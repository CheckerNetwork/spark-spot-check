/* global Zinnia */

import { MERIDIAN_CONTRACT, SPARK_BASE_URL } from './constants.js'
import { assertOkResponse } from './http-assertions.js'
import { assertEquals, assertInstanceOf } from 'zinnia:assert'

/** @typedef {{cid: string; minerId: string;}} RetrievalTask */

export class Tasker {
  /** @type {Task[]} */
  #fetch

  /**
     * @param {object} args
     * @param {globalThis.fetch} args.fetch
    */
  constructor ({
    fetch = globalThis.fetch
  } = {}) {
    this.#fetch = fetch
  }

  /**
    * @param {object} args
    * @param {number} args.roundNum
    * @param {string} args.minerId
    * @param {number} args.maxTasks
    * @returns {Promise<RetrievalTask[] | undefined>}
    */
  async getRetrievalTasks ({ roundNum, minerId, maxTasks = 0 }) {
    const url = this.#getRoundUrl(roundNum)
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

    return pickTasks({ tasks: retrievalTasks, minerId, maxTasks })
  }

  /**
    * @param {number} roundNum
    * @returns {string}
    */
  #getRoundUrl (roundNum) {
    if (roundNum > 0) {
      return `${SPARK_BASE_URL}/rounds/meridian/${MERIDIAN_CONTRACT}/${roundNum}`
    }

    return `${SPARK_BASE_URL}/rounds/current`
  }
}

/**
 * @param {object} args
 * @param {RetrievalTask[]} args.tasks
 * @param {string} args.minerId
 * @param {number} args.maxTasks
 * @returns {Promise<RetrievalTask[]>}
 */
export async function pickTasks ({ tasks, minerId, maxTasks }) {
  assertInstanceOf(tasks, Array, 'tasks must be an array')
  assertEquals(typeof maxTasks, 'number', 'maxTasks must be a number')

  if (minerId) {
    tasks = tasks.filter((t) => t.minerId === minerId)
  }

  if (maxTasks > 0) {
    tasks.splice(maxTasks)
  }

  return tasks
}
