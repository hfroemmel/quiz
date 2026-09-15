/**
 * Generates the TEST CONTENT for this repository.
 *
 * The editorial content has lived in `quiz-content-data` since the split.
 * What remains here is a synthetic set with exactly one job: fill every
 * question slot of every preset, so unit and E2E tests can play through a
 * complete game.
 *
 * GENERATED AND NOT MAINTAINED BY HAND: if a preset or question type is
 * added, it would otherwise only show up as a mismatch during a test run.
 * This script reads the slot filters and creates enough questions for every
 * combination that's actually used.
 *
 *   node scripts/build-content-fixtures.mjs
 *   pnpm content:demo-assets && pnpm content:validate && pnpm content:build
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const sourceDir = join(process.cwd(), 'content', 'source')
const config = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(join(sourceDir, 'config.json'), 'utf8')))

/** Three candidates per combination: enough for one game without repeats. */
const PRO_KOMBINATION = 3

/**
 * Types of which there is exactly ONE question.
 *
 * The video and portrait question types sit in the preset on their own test
 * slots without a difficulty filter; in the editorial content there is
 * exactly one of each. The tests rely on a pool that's too small being
 * forced to repeat - so the test content reproduces that property.
 */
const EINZELSTUECKE = ['video-then-question', 'person']

const alleTypen = ['text-choice', 'image-choice', 'person', 'image-reveal', 'video-then-question']
/**
 * Types that a slot WITHOUT a type filter should receive.
 *
 * Image recognition, portrait and video are special types with their own
 * question slots: they need an image in a special composition, a reveal, or
 * a lead-in. A slot that simply asks for "any question" only gets them by
 * chance in the editorial content - and an image-recognition question
 * without a reveal slot would just be confusing in a test.
 */
const NEUTRALE_TYPEN = ['text-choice', 'image-choice']
const alleSchwierigkeiten = config.difficulties.map((entry) => entry.id)
const alleKategorien = config.categories.map((entry) => entry.id)
/**
 * Pools that deliberately stay EMPTY.
 *
 * `europa` is in the configuration so that there is a quiz whose pool holds no
 * questions: the start menu says why such a quiz cannot be started, BEFORE the
 * attempt, and that sentence needs a quiz it is true for. Handing questions
 * round-robin to every pool in the config would fill it and take the case away.
 */
const EMPTY_POOLS = ['europa']
const allePools = config.pools.map((entry) => entry.id).filter((id) => !EMPTY_POOLS.includes(id))
const alleZielgruppen = config.audiences.map((entry) => entry.id)

/**
 * Which combinations do the presets require?
 *
 * A slot without a type filter accepts any type, one without a difficulty
 * filter accepts any difficulty. To not miss anything, the cross product of
 * all named values is formed - the content set still stays small.
 */
const kombinationen = new Map()
for (const preset of config.presets) {
  for (const slot of preset.slots) {
    const filters = slot.filters ?? {}
    const typen = filters.questionTypes ?? NEUTRALE_TYPEN
    const schwierigkeiten = filters.difficultyIds ?? alleSchwierigkeiten
    const kategorien = filters.categoryIds ?? alleKategorien
    const bewertungen = filters.evaluationModes ?? ['option-comparison', 'manual-correct-incorrect']
    for (const typ of typen) {
      for (const schwierigkeit of schwierigkeiten) {
        /*
         * Image recognition is ALWAYS scored verbally - that's how it is in
         * the editorial content, so the touch presets don't draw it at all
         * (they filter on `option-comparison`). A version with answer
         * options would only exist there in the test content; it would slip
         * the stage presets a question that no one reads aloud.
         */
        if (typ === 'image-reveal' && !bewertungen.includes('manual-correct-incorrect')) continue
        const bewertung = typ === 'image-reveal' ? 'manual-correct-incorrect' : 'option-comparison'
        const kategorie = kategorien[0]
        /*
         * One-off types get ONE entry, no matter how many slots demand them:
         * their test slot doesn't filter by difficulty, and a slot without a
         * type filter only picks them up incidentally anyway.
         */
        const einzelstueck = EINZELSTUECKE.includes(typ)
        const stufe = einzelstueck ? alleSchwierigkeiten[0] : schwierigkeit
        const schluessel = einzelstueck ? typ : `${typ}|${stufe}|${bewertung}`
        kombinationen.set(schluessel, { typ, schwierigkeit: stufe, bewertung, kategorie })
      }
    }
  }
}

const fragen = []
const medien = []
let laufendeNummer = 0

const braucht = { image: ['image-choice', 'person', 'image-reveal'], video: ['video-then-question'] }

