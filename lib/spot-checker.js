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
import { validateHttpMultiaddr } from './multiaddr.js'

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
   * @param {number} [args.maxByteLength]
   * */
  async executeSpotCheck ({ task, stats, maxByteLength }) {
    console.log(
      `Calling Filecoin JSON-RPC to get PeerId of miner ${task.minerId}`
    )
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
        console.error(
          'The error printed below was not expected, please report it on GitHub:'
        )
        console.error('https://github.com/filecoin-station/spark/issues/new')
      }
      // Abort the check, no measurement should be recorded
      throw err
    }

    console.log(`Querying IPNI to find retrieval providers for ${task.cid}`)
    const { indexerResult, provider } = await queryTheIndex(
      task.cid,
      stats.providerId
    )
    stats.indexerResult = indexerResult

    const providerFound =
      indexerResult === 'OK' || indexerResult === 'HTTP_NOT_ADVERTISED'
    if (!providerFound) return

    stats.protocol = provider.protocol
    stats.providerAddress = provider.address

    await this.fetchCAR({
      protocol: provider.protocol,
      address: provider.address,
      cid: task.cid,
      dagScope: 'block',
      stats: stats.blockRetrieval
    })

    await this.fetchCAR({
      protocol: provider.protocol,
      address: provider.address,
      cid: task.cid,
      dagScope: 'all',
      stats: stats.fullRetrieval,
      maxByteLength
    })
  }

  /**
   * @param {object} args
   * @param {RetrievalProtocol} args.protocol
   * @param {string} args.address
   * @param {string} args.cid
   * @param {object} args.stats
   * @param {'all' | 'block'} args.dagScope
   * @param {number} [args.maxByteLength]
   * */
  async fetchCAR ({ protocol, address, cid, stats, dagScope, maxByteLength }) {
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
      const url = getRetrievalUrl({ protocol, address, cid, dagScope })
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
          if (maxByteLength !== undefined && stats.byteLength > maxByteLength) {
            console.log('reached max, breaking')
            break
          }
          resetTimeout()
        }
      } else {
        console.error('Retrieval failed with status code %s: %s', res.status, (await res.text()).trimEnd())
      }
    } catch (err) {
      console.error(`Failed to fetch ${cid} from ${address} using ${protocol}`)
      if (!stats.statusCode || stats.statusCode === 200) {
        stats.statusCode = mapErrorToStatusCode(err)
      }
    } finally {
      clearTimeout(timeout)
      console.log(stats, dagScope)
    }
  }

  /**
   * @param {RetrievalTask} task
   * @param {number} [maxByteLength]
   * */
  async spotCheck (task, maxByteLength) {
    const stats = newStats()
    await this.executeSpotCheck({ task, stats, maxByteLength })

    Zinnia.jobCompleted()
    return stats
  }

  /**
   * Performs spot checks on retrieval tasks, either from a specified round or using provided tasks.
   *
   * @param {object} args
   * @param {number} args.roundId - Round ID to fetch tasks from (ignored if retrievalTasks is provided)
   * @param {number} [args.maxTasks] - Optional maximum number of tasks to spot check (we check all tasks if not provided)
   * @param {RetrievalTask[]} [args.retrievalTasks] - Optional array of retrieval tasks to check instead of fetching from a round
   * @param {string} [args.minerId] - Optional miner ID to filter tasks by
   * @param {number} [args.maxByteLength] - Optional maximum bytes to download before stopping retrieval
   * */
  async run ({ roundId, maxTasks, retrievalTasks, minerId, maxByteLength }) {
    const results = []
    if (!retrievalTasks.length) {
      retrievalTasks = await this.#tasker.getRetrievalTasks({
        roundId,
        maxTasks,
        minerId
      })
    }

    if (!retrievalTasks.length) {
      console.error('Exiting, no retrieval tasks to perform spot check on...')
      return
    }

    for (const task of retrievalTasks) {
      try {
        const result = await this.spotCheck(task, maxByteLength)
        results.push({ task, result })
      } catch (err) {
        console.error(err)
      }
    }

    console.log('Results:')
    console.log(JSON.stringify(results, 0, 2))
  }
}

export function newStats () {
  return {
    providerId: null,
    indexerResult: null,
    protocol: null,
    providerAddress: null,
    blockRetrieval: {
      timeout: false,
      byteLength: 0,
      statusCode: null
    },
    fullRetrieval: {
      timeout: false,
      byteLength: 0,
      statusCode: null
    }
  }
}

/**
 * @param {object} args
 * @param {RetrievalProtocol} args.protocol
 * @param {string} args.address
 * @param {string} args.cid
 * @param {'all' | 'block'} dagScope
 * @returns {string}
 * @throws Will throw an error if invalid mutliaddr is supplied for http retrieval
 * */
export function getRetrievalUrl ({ protocol, address, cid, dagScope }) {
  if (protocol === 'http') {
    validateHttpMultiaddr(address)
  }

  const searchParams = new URLSearchParams({
    'dag-scope': dagScope,
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
  } else if (err.message.includes('Invalid CAR header format')) {
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
