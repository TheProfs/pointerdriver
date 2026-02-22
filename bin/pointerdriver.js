#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(here, '..')

const host = '127.0.0.1'
const port = 5619

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const args = [
  '--yes',
  'serve',
  '--listen',
  `tcp://${host}:${port}`,
  '--cors',
  root,
]

const child = spawn(npx, args, { stdio: 'inherit' })

const exit = code =>
  process.exit(typeof code === 'number' ? code : 1)

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))

child.on('error', err => {
  console.error(err?.message ?? String(err))
  exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) exit(1)
  exit(code)
})
