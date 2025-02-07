//
// Usage:
// zinnia run manual-check.js
//

import SpotChecker, { getRetrievalUrl } from './lib/spot-checker.js'
import { getMinerPeerId as defaultGetMinerPeerId } from './lib/miner-info.js'

const dagScope = 'entity'
const entityBytesRange = '0:200'

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
await spark.executeSpotCheck({ retrieval: task, stats, dagScope, entityBytesRange })
console.log('Measurement: %o', stats)

if (stats.providerAddress && stats.statusCode !== 200) {
  console.log('\nThe retrieval failed.')
  switch (stats.protocol) {
    case 'graphsync':
      console.log('You can get more details by running Lassie manually:\n')
      console.log(
        '  lassie fetch -o /dev/null -vv --dag-scope block --protocols graphsync --providers %s %s',
        JSON.stringify(stats.providerAddress),
        task.cid
      )
      console.log('\nHow to install Lassie: https://github.com/filecoin-project/lassie?tab=readme-ov-file#installation')
      break
    case 'http':
      try {
        const url = getRetrievalUrl({ protocol: stats.protocol, address: stats.providerAddress, cid: task.cid, dagScope, entityBytesRange })
        console.log('You can get more details by requesting the following URL yourself:\n')
        console.log('  %s', url)
        console.log('\nE.g. using `curl`:')
        console.log('  curl -i %s', JSON.stringify(url))
        console.log('\nYou can also test the retrieval using Lassie:\n')
        console.log(
          '  lassie fetch -o /dev/null -vv --dag-scope block --protocols http --providers %s %s',
          JSON.stringify(stats.providerAddress),
          task.cid
        )
        console.log('\nHow to install Lassie: https://github.com/filecoin-project/lassie?tab=readme-ov-file#installation')
      } catch (err) {
        console.log('The provider address %j cannot be converted to a URL: %s', stats.providerAddress, err.message ?? err)
      }
      break
  }
}
