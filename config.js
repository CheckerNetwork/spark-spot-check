/**
 * Configuration options:
 * - roundNum: Specifies which round to analyze
 *   Default: undefined (uses current round)
 *
 * - maxTasks: Limits the number of tasks to process
 *   Default: undefined (processes all tasks)
 *
 * - minerId: Focuses spot check on a specific storage provider
 *   Default: undefined (spot checks all miners)
 *
 * - maxByteLength: Sets a size limit for single spot check data retrieval
 *   Default: undefined (no size limit)
 *
 * - retrievalTasks: Array of tasks to execute retrievals
 *   Structure: [
 *     {
 *       minerId: '123',           // Storage provider ID to retrieve from
 *       cid: 'bafy...',           // CID of the data to retrieve
 *     }
 *   ]
 *   Default: [] (tasks will be loaded from network)
 */
export const roundId = undefined
export const maxTasks = undefined
export const minerId = undefined
export const maxByteLength = undefined
export const retrievalTasks = []
