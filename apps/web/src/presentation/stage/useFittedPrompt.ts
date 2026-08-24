/**
 * Passt den Fragetext an den freien Platz an.
 *
 * DAS PROBLEM: Die Schriftgroesse der Frage stand fest (2,8 cqw auf der Buehne
 * der Erwachsenen). Eine kurze Frage sah damit richtig aus, eine lange schob die
 * unteren Antwortzeilen aus dem Bild - im Saal fehlten dann schlicht die
 * Antworten C und D, ohne dass irgendetwas nach einem Fehler aussah.
 *
 * DIE REGEL: Die Frage ist der nachgiebige Teil der Ansicht. Sie wird so weit
 * verkleinert, dass NICHTS mehr aus der Szenenflaeche ragt - und keinen Schritt
 * weiter. Passt sie ohnehin, bleibt alles, wie es war; kurze Fragen sehen also
 * aus wie bisher.
 *
 * WARUM GEMESSEN UND NICHT GERECHNET: Wie viel Platz die Frage hat, haengt an
 * Bild, Rubrik, Anzahl und Umbruch der Antwortzeilen, an der Gestaltungswelt und
 * am Seitenverhaeltnis des Bildschirms. Diese Rechnung waere an jeder einzelnen
 * Stelle angreifbar. Gemessen wird deshalb die Aussage selbst: Steht noch etwas
 * ueber der Kante? Die Suche ist eine Intervallhalbierung - sechs Schritte
 * genuegen fuer eine Genauigkeit, die niemand mehr sieht.
 *
 * WAS NICHT SKALIERT: Antwortzeilen, Rubrik und Bild behalten ihre Groessen. Sie
 * tragen die Lesbarkeit im Saal; die Frage liest der Moderator ohnehin vor.
 */
import { useLayoutEffect, useRef, type MutableRefObject } from 'react'

/**
 * Untergrenze der Verkleinerung.
 *
 * Weiter herunter zu gehen brächte auf der Buehne nichts mehr: Aus zwanzig
 * Metern waere die Frage dann ohnehin nicht mehr zu lesen. Reicht das nicht,
 * ist der Fragetext zu lang - das gehoert in die Fragenpflege und nicht in die
 * Darstellung.
 */
const MIN_SCALE = 0.55

/** Schritte der Intervallhalbierung; 6 Schritte treffen auf 0,7 Prozent genau. */
const STEPS = 6

/**
 * Alle Elemente, die innerhalb der Flaeche bleiben muessen.
 *
 * Absolut gesetzte Teile bleiben aussen vor: Der Regiehinweis unter dem Bild
 * steht bewusst ueber die Kante hinaus, und die Figur der Kinderwelt
 * schaut absichtlich aus dem Bild. Beide wuerden die Messung sonst dauerhaft auf
 * "passt nicht" stellen.
 */
function measuredNodes(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>('*')].filter((node) => {
    const position = getComputedStyle(node).position
    return position !== 'absolute' && position !== 'fixed'
  })
}

/**
 * Untere Kante eines Elements - im LAYOUT, nicht auf dem Bildschirm.
 *
 * Warum nicht `getBoundingClientRect`: Beim Szenenwechsel laufen die
 * Antwortzeilen versetzt von unten ein und die Szene blendet sich ein. Beides
 * sind Transformationen, und die stecken im Rechteck auf dem Bildschirm mit
 * drin. Eine Messung waehrend des Einlaufs saehe deshalb einen Ueberstand, den
 * es gleich nicht mehr gibt, und stellte die Frage dauerhaft zu klein - genau
 * das war in der Loesungsszene zu sehen.
 *
 * `offsetTop` und `offsetHeight` kennen keine Transformationen. Die Messung ist
 * damit vom Zeitpunkt unabhaengig: Sie gilt waehrend der Animation genauso wie
 * danach, und es braucht kein Warten auf irgendein Ereignis.
 */
