#!/usr/bin/env node

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const flag = process.argv[2]

if (['-h', '--help'].includes(flag)) {
  console.log(`
  pointerdriver

  Synthesize pointer, touch, and gesture events on any page.

  Usage:
    npx pointerdriver              start the module server
    npx pointerdriver -s|--skill   print the agent skill reference
    npx pointerdriver -h|--help    show this help
  `)
} else if (['-s', '--skill'].includes(flag)) {
  const skill = resolve(root, 'bin/skill.md')

  process.stdout.write(await readFile(skill, 'utf8'))
} else {

const host = process.env.HOST || '127.0.0.1'
const port = +process.env.PORT || 5619

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const rewriteImports = source => source
  .replace(
    /from\s+['"]#(\w+)['"]/g,
    (_, name) => `from '/src/${name}/index.js'`
  )

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}`)

  const pathname = url.pathname === '/pointerdriver.js'
    ? '/index.js'
    : url.pathname === '/'
      ? '/index.html'
      : url.pathname

  const path = join(root, pathname)

  try {
    const data = await readFile(path)
    const mime = types[extname(path)] || 'application/octet-stream'

    const body = mime === 'text/javascript'
      ? rewriteImports(data.toString())
      : data

    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    })

    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(port, host, () =>
  console.log(`http://${host}:${port}/pointerdriver.js`))

const shutdown = () => server.close()

process
  .on('SIGINT', shutdown)
  .on('SIGTERM', shutdown)
}
