import process from 'node:process'

type Streams = {
  stdout: NodeJS.WritableStream
  stderr: NodeJS.WritableStream
}

type RuntimeMain = {
  run: (argv: string[], streams?: Streams) => Promise<number>
}

// The TypeScript package entrypoint delegates to the existing audited runtime
// while modules migrate incrementally from lib/ to src/.
const runtime = require('../lib/confluex-node/main.js') as RuntimeMain

async function main (): Promise<void> {
  process.exitCode = await runtime.run(process.argv.slice(2), process)
}

if (require.main === module) {
  main().catch((error: Error) => {
    process.stderr.write(`ERROR: internal_error ${error.name}\n`)
    process.exitCode = 4
  })
}

export { main }
export const run = runtime.run
