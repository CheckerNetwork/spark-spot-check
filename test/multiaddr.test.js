import { test } from 'zinnia:test'
import { assertEquals, assertThrows } from 'zinnia:assert'
import { validateHttpMultiaddr } from '../lib/multiaddr.js'

const HAPPY_CASES = [
  '/ip4/127.0.0.1/tcp/80/http',
  '/ip4/127.0.0.1/tcp/8080/http',
  '/ip4/127.0.0.1/tcp/443/https',
  '/ip4/127.0.0.1/tcp/8080/https',
  '/dns/meridian.space/tcp/8080/http',
  '/dns4/meridian.space/tcp/8080/http',
  '/dns6/meridian.space/tcp/8080/http'
]

for (const multiaddr of HAPPY_CASES) {
  test(`parse ${multiaddr}`, () => {
    validateHttpMultiaddr(multiaddr)
  })
}

const ERROR_CASES = [
  ['/ip4/127.0.0.1/tcp/80', 'Cannot parse "/ip4/127.0.0.1/tcp/80": unsupported scheme "undefined"'],
  ['/ip4/127.0.0.1/udp/90', 'Cannot parse "/ip4/127.0.0.1/udp/90": unsupported protocol "udp"'],
  ['/ip4/127.0.0.1/tcp/8080/http/p2p/pubkey', 'Cannot parse "/ip4/127.0.0.1/tcp/8080/http/p2p/pubkey": too many parts']
]

for (const [multiaddr, expectedError] of ERROR_CASES) {
  test(`parse ${multiaddr}`, () => {
    const err = assertThrows(() => validateHttpMultiaddr(multiaddr))
    assertEquals(err.message, expectedError)
  })
}
