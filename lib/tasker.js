/* global Zinnia */

import { assertOkResponse, assertRedirectResponse } from './http-assertions.js'
import { assertEquals, assertInstanceOf } from 'zinnia:assert'

/** @typedef {{cid: string; minerId: string;}} RetrievalTask */

export class Tasker {
  #lastRoundUrl
  /** @type {Task[]} */
  #remainingRoundTasks
  #fetch

  /**
   * @param {object} args
   * @param {globalThis.fetch} args.fetch
   * @param {number} args.numTasks
   */
  constructor ({
    fetch = globalThis.fetch,
    numTasks = 10
  } = {}) {
    this.#fetch = fetch

    this.numTasks = numTasks

    // TODO: persist these two values across module restarts
    // Without persistence, after the Spark module is restarted, it will start executing the same
    // retrieval tasks we have already executed
    this.#lastRoundUrl = 'unknown'
    this.#remainingRoundTasks = []
  }

  /**
   * @returns {Task | undefined}
   */
  async next () {
    await this.#updateCurrentRound()
    return this.#remainingRoundTasks.pop()
  }

  async #updateCurrentRound () {
    console.log('Checking the current SPARK round...')
    let res = await this.#fetch('https://api.filspark.com/rounds/current', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000)
    })

    await assertRedirectResponse(res, 'Failed to find the URL of the current SPARK round')
    const roundUrl = res.headers.get('location')
    if (roundUrl === this.#lastRoundUrl) {
      console.log('Round did not change since the last iteration')
      return
    }

    console.log('Fetching round details at location %s', roundUrl)
    res = await this.#fetch(`https://api.filspark.com${roundUrl}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000)
    })
    await assertOkResponse(res, 'Failed to fetch the current SPARK round')
    const { retrievalTasks, maxTasksPerNode, ...round } = await res.json()
    console.log('Current SPARK round:', round)
    console.log('  %s max tasks per round', maxTasksPerNode ?? '<n/a>')
    console.log('  %s retrieval tasks', retrievalTasks.length)
    this.maxTasksPerRound = maxTasksPerNode

    this.#remainingRoundTasks = await pickTasksForNode({
      tasks: retrievalTasks,
      numTasks: this.numTasks,
    })

    this.#lastRoundUrl = roundUrl
  }
}

/**
 * @param {object} args
 * @param {Task[]} args.tasks
 * @param {number} args.numTasks
 * @returns {Promise<Task[]>}
 */
export async function pickTasksForNode ({ tasks, numTasks }) {
  assertInstanceOf(tasks, Array, 'tasks must be an array')
  assertEquals(typeof numTasks, 'number', 'numTasks must be a number')

  tasks.sort(() => Math.random() - 0.5)
  tasks.splice(numTasks)

  return tasks
}
