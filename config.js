/**
 * Configuration options:
 * - roundNum: Specifies which round to analyze
 *   Default: -1 (uses current round)
 *
 * - maxTasks: Limits the number of tasks to process
 *   Default: -1 (processes all tasks)
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
export const roundId = -1
export const maxTasks = -1
export const minerId = undefined
export const maxByteLength = undefined
export const retrievalTasks = []
