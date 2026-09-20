/**
 * WHAT THE DESK HAS SET UP BUT NOT YET STARTED.
 *
 * The choice is a command like any other, and it lives in the service and not
 * in a window: three screens read it - the form, the preview beside it, and
 * the offer overview in the room, which marks the card that is coming. What is
 * measured here is that it reaches every one of them, that the room learns
 * only the quiz and not the level, and that a start consumes it.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createSeededRng,
  questionSchema,
  quizConfigSchema,
  quizPackageManifestSchema,
  type Command,
  type QuizPackage,
} from '../src'
import { LocalQuizRuntime } from '../src/runtime/localRuntime'

function loadTestPackage(): QuizPackage {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'content', 'dist')
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown
  const manifest = quizPackageManifestSchema.parse(read('manifest.json'))
  return {
    manifest,
    config: quizConfigSchema.parse(read('config.json')),
    questions: questionSchema.array().parse(read('questions.json')),
    assetsById: new Map(manifest.assets.map((asset) => [asset.id, asset])),
    rootDir: dir,
  }
}

function desk() {
  const runtime = new LocalQuizRuntime({
    quizPackage: loadTestPackage(),
    now: () => Date.UTC(2026, 7, 18, 19, 0, 0),
    random: createSeededRng(12345),
  })
  const send = (command: Command) =>
    runtime.service.dispatch({
      commandId: `test-${Math.random().toString(36).slice(2)}`,
      actor: { role: 'operator', clientId: 'test-desk' },
      expectedRevision: runtime.service.snapshotFor('operator').revision,
      command,
    })
  return { runtime, send, stage: () => runtime.service.snapshotFor('stage'), operator: () => runtime.service.snapshotFor('operator') }
}

describe("The desk's choice before the start", () => {
  it('marks nothing as long as nothing is chosen', () => {
    const { stage, operator } = desk()
    expect(stage().selectedQuizId).toBeUndefined()
    expect(operator().quizSelection).toBeUndefined()
  })

  it('reaches the room and the desk - the level only the desk', () => {
    const { send, stage, operator } = desk()
    const quiz = operator().catalog.quizzes[0]!

    expect(send({ type: 'SELECT_QUIZ', quizId: quiz.id, presetId: quiz.defaultPresetId }).ok).toBe(true)

    expect(stage().selectedQuizId).toBe(quiz.id)
    expect(operator().quizSelection).toEqual({ quizId: quiz.id, presetId: quiz.defaultPresetId })
    /* The room is not told how hard it will be - that is configuration. */
    expect(Object.keys(stage())).not.toContain('quizSelection')
  })

  it('moves to the last card clicked instead of collecting them', () => {
    const { send, stage, operator } = desk()
    const [first, second] = operator().catalog.quizzes

    send({ type: 'SELECT_QUIZ', quizId: first!.id })
    send({ type: 'SELECT_QUIZ', quizId: second!.id })
    expect(stage().selectedQuizId).toBe(second!.id)
  })

  it('is consumed by the start - the next group starts from an empty form', () => {
    const { send, stage, operator } = desk()
    const quiz = operator().catalog.quizzes[0]!

    send({ type: 'SELECT_QUIZ', quizId: quiz.id, presetId: quiz.defaultPresetId })
    expect(send({ type: 'START_GAME', quizId: quiz.id, presetId: quiz.defaultPresetId }).ok).toBe(true)

    expect(operator().quizSelection).toBeUndefined()
    expect(stage().selectedQuizId).toBeUndefined()
  })

  it('is refused while a game runs - there is nothing to choose then', () => {
    const { send, operator } = desk()
    const quiz = operator().catalog.quizzes[0]!
    send({ type: 'START_GAME', quizId: quiz.id, presetId: quiz.defaultPresetId })

    const result = send({ type: 'SELECT_QUIZ', quizId: quiz.id })
    expect(result.ok).toBe(false)
    expect(result.rejection?.reason).toBe('invalid-phase')
  })
})
