import SpotChecker from './lib/spark.js'


const roundNum = -1
const numTasks = 10

const checker = new SpotChecker()
await checker.run({ roundNum, numTasks })
