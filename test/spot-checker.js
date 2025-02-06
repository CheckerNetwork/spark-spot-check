/* global Zinnia */

import SpotChecker, { newStats } from '../lib/spot-checker.js'
import { test } from 'zinnia:test'
import { assertInstanceOf, assertEquals } from 'zinnia:assert'

const KNOWN_CID = 'bafkreih25dih6ug3xtj73vswccw423b56ilrwmnos4cbwhrceudopdp5sq'

test('fetchCAR - http', async () => {
  const requests = []
  const spark = new SpotChecker({
    fetch: async (url) => {
      requests.push(url.toString())
      return fetch(url)
    }
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.timeout, false, 'stats.timeout')
  assertInstanceOf(stats.startAt, Date)
  assertInstanceOf(stats.firstByteAt, Date)
  assertInstanceOf(stats.endAt, Date)
  assertEquals(stats.byteLength, 200, 'stats.byteLength')
  assertEquals(stats.carChecksum, '122069f03061f7ad4c14a5691b7e96d3ddd109023a6539a0b4230ea3dc92050e7136', 'stats.carChecksum')
  assertEquals(requests, [`https://frisbii.fly.dev/ipfs/${KNOWN_CID}?dag-scope=block`])
})

test('fetchCAR - graphsync', async () => {
  // This test relies on data stored as part of a Filecoin deal which will eventually expire.
  // Also the storage provider may decide to stop serving Graphsync retrievals.
  // When that happens, this test will start failing, and we will need to find different
  // content that can be retrieved over Graphsync.
  // Hopefully, we will no longer support Graphsync by that time.
  const cid = 'bafybeiepi56qxfcwqgpstg25r6sonig7y3pzd37lwambzmlcmbnujjri4a'
  const addr = '/dns/f010479.twinquasar.io/tcp/42002/p2p/12D3KooWHKeaNCnYByQUMS2n5PAZ1KZ9xKXqsb4bhpxVJ6bBJg5V'

  const requests = []
  const spark = new SpotChecker({
    fetch: async (url) => {
      requests.push(url.toString())
      return fetch(url)
    }
  })
  const stats = newStats()
  await spark.fetchCAR('graphsync', addr, cid, stats, 'block')
  assertEquals(stats.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.timeout, false, 'stats.timeout')
  assertInstanceOf(stats.startAt, Date)
  assertInstanceOf(stats.firstByteAt, Date)
  assertInstanceOf(stats.endAt, Date)
  assertEquals(stats.byteLength, 217, 'stats.byteLength')
  assertEquals(stats.carChecksum, '1220a8d765159d8829f2bca7df05e5cd46eb88bdaa30905d3d08c6295562ea072f0f', 'stats.carChecksum')
  assertEquals(requests, [`ipfs://${cid}?dag-scope=block&protocols=graphsync&providers=${encodeURIComponent(addr)}`])
})

/* Disabled as long as we are fetching the top-level block only
test('fetchCAR exceeding MAX_CAR_SIZE', async () => {
  const fetch = async url => {
    return {
      status: 200,
      ok: true,
      body: (async function * () {
        const data = new Uint8Array(MAX_CAR_SIZE + 1)
        data.fill(11, 0, -1)
        yield data
      })()
    }
  }
  const spark = new Spotchecker({ fetch })
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/80/http', 'bafy', stats)
  assertEquals(stats.timeout, false)
  assertEquals(stats.carTooLarge, true)
  assertEquals(stats.byteLength, MAX_CAR_SIZE + 1)
  assertEquals(stats.carChecksum, null)
  assertEquals(stats.statusCode, 200)
})
*/

test('fetchCAR fails with statusCode=701 (unsupported host type)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip99/1.2.3.4.5/tcp/80/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 701, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=702 (protocol is not tcp)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/1.2.3.4/udp/80/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 702, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=703 (scheme is not http/https)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/1.2.3.4/tcp/80/ldap', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 703, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=704 (multiaddr has too many parts)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/1.2.3.4/tcp/80/http/p2p/pubkey', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 704, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=801 (DNS error)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/invalid.example.com/tcp/80/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 801, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=802 (TCP connection refused)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/79/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 802, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=802 (TCP connection refused)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/79/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 802, 'stats.statusCode')
})

// TODO:
// statusCode=901 - unsupported hash algorithm

test('fetchCAR fails with statusCode=902 (hash mismatch)', async () => {
  const spark = new SpotChecker({
    fetch: async (url) => {
      const res = await fetch(url)
      return {
        status: res.status,
        ok: res.ok,
        body: (async function * () {
          const bytes = new Uint8Array(await res.arrayBuffer())
          // manipulate one byte inside the CAR block
          bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0x88
          yield bytes
        })()
      }
    }
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/dns/frisbii.fly.dev/tcp/443/https', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 902, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=903 (unexpected CAR block)', async () => {
  const spark = new SpotChecker({
    // Fetch the root block of a different CID
    fetch: (_url) => fetch(
      'https://frisbii.fly.dev/ipfs/bafkreih5zasorm4tlfga4ztwvm2dlnw6jxwwuvgnokyt3mjamfn3svvpyy?dag-scope=block'
    )
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/80/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 903, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=904 (cannot parse CAR)', async () => {
  const spark = new SpotChecker({
    fetch: async (_url) => {
      return {
        status: 200,
        ok: true,
        body: (async function * () {
          yield new Uint8Array([1, 2, 3])
        })()
      }
    }
  })
  const stats = newStats()
  await spark.fetchCAR('http', '/ip4/127.0.0.1/tcp/80/http', KNOWN_CID, stats, 'block')
  assertEquals(stats.statusCode, 904, 'stats.statusCode')
})
