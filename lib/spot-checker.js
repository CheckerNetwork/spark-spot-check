/* global Zinnia */

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
import { MAX_CAR_SIZE } from './constants.js'


/** @typedef {'all' | 'block' | 'entity'} DagScope */
/** @typedef {'bitswap' | 'graphsync' | 'http'} RetrievalProtocol */
/** @typedef {`${number}:${number | '*'}`} EntityBytesRange */

export default class SpotChecker {
  #fetch
  #getMinerPeerId
  #tasker

  constructor({
    fetch = globalThis.fetch,
    getMinerPeerId = defaultGetMinerPeerId
  } = {}) {
    this.#fetch = fetch
    this.#getMinerPeerId = getMinerPeerId
    this.#tasker = new Tasker({ fetch: this.#fetch })
  }

  async executeSpotCheck({ retrieval, stats, dagScope, entityBytesRange }) {
    console.log(`Calling Filecoin JSON-RPC to get PeerId of miner ${retrieval.minerId}`)
    try {
      const peerId = await this.#getMinerPeerId(retrieval.minerId)
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

    console.log(`Querying IPNI to find retrieval providers for ${retrieval.cid}`)
    const { indexerResult, provider } = await queryTheIndex(retrieval.cid, stats.providerId)
    stats.indexerResult = indexerResult

    const providerFound = indexerResult === 'OK' || indexerResult === 'HTTP_NOT_ADVERTISED'
    if (!providerFound) return

    stats.protocol = provider.protocol
    stats.providerAddress = provider.address

    await this.fetchCAR({
      protocol: provider.protocol,
      address: provider.address,
      cid: retrieval.cid,
      stats: stats,
      dagScope: dagScope,
      entityBytesRange: entityBytesRange
    })
  }

  async fetchCAR({ protocol, address, cid, stats, dagScope, entityBytesRange }) {
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

    stats.startAt = new Date()

    try {
      const url = getRetrievalUrl({ protocol, address, cid, dagScope, entityBytesRange })
      console.log(`Fetching: ${url}`)

      resetTimeout()
      const res = await this.#fetch(url, { signal })
      stats.statusCode = res.status

      if (res.ok) {
        resetTimeout()
        for await (const value of res.body) {
          if (stats.firstByteAt === null) {
            stats.firstByteAt = new Date()
          }
          stats.byteLength += value.byteLength

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

    stats.endAt = new Date()
  }

  async spotCheck(retrieval, dagScope, entityBytesRange) {
    const stats = newStats()
    await this.executeSpotCheck({ retrieval, stats, dagScope, entityBytesRange })

    Zinnia.jobCompleted()
    return stats
  }

  async run({ roundNum, maxTasks, minerId, dagScope = 'entity', entityBytesRange = '0:200' }) {
    const results = []
    const retrievalTasks = await this.#tasker.getRetrievalTasks({ roundNum, maxTasks, minerId, entityBytesRange })
    for (const retrieval of retrievalTasks) {
      console.log(retrieval)
      try {
        const result = await this.spotCheck(retrieval, dagScope)
        results.push({ retrieval, result })
      } catch (err) {
        console.error(err)
      }
    }

    console.log(JSON.stringify(results, 0, 2))
  }

  handleRunError(err) {
    console.error(err)
  }
}

export function newStats() {
  return {
    timeout: false,
    startAt: null,
    firstByteAt: null,
    endAt: null,
    byteLength: 0,
    carChecksum: null,
    statusCode: null
  }
}

/**
*
* @param {object} args
* @param {RetrievalProtocol} args.protocol
* @param {string} args.address
* @param {string} args.cid
* @param {DagScope} args.dagScope
* @param {EntityBytesRange} args.entityBytesRange
* @returns {string}
*/
export function getRetrievalUrl({ protocol, address, cid, dagScope, entityBytesRange }) {
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
async function verifyContent(cid, carBytes) {
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

function mapErrorToStatusCode(err) {
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
