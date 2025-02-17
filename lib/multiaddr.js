/**
 * @param {string} addr Multiaddr, e.g. `/ip4/127.0.0.1/tcp/80/http`
 * @throws {Error}
 */
export function validateHttpMultiaddr (addr) {
  const [, hostType, , ipProtocol, , scheme, ...rest] = addr.split('/')

  validateHostType(hostType)

  if (ipProtocol !== 'tcp') {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": unsupported protocol "${ipProtocol}"`),
      { code: 'UNSUPPORTED_MULTIADDR_PROTO' }
    )
  }

  if (scheme !== 'http' && scheme !== 'https') {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": unsupported scheme "${scheme}"`),
      { code: 'UNSUPPORTED_MULTIADDR_SCHEME' }
    )
  }

  if (rest.length) {
    throw Object.assign(
      new Error(`Cannot parse "${addr}": too many parts`),
      { code: 'MULTIADDR_HAS_TOO_MANY_PARTS' }
    )
  }
}

function validateHostType (hostType) {
  switch (hostType) {
    case 'ip4':
    case 'dns':
    case 'dns4':
    case 'dns6':
    case 'ip6':
      return
  }

  throw Object.assign(
    new Error(`Unsupported multiaddr host type "${hostType}"`),
    { code: 'UNSUPPORTED_MULTIADDR_HOST_TYPE' }
  )
}
