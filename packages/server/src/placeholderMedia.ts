/**
 * Ersatzbild fuer fehlende Mediendateien.
 *
 * WOFUER: Waehrend der Entwicklung liegt der freigegebene Bildbestand noch nicht
 * vor. Ohne Ersatz zeigte der Buehnenscreen ein kaputtes Bildsymbol, und die
 * Fragen liessen sich nicht durchspielen.
 *
 * WAS ES NICHT IST: eine stille Reparatur. Der Server traegt jede fehlende Datei
 * als Operatorwarnung ein, und die Inhaltsvalidierung meldet sie weiterhin -
 * fuer den Livebetrieb ist eine fehlende Datei ein Fehler, kein Platzhalter.
 *
 * Das Bild wird bewusst erzeugt statt mitgeliefert: So steht der gesuchte
 * Dateiname darauf, und es gibt keine Platzhalterdatei, die versehentlich in
 * einem echten Paket landet.
 */

/** Bricht einen Dateinamen so um, dass er in die Platzhalterflaeche passt. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let rest = text
  while (rest.length > maxChars) {
    lines.push(rest.slice(0, maxChars))
    rest = rest.slice(maxChars)
  }
  if (rest) lines.push(rest)
  return lines.slice(0, 3)
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
}

/**
 * Erzeugt ein neutrales Ersatzbild im Graustufensystem des Designs.
 *
 * Es zeigt nichts, was eine Loesung verraten koennte - der Dateiname ist
 * redaktionelle Information und steht ohnehin schon in den Quelldaten.
 */
export function placeholderSvg(filename: string): string {
  const lines = wrap(escapeXml(filename), 34)
  const text = lines
    .map((line, index) => `<tspan x="480" dy="${index === 0 ? 0 : 34}">${line}</tspan>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" width="960" height="720" role="img" aria-label="Bild fehlt">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5C5C5C"/>
      <stop offset="1" stop-color="#757575"/>
    </linearGradient>
  </defs>
  <rect width="960" height="720" fill="url(#bg)"/>
  <rect x="24" y="24" width="912" height="672" fill="none" stroke="#444444" stroke-width="4" stroke-dasharray="18 14"/>
  <g fill="#FFFFFF" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="480" y="330" font-size="46" opacity="0.85">Bild fehlt</text>
    <text x="480" y="392" font-size="26" opacity="0.55">${text}</text>
  </g>
</svg>
`
}
