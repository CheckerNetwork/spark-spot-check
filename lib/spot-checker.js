/* global Zinnia */

import { MAX_CAR_SIZE } from './constants.js'
import { queryTheIndex } from './ipni-client.js'
import { getMinerPeerId as defaultGetMinerPeerId } from './miner-info.js'
import { multiaddrToHttpUrl } from './multiaddr.js'
import { Tasker } from './tasker.js'

import {
  CarBlockIterator,
  encodeHex,
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
   * @param {DagScope} args.dagScope
   * @param {EntityBytesRange} args.entityBytesRange
   * */
  async executeSpotCheck ({ task, stats, dagScope, entityBytesRange }) {
    console.log(`task ${task}`)
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
      stats,
      dagScope,
      entityBytesRange
    })
  }

  /**
   * @param {object} args
   * @param {RetrievalProtocol} args.protocol
   * @param {string} args.address
   * @param {string} args.cid
   * @param {object} args.stats
   * @param {DagScope} args.dagScope
   * @param {EntityBytesRange} args.entityBytesRange
   * */
  async fetchCAR ({ protocol, address, cid, stats, dagScope, entityBytesRange }) {
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

    // WebCrypto API does not support streams yet, the hashing function requires entire data
    // to be provided at once. See https://github.com/w3c/webcrypto/issues/73
    const carBuffer = new ArrayBuffer(0, { maxByteLength: MAX_CAR_SIZE })
    const carBytes = new Uint8Array(carBuffer)

    try {
      const url = getRetrievalUrl({ protocol, address, cid, dagScope, entityBytesRange })
      console.log(`Fetching: ${url}`)

      resetTimeout()
      const res = await this.#fetch(url, { signal })
      stats.statusCode = res.status

      if (res.ok) {
        resetTimeout()
        for await (const value of res.body) {
          stats.byteLength += value.byteLength

          // We want to limit how large content we are willing to download.
          // 1. To make sure we don't spend too much time (and network bandwidth) on a single task,
          //    so that we can complete more tasks per round
          // 2. Until we have streaming hashes, we need to keep the entire payload in memory, and so
          //    we need to put an upper limit on how much memory we consume.
          if (stats.byteLength > MAX_CAR_SIZE) {
            stats.carTooLarge = true
            break
          }

          const offset = carBuffer.byteLength
          carBuffer.resize(offset + value.byteLength)
          carBytes.set(value, offset)

          resetTimeout()
        }

        await verifyContent(cid, carBytes)
        const digest = await crypto.subtle.digest('sha-256', carBytes)
        // 12 is the code for sha2-256
        // 20 is the digest length (32 bytes = 256 bits)
        stats.carChecksum = '1220' + encodeHex(digest)
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
   * @param {DagScope} dagScope
   * @param {EntityBytesRange} [entityBytesRange]
   * */
  async spotCheck (task, dagScope, entityBytesRange) {
    const stats = newStats()
    await this.executeSpotCheck({ task, stats, dagScope, entityBytesRange })

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
   * @param {DagScope} [args.dagScope='entity']
   * @param {EntityBytesRange} [args.entityBytesRange]
   * */
  async run ({ roundId, maxTasks, retrievalTasks, minerId, dagScope = 'entity', entityBytesRange }) {
    const results = []
    if (!retrievalTasks.length > 0) {
      retrievalTasks = await this.#tasker.getRetrievalTasks({ roundId, maxTasks, minerId })
    }

    for (const task of retrievalTasks) {
      try {
        const result = await this.spotCheck(task, dagScope, entityBytesRange)
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
 *
 * @param {object} args
 * @param {RetrievalProtocol} args.protocol
 * @param {string} args.address
 * @param {string} args.cid
 * @param {DagScope} args.dagScope
 * @param {EntityBytesRange} [args.entityBytesRange]
 * @returns {string}
 * */
export function getRetrievalUrl ({ protocol, address, cid, dagScope, entityBytesRange }) {
  if (protocol === 'http') {
    const baseUrl = multiaddrToHttpUrl(address)
    const url = `${baseUrl}/ipfs/${cid}?dag-scope=${dagScope}`

    if (dagScope === 'entity') {
      // TODO: Randomise entity bytes range
      return `${url}&entity-bytes=${entityBytesRange}`
    }

    return url
  }

  const searchParams = new URLSearchParams({
    // See https://github.com/filecoin-project/lassie/blob/main/docs/HTTP_SPEC.md#dag-scope-request-query-parameter
    // Only the root block at the end of the path is returned after blocks required to verify the specified path segments.
    'dag-scope': dagScope,
    protocols: protocol,
    providers: address
  })

  if (dagScope === 'entity') {
    searchParams.append('entity-bytes', entityBytesRange)
  }

  return `ipfs://${cid}?${searchParams.toString()}`
}

/**
 * @param {string} cid
 * @param {Uint8Array} carBytes
 */
async function verifyContent (cid, carBytes) {
  let reader
  try {
    reader = await CarBlockIterator.fromBytes(carBytes)
  } catch (err) {
    throw Object.assign(err, { code: 'CANNOT_PARSE_CAR_BYTES' })
  }

  for await (const block of reader) {
    if (block.cid.toString() !== cid.toString()) {
      throw Object.assign(
        new Error(`Unexpected block CID ${block.cid}. Expected: ${cid}`),
        { code: 'UNEXPECTED_CAR_BLOCK' }
      )
    }

    await validateBlock(block)
  }
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