for (const { typ, schwierigkeit, bewertung, kategorie } of kombinationen.values()) {
  // One video question is enough: it's a lead-in, not game content.
  const anzahl = EINZELSTUECKE.includes(typ) ? 1 : PRO_KOMBINATION
  for (let index = 0; index < anzahl; index += 1) {
    laufendeNummer += 1
    // The scoring type belongs in the identifier: image recognition exists
    // verbally (stage) and with answer options (touch device) - otherwise the IDs collide.
    const kuerzel = bewertung === 'option-comparison' ? 'auswahl' : 'muendlich'
    const id = `test-${typ}-${schwierigkeit}-${kuerzel}-${index + 1}`
    const mitOptionen = bewertung === 'option-comparison'
    const frage = {
      id,
      poolIds: [allePools[laufendeNummer % allePools.length]],
      audiences: alleZielgruppen,
      difficulty: schwierigkeit,
      categories: [alleKategorien[laufendeNummer % alleKategorien.length], kategorie].filter(
        (value, position, liste) => liste.indexOf(value) === position,
      ),
      tags: [],
      locale: 'de-DE',
      prompt: `Testfrage ${laufendeNummer}: Welche Antwort ist die richtige?`,
      questionType: typ,
      evaluationMode: bewertung,
      ...(mitOptionen
        ? {
            options: [
              { id: 'o1', text: `Richtige Antwort ${laufendeNummer}` },
              { id: 'o2', text: `Falsche Antwort A ${laufendeNummer}` },
              { id: 'o3', text: `Falsche Antwort B ${laufendeNummer}` },
              { id: 'o4', text: `Falsche Antwort C ${laufendeNummer}` },
            ],
            correctOptionId: 'o1',
          }
        : { acceptedAnswerText: [`Richtige Antwort ${laufendeNummer}`] }),
      /*
       * BACKGROUND ON EVERYTHING BUT THE EASY LEVEL.
       *
       * The detail text is what the details step reads at a device
       * (`rules.showDetailsAfterSolution`), and that step has two cases to
       * show: a question that carries background, and one that does not. If
       * every test question had one, the second case could not be reached from
       * a test at all - so the easy level deliberately brings none.
       */
      explanation: {
        summary: `Erklaerung zur Testfrage ${laufendeNummer}.`,
        ...(schwierigkeit === 'easy'
          ? {}
          : {
              details: `Hintergrund zur Testfrage ${laufendeNummer}: Dieser Absatz steht fuer den redaktionellen Hintergrund, den am Geraet niemand erzaehlt - er wird gelesen.`,
            }),
      },
      /*
       * EVERY test question carries an English version. Multilingualism is
       * not a special case of individual questions but a property of the
       * whole flow - a content set with just one translated question in it
       * wouldn't find the spot where the language gets lost.
       */
      translations: {
        'en-GB': {
          prompt: `Test question ${laufendeNummer}: which answer is correct?`,
          ...(mitOptionen
            ? {
                options: [
                  { id: 'o1', text: `Correct answer ${laufendeNummer}` },
                  { id: 'o2', text: `Wrong answer A ${laufendeNummer}` },
                  { id: 'o3', text: `Wrong answer B ${laufendeNummer}` },
                  { id: 'o4', text: `Wrong answer C ${laufendeNummer}` },
                ],
              }
            : { acceptedAnswerText: [`Correct answer ${laufendeNummer}`] }),
          explanation: {
            summary: `Explanation for test question ${laufendeNummer}.`,
            ...(schwierigkeit === 'easy'
              ? {}
              : {
                  details: `Background for test question ${laufendeNummer}: this paragraph stands for the editorial background that nobody tells at a device - it is read.`,
                }),
          },
        },
      },
      enabled: true,
    }

    if (braucht.image.includes(typ)) {
      const assetId = `img-${id}`
      frage.media = { imageAssetId: assetId }
      medien.push({
        id: assetId,
        kind: 'image',
        filename: `questions/${assetId}.svg`,
        mimeType: 'image/svg+xml',
        credit: 'Platzhalter',
      })
    }
    if (braucht.video.includes(typ)) {
      const assetId = `vid-${id}`
      frage.media = { videoAssetId: assetId }
      medien.push({
        id: assetId,
        kind: 'video',
        filename: `video/${assetId}.mp4`,
        mimeType: 'video/mp4',
        credit: 'Platzhalter',
      })
    }
    fragen.push(frage)
  }
}

// Branding of the audiences and themes - otherwise the start graphic and logo would be missing.
const brandingIds = new Set()
for (const audience of config.audiences) if (audience.startVisualAssetId) brandingIds.add(audience.startVisualAssetId)
for (const theme of config.themes) if (theme.logoAssetId) brandingIds.add(theme.logoAssetId)
for (const id of brandingIds) {
  medien.push({ id, kind: 'image', filename: `branding/${id}.svg`, mimeType: 'image/svg+xml', credit: 'Platzhalter' })
}

fragen.sort((a, b) => a.id.localeCompare(b.id))
medien.sort((a, b) => a.id.localeCompare(b.id))

rmSync(join(sourceDir, 'assets'), { recursive: true, force: true })
mkdirSync(join(sourceDir, 'assets'), { recursive: true })
writeFileSync(join(sourceDir, 'questions.json'), `${JSON.stringify(fragen, null, 2)}\n`)
writeFileSync(join(sourceDir, 'assets.json'), `${JSON.stringify(medien, null, 2)}\n`)

console.log(`${fragen.length} Testfragen und ${medien.length} Medienverweise geschrieben.`)
console.log('Naechster Schritt: pnpm content:demo-assets (erzeugt die Platzhalterdateien).')
