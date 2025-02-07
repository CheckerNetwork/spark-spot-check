import SpotChecker from './lib/spot-checker.js'

const roundNum = -1 // current
const maxTasks = -1 // all tasks
const dagScope = 'entity'
const entityBytesRange = '0:200' // fetch first 200 mb of the file
const minerId = undefined // by default do not filter for specific miner tasks

const checker = new SpotChecker()
await checker.run({ roundNum, maxTasks, minerId, dagScope, entityBytesRange })
