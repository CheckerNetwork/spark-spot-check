/* global Zinnia */

import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { pickTasks } from '../lib/tasker.js'

test('pickTasks - no miner or limit specified', async () => {
  const tasks = givenTasks()
  const selectedTasks = await pickTasks({
    tasks,
    maxTasks: -1
  })

  assertEquals(selectedTasks, tasks)
})

test('pickTasks - miner f010', async () => {
  const tasks = givenTasks()
  const selectedTasks = await pickTasks({
    tasks,
    minerId: 'f010',
    maxTasks: -1
  })

  assertEquals(selectedTasks, [
    { cid: 'bafyone', minerId: 'f010' },
    { cid: 'bafytwo', minerId: 'f010' }
  ])
})

test('pickTasks - miner f010 and limit 1', async () => {
  const tasks = givenTasks()
  const selectedTasks = await pickTasks({
    tasks,
    minerId: 'f010',
    maxTasks: 1
  })

  assertEquals(selectedTasks, [
    { cid: 'bafyone', minerId: 'f010' }
  ])
})

test('pickTasks - limit 3', async () => {
  const tasks = givenTasks()
  const selectedTasks = await pickTasks({
    tasks,
    maxTasks: 3
  })

  assertEquals(selectedTasks, [
    { cid: 'bafyone', minerId: 'f010' },
    { cid: 'bafyone', minerId: 'f020' },
    { cid: 'bafyone', minerId: 'f030' }
  ])
})

function givenTasks () {
  return [
    { cid: 'bafyone', minerId: 'f010' },
    { cid: 'bafyone', minerId: 'f020' },
    { cid: 'bafyone', minerId: 'f030' },
    { cid: 'bafyone', minerId: 'f040' },

    { cid: 'bafytwo', minerId: 'f010' },
    { cid: 'bafytwo', minerId: 'f020' },
    { cid: 'bafytwo', minerId: 'f030' },
    { cid: 'bafytwo', minerId: 'f040' }
  ]
}