function layoutBottom(node: HTMLElement): number {
  /*
   * `offsetTop` misst bereits ab der Innenkante des Vorfahren. Aufsummiert
   * ergibt das den Abstand zum Seitenanfang. Was dabei fehlt - die Rahmen der
   * Vorfahren OBERHALB von Kasten und Element - fehlt auf beiden Seiten des
   * Vergleichs gleichermassen und hebt sich damit auf.
   */
  let bottom = node.offsetHeight
  let current: HTMLElement | null = node
  while (current) {
    bottom += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }
  return bottom
}

/**
 * Untere Kante, die nichts ueberschreiten darf.
 *
 * Gemeint ist die INHALTSKANTE, nicht die Aussenkante: Die Polsterung der Szene
 * ist der Abstand zum Bildrand und gehoert dem Entwurf. Wuerde bis zur
 * Aussenkante gemessen, klebte die letzte Antwortzeile am unteren Bildrand -
 * abgeschnitten ist sie dann zwar nicht, aber die Komposition ist hin.
 *
 * Die Toleranz faengt die Rundung ab: `offsetHeight` ist ganzzahlig, und ueber
 * mehrere Ebenen summiert sich das.
 */
function contentBottom(box: HTMLElement): number {
  const padding = Number.parseFloat(getComputedStyle(box).paddingBottom)
  return layoutBottom(box) - (Number.isFinite(padding) ? padding : 0) + 2
}

/** Um wie viel steht der Inhalt ueber der Kante? Null heisst: Er passt. */
function overshoot(limit: number, nodes: readonly HTMLElement[]): number {
  let worst = 0
  for (const node of nodes) worst = Math.max(worst, layoutBottom(node) - limit)
  return worst
}

/**
 * Liefert die Referenz fuer den Fragetext.
 *
 * Die Flaeche, in die er passen muss, ist der naechste Vorfahr mit
 * `data-fit-box` - also die Szene. Fehlt sie, passiert nichts: Die Frage steht
 * dann in ihrer Grundgroesse da, so wie vorher.
 */
export function useFittedPrompt(promptText: string): MutableRefObject<HTMLHeadingElement | null> {
  const ref = useRef<HTMLHeadingElement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    const box = element?.closest<HTMLElement>('[data-fit-box]')
    if (!element || !box) return

    let disposed = false

    const fit = () => {
      if (disposed) return
      const scale = (value: number) => element.style.setProperty('--prompt-scale', String(value))

      // Erst zurueck auf volle Groesse, sonst misst dieser Lauf das Ergebnis des vorigen.
      scale(1)
      const nodes = measuredNodes(box)
      const limit = contentBottom(box)
      const atFullSize = overshoot(limit, nodes)
      if (atFullSize === 0) return

      /*
       * Passt es selbst in der kleinsten Stufe nicht, liegt es nicht an der
       * Frage - dann sind die Antwortzeilen allein schon zu hoch. Bringt das
       * Verkleinern in dem Fall nichts, bleibt die Frage in voller Groesse:
       * Eine winzige Frage UND ein Ueberstand waeren zweimal schlecht.
       */
      scale(MIN_SCALE)
      const atMinimum = overshoot(limit, nodes)
      if (atMinimum > 0) {
        if (atMinimum >= atFullSize) scale(1)
        return
      }

      let fits = MIN_SCALE
      let tooBig = 1
      for (let step = 0; step < STEPS; step += 1) {
        const middle = (fits + tooBig) / 2
        scale(middle)
        if (overshoot(limit, nodes) > 0) tooBig = middle
        else fits = middle
      }
      scale(fits)
    }

    let frame = 0
    const refit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }

    fit()

    /*
     * Neu messen, wenn sich die Flaeche aendert - Fenstergroesse, Vollbild,
     * Wechsel des Zielformats. Beobachtet wird die Flaeche und nicht der Text:
     * Der Text aendert sich durch die Messung selbst, die Flaeche nicht. Sonst
     * loeste jede Anpassung die naechste aus.
     */
    const observer = new ResizeObserver(refit)
    observer.observe(box)

    /*
     * Schriften kommen als Datei nach. Vor ihrem Eintreffen misst der Browser
     * mit einer Ersatzschrift und damit an der falschen Zeilenzahl.
     */
    void document.fonts?.ready.then(refit)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [promptText])

  return ref
}
