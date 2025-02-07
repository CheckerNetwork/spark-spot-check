//
// Usage:
// zinnia run main.js
//
// roundNum = -1 for current round by default; adjust to your desired round number
// maxTasks = -1 for all tasks by default; adjust to the desired number of tasks you want to run
// dagScope = all, block, entity; by default set to entity (retrieves byte range)
// minerId = undefined by default; set to miner id if you want to spot check specific miner (storage provider)
//

import SpotChecker from './lib/spot-checker.js'

const roundNum = -1 // current
const maxTasks = -1 // all tasks
const dagScope = 'entity'
const entityBytesRange = '0:200' // fetch first 200 mb of the file
const minerId = undefined // by default do not filter for specific miner tasks

const checker = new SpotChecker()
await checker.run({ roundNum, maxTasks, minerId, dagScope, entityBytesRange })
