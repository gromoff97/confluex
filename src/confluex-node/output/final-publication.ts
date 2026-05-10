import fs from 'node:fs/promises'
import path from 'node:path'

import { ensureDirectoryNoFollow, joinGovernedRelativePath, removeTreeNoFollow, writeFileNoFollowAtomic } from './filesystem-safety'

export type FinalArtifactKind = 'plain_root' | 'zip'
export type PublicationStatus = 'authoritative' | 'incomplete' | 'non_authoritative'
export type RetainedPublicationAuthority = PublicationStatus

export type FinalPublication = {
  status: PublicationStatus
  artifactKind: FinalArtifactKind
  outputRoot: string
  zipPath: string | null
}

export type RetainedPublicationInput = {
  outputRoot: string
  authority: RetainedPublicationAuthority
  artifactKind: FinalArtifactKind
  zipPath: string | null
  cleanupPaths: readonly string[]
}

export type RetainedPublicationResult = {
  authority: RetainedPublicationAuthority
  markerFile: 'INCOMPLETE' | 'NON_AUTHORITATIVE' | null
}

export async function publishFinalArtifacts (publication: FinalPublication): Promise<void> {
  await publishRetainedOutcome({
    outputRoot: publication.outputRoot,
    authority: publication.status,
    artifactKind: publication.artifactKind,
    zipPath: publication.zipPath,
    cleanupPaths: []
  })
}

export async function publishRetainedOutcome (publication: RetainedPublicationInput): Promise<RetainedPublicationResult> {
  const outputRoot = path.resolve(publication.outputRoot)
  await ensureDirectoryNoFollow(outputRoot)
  if (publication.artifactKind === 'zip' && publication.zipPath === null) {
    throw new Error('zip publication requires zip path')
  }

  await removeCleanupPaths(outputRoot, publication.cleanupPaths)

  if (publication.authority === 'authoritative') {
    await fs.rm(path.join(outputRoot, 'INCOMPLETE'), { force: true })
    await fs.rm(path.join(outputRoot, 'NON_AUTHORITATIVE'), { force: true })
    return {
      authority: publication.authority,
      markerFile: null
    }
  }

  if (publication.authority === 'incomplete') {
    await writeFileNoFollowAtomic(path.join(outputRoot, 'INCOMPLETE'), 'incomplete=1\n', 0o600)
    await fs.rm(path.join(outputRoot, 'NON_AUTHORITATIVE'), { force: true })
    return {
      authority: publication.authority,
      markerFile: 'INCOMPLETE'
    }
  }

  await writeFileNoFollowAtomic(path.join(outputRoot, 'NON_AUTHORITATIVE'), 'non_authoritative=1\n', 0o600)
  return {
    authority: publication.authority,
    markerFile: 'NON_AUTHORITATIVE'
  }
}

async function removeCleanupPaths (outputRoot: string, cleanupPaths: readonly string[]): Promise<void> {
  for (const cleanupPath of cleanupPaths) {
    await removeTreeNoFollow(joinGovernedRelativePath(outputRoot, cleanupPath))
  }
}
