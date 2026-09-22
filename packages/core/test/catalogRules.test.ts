/**
 * The rules a client is told about.
 *
 * THE DESK SAYS THE CORRECTION STEP OUT LOUD. Its two buttons are announced
 * as "plus 50" and "minus 50", and that figure used to come from the engine's
 * constant instead of from the package being played - so a package that set
 * `scoring.manualAdjustmentStep` moved the score by its own step and had the
 * desk announce the constant. A screen reader then read out a number nothing
 * in the room used.
 *
 * The other two values were already here and stay: the idle watch runs in the
 * device, and whether the background gets its own step after the solution is a
 * question of the interface.
 */
import { describe, expect, it } from 'vitest'
import { LocalQuizRuntime, loadQuizPackage, scoringRules } from '../src'
import { makeQuestion, testConfig } from './helpers'

const manifest = {
  schemaVersion: '2.0.0',
  contentVersion: '1.0.0',
  profile: 'full',
  createdAt: new Date(0).toISOString(),
  questionsFile: 'questions.json',
  configFile: 'config.json',
  assets: [],
  checksum: 'abc',
}

function catalogRules(config: unknown) {
  const quizPackage = loadQuizPackage({ manifest, config, questions: [makeQuestion({ id: 'q1' })] })
  const runtime = new LocalQuizRuntime({ quizPackage })
  try {
    return runtime.getSnapshot().view?.catalog.rules
  } finally {
    runtime.dispose()
  }
}

describe('the rules in the catalogue', () => {
  it('names the correction step a package configures', () => {
    const rules = catalogRules({ ...testConfig, rules: { scoring: { manualAdjustmentStep: 10 } } })

    expect(rules?.manualAdjustmentStep).toBe(10)
    // And it is the package's figure, not the engine's - the point of the test.
    expect(rules?.manualAdjustmentStep).not.toBe(scoringRules.manualAdjustmentStep)
  })

  it('falls back to the engine step where a package sets none', () => {
    expect(catalogRules(testConfig)?.manualAdjustmentStep).toBe(scoringRules.manualAdjustmentStep)
  })
})
