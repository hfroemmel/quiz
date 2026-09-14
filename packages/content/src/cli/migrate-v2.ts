/**
 * One-time migration of the content source from schema v1 to v2.
 *
 *   pnpm content:migrate-v2 [--source <dir>]
 *
 * What changes (packaging specification, schema v2):
 *   - `modeIds` becomes `audiences`; the audiences themselves stay.
 *   - NEW `poolIds`: questions of the regional category "saarbruecken" form
 *     the pool `saarbruecken`, all others the pool `bundestag`. The category
 *     stays as a rubric - the pool is the SELECTION, the rubric the heading
 *     on stage.
 *   - `difficultyId`/`categoryIds`/`presentationType` are called `difficulty`,
 *     `categories`, `questionType`; NEW `locale` (de-DE).
 *   - Configuration: `modes` becomes `audiences` (without filter expressions),
 *     the special mode "saarbruecken" is dropped in favour of the pool; its
 *     preset `regional` moves to the adults. Slot filter `presentationTypes`
 *     is called `questionTypes`. Colours and fonts leave the themes.
 *
 * The migration runs IN PLACE over `content/source` and is idempotent:
 * already migrated files are recognised and left unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flagValue } from './dirs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const sourceDir = resolve(flagValue(args, '--source') ?? join(process.cwd(), 'content', 'source'))

const REGIONAL_CATEGORY = 'saarbruecken'
const REGIONAL_POOL = 'saarbruecken'
const DEFAULT_POOL = 'bundestag'

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

/* -------- Questions -------- */

const questionsFile = join(sourceDir, 'questions.json')
const questions = readJson(questionsFile) as Record<string, unknown>[]
let migratedQuestions = 0

const migrated = questions.map((question) => {
  if (question['audiences']) return question
  migratedQuestions += 1
  const { modeIds, difficultyId, categoryIds, presentationType, ...rest } = question
  const categories = (categoryIds as string[] | undefined) ?? []
  const ordered: Record<string, unknown> = {
    id: rest['id'],
    ...(rest['repetitionGroupId'] === undefined ? {} : { repetitionGroupId: rest['repetitionGroupId'] }),
    poolIds: categories.includes(REGIONAL_CATEGORY) ? [REGIONAL_POOL] : [DEFAULT_POOL],
    audiences: modeIds,
    difficulty: difficultyId,
    categories,
    tags: rest['tags'] ?? [],
    locale: 'de-DE',
    prompt: rest['prompt'],
    questionType: presentationType,
    evaluationMode: rest['evaluationMode'],
  }
  for (const [key, value] of Object.entries(rest)) {
    if (!(key in ordered)) ordered[key] = value
  }
  return ordered
})
writeJson(questionsFile, migrated)

/* -------- Configuration -------- */

const configFile = join(sourceDir, 'config.json')
const config = readJson(configFile) as Record<string, unknown>
let configMigrated = false

if (!config['audiences']) {
  configMigrated = true
  const modes = config['modes'] as Record<string, unknown>[]
  const regional = modes.find((mode) => mode['id'] === 'saarbruecken')
  const audiences = modes
    .filter((mode) => mode['id'] !== 'saarbruecken')
    .map((mode) => {
      const { questionFilter, allowedPresetIds, ...rest } = mode
      void questionFilter
      const presets = [...(allowedPresetIds as string[])]
      // The regional preset belongs to the adults from now on; it is played
      // via the pool selection, not via a special mode.
      if (regional && mode['id'] === 'adults') {
        for (const presetId of regional['allowedPresetIds'] as string[]) {
          if (!presets.includes(presetId)) presets.push(presetId)
        }
      }
      return { ...rest, allowedPresetIds: presets }
    })

  const themes = (config['themes'] as Record<string, unknown>[]).map((theme) => {
    const { colors, typography, ...rest } = theme
    void colors
    void typography
    return rest
  })

  const presets = (config['presets'] as Record<string, unknown>[]).map((preset) => ({
    ...preset,
    slots: (preset['slots'] as Record<string, unknown>[]).map((slot) => {
      const filters = { ...(slot['filters'] as Record<string, unknown>) }
      if (filters['presentationTypes']) {
        filters['questionTypes'] = filters['presentationTypes']
        delete filters['presentationTypes']
      }
      return { ...slot, filters }
    }),
  }))

  const ordered: Record<string, unknown> = {
    questionsPerGame: config['questionsPerGame'],
    difficulties: config['difficulties'],
    categories: config['categories'],
    pools: [
      { id: DEFAULT_POOL, label: 'Bundestag' },
      { id: REGIONAL_POOL, label: 'Saarbrücken' },
    ],
    themes,
    presets,
    audiences,
  }
  writeJson(configFile, ordered)
}

console.log(
  `Migration v2: ${migratedQuestions} von ${questions.length} Fragen migriert, ` +
    `Konfiguration ${configMigrated ? 'migriert' : 'bereits aktuell'}. Quelle: ${sourceDir}`,
)
