/** Gemeinsame Projektpfade der Inhaltspipeline. */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Wurzel des Monorepos. */
export const repositoryRoot = resolve(here, '..', '..', '..')

/** Redaktionelle Quelle (von Hand oder ueber `content:fetch` gepflegt). */
export const contentSourceDir = join(repositoryRoot, 'content', 'source')

/** Gebautes, versioniertes Quizpaket. Der Server laedt ausschliesslich von hier. */
export const contentPackageDir = join(repositoryRoot, 'content', 'dist')

/** Berichte der Inhaltspipeline. */
export const contentReportDir = join(repositoryRoot, 'content', 'reports')

/** Laufzeitdaten des Servers (SQLite, Exporte). */
export const runtimeDir = join(repositoryRoot, 'runtime')
