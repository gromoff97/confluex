import process from 'node:process'

import { run } from './confluex-node/main'
import { isAcceptedRunActive, signalInterruptedOutcome } from './confluex-node/runtime/outcome'

const GOVERNED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

async function main (): Promise<void> {
  const signalHandler = (signal: NodeJS.Signals): void => {
    if (!isAcceptedRunActive()) {
      removeSignalHandlers(signalHandler)
      process.kill(process.pid, signal)
      return
    }

    const outcome = signalInterruptedOutcome()
    process.stdout.write(outcome.stdout)
    process.stderr.write(outcome.stderr)
    process.exit(outcome.exitCode)
  }

  installSignalHandlers(signalHandler)
  try {
    process.exitCode = await run(process.argv.slice(2), process)
  } finally {
    removeSignalHandlers(signalHandler)
  }
}

function installSignalHandlers (handler: (signal: NodeJS.Signals) => void): void {
  for (const signal of GOVERNED_SIGNALS) {
    process.on(signal, handler)
  }
}

function removeSignalHandlers (handler: (signal: NodeJS.Signals) => void): void {
  for (const signal of GOVERNED_SIGNALS) {
    process.off(signal, handler)
  }
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
