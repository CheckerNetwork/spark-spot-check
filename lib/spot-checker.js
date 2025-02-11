/* global Zinnia */

import { queryTheIndex } from './ipni-client.js'
import { getMinerPeerId as defaultGetMinerPeerId } from './miner-info.js'
import { Tasker } from './tasker.js'

import {
  CarBlockIterator,
  HashMismatchError,
  UnsupportedHashError,
  validateBlock
} from '../vendor/deno-deps.js'

/** @import {RetrievalTask} from './tasker.js' */
/** @typedef {'all' | 'block' | 'entity'} DagScope */
/** @typedef {'bitswap' | 'graphsync' | 'http'} RetrievalProtocol */
/** @typedef {`${number}:${number | '*'}`} EntityBytesRange */

export default class SpotChecker {
  #fetch
  #getMinerPeerId
  #tasker

  constructor ({
    fetch = globalThis.fetch,
    getMinerPeerId = defaultGetMinerPeerId
  } = {}) {
    this.#fetch = fetch
    this.#getMinerPeerId = getMinerPeerId
    this.#tasker = new Tasker({ fetch: this.#fetch })
  }

  /**
           *
           * @param {object} args
           * @param {RetrievalTask} args.task
           * @param {object} args.stats
           * */
  async executeSpotCheck ({ task, stats }) {
    console.log(`Calling Filecoin JSON-RPC to get PeerId of miner ${task.minerId}`)
    try {
      const peerId = await this.#getMinerPeerId(task.minerId)
      console.log(`Found peer id: ${peerId}`)
      stats.providerId = peerId
    } catch (err) {
      // There are three common error cases:
      //  1. We are offline
      //  2. The JSON RPC provider is down
      //  3. JSON RPC errors like when Miner ID is not a known actor
      // There isn't much we can do in the first two cases. We can notify the user that we are not
      // performing any jobs and wait until the problem is resolved.
      // The third case should not happen unless we made a mistake, so we want to learn about it
      if (err.name === 'FilecoinRpcError') {
        // TODO: report the error to Sentry
        console.error('The error printed below was not expected, please report it on GitHub:')
        console.error('https://github.com/filecoin-station/spark/issues/new')
      }
      // Abort the check, no measurement should be recorded
      throw err
    }

    console.log(`Querying IPNI to find retrieval providers for ${task.cid}`)
    const { indexerResult, provider } = await queryTheIndex(task.cid, stats.providerId)
    stats.indexerResult = indexerResult

    const providerFound = indexerResult === 'OK' || indexerResult === 'HTTP_NOT_ADVERTISED'
    if (!providerFound) return

    stats.protocol = provider.protocol
    stats.providerAddress = provider.address

    await this.fetchCAR({
      protocol: provider.protocol,
      address: provider.address,
      cid: task.cid,
      stats
    })
  }

  /**
           * @param {object} args
           * @param {RetrievalProtocol} args.protocol
           * @param {string} args.address
           * @param {string} args.cid
           * @param {object} args.stats
           * */
  async fetchCAR ({ protocol, address, cid, stats }) {
    // Abort if no progress was made for 60 seconds
    const controller = new AbortController()
    const { signal } = controller
    let timeout
    const resetTimeout = () => {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        stats.timeout = true
        controller.abort()
      }, 60_000)
    }

    try {
      const url = getRetrievalUrl({ protocol, address, cid })
      console.log(`Fetching: ${url}`)

      resetTimeout()
      const res = await this.#fetch(url, { signal })
      stats.statusCode = res.status

      if (res.ok) {
        resetTimeout()
        const reader = await CarBlockIterator.fromIterable(res.body)
        for await (const block of reader) {
          stats.byteLength += block.bytes.length
          await validateBlock(block)
        }
      } else {
        console.error('Retrieval failed with status code %s: %s',
          res.status, (await res.text()).trimEnd())
      }
    } catch (err) {
      console.error(`Failed to fetch ${cid} from ${address} using ${protocol}`)
      console.error(err)
      if (!stats.statusCode || stats.statusCode === 200) {
        stats.statusCode = mapErrorToStatusCode(err)
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
           * @param {RetrievalTask} task
           * */
  async spotCheck (task) {
    const stats = newStats()
    await this.executeSpotCheck({ task, stats })

    Zinnia.jobCompleted()
    return stats
  }

  /**
           *
           * Fetches retrieval tasks for given round, or uses supplied retrieval tasks and performs spot check.
           *
           * @param {object} args
           * @param {number} args.roundId Id of specific round you want to fetch tasks for. Will be ignored if `retrievalTasks` is supplied
           * @param {number} args.maxTasks Maximum number of tasks you want to perform spot check on
           * @param {RetrievalTask[]} [args.retrievalTasks] Retrieval tasks to check. If supplied tasks for given round won't be fetched
           * @param {string} [args.minerId] Id of specific miner you want to filter tasks for
           * */
  async run ({ roundId, maxTasks, retrievalTasks, minerId }) {
    const results = []
    if (!retrievalTasks.length > 0) {
      retrievalTasks = await this.#tasker.getRetrievalTasks({ roundId, maxTasks, minerId })
    }

    for (const task of retrievalTasks) {
      try {
        const result = await this.spotCheck(task)
        results.push({ task, result })
      } catch (err) {
        console.error(err)
      }
    }

    console.log('Results:')
    console.log(JSON.stringify(results, 0, 2))
  }

  handleRunError (err) {
    console.error(err)
  }
}

export function newStats () {
  return {
    timeout: false,
    byteLength: 0,
    carChecksum: null,
    statusCode: null,
    carTooLarge: false
  }
}

/**
 * @param {object} args
 * @param {RetrievalProtocol} args.protocol
 * @param {string} args.address
 * @param {string} args.cid
 * @returns {string}
 * */
export function getRetrievalUrl ({ protocol, address, cid }) {
  const searchParams = new URLSearchParams({
    'dag-scope': 'all',
    protocols: protocol,
    providers: address
  })

  return `ipfs://${cid}?${searchParams.toString()}`
}

function mapErrorToStatusCode (err) {
  // 7xx codes for multiaddr parsing errors
  switch (err.code) {
    case 'UNSUPPORTED_MULTIADDR_HOST_TYPE':
      return 701
    case 'UNSUPPORTED_MULTIADDR_PROTO':
      return 702
    case 'UNSUPPORTED_MULTIADDR_SCHEME':
      return 703
    case 'MULTIADDR_HAS_TOO_MANY_PARTS':
      return 704
  }

  // 9xx for content verification errors
  if (err instanceof UnsupportedHashError) {
    return 901
  } else if (err instanceof HashMismatchError) {
    return 902
  } else if (err.code === 'UNEXPECTED_CAR_BLOCK') {
    return 903
  } else if (err.code === 'CANNOT_PARSE_CAR_BYTES') {
    return 904
  }

  // 8xx errors for network connection errors
  // Unfortunately, the Fetch API does not support programmatic detection of various error
  // conditions. We have to check the error message text.
  if (err.message.includes('dns error')) {
    return 801
  } else if (err.message.includes('tcp connect error')) {
    return 802
  }

  // Fallback code for unknown errors
  return 600
}
