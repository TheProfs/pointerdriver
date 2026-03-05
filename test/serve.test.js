import { test } from 'node:test'
import { request } from 'node:http'
import { createApp } from '../bin/server.js'

const fetch = (server, path, { method = 'GET', headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const { port } = server.address()
    const req = request(
      { hostname: '127.0.0.1', port, path, method, headers },
      res => {
        let body = ''
        res.on('data', chunk => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      }
    )

    req.on('error', reject)
    req.end()
  })

test('server', async t => {
  t.beforeEach(t => {
    t.server = createApp().listen(0)
  })

  t.afterEach(t => {
    t.server.close()
  })

  await t.test('GET /', async t => {
    await t.test('returns skill.md', async t => {
      const res = await fetch(t.server, '/')

      t.assert.strictEqual(res.status, 200)
      t.assert.match(
        res.headers['content-type'], /text\/markdown/
      )
      t.assert.match(res.body, /pointerdriver/i)
    })
  })

  await t.test('GET /pointerdriver.js', async t => {
    await t.test('returns entrypoint with rewritten imports', async t => {
      const res = await fetch(t.server, '/pointerdriver.js')

      t.assert.strictEqual(res.status, 200)
      t.assert.match(
        res.headers['content-type'], /text\/javascript/
      )
      t.assert.ok(
        !res.body.includes("from '#"),
        'bare #imports should be rewritten'
      )
    })
  })

  await t.test('GET /src/pointer/index.js', async t => {
    await t.test('serves core module', async t => {
      const res = await fetch(t.server, '/src/pointer/index.js')

      t.assert.strictEqual(res.status, 200)
      t.assert.match(
        res.headers['content-type'], /text\/javascript/
      )
    })
  })

  await t.test('GET /motions/drag/index.js', async t => {
    await t.test('serves motion module', async t => {
      const res = await fetch(t.server, '/motions/drag/index.js')

      t.assert.strictEqual(res.status, 200)
      t.assert.match(
        res.headers['content-type'], /text\/javascript/
      )
    })
  })

  await t.test('GET /motions/index.js', async t => {
    await t.test('serves motion barrel', async t => {
      const res = await fetch(t.server, '/motions/index.js')

      t.assert.strictEqual(res.status, 200)
      t.assert.match(
        res.headers['content-type'], /text\/javascript/
      )
    })
  })

  await t.test('GET /fonts/hershey-script.svg', async t => {
    await t.test('serves font file', async t => {
      const res = await fetch(t.server, '/fonts/hershey-script.svg')

      t.assert.strictEqual(res.status, 200)
      t.assert.match(res.headers['content-type'], /svg/)
    })
  })

  await t.test('CORS', async t => {
    await t.test('sets permissive CORS headers', async t => {
      const res = await fetch(t.server, '/')

      t.assert.strictEqual(
        res.headers['access-control-allow-origin'], '*'
      )
    })

    await t.test('OPTIONS returns 204', async t => {
      const res = await fetch(t.server, '/', { method: 'OPTIONS' })

      t.assert.strictEqual(res.status, 204)
    })
  })

  await t.test('errors', async t => {
    await t.test('unknown path returns 404', async t => {
      const res = await fetch(t.server, '/nope')

      t.assert.strictEqual(res.status, 404)
    })

    await t.test('POST returns 405', async t => {
      const res = await fetch(t.server, '/', { method: 'POST' })

      t.assert.strictEqual(res.status, 405)
    })
  })

  await t.test('import rewriting', async t => {
    await t.test('rewrites core #imports to /src/', async t => {
      const res = await fetch(t.server, '/motions/drag/index.js')

      t.assert.match(res.body, /\/src\//)
      t.assert.ok(
        !res.body.includes("from '#"),
        'bare #imports should be rewritten'
      )
    })

    await t.test('rewrites motion #imports to /motions/', async t => {
      const res = await fetch(t.server, '/pointerdriver.js')

      t.assert.match(res.body, /\/motions\//)
    })
  })
})
