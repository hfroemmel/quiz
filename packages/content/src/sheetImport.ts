/**
 * Aus einer Redaktionstabelle werden Fragen.
 *
 * WARUM UEBERHAUPT: Fragen entstehen nicht in JSON. Sie entstehen in einer
 * Tabelle, an der mehrere Leute gleichzeitig sitzen, mit Kommentaren und
 * Faerbungen daneben. Dieser Schritt ist die Bruecke - und er ist bewusst eine
 * EINBAHNSTRASSE: Die Tabelle ist die Quelle, `questions.json` das Erzeugnis.
 * Wer im Erzeugnis korrigiert, verliert es beim naechsten Import.
 *
 * WAS HIER NICHT STEHT: das Netz. Diese Datei rechnet auf einer Zeichenkette,
 * damit sie ohne Google und ohne Zugangsdaten pruefbar ist; das Holen macht das
 * CLI.
 *
 * DIE ZUORDNUNG DER SPALTEN IST KONFIGURATION, kein Code. Jede Redaktion nennt
 * ihre Spalten anders, und eine Tabelle umzubenennen ist die schlechtere
 * Loesung als eine Zuordnungsdatei danebenzulegen.
 */
import { questionSchema, type Question } from '@hfroemmel/quiz-core'
import { csvZuZeilen } from './csv'

/** Buchstaben der Antwortoptionen - dieselbe Ordnung wie auf der Buehne. */
const OPTIONSBUCHSTABEN = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export interface SheetMapping {
  /**
   * Welche Spalte traegt welches Feld. Fehlt ein Eintrag, greift die Vorgabe.
   *
   * `options` ist eine Liste: eine Spalte je Antwortmoeglichkeit, in der
   * Reihenfolge A, B, C, D.
   */
  spalten: {
    id?: string
    prompt?: string
    difficulty?: string
    categories?: string
    pools?: string
    audiences?: string
    locale?: string
    questionType?: string
    options?: string[]
    /** Die richtige Antwort - als Buchstabe (`B`), als Nummer (`2`) oder als Text. */
    correct?: string
    acceptedAnswerText?: string
    imageAssetId?: string
    videoAssetId?: string
    explanation?: string
    source?: string
    tags?: string
    enabled?: string
  }
  /** Was gilt, wo die Tabelle nichts sagt. */
  vorgaben?: {
    poolIds?: string[]
    audiences?: string[]
    locale?: string
    difficulty?: string
    questionType?: Question['questionType']
    tags?: string[]
  }
  /**
   * Uebersetzung von Zellwerten auf Bezeichner - je Feld eine Tabelle.
   *
   * In der Tabelle steht "leicht", im Schema steht `easy`. Ohne diese Ebene
   * muesste die Redaktion Bezeichner tippen, und genau das erzeugt Tippfehler,
   * die erst beim Bauen auffallen.
   */
  werte?: Partial<Record<'difficulty' | 'questionType' | 'categories' | 'pools' | 'audiences', Record<string, string>>>
}

export interface ImportBefund {
  fragen: Question[]
  /** Zeilen, die nicht uebernommen wurden - mit Zeilennummer und Grund. */
  uebersprungen: { zeile: number; grund: string }[]
  /** Gelesene Spaltenueberschriften, fuer die Fehlersuche an der Zuordnung. */
  spalten: string[]
}

/** Die Zuordnung, mit der ein Bestand ohne eigene Datei durchlaeuft. */
export const standardMapping: SheetMapping = {
  spalten: {
    id: 'ID',
    prompt: 'Frage',
    difficulty: 'Schwierigkeit',
    categories: 'Kategorie',
    audiences: 'Zielgruppe',
    questionType: 'Typ',
    options: ['A', 'B', 'C', 'D'],
    correct: 'Richtig',
    acceptedAnswerText: 'Antwort',
    imageAssetId: 'Bild',
    videoAssetId: 'Video',
    explanation: 'Erklärung',
    source: 'Quelle',
  },
  vorgaben: { poolIds: ['bundestag'], audiences: ['adults'], locale: 'de-DE', difficulty: 'medium' },
  werte: {
    difficulty: { leicht: 'easy', mittel: 'medium', schwer: 'hard' },
    questionType: {
      text: 'text-choice',
      bild: 'image-choice',
      person: 'person',
      bilderkennen: 'image-reveal',
      video: 'video-then-question',
    },
  },
}

