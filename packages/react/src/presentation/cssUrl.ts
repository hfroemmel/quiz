/**
 * Eine Adresse als CSS-`url()` schreiben - IN ANFUEHRUNGSZEICHEN.
 *
 * Ohne sie bricht der Wert an einem einzigen Hochkomma. Genau das passiert im
 * gebauten Paket: Der Bundler bettet kleine SVG als `data:`-Adresse ein und
 * schreibt deren Attribute mit Hochkommata (`width='339.417'`) - fuer ein
 * unquotiertes `url()` ist das ein ungueltiges Zeichen. Die Regel faellt
 * stillschweigend aus, und wo eine Maske stehen sollte, bleibt die nackte
 * Farbflaeche darunter stehen: ein weisser Balken statt der Wortmarke.
 *
 * In der Entwicklung faellt das nicht auf, weil dort eine Dateiadresse steht.
 *
 * Doppelte Anfuehrungszeichen sind die richtige Wahl: Der Bundler ersetzt sie
 * im eingebetteten SVG durch einfache, damit der Wert genau so verwendbar ist.
 */
export function cssUrl(adresse: string): string {
  return `url("${adresse.replace(/"/g, '%22')}")`
}
