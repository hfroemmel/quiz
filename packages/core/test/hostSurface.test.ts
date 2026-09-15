/**
 * What every host used to build itself.
 *
 * Two of the three concerns a host re-implemented are checked here: reading a
 * package, and resolving its media. Both were copies - four of the first, one
 * of the second that reached into the content service from outside and would
 * have broken silently on a rename.
 */
import { describe, expect, it } from 'vitest'
import { LocalQuizRuntime, loadQuizPackage } from '../src'
import { makeQuestion, testConfig } from './helpers'

const manifest = {
  schemaVersion: '2.0.0',
  contentVersion: '1.0.0',
  profile: 'full',
  createdAt: new Date(0).toISOString(),
  questionsFile: 'questions.json',
  configFile: 'config.json',
  assets: [{ id: 'img-1', kind: 'image', filename: 'assets/img-1.svg', mimeType: 'image/svg+xml' }],
  checksum: 'abc',
}

const raw = { manifest, config: testConfig, questions: [makeQuestion({ id: 'q1' })] }

describe('loadQuizPackage', () => {
  it('reads the three files into one package, with its assets addressable', () => {
    const quizPackage = loadQuizPackage(raw)

    expect(quizPackage.manifest.contentVersion).toBe('1.0.0')
    expect(quizPackage.config.questionsPerGame).toBe(testConfig.questionsPerGame)
    expect(quizPackage.questions).toHaveLength(1)
    expect(quizPackage.assetsById.get('img-1')?.filename).toBe('assets/img-1.svg')
  })

  it('has no directory unless the host names one - the core reads no files', () => {
    expect(loadQuizPackage(raw).rootDir).toBe('')
    expect(loadQuizPackage(raw, { rootDir: '/srv/quiz' }).rootDir).toBe('/srv/quiz')
  })

  it('fails at the start rather than in the middle of a game', () => {
    // A question set that is only half readable is an error, not a shrug.
    expect(() => loadQuizPackage({ ...raw, questions: [{ id: 'broken' }] })).toThrow()
    expect(() => loadQuizPackage({ ...raw, manifest: { ...manifest, checksum: '' } })).toThrow()
    expect(() => loadQuizPackage({ ...raw, config: { ...testConfig, presets: [] } })).toThrow()
  })
})

describe('the media resolution of a host', () => {
  it('serves the package route where the host says nothing', () => {
    const runtime = new LocalQuizRuntime({ quizPackage: loadQuizPackage(raw) })
    expect(runtime.content.assetUrl('img-1')).toBe('/media/img-1')
    // An id the package does not know has no medium.
    expect(runtime.content.assetUrl('img-2')).toBeUndefined()
    runtime.dispose()
  })

  it('leaves the address to the host where it brings its own', () => {
    /*
     * An application with its media in its own bundle - imported by a bundler,
     * addressed by a protocol of its own - cannot use the package route.
     */
    const runtime = new LocalQuizRuntime({
      quizPackage: loadQuizPackage(raw),
      media: (assetId) => (assetId === 'img-1' ? 'app://quiz/media/one.svg' : undefined),
    })

    expect(runtime.content.assetUrl('img-1')).toBe('app://quiz/media/one.svg')
    // And its "nothing" means nothing: the question runs without an image.
    expect(runtime.content.assetUrl('img-2')).toBeUndefined()
    expect(runtime.content.assetUrl(undefined)).toBeUndefined()
    runtime.dispose()
  })

  it('reaches the view the players see', () => {
    /*
     * The board of the start screen carries a motif of the content, and the
     * view names it as an address. It is the shortest way to check that the
     * resolution really is the one the components read - not one the test
     * calls directly.
     */
    const config = {
      ...testConfig,
      /*
       * The device only sees what it can play through alone, so the level of
       * this fixture is one it can: an answer that is compared, not judged.
       */
      presets: [{ id: 'medium', label: 'Mittel', slots: [{ id: 'text', filters: { evaluationModes: ['option-comparison' as const] } }] }],
      audiences: testConfig.audiences.map((audience) =>
        audience.id === 'adults'
          ? { ...audience, allowedPresetIds: ['medium'], startVisualAssetId: 'img-1' }
          : { ...audience, allowedPresetIds: ['medium'] },
      ),
      quizzes: undefined,
    }
    const runtime = new LocalQuizRuntime({
      quizPackage: loadQuizPackage({ ...raw, config }),
      media: (assetId) => `app://quiz/media/${assetId}.svg`,
    })

    expect(runtime.getSnapshot().view?.catalog.audiences[0]?.startVisualUrl).toBe('app://quiz/media/img-1.svg')
    runtime.dispose()
  })
})
