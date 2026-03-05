import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin',
}

const core = new Set([
  'pointer', 'motion', 'path', 'gesture', 'font', 'glass',
])

const rewriteImports = source => source
  .replace(
    /from\s+['"]#([\w-]+)['"]/g,
    (_, name) => core.has(name)
      ? `from '/src/${name}/index.js'`
      : `from '/motions/${name}/index.js'`
  )
  .replace(
    /import\s+['"]#([\w-]+)['"]/g,
    (_, name) => core.has(name)
      ? `import '/src/${name}/index.js'`
      : `import '/motions/${name}/index.js'`
  )

const js = async path =>
  rewriteImports(await readFile(path, 'utf8'))

const send = (req, res, code, headers, body) => {
  res.writeHead(code, headers)
  if (body == null || req.method === 'HEAD')
    return res.end()
  return res.end(body)
}

const route = pathname =>
  pathname === '/'
    ? { file: 'bin/skill.md', type: 'text/markdown; charset=utf-8' }
    : pathname === '/pointerdriver.js'
      ? { file: 'index.js', type: 'text/javascript; charset=utf-8' }
      : pathname.match(/^\/src\/[\w-]+\/index\.js$/)
        ? { file: pathname.slice(1), type: 'text/javascript; charset=utf-8' }
        : pathname.match(/^\/motions\/([\w-]+\/)?index\.js$/)
          ? { file: pathname.slice(1), type: 'text/javascript; charset=utf-8' }
          : pathname.match(/^\/fonts\/[\w-]+\.svg$/)
            ? { file: pathname.slice(1), type: 'image/svg+xml' }
            : null

export const createApp = () => createServer(async (req, res) => {
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
    const request = route(url.pathname)

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
