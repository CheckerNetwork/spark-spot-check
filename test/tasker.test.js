/* global Zinnia */

import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { pickRandomTasks } from '../lib/tasker.js'

test('pickRandomTasks', async () => {
  const allTasks = [
    { cid: 'bafyone', minerId: 'f010' },
    { cid: 'bafyone', minerId: 'f020' },
    { cid: 'bafyone', minerId: 'f030' },
    { cid: 'bafyone', minerId: 'f040' },

    { cid: 'bafytwo', minerId: 'f010' },
    { cid: 'bafytwo', minerId: 'f020' },
    { cid: 'bafytwo', minerId: 'f030' },
    { cid: 'bafytwo', minerId: 'f040' }
  ]

  const selectedTasks = await pickRandomTasks({
    tasks: allTasks,
    numTasks: 3
  })

  assertEquals(selectedTasks.length, 3)
})
