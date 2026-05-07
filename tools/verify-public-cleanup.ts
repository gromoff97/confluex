import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

type PackageJson = {
  files?: unknown
  scripts?: Record<string, string>
}

const deletedTrackedPrefixes = [
  '.agents/superpowers/',
  'designs/',
  'plans/',
  'docker/',
  'lib/',
  'scripts/',
  'tests/',
  'docs/superpowers/'
]

const deletedTrackedFiles = new Set([
  'confluex',
  'tsconfig.test.json'
])

const allowedTrackedFiles = new Set([
  '.gitignore',
  'AGENTS.md',
  'README.md',
  'LICENSE',
  'bin/confluex.js',
  'eslint.config.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.tools.json',
  'tools/verify-public-cleanup.ts'
])

const forbiddenPublicTerms = [
  '--html',
  '--save',
  '--safe',
  '--encryption-key',
  'EncryptionKey',
  'docker/confluence-7137',
  'live-bats',
  'selftest',
  'scripts/',
  'tests/',
  'plans/',
  'designs/',
  'lib/'
]

const expectedPackageFiles = ['bin/', 'dist/', 'README.md', 'LICENSE', 'package.json']
const forbiddenScripts = ['test:node', 'typecheck:tests', 'typecheck:src', 'lint:js', 'lint:ts', 'lint:shell']

const failures: string[] = []
const files = trackedFiles()

for (const file of files) {
  verifyTrackedPath(file)
  verifyJavascriptBoundary(file)
  verifyForbiddenTerms(file)
}

verifyPackageJson()

if (failures.length > 0) {
  throw new Error(`Public cleanup verification failed:\n${failures.join('\n')}`)
}

process.stdout.write(`public_cleanup_result=passed tracked_files=${files.length}\n`)

function trackedFiles (): string[] {
  return execFileSync('git', ['ls-files'], {
    encoding: 'utf8'
  })
    .split(/\r?\n/)
    .filter(file => file.length > 0)
}

function verifyTrackedPath (file: string): void {
  if (deletedTrackedFiles.has(file)) {
    failures.push(`${file}: deleted legacy file is still tracked`)
  }

  if (deletedTrackedPrefixes.some(prefix => file.startsWith(prefix))) {
    failures.push(`${file}: deleted legacy root is still tracked`)
  }

  if (file.startsWith('dist/')) {
    failures.push(`${file}: generated dist output must not be tracked`)
  }

  if (allowedTrackedFiles.has(file) || file.startsWith('src/') || file.startsWith('docs/')) {
    return
  }

  failures.push(`${file}: path is outside the public repository allowlist`)
}

function verifyJavascriptBoundary (file: string): void {
  if (extname(file) !== '.js' && extname(file) !== '.mjs') {
    return
  }

  if (file === 'bin/confluex.js' || file === 'eslint.config.mjs') {
    return
  }

  failures.push(`${file}: JavaScript runtime source is not allowed in the cleaned product tree`)
}

function verifyForbiddenTerms (file: string): void {
  if (file === '.gitignore' || file === 'tools/verify-public-cleanup.ts') {
    return
  }

  if (!isTextScanned(file)) {
    return
  }

  const content = readFileSync(file, 'utf8')
  for (const term of forbiddenPublicTerms) {
    if (content.includes(term)) {
      failures.push(`${file}: forbidden legacy term ${term}`)
    }
  }
}

function isTextScanned (file: string): boolean {
  return ['.md', '.json', '.ts', '.js', '.mjs', ''].includes(extname(file))
}

function verifyPackageJson (): void {
  const parsed = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson
  if (!Array.isArray(parsed.files) || parsed.files.some((item, index) => item !== expectedPackageFiles[index]) || parsed.files.length !== expectedPackageFiles.length) {
    failures.push('package.json: files allowlist does not match the public package inventory')
  }

  const scripts = parsed.scripts ?? {}
  for (const script of forbiddenScripts) {
    if (Object.hasOwn(scripts, script)) {
      failures.push(`package.json: forbidden public script ${script}`)
    }
  }
}
