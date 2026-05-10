import fs from 'node:fs/promises'
import path from 'node:path'

import {
  REPORT_FILE_ORDER,
  type RunReportTexts
} from './run-report'

export type ReportFileName = typeof REPORT_FILE_ORDER[number]
export type { RunReportTexts }

export { REPORT_FILE_ORDER, REPORT_HEADER_TEXT, SUMMARY_KEYS, emptyRunReportTexts, runReportTexts, writeRunReportSet } from './run-report'

export async function readRunReportSet (outputRoot: string): Promise<RunReportTexts> {
  await validateReportDirectory(outputRoot)
  const texts: Partial<RunReportTexts> = {}
  for (const name of REPORT_FILE_ORDER) {
    texts[name] = await fs.readFile(path.join(outputRoot, name), 'utf8')
  }
  validateRunReportSet(texts)
  return texts
}

export function validateRunReportSet (texts: unknown): asserts texts is RunReportTexts {
  if (!isRecord(texts)) {
    throw new TypeError('report texts must be an object')
  }

  const actual = Object.keys(texts)
  if (actual.join('\n') !== REPORT_FILE_ORDER.join('\n')) {
    throw new TypeError('report texts must contain exactly the governed report files in order')
  }

  for (const name of REPORT_FILE_ORDER) {
    if (typeof texts[name] !== 'string') {
      throw new TypeError(`${name} text must be a string`)
    }
  }
}

async function validateReportDirectory (outputRoot: string): Promise<void> {
  const expected = new Set<string>(REPORT_FILE_ORDER)
  const actual = (await fs.readdir(outputRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort()
  const expectedNames = Array.from(expected).sort()
  if (actual.join('\n') !== expectedNames.join('\n')) {
    throw new TypeError('report texts must contain exactly the governed report files in order')
  }
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
