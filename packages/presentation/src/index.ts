/**
 * Oeffentliche Oberflaeche der Praesentationsschicht.
 *
 * Alles, was eine Anwendung von der Buehne braucht, steht hier - und nur das.
 * Tiefe Importe in einzelne Dateien sind bewusst nicht moeglich (`exports` in
 * `package.json`), damit die innere Struktur (`scenes/`, `transitions/`,
 * `ui/`) frei umgestellt werden kann, ohne eine der drei Anwendungen zu brechen.
 *
 * Das Stylesheet gehoert dazu und wird getrennt eingebunden:
 *   import '@quiz/presentation/styles.css'
 */

/* Die Buehnenflaeche selbst. */
export { StageScreen, themeVariables, type StageScreenProps } from './StageScreen.tsx'
export { type StageHeaderSlots } from './StageHeader.tsx'

/* Enthuellungsuhr: aus dem Serverstand abgeleitete Anzeigewerte. */
export { useRevealClock, type RevealDisplay } from './useRevealClock.ts'

/* Ton: nur der Audio-Master spielt ab, `unlockAudio` loest die Browsersperre. */
export { playCue, unlockAudio, soundCueIds, type SoundCueId } from './soundCues.ts'

/* Uebergaenge und ihre Kennwerte - Grundlage der Entwicklungsvorschau. */
export {
  transitions,
  transitionsById,
  transitionFor,
  transitionStyle,
  effectiveDurationMs,
} from './transitions/registry.ts'
export { type PresentationTransitionDefinition } from './transitions/types.ts'
export {
  presentationTiming,
  easings,
  revealMaxBlurPx,
  prefersReducedMotion,
  type PresentationTiming,
} from './animationPresets.ts'

/* Farbtoken des Designsystems als Fallback ausserhalb eines laufenden Spiels. */
export { greyDesignColors, designFontStack } from './designTokens.ts'
