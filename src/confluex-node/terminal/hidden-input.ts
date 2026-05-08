import fs from 'node:fs'
import { stdin, stdout } from 'node:process'

type ReadableInput = NodeJS.ReadableStream & {
  isTTY?: boolean
  setRawMode?: (mode: boolean) => void
  resume: () => NodeJS.ReadableStream
  pause: () => NodeJS.ReadableStream
}

type WritableOutput = Pick<NodeJS.WritableStream, 'write'>

let pipedStdinLines: string[] | null = null

export async function readVisibleLine (
  prompt: string,
  input: ReadableInput = stdin,
  output: WritableOutput = stdout
): Promise<string> {
  output.write(prompt)
  if (input === stdin && input.isTTY !== true) {
    return nextPipedStdinLine()
  }
  return readLine(input, output, false)
}

export async function readHiddenLine (
  prompt: string,
  input: ReadableInput = stdin,
  output: WritableOutput = stdout
): Promise<string> {
  if (input === stdin && input.isTTY !== true) {
    output.write(prompt)
    const value = nextPipedStdinLine()
    output.write('\n')
    return value
  }

  if (!supportsRawMode(input)) {
    output.write(prompt)
    return readLine(input, output, true)
  }

  output.write(prompt)
  input.setRawMode(true)
  input.resume()

  try {
    return await readLine(input, output, true)
  } finally {
    input.setRawMode(false)
  }
}

function readLine (
  input: ReadableInput,
  output: WritableOutput,
  writeTerminalNewline: boolean
): Promise<string> {
  input.resume()

  return new Promise((resolve, reject) => {
    let value = ''

    const cleanup = (): void => {
      input.pause()
      input.off('data', onData)
    }

    const finish = (): void => {
      if (writeTerminalNewline) {
        output.write('\n')
      }
      cleanup()
      resolve(value)
    }

    const fail = (error: Error): void => {
      output.write('\n')
      cleanup()
      reject(error)
    }

    const onData = (chunk: Buffer | string): void => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') {
          fail(new Error('interrupted'))
          return
        }
        if (char === '\r' || char === '\n') {
          finish()
          return
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }

    input.on('data', onData)
  })
}

function supportsRawMode (input: ReadableInput): input is Required<Pick<ReadableInput, 'setRawMode'>> & ReadableInput {
  return input.isTTY === true && typeof input.setRawMode === 'function'
}

function nextPipedStdinLine (): string {
  if (pipedStdinLines === null) {
    pipedStdinLines = fs.readFileSync(0, 'utf8').split(/\r?\n/)
  }
  return pipedStdinLines.shift() ?? ''
}
