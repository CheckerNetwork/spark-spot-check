import SpotChecker, { newStats } from '../lib/spot-checker.js'
import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { getMinerPeerId as defaultGetMinerPeerId } from '../lib/miner-info.js'

test('can execute spot check for our CID', async () => {
  // The task to check, replace with your own values
  const task = {
    cid: 'bafkreih25dih6ug3xtj73vswccw423b56ilrwmnos4cbwhrceudopdp5sq',
    minerId: 'f0frisbii'
  }

  const getMinerPeerId = (minerId) =>
    minerId === 'f0frisbii'
      ? '12D3KooWC8gXxg9LoJ9h3hy3jzBkEAxamyHEQJKtRmAuBuvoMzpr'
      : defaultGetMinerPeerId(minerId)

  // Run the check
  const spark = new SpotChecker({ getMinerPeerId })
  const stats = { ...task, ...newStats() }
  await spark.executeSpotCheck({ task, stats })

  assertEquals(stats.indexerResult, 'OK', 'stats.indexerResult')
  assertEquals(stats.fullRetrieval.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.fullRetrieval.byteLength, 103, 'stats.byteLength')
  assertEquals(stats.blockRetrieval.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.byteLength, 103, 'stats.byteLength')
})
