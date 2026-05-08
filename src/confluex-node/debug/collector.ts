import fs from 'node:fs/promises'
import path from 'node:path'

import { redactForDebug, redactTextForDebug } from './redaction'

export type MarkdownDebugArtifacts = {
  args: string[]
  stdout: string
  stderr: string
  exitCode: number | null
  rawPayload?: string
  normalizedPayload?: string
}

export type DebugCollector = {
  enabled: boolean
  writeRun: (value: unknown) => Promise<void>
  writeOptions: (value: unknown) => Promise<void>
  recordEvent: (event: string, value?: unknown) => Promise<void>
  writePageMetadata: (pageId: string, value: unknown) => Promise<void>
  writePageStorage: (pageId: string, storage: string) => Promise<void>
  writeAttachmentPreview: (pageId: string, value: unknown) => Promise<void>
  writeMarkdownExporter: (pageId: string, artifacts: MarkdownDebugArtifacts) => Promise<void>
}

export function createDebugCollector (outputRoot: string, secrets: readonly string[]): DebugCollector {
  const root = path.join(outputRoot, '_debug')
  const writeText = async (relativePath: string, text: string): Promise<void> => {
    const target = path.join(root, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, redactTextForDebug(text, secrets), 'utf8')
  }
  const writeJson = async (relativePath: string, value: unknown): Promise<void> => {
    await writeText(relativePath, `${JSON.stringify(redactForDebug(value, secrets), null, 2)}\n`)
  }
  const pagePath = (pageId: string, filename: string): string => `pages/${pageId}/${filename}`

  return {
    enabled: true,
    async writeRun (value: unknown): Promise<void> {
      await writeJson('run.json', value)
    },
    async writeOptions (value: unknown): Promise<void> {
      await writeJson('options.json', value)
    },
    async recordEvent (event: string, value: unknown = {}): Promise<void> {
      const payload = redactForDebug({
        event,
        timestamp: new Date().toISOString(),
        data: value
      }, secrets)
      const target = path.join(root, 'events.ndjson')
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.appendFile(target, `${JSON.stringify(payload)}\n`, 'utf8')
    },
    async writePageMetadata (pageId: string, value: unknown): Promise<void> {
      await writeJson(pagePath(pageId, 'metadata.json'), value)
    },
    async writePageStorage (pageId: string, storage: string): Promise<void> {
      await writeText(pagePath(pageId, 'storage.xml'), storage)
    },
    async writeAttachmentPreview (pageId: string, value: unknown): Promise<void> {
      await writeJson(pagePath(pageId, 'attachments-preview.json'), value)
    },
    async writeMarkdownExporter (pageId: string, artifacts: MarkdownDebugArtifacts): Promise<void> {
      await writeText(pagePath(pageId, 'markdown-exporter.args.txt'), `${artifacts.args.join('\n')}\n`)
      await writeText(pagePath(pageId, 'markdown-exporter.stdout.txt'), artifacts.stdout)
      await writeText(pagePath(pageId, 'markdown-exporter.stderr.txt'), artifacts.stderr)
      await writeJson(pagePath(pageId, 'markdown-exporter.exit.json'), { exit_code: artifacts.exitCode })
      if (artifacts.rawPayload !== undefined) {
        await writeText(pagePath(pageId, 'markdown.raw.md'), artifacts.rawPayload)
      }
      if (artifacts.normalizedPayload !== undefined) {
        await writeText(pagePath(pageId, 'markdown.normalized.md'), artifacts.normalizedPayload)
      }
    }
  }
}

export function disabledDebugCollector (): DebugCollector {
  return {
    enabled: false,
    async writeRun (): Promise<void> {},
    async writeOptions (): Promise<void> {},
    async recordEvent (): Promise<void> {},
    async writePageMetadata (): Promise<void> {},
    async writePageStorage (): Promise<void> {},
    async writeAttachmentPreview (): Promise<void> {},
    async writeMarkdownExporter (): Promise<void> {}
  }
}
