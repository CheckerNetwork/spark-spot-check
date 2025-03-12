import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { pickTasks, Tasker } from '../lib/tasker.js'
import { MERIDIAN_CONTRACT } from '../lib/constants.js'

test('get retrieval tasks', async () => {
  const round = {
    roundId: '123',
    startEpoch: 4111111,
    maxTasksPerNode: 1,
    retrievalTasks: [
      {
        cid: 'bafkreidysaugf7iuvemebpzwxxas5rctbyiryykagup2ygkojmx7ag64gy',
        minerId: 'f010'
      },
      {
        cid: 'QmUMpWycKJ7GUDJp9GBRX4qWUFUePUmHzri9Tm1CQHEzbJ',
        minerId: 'f020'
      }
    ]
  }

  const fetch = async (url, allOpts) => {
    const { signal, ...opts } = allOpts
    requests.push({ url, opts })
    return {
      status: 200,
      ok: true,
      async json () {
        return round
      }
    }
  }

  const requests = []
  const tasker = new Tasker({ fetch })
  await tasker.getRetrievalTasks({})
  assertEquals(requests, [
    {
      url: 'https://api.filspark.com/rounds/current',
      opts: {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    }
  ])
  requests.splice(0) // clear requests array

  await tasker.getRetrievalTasks({ roundId: 123 })
  assertEquals(requests, [
    {
      url: `https://api.filspark.com/rounds/meridian/${MERIDIAN_CONTRACT}/123`,
      opts: {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    }
  ])
})

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
