/**
 * Erzeugt den TESTINHALT dieses Repositories.
 *
 * Die redaktionellen Inhalte leben seit der Aufteilung in `quiz-content-data`.
 * Was hier bleibt, ist ein synthetischer Bestand, der genau eine Aufgabe hat:
 * jeden Fragenplatz jedes Presets bedienen, damit Unit- und E2E-Tests ein
 * vollstaendiges Spiel durchspielen koennen.
 *
 * ERZEUGT UND NICHT VON HAND GEPFLEGT: Kommt ein Preset oder ein Fragentyp
 * hinzu, faellt sonst erst im Testlauf auf, dass der Bestand nicht mehr passt.
 * Dieses Skript liest die Slotfilter und legt zu jeder gebrauchten Kombination
 * genug Fragen an.
 *
 *   node scripts/build-content-fixtures.mjs
 *   pnpm content:demo-assets && pnpm content:validate && pnpm content:build
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const sourceDir = join(process.cwd(), 'content', 'source')
const config = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(join(sourceDir, 'config.json'), 'utf8')))

/** Drei Kandidaten je Kombination: genug fuer ein Spiel ohne Wiederholung. */
const PRO_KOMBINATION = 3

/**
 * Typen, von denen es genau EINE Frage gibt.
 *
 * Video- und Portraetfrage stehen im Preset auf eigenen Testplaetzen ohne
 * Schwierigkeitsfilter; im redaktionellen Bestand gibt es je genau eine. Die
 * Tests messen daran, dass ein zu kleiner Pool sich wiederholen MUSS - deshalb
 * bildet der Testbestand diese Eigenschaft nach.
 */
const EINZELSTUECKE = ['video-then-question', 'person']

const alleTypen = ['text-choice', 'image-choice', 'person', 'image-reveal', 'video-then-question']
/**
 * Typen, die ein Slot OHNE Typfilter bekommen soll.
 *
 * Bilderkennen, Portraet und Video sind Sondertypen mit eigenen Fragenplaetzen:
 * Sie brauchen ein Bild in besonderer Komposition, eine Enthuellung oder einen
 * Vorspann. Ein Platz, der einfach "irgendeine Frage" verlangt, bekommt sie im
 * redaktionellen Bestand nur zufaellig - und ein Bilderkennen ohne
 * Enthuellungsslot waere im Test bloss verwirrend.
 */
const NEUTRALE_TYPEN = ['text-choice', 'image-choice']
const alleSchwierigkeiten = config.difficulties.map((entry) => entry.id)
const alleKategorien = config.categories.map((entry) => entry.id)
const allePools = config.pools.map((entry) => entry.id)
const alleZielgruppen = config.audiences.map((entry) => entry.id)

/**
 * Welche Kombinationen verlangen die Presets?
 *
 * Ein Slot ohne Typfilter nimmt jeden Typ, einer ohne Schwierigkeitsfilter jede
 * Schwierigkeit. Um nichts zu uebersehen, wird das Kreuzprodukt aller genannten
 * Werte gebildet - der Bestand bleibt trotzdem klein.
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
         * Bilderkennen wird IMMER muendlich bewertet - so ist es im
         * redaktionellen Bestand, und die Touch-Presets ziehen es deshalb gar
         * nicht erst (sie filtern auf `option-comparison`). Eine Fassung mit
         * Antwortoptionen gaebe es dort nur im Testbestand; sie wuerde den
         * Buehnenpresets eine Frage unterschieben, die niemand vorliest.
         */
        if (typ === 'image-reveal' && !bewertungen.includes('manual-correct-incorrect')) continue
        const bewertung = typ === 'image-reveal' ? 'manual-correct-incorrect' : 'option-comparison'
        const kategorie = kategorien[0]
        /*
         * Einzelstuecke bekommen EINEN Eintrag, egal ueber wie viele Slots sie
         * gefordert werden: Ihr Testplatz filtert nicht nach Schwierigkeit, und
         * ein Slot ohne Typfilter nimmt sie ohnehin nur nebenbei mit.
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
  // Von der Videofrage genuegt eine: Sie ist Vorspann, nicht Spielinhalt.
  const anzahl = EINZELSTUECKE.includes(typ) ? 1 : PRO_KOMBINATION
  for (let index = 0; index < anzahl; index += 1) {
    laufendeNummer += 1
    // Die Bewertungsart gehoert in die Kennung: Bilderkennen gibt es muendlich
    // (Buehne) und mit Antwortoptionen (Touchgeraet) - sonst kollidieren die IDs.
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
      explanation: { summary: `Erklaerung zur Testfrage ${laufendeNummer}.` },
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

// Branding der Zielgruppen und Themes - sonst fehlten Startgrafik und Logo.
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
