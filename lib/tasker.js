/* global Zinnia */

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
    * @returns {Promise<Task[] | undefined>}
    */
  async getRetrievalTasks ({ roundNum, numTasks }) {
    console.log('Checking the current SPARK round...')
    let res = await this.#fetch('https://api.filspark.com/rounds/current', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000)
    })

    let roundUrl = res.url
    if (roundNum > 0) {
      roundUrl = replaceRoundNumber(roundUrl, roundNum)
      console.log('Fetching round details at location %s', roundUrl)
      res = await this.#fetch(roundUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000)
      })

      await assertOkResponse(res, 'Failed to fetch the current SPARK round')
    }

    const { retrievalTasks, ...round } = await res.json()
    console.log('Current SPARK round:', round)
    console.log('  %s retrieval tasks', retrievalTasks.length)

    return await pickRandomTasks({
      tasks: retrievalTasks,
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

function replaceRoundNumber (roundUrl, roundNum) {
  const parts = roundUrl.split('/')
  parts[parts.length - 1] = roundNum
  return parts.join('/')
}
