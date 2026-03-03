import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname)

const port = (() => {
  const raw = process.env.PORT
  if (raw == null)
    return 3000

  const parsed = Number(raw)
  if (!Number.isInteger(parsed))
    throw new TypeError(`Expected PORT integer, got ${raw}`)
  if (parsed < 1 || parsed > 65535)
    throw new RangeError(`PORT out of range: ${parsed}`)

  return parsed
})()

const host = process.env.HOST || '127.0.0.1'

const send = (req, res, code, headers, body) => {
  res.writeHead(code, headers)
  if (body == null || req.method === 'HEAD')
    return res.end()
  return res.end(body)
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method || 'GET'
    if (!['GET', 'HEAD'].includes(method))
      return send(req, res, 405, {
        Allow: 'GET, HEAD',
        'Content-Type': 'text/plain; charset=utf-8',
      }, 'Method not allowed')

    const url = new URL(req.url || '/', 'http://local')
    const path =
      url.pathname === '/' || url.pathname === '/index.html'
        ? { file: 'index.html', mime: 'text/html; charset=utf-8' }
        : url.pathname === '/lib/paper-core.js'
          ? { file: 'lib/paper-core.js', mime: 'text/javascript; charset=utf-8' }
          : null

    if (!path)
      return send(req, res, 404, {
        'Content-Type': 'text/plain; charset=utf-8',
      }, 'Not found')

    const body = await readFile(resolve(root, path.file))
    return send(req, res, 200, {
      'Content-Type': path.mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)

    return send(req, res, 500, {
      'Content-Type': 'text/plain; charset=utf-8',
    }, 'Internal server error')
  }
})

const logHost = host.includes(':') ? `[${host}]` : host
server.listen(port, host, () =>
  console.log(`http://${logHost}:${port}`))

