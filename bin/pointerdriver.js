#!/usr/bin/env node

import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { formatWithOptions, promisify } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))

const release = (port, {
  timeout = 3000,
  poll: { interval = 50 } = {}
} = {}) =>
  Promise.resolve(port)
    .then(port => Number.isFinite(port) && port >= 1 && port <= 65535
      ? port
      : Promise.reject(new RangeError(`port: ${port}, must be 1 - 65535`)))
    .then(port => promisify(execFile)('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']))
    .then(({ stdout }) => stdout.trim().split('\n').map(Number).filter(Boolean))
    .then(pids => pids.map(pid => (process.kill(pid, 'SIGTERM'), pid)))
    .then(function poll(pids, start = Date.now()) {
      const live = pids.filter(pid => {
        try { return process.kill(pid, 0), true }
        catch (err) {
          if (err.code === 'ESRCH') return false
          throw err
        }
      })

      return !live.length ? pids :
        Date.now() - start >= timeout
          ? (live.forEach(pid => process.kill(pid, 'SIGKILL')), pids)
          : wait(Math.max(10, interval)).then(() => poll(pids, start))
    })
    .catch(err => err.code === 1 ? [] : Promise.reject(err))

const log = (...args) =>
  console.log(formatWithOptions({ colors: true }, ...args))

const aliases = {
  '-p': '--port',
  '-H': '--host',
  '-h': '--help',
  '-s': '--skill',
}

const expand = a => {
  const [key, ...rest] = a.split('=')
  return aliases[key]
    ? [aliases[key], ...rest].join('=')
    : a
}

const args = Object.fromEntries(
  process.argv.slice(2)
    .map(expand)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
)

if ('help' in args) {
  console.log([
    '',
    'pointerdriver',
    '',
    'Synthesize pointer, touch, and gesture events on any page.',
    '',
    'Usage:',
    '  pointerdriver                   start the module server',
    '  pointerdriver --port=<port>     set port (default: 5619)',
    '  pointerdriver --host=<host>     set host (default: 127.0.0.1)',
    '  pointerdriver --skill           print the agent skill reference',
    '  pointerdriver --help            show this help',
    '',
    'Aliases:',
    '  -p=5619, -H=127.0.0.1, -s, -h',
    '',
    'Run without install:',
    '  npx github:TheProfs/pointerdriver',
    '',
  ].join('\n'))
  process.exitCode = 0
} else if ('skill' in args) {
  const skill = resolve(root, 'bin/skill.md')
  process.stdout.write(await readFile(skill, 'utf8'))
} else {
  const host = args.host || process.env.HOST || '127.0.0.1'
  const port = (() => {
    const raw = args.port ?? process.env.PORT
    if (raw == null)
      return 5619

    const parsed = Number(raw)
    if (!Number.isInteger(parsed))
      throw new TypeError(`Expected port integer, got ${raw}`)
    if (parsed < 1 || parsed > 65535)
      throw new RangeError(`port out of range: ${parsed}`)

    return parsed
  })()

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin',
  }

  const rewriteImports = source => source
    .replace(
      /from\s+['"]#([\w-]+)['"]/g,
      (_, name) => `from '/src/${name}/index.js'`
    )
    .replace(
      /import\s+['"]#([\w-]+)['"]/g,
      (_, name) => `import '/src/${name}/index.js'`
    )

  const js = async path =>
    rewriteImports(await readFile(path, 'utf8'))

  const send = (req, res, code, headers, body) => {
    res.writeHead(code, headers)
    if (body == null || req.method === 'HEAD')
      return res.end()
    return res.end(body)
  }

  const server = createServer(async (req, res) => {
    try {
      const method = req.method || 'GET'
      if (method === 'OPTIONS')
        return send(req, res, 204, {
          ...cors,
          'Access-Control-Allow-Headers':
            req.headers['access-control-request-headers'] || 'Origin',
        })
      if (!['GET', 'HEAD'].includes(method))
        return send(req, res, 405, {
          ...cors,
          Allow: 'GET, HEAD, OPTIONS',
          'Content-Type': 'text/plain; charset=utf-8',
        }, 'Method not allowed')

      const url = new URL(req.url || '/', 'http://local')
      const pathname = url.pathname

      const request =
        pathname === '/'
          ? { file: 'bin/skill.md', type: 'text/markdown; charset=utf-8' }
          : pathname === '/pointerdriver.js'
            ? { file: 'index.js', type: 'text/javascript; charset=utf-8' }
            : pathname.match(/^\/src\/[\w-]+\/index\.js$/)
              ? { file: pathname.slice(1), type: 'text/javascript; charset=utf-8' }
              : pathname.match(/^\/fonts\/[\w-]+\.svg$/)
                ? { file: pathname.slice(1), type: 'image/svg+xml' }
                : null

      if (!request)
        return send(req, res, 404, {
          ...cors,
          'Content-Type': 'text/plain; charset=utf-8',
        }, 'Not found')

      const path = resolve(root, request.file)

      const body = request.type.startsWith('text/javascript')
        ? await js(path)
        : await readFile(path, 'utf8')

      return send(req, res, 200, {
        ...cors,
        'Content-Type': request.type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }, body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(message)

      const code = err && typeof err === 'object' && 'code' in err
        ? err.code
        : null

      if (code === 'ENOENT')
        return send(req, res, 404, {
          ...cors,
          'Content-Type': 'text/plain; charset=utf-8',
        }, 'Not found')

      return send(req, res, 500, {
        ...cors,
        'Content-Type': 'text/plain; charset=utf-8',
      }, 'Internal server error')
    }
  })

  log('starting server ...')
  log('checking port %d ...', port)

  const released = await release(port)

  if (released.length)
    log('killed: %s to free up port: %d', released.join(', '), port)

  const logHost = host.includes(':') ? `[${host}]` : host

  server.listen(port, host, () =>
    log('listening: http://%s:%d/', logHost, port))

  const shutdown = () => server.close()

  process
    .on('SIGINT', shutdown)
    .on('SIGTERM', shutdown)
}
