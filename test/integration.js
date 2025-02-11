import SpotChecker from '../lib/spot-checker.js'
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
  const stats = { ...task, indexerResult: null, statusCode: null, byteLength: 0 }
  await spark.executeSpotCheck({ task, stats })

  assertEquals(stats.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.indexerResult, 'OK', 'stats.indexerResult')
  assertEquals(stats.byteLength, 200, 'stats.byteLength')
  assertEquals(stats.carChecksum, '122069f03061f7ad4c14a5691b7e96d3ddd109023a6539a0b4230ea3dc92050e7136', 'stats.carChecksum')
})
