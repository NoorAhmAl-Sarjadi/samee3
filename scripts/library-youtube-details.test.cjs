const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function route(fetch) {
  const exports = {}
  const source = fs.readFileSync(
    require('node:path').join(__dirname, '../app/api/islamic-library/youtube-details/route.ts'),
    'utf8',
  )
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    {
      exports,
      URL,
      AbortSignal,
      fetch,
      require: (name) => {
        assert.equal(name, 'next/server')
        return { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } }
      },
    },
  )
  return exports.GET
}
const request = (id) => ({
  nextUrl: new URL('https://samee3.test/api/islamic-library/youtube-details?id=' + encodeURIComponent(id)),
  signal: new AbortController().signal,
})
test('invalid identifiers never contact the source', async () => {
  const get = route(() => {
    throw new Error('unexpected fetch')
  })
  const response = await get(request('https://evil.example'))
  assert.equal(response.status, 400)
})
test('the current video title and lecturer come only from the fixed YouTube oEmbed endpoint', async () => {
  const get = route(async (url, options) => {
    assert.equal(url.hostname, 'www.youtube.com')
    assert.equal(url.pathname, '/oembed')
    assert.equal(url.searchParams.get('url'), 'https://www.youtube.com/watch?v=abcdefghijk')
    assert.ok(options.signal)
    return {
      ok: true,
      json: async () => ({ title: 'شرح حالي', author_name: 'شارح حالي', html: '<script>bad()</script>' }),
    }
  })
  const response = await get(request('abcdefghijk'))
  assert.equal(response.body.title, 'شرح حالي')
  assert.equal(response.body.author, 'شارح حالي')
  assert.equal('html' in response.body, false)
})
test('unavailable source metadata returns a usable fallback without changing video identity', async () => {
  const unavailable = await route(async () => ({ ok: false }))(request('abcdefghijk'))
  assert.equal(unavailable.body.id, 'abcdefghijk')
  assert.equal(unavailable.body.available, false)
  const timeout = await route(async () => {
    throw new Error('timeout')
  })(request('abcdefghijk'))
  assert.equal(timeout.status, 200)
  assert.equal(timeout.body.available, false)
})
test('unexpected source fields cannot become unsafe embedded markup', async () => {
  const response = await route(async () => ({
    ok: true,
    json: async () => ({ title: 'x'.repeat(1000), author_name: 123 }),
  }))(request('abcdefghijk'))
  assert.equal(response.body.title.length, 400)
  assert.equal(response.body.author, '')
})
