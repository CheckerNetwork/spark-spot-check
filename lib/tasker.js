/* global Zinnia */

import { MERIDIAN_CONTRACT } from './constants.js'
import { assertOkResponse } from './http-assertions.js'
import { assertEquals, assertInstanceOf } from 'zinnia:assert'

/** @typedef {{cid: string; minerId: string;}} RetrievalTask */

export class Tasker {
  /** @type {Task[]} */
  #fetch

  /**
       * @param {object} args
       * @param {globalThis.fetch} args.fetch
       * @param {number} args.numTasks
       */
  constructor ({
    fetch = globalThis.fetch
  } = {}) {
    this.#fetch = fetch
  }

  /**
      * @param {object} args
      * @param {number} args.roundNum
      * @param {number} args.numTasks
      * @param {string} args.minerId
      * @returns {Promise<RetrievalTask[] | undefined>}
      */
  async getRetrievalTasks ({ roundNum, numTasks, minerId }) {
    let url = 'https://api.filspark.com/rounds/current'
    // if round number is given fetch given round
    if (roundNum > 0) {
      url = `https://api.filspark.com/rounds/meridian/${MERIDIAN_CONTRACT}/${roundNum}`
    }

    console.log('Fetching SPARK round at location %s', url)
    const res = await this.#fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000)
    })

    await assertOkResponse(res, 'Failed to fetch the current SPARK round')
    const { retrievalTasks, ...round } = await res.json()
    console.log('Current SPARK round:', round)
    console.log('  %s retrieval tasks', retrievalTasks.length)

    // filter retrievalTasks for miner if minerId is defined
    let tasks = retrievalTasks
    if (minerId) {
      tasks = retrievalTasks.filter((t) => t.minerId === minerId)
    }

    return await pickRandomTasks({
      tasks,
      numTasks
    })
  }
}

/**
 * @param {object} args
 * @param {Task[]} args.tasks
 * @param {number} args.numTasks
 * @returns {Promise<Task[]>}
 */
export async function pickRandomTasks ({ tasks, numTasks }) {
  assertInstanceOf(tasks, Array, 'tasks must be an array')
  assertEquals(typeof numTasks, 'number', 'numTasks must be a number')

  tasks.sort(() => Math.random() - 0.5)
  tasks.splice(numTasks)

  return tasks
}
