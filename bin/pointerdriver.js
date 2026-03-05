#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { formatWithOptions, promisify } from 'node:util'
import { createApp } from './server.js'

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

  const server = createApp()

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
