import { test } from 'node:test'
import { request } from 'node:http'
import { pointerdriver } from '../index.js'

const fetch = (server, path) =>
  new Promise((resolve, reject) => {
    const { port } = server.address()
    const req = request(
      { hostname: '127.0.0.1', port, path, method: 'GET' },
      res => {
        let body = ''
        res.on('data', chunk => (body += chunk))
        res.on('end', () => resolve({
          status: res.statusCode, headers: res.headers, body
        }))
      }
    )

    req.on('error', reject)
    req.end()
  })

test('serve', async t => {
  t.beforeEach(t => (t.server = pointerdriver(0)))
  t.afterEach(t => t.server.close())

  await t.test('returns a listening server', async t => {
    const addr = t.server.address()

    t.assert.ok(addr, 'has address')
    t.assert.ok(addr.port > 0, 'bound to a port')
  })

  await t.test('serves entrypoint', async t => {
    const res = await fetch(t.server, '/pointerdriver.js')

    t.assert.strictEqual(res.status, 200)
    t.assert.match(
      res.headers['content-type'], /text\/javascript/
    )
  })

  await t.test('rewrites imports', async t => {
    const res = await fetch(t.server, '/pointerdriver.js')

    t.assert.ok(
      !res.body.includes("from '#"),
      'bare #imports should be rewritten'
    )
  })

  await t.test('serves motion modules', async t => {
    const res = await fetch(t.server, '/motions/drag/index.js')

    t.assert.strictEqual(res.status, 200)
  })
})
