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
export const minZoom = 0.6
export const maxZoom = 1
export const zoomStep = 0.05

/**
 * Einen Wert aus Konfiguration oder Bedienung auf den erlaubten Bereich holen.
 *
 * Ein unbrauchbarer Wert im Config File - Text, negativ, fehlend - darf das
 * Geraet nicht dunkel lassen; er faellt auf die volle Groesse zurueck.
 */
export function clampZoom(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return maxZoom
  return Math.min(maxZoom, Math.max(minZoom, value))
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `clampZoom`. */
export const klemmeZoom = clampZoom
