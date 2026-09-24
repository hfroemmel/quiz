/**
 * A REHEARSED ROUND: seven agreed questions, in the agreed order.
 *
 * The evening of a guided round is not a draw. The questions are chosen
 * beforehand, they build on one another, and the order is part of the
 * dramaturgy - so a place of such a preset names its question
 * (`filters.questionIds`), and the seven places are the running order.
 *
 * The mechanism is proved HERE, against the selection the server really uses:
 * the content service builds the question source, and the source is asked slot
 * by slot exactly as the engine asks it. The three rounds of the live quiz's
 * own content are data and are proved where they live (`quiz-live`).
 */
import { describe, expect, it } from 'vitest'
import { createSeededRng, type QuizConfig, type QuizPackage } from '../src'
import { ContentService } from '../src/runtime/contentService'
import { makeQuestion, testConfig } from './helpers'

/** Seven questions of a round, plus three the draw must not reach for. */
const round = ['q-291', 'q-292', 'q-293', 'q-294', 'q-295', 'q-296', 'q-297']
const questions = [...round, 'q-298', 'q-299', 'q-300'].map((id) => makeQuestion({ id }))

function packageWith(config: QuizConfig): QuizPackage {
  return {
    manifest: {
      schemaVersion: 2,
      contentVersion: '1.0.0',
      createdAt: new Date(0).toISOString(),
      questionsFile: 'questions.json',
      configFile: 'config.json',
      assets: [],
      checksum: 'test',
    },
    config,
    questions,
    assetsById: new Map(),
    rootDir: '/nowhere',
  }
}

/** The configuration of a round: one named question per place, in order. */
function withRound(ids: string[]): QuizConfig {
  return {
    ...testConfig,
    questionsPerGame: ids.length,
    presets: [
      ...testConfig.presets,
      {
        id: 'runde-1',
        label: 'Runde 1',
        slots: ids.map((id, index) => ({
          id: `frage-${index + 1}`,
          label: `Frage ${index + 1}`,
          filters: { questionIds: [id] },
        })),
      },
    ],
    audiences: testConfig.audiences.map((audience) =>
      audience.id === 'adults'
        ? { ...audience, allowedPresetIds: [...audience.allowedPresetIds, 'runde-1'] }
        : audience,
    ),
  }
}

/** Plays the places of a preset through, the way the engine does. */
function playedOrder(config: QuizConfig, presetId: string, seed: number): string[] {
  const source = new ContentService(packageWith(config)).createQuestionSource([], createSeededRng(seed))
  const slotCount = source.slotCountFor('adults', presetId)
  expect(slotCount).toBe(config.questionsPerGame)
  const played: string[] = []
  for (let slotIndex = 0; slotIndex < (slotCount ?? 0); slotIndex += 1) {
    const answer = source.selectForSlot({
      audience: 'adults',
      presetId,
      slotIndex,
      excludeQuestionIds: [...played],
      excludeRepetitionGroupIds: [...played],
      poolIds: undefined,
    })
    expect(answer.ok, `Fragenplatz ${slotIndex + 1}`).toBe(true)
    if (answer.ok) played.push(answer.runtimeQuestion.question.id)
  }
  return played
}

describe('A round with a fixed programme', () => {
  it('plays the seven named questions in the order they stand in', () => {
    expect(playedOrder(withRound(round), 'runde-1', 1)).toEqual(round)
  })

  /*
   * AND IT IS THE ORDER OF THE PLACES, not of the corpus: swapped in the
   * configuration, the round is played swapped. That is the whole promise the
   * editors get - the list is theirs, and nothing sorts it again.
   */
  it('follows the configuration when the order is exchanged', () => {
    const swapped = [...round].reverse()
    expect(playedOrder(withRound(swapped), 'runde-1', 1)).toEqual(swapped)
  })

  /*
   * WHATEVER THE DICE SAY. A drawn round is different on every throw; this one
   * is the same, which is what makes it rehearsable.
   */
  it('stands still across every seed the draw could use', () => {
    for (const seed of [1, 7, 42, 4711]) {
      expect(playedOrder(withRound(round), 'runde-1', seed), `Seed ${seed}`).toEqual(round)
    }
  })

  /*
   * And the free round beside it still draws: the same corpus, the preset
   * without named places, and the order is no longer the corpus's.
   */
  it('leaves an unnamed round to the draw', () => {
    const free: QuizConfig = {
      ...withRound(round),
      presets: [
        ...withRound(round).presets,
        {
          id: 'alle-fragen',
          label: 'Alle Fragen',
          slots: round.map((_, index) => ({ id: `frage-${index + 1}`, filters: {} })),
        },
      ],
      audiences: withRound(round).audiences.map((audience) =>
        audience.id === 'adults'
          ? { ...audience, allowedPresetIds: [...audience.allowedPresetIds, 'alle-fragen'] }
          : audience,
      ),
    }
    const drawn = playedOrder(free, 'alle-fragen', 3)
    expect(drawn).toHaveLength(round.length)
    expect(new Set(drawn).size).toBe(round.length)
    expect(drawn).not.toEqual(round)
  })
})
