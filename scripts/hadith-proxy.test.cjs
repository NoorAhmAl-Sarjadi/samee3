const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('./load-ts.cjs')
const route = (fetch) => load('app/api/hadith/[...path]/route.ts', { fetch, AbortSignal })
const request = (query = '') => new Request(`https://samee3.test/api/hadith/bukhari${query}`)
test('hadith proxy rejects traversal and invalid segments before contacting the source', async () => {
  const { GET } = route(() => { throw new Error('must not fetch') })
  for (const path of [['..'], ['bukhari','bad/path'], []]) assert.equal((await GET(request(), { params: Promise.resolve({ path }) })).status, 400)
})
test('hadith proxy forwards only supported query fields to the fixed source', async () => {
  let target
  const { GET } = route(async (url) => { target = String(url); return Response.json({ success: true, data: [] }) })
  const response = await GET(request('?page=2&q=test&url=https://evil.test'), { params: Promise.resolve({ path: ['bukhari','1'] }) })
  assert.equal(response.status, 200)
  assert.equal(target, 'https://alfurqan.online/api/v1/hadith/bukhari/1?page=2&q=test')
  assert.deepEqual(await response.json(), { success: true, data: [] })
})
test('hadith proxy reports malformed upstream content and upstream outages', async () => {
  const context = { params: Promise.resolve({ path: ['bukhari'] }) }
  for (const fetch of [async () => new Response('<html>down</html>'), async () => new Response('', { status: 503 }), async () => { throw new Error('offline') }]) {
    const response = await route(fetch).GET(request(), context)
    assert.equal(response.status, 502)
    assert.ok((await response.json()).error)
  }
})
