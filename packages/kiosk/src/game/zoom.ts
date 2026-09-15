/**
 * Bounds of the zoom level - defined in one place because they apply in
 * three: the settings slider, applying the default from the config file, and
 * the stage itself.
 *
 * THE MAXIMUM IS 1 AND NO MORE. The stage composition is designed for this
 * size; enlarged beyond it, it would run off the picture. At the lower end
 * it stops at 60 percent - smaller than that, the type on a touch table can
 * no longer be read at a glance.
 */
export const minZoom = 0.6
export const maxZoom = 1
export const zoomStep = 0.05

/**
 * Bring a value from configuration or user input into the allowed range.
 *
 * An unusable value in the config file - text, negative, missing - must not
 * leave the device dark; it falls back to full size.
 */
export function clampZoom(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return maxZoom
  return Math.min(maxZoom, Math.max(minZoom, value))
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `clampZoom`. */
export const klemmeZoom = clampZoom
