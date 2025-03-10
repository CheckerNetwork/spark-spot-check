import SpotChecker, { newStats } from '../lib/spot-checker.js'
import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'

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
  await spark.fetchCAR({
    protocol: 'http',
    address: '/dns/frisbii.fly.dev/tcp/443/https',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })

  assertEquals(stats.fullRetrieval.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.fullRetrieval.timeout, false, 'stats.timeout')
  assertEquals(stats.fullRetrieval.byteLength, 103, 'stats.byteLength')

  await spark.fetchCAR({
    protocol: 'http',
    address: '/dns/frisbii.fly.dev/tcp/443/https',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })

  assertEquals(stats.blockRetrieval.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.timeout, false, 'stats.timeout')
  assertEquals(stats.blockRetrieval.byteLength, 103, 'stats.byteLength')

  assertEquals(requests, [
    `ipfs://${KNOWN_CID}?dag-scope=all&protocols=http&providers=%2Fdns%2Ffrisbii.fly.dev%2Ftcp%2F443%2Fhttps`,
    `ipfs://${KNOWN_CID}?dag-scope=block&protocols=http&providers=%2Fdns%2Ffrisbii.fly.dev%2Ftcp%2F443%2Fhttps`
  ])
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
  await spark.fetchCAR({
    protocol: 'graphsync',
    address: addr,
    cid,
    stats,
    dagScope: 'block'
  })

  assertEquals(stats.blockRetrieval.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.timeout, false, 'stats.timeout')
  assertEquals(stats.blockRetrieval.byteLength, 120, 'stats.byteLength')

  await spark.fetchCAR({
    protocol: 'graphsync',
    address: addr,
    cid,
    stats,
    dagScope: 'all',
    maxByteLength: 600 // download first two blocks
  })

  assertEquals(stats.fullRetrieval.statusCode, 200, 'stats.statusCode')
  assertEquals(stats.fullRetrieval.timeout, false, 'stats.timeout')
  assertEquals(stats.fullRetrieval.byteLength, 601, 'stats.byteLength')
  assertEquals(requests, [
    `ipfs://${cid}?dag-scope=block&protocols=graphsync&providers=${encodeURIComponent(addr)}`,
    `ipfs://${cid}?dag-scope=all&protocols=graphsync&providers=${encodeURIComponent(addr)}`
  ])
})

test('fetchCAR fails with statusCode=701 (unsupported host type)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip99/1.2.3.4.5/tcp/80/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip99/1.2.3.4.5/tcp/80/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })
  assertEquals(stats.fullRetrieval.statusCode, 701, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.statusCode, 701, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=702 (protocol is not tcp)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/1.2.3.4/udp/80/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/1.2.3.4/udp/80/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })
  assertEquals(stats.fullRetrieval.statusCode, 702, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.statusCode, 702, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=703 (scheme is not http/https)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/1.2.3.4/tcp/80/ldap',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/1.2.3.4/tcp/80/ldap',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })
  assertEquals(stats.fullRetrieval.statusCode, 703, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.statusCode, 703, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=704 (multiaddr has too many parts)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/1.2.3.4/tcp/80/http/p2p/pubkey',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/1.2.3.4/tcp/80/http/p2p/pubkey',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })
  assertEquals(stats.fullRetrieval.statusCode, 704, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.statusCode, 704, 'stats.statusCode')
})

test('fetchCAR fails with statusCode=502 (no candidates found)', async () => {
  const spark = new SpotChecker()
  const stats = newStats()
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/127.0.0.1/tcp/79/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/127.0.0.1/tcp/79/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })
  assertEquals(stats.fullRetrieval.statusCode, 502, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.statusCode, 502, 'stats.statusCode')
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
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/127.0.0.1/tcp/80/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'all'
  })
  await spark.fetchCAR({
    protocol: 'http',
    address: '/ip4/127.0.0.1/tcp/80/http',
    cid: KNOWN_CID,
    stats,
    dagScope: 'block'
  })
  assertEquals(stats.fullRetrieval.statusCode, 904, 'stats.statusCode')
  assertEquals(stats.blockRetrieval.statusCode, 904, 'stats.statusCode')
})
