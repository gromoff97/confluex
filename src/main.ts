import process from 'node:process'

import { run } from './confluex-node/main'

async function main (): Promise<void> {
  process.exitCode = await run(process.argv.slice(2), process)
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'unknown'
    process.stderr.write(`ERROR: internal_error ${errorName}\n`)
    process.exitCode = 4
  })
}

export { main }
export { run }
