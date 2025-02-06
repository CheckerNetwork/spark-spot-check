import SpotChecker from './lib/spot-checker.js'

const roundNum = -1
const numTasks = 50

const checker = new SpotChecker()
await checker.run({ roundNum, numTasks })
