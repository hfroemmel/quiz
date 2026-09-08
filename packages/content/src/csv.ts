/**
 * CSV lesen - nach RFC 4180, ohne Abhaengigkeit.
 *
 * WARUM NICHT `zeile.split(',')`: In einer redaktionellen Tabelle steht in fast
 * jeder zweiten Frage ein Komma, und in Erklaerungstexten stehen Zeilenumbrueche
 * und Anfuehrungszeichen. Ein naives Trennen zerlegt genau die Zellen, auf die
 * es ankommt - und zwar still, mit einer um eins verschobenen Spalte.
 *
 * Die Regeln sind kurz: Felder trennt das Komma, Zeilen der Umbruch. Ein Feld in
 * Anfuehrungszeichen darf beides enthalten; ein doppeltes Anfuehrungszeichen
 * darin bedeutet eines.
 */

export function parseCsv(text: string): string[][] {
  // Ein BOM aus Tabellenprogrammen gehoert nicht in die erste Spaltenueberschrift.
  const roh = text.replace(/^﻿/, '')

  const zeilen: string[][] = []
  let zelle = ''
  let zeile: string[] = []
  let inAnfuehrung = false

  for (let i = 0; i < roh.length; i += 1) {
    const zeichen = roh[i]!

    if (inAnfuehrung) {
      if (zeichen !== '"') {
        zelle += zeichen
        continue
      }
      // Verdoppeltes Anfuehrungszeichen steht fuer eines im Text.
      if (roh[i + 1] === '"') {
        zelle += '"'
        i += 1
        continue
      }
      inAnfuehrung = false
      continue
    }

    if (zeichen === '"') {
      inAnfuehrung = true
      continue
    }
    if (zeichen === ',') {
      zeile.push(zelle)
      zelle = ''
      continue
    }
    if (zeichen === '\r') continue
    if (zeichen === '\n') {
      zeile.push(zelle)
      zeilen.push(zeile)
      zelle = ''
      zeile = []
      continue
    }
    zelle += zeichen
  }

  // Die letzte Zeile endet oft ohne Umbruch.
  if (zelle !== '' || zeile.length > 0) {
    zeile.push(zelle)
    zeilen.push(zeile)
  }

  /*
   * Leere Zeilen fliegen raus. Tabellen haben am Ende regelmaessig ein paar
   * davon, und aus ihnen entstuende sonst je eine Frage ohne Text.
   */
  return zeilen.filter((eintrag) => eintrag.some((wert) => wert.trim() !== ''))
}

/**
 * Kopfzeile und Datenzeilen zu Objekten verbinden.
 *
 * Spaltennamen werden getrimmt; doppelte Namen gewinnt der erste - sonst
 * ueberschriebe eine zweite Spalte "Frage" still die erste.
 */
export function csvZuZeilen(text: string): { spalten: string[]; zeilen: Record<string, string>[] } {
  const tabelle = parseCsv(text)
  const kopf = (tabelle[0] ?? []).map((name) => name.trim())

  const zeilen = tabelle.slice(1).map((werte) => {
    const zeile: Record<string, string> = {}
    kopf.forEach((name, index) => {
      if (name !== '' && !(name in zeile)) zeile[name] = (werte[index] ?? '').trim()
    })
    return zeile
  })

  return { spalten: kopf, zeilen }
}
