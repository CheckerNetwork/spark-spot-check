import SpotChecker from './lib/spot-checker.js'
import { getMinerPeerId as defaultGetMinerPeerId } from './lib/miner-info.js'
import { roundId, maxTasks, minerId, maxByteLength, retrievalTasks } from './config.js'

/**
 * Checks data accessibility by performing complete retrievals from storage providers.
 * This validation ensures that stored data can be successfully accessed and downloaded.
 *
 * Usage:
 * zinnia run main.js
 *
 * Configuration options can be found in config.js
 *
 */
const getMinerPeerId = (minerId) =>
  minerId === 'f0frisbii'
    ? '12D3KooWC8gXxg9LoJ9h3hy3jzBkEAxamyHEQJKtRmAuBuvoMzpr'
    : defaultGetMinerPeerId(minerId)

const checker = new SpotChecker({ getMinerPeerId })
await checker.run({ roundId, maxTasks, retrievalTasks, minerId, maxByteLength })