function bezeichner(wert: string): string {
  /*
   * Aus "Ämter & Recht" wird "aemter-recht": Bezeichner duerfen nur a-z, 0-9
   * und die drei Trennzeichen tragen (siehe `idSchema`). Umlaute werden
   * ausgeschrieben statt entfernt - "Amter" waere ein anderer Begriff.
   */
  return wert
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function liste(wert: string | undefined, uebersetzung?: Record<string, string>): string[] {
  if (!wert) return []
  return wert
    .split(/[,;/]/)
    .map((eintrag) => eintrag.trim())
    .filter((eintrag) => eintrag !== '')
    .map((eintrag) => uebersetzung?.[eintrag.toLowerCase()] ?? bezeichner(eintrag))
}

function jaNein(wert: string | undefined): boolean | undefined {
  if (wert === undefined || wert.trim() === '') return undefined
  return !['nein', 'no', 'false', '0', 'inaktiv'].includes(wert.trim().toLowerCase())
}

/**
 * Welche Option ist die richtige?
 *
 * Redaktionen schreiben das auf drei Arten auf: als Buchstabe, als Nummer oder
 * indem sie die Antwort noch einmal hinschreiben. Alle drei werden gelesen -
 * eine Tabelle umzuschreiben, weil das Werkzeug nur eine Schreibweise kennt,
 * waere die falsche Richtung.
 */
function findeRichtige(wert: string, optionen: { id: string; text: string }[]): string | undefined {
  const gesucht = wert.trim()
  if (gesucht === '') return undefined

  const alsBuchstabe = gesucht.toLowerCase().replace(/[^a-z]/g, '')
  if (alsBuchstabe.length === 1 && optionen.some((option) => option.id === alsBuchstabe)) return alsBuchstabe

  const alsNummer = Number(gesucht)
  if (Number.isInteger(alsNummer) && alsNummer >= 1 && alsNummer <= optionen.length) {
    return optionen[alsNummer - 1]!.id
  }

  const alsText = optionen.find((option) => option.text.trim().toLowerCase() === gesucht.toLowerCase())
  return alsText?.id
}

/**
 * Tabelle in Fragen uebersetzen.
 *
 * Eine Zeile, die nicht durchgeht, hält den Import NICHT an: Sie wird mit
 * Zeilennummer und Grund gemeldet, und der Rest laeuft durch. Ein Bestand von
 * zweihundert Fragen wegen einer halbfertigen Zeile gar nicht zu bekommen, ist
 * in der Redaktion die teurere Antwort - der Bericht sagt, was fehlt.
 */
export function importiereTabelle(csv: string, mapping: SheetMapping = standardMapping): ImportBefund {
  const { spalten, zeilen } = csvZuZeilen(csv)
  const zu = mapping.spalten
  const vorgabe = mapping.vorgaben ?? {}
  const werte = mapping.werte ?? {}

  const fragen: Question[] = []
  const uebersprungen: { zeile: number; grund: string }[] = []

  zeilen.forEach((zeile, index) => {
    // Zeile 1 ist die Kopfzeile; die erste Datenzeile ist Zeile 2.
    const zeilennummer = index + 2
    const zelle = (name: string | undefined): string | undefined => (name ? zeile[name] : undefined)

    const prompt = zelle(zu.prompt)?.trim()
    if (!prompt) {
      uebersprungen.push({ zeile: zeilennummer, grund: 'Keine Frage in der Fragespalte.' })
      return
    }

    const optionen = (zu.options ?? [])
      .map((name, stelle) => ({ id: OPTIONSBUCHSTABEN[stelle] ?? `o${stelle + 1}`, text: (zeile[name] ?? '').trim() }))
      .filter((option) => option.text !== '')

    const questionType =
      (werte.questionType?.[(zelle(zu.questionType) ?? '').toLowerCase()] as Question['questionType'] | undefined) ??
      (zelle(zu.questionType)?.trim() as Question['questionType'] | undefined) ??
      vorgabe.questionType ??
      (optionen.length >= 2 ? 'text-choice' : 'image-reveal')

    const correctOptionId = optionen.length >= 2 ? findeRichtige(zelle(zu.correct) ?? '', optionen) : undefined
    if (optionen.length >= 2 && !correctOptionId) {
      uebersprungen.push({ zeile: zeilennummer, grund: 'Die richtige Antwort ist nicht zuzuordnen.' })
      return
    }

    const kategorien = liste(zelle(zu.categories), werte.categories)
    const pools = liste(zelle(zu.pools), werte.pools)
    const zielgruppen = liste(zelle(zu.audiences), werte.audiences)
    const erwartet = (zelle(zu.acceptedAnswerText) ?? '')
      .split(/\r?\n|;/)
      .map((eintrag) => eintrag.trim())
      .filter((eintrag) => eintrag !== '')

    const bild = zelle(zu.imageAssetId)?.trim()
    const film = zelle(zu.videoAssetId)?.trim()
    const erklaerung = zelle(zu.explanation)?.trim()
    const quelle = zelle(zu.source)?.trim()

    const roh = {
      id: bezeichner(zelle(zu.id)?.trim() || `frage-${zeilennummer}`),
      poolIds: pools.length > 0 ? pools : (vorgabe.poolIds ?? ['default']),
      audiences: zielgruppen.length > 0 ? zielgruppen : (vorgabe.audiences ?? ['adults']),
      difficulty:
        werte.difficulty?.[(zelle(zu.difficulty) ?? '').toLowerCase()] ??
        (zelle(zu.difficulty) ? bezeichner(zelle(zu.difficulty)!) : undefined) ??
        vorgabe.difficulty ??
        'medium',
      categories: kategorien,
      tags: liste(zelle(zu.tags)).concat(vorgabe.tags ?? []),
      locale: zelle(zu.locale)?.trim() || vorgabe.locale || 'de-DE',
      prompt,
      questionType,
      evaluationMode: correctOptionId ? ('option-comparison' as const) : ('manual-correct-incorrect' as const),
      ...(optionen.length >= 2 ? { options: optionen, correctOptionId } : {}),
      ...(erwartet.length > 0 ? { acceptedAnswerText: erwartet } : {}),
      ...(bild || film
        ? { media: { ...(bild ? { imageAssetId: bild } : {}), ...(film ? { videoAssetId: film } : {}) } }
        : {}),
      ...(erklaerung || quelle
        ? { explanation: { ...(erklaerung ? { summary: erklaerung } : {}), ...(quelle ? { source: quelle } : {}) } }
        : {}),
      enabled: jaNein(zelle(zu.enabled)) ?? true,
    }

    /*
     * GEPRUEFT WIRD HIER, nicht erst beim Bauen: Eine Frage, die das Schema
     * nicht haelt, ist ein Fehler der Tabelle - und die Zeilennummer ist das
     * Einzige, womit die Redaktion ihn findet.
     */
    const geprueft = questionSchema.safeParse(roh)
    if (!geprueft.success) {
      const gruende = geprueft.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      uebersprungen.push({ zeile: zeilennummer, grund: gruende })
      return
    }
    fragen.push(geprueft.data)
  })

  return { fragen, uebersprungen, spalten }
}

/**
 * Die CSV-Adresse einer Google-Tabelle.
 *
 * Google liefert jede Tabelle als CSV aus, ohne API und ohne Schluessel - eine
 * Freigabe "Jeder mit dem Link" genuegt. Das ist der Grund, warum dieser Import
 * ohne Zugangsdaten auskommt.
 */
export function csvAdresse(tabelle: string): string {
  const id = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(tabelle)?.[1] ?? tabelle
  const gid = /[#&?]gid=([0-9]+)/.exec(tabelle)?.[1]
  const adresse = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
  return gid ? `${adresse}&gid=${gid}` : adresse
}
