//
// Usage:
// zinnia run main.js
//
// roundNum = -1 for current round by default; adjust to your desired round number
// maxTasks = -1 for all tasks by default; adjust to the desired number of tasks you want to run
// minerId = undefined by default; set to miner id if you want to spot check specific miner (storage provider)
//

import SpotChecker from './lib/spot-checker.js'
import { getMinerPeerId as defaultGetMinerPeerId } from './lib/miner-info.js'

const roundId = -1 // current
const maxTasks = -1 // all tasks
const minerId = undefined // by default do not filter for specific miner tasks

const getMinerPeerId = (minerId) =>
  minerId === 'f0frisbii'
    ? '12D3KooWC8gXxg9LoJ9h3hy3jzBkEAxamyHEQJKtRmAuBuvoMzpr'
    : defaultGetMinerPeerId(minerId)

const retrievalTasks = []

// If you want to test specific task / miner
// you can add tasks to retrievalTasks array
const task = {
  cid: 'bafybeiepi56qxfcwqgpstg25r6sonig7y3pzd37lwambzmlcmbnujjri4a',
  minerId: 'f010479'
}

retrievalTasks.push(task)

const checker = new SpotChecker({ getMinerPeerId })
await checker.run({ roundId, maxTasks, retrievalTasks, minerId })
