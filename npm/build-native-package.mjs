import { chmod, copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { nativePackage } from './package-manifest.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const source = path.join(root, 'target', 'release', nativePackage.cargoBinaryName)
const target = path.join(root, nativePackage.packageBinaryPath)

await mkdir(path.dirname(target), { recursive: true })
await rm(target, { force: true })
await copyFile(source, target)

if (process.platform !== 'win32') {
  await chmod(target, 0o755)
}
