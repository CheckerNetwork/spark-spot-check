import { test } from 'zinnia:test'

test('can execute manual check for our CID', async () => {
  await import('../manual-check.js')
})
