/**
 * Grenzen der Zoomstufe - an einer Stelle, weil sie an dreien gelten: im
 * Schieberegler der Einstellungen, beim Uebernehmen der Vorgabe aus dem Config
 * File und in der Buehne selbst.
 *
 * DAS MAXIMUM IST 1 UND NICHT MEHR. Die Komposition der Buehne ist auf diese
 * Groesse entworfen; darueber hinaus vergroessert liefe sie aus dem Bild. Nach
 * unten ist bei 60 Prozent Schluss - kleiner ist die Schrift auf einem
 * Touchtisch aus dem Stand nicht mehr zu lesen.
 */
export const minimalerZoom = 0.6
export const maximalerZoom = 1
export const zoomSchritt = 0.05

/**
 * Einen Wert aus Konfiguration oder Bedienung auf den erlaubten Bereich holen.
 *
 * Ein unbrauchbarer Wert im Config File - Text, negativ, fehlend - darf das
 * Geraet nicht dunkel lassen; er faellt auf die volle Groesse zurueck.
 */
export function klemmeZoom(wert: number | undefined): number {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return maximalerZoom
  return Math.min(maximalerZoom, Math.max(minimalerZoom, wert))
}
