/**
 * Which colour variant of the stage is on show - light, dark or red.
 *
 * WHAT THIS IS AND WHAT IT IS NOT: it is a viewing preference of the person
 * operating it, not game state. The server knows nothing about it, it is not
 * part of any snapshot and it is not transmitted - every window decides for
 * itself. That is why the choice lives in `localStorage` and not in the state
 * machine.
 *
 * ONLY THE ADULTS' STAGE knows these versions. The children's world is its own
 * design world with its own paper and its own drawings; it is not touched by
 * the choice.
 *
 * THE LIST IS THE OFFER. Whoever adds a variant adds it here, and every place
 * that shows the choice grows by one option on its own - the stage carries it
 * as `stage--<name>`, the screens in front of it as `data-theme="<name>"`, and
 * `packages/themes/src/palette.css` holds the colours under those names.
 */
import { useCallback, useEffect, useState } from 'react'

export const stageThemes = ['dark', 'bright', 'red'] as const
export type StageTheme = (typeof stageThemes)[number]

const STORAGE_KEY = 'quiz.stageTheme'
/**
 * THE STAGE DEFAULTS TO LIGHT WHEN IN DOUBT.
 *
 * It was dark for a long time because it was designed for a darkened hall.
 * Its most common location by now is a touch table in a foyer with daylight,
 * and there paper is the calmer surface. Anyone who wants it otherwise
 * switches it - the choice stays saved on the window.
 *
 * The children's world is unaffected by this: it brings its own paper and
 * does not have the switch (see `StageScreen`).
 */
const FALLBACK: StageTheme = 'bright'

/*
 * A change applies immediately in ALL windows of the same origin: the
 * operator switches it in their preview, the projector follows suit. The
 * `storage` event only reaches other windows, hence the additional own event.
 */
const CHANGE_EVENT = 'quiz:stage-theme'

function read(): StageTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stageThemes.includes(stored as StageTheme) ? (stored as StageTheme) : FALLBACK
}

export function useStageTheme(): [StageTheme, (next: StageTheme) => void] {
  const [theme, setTheme] = useState<StageTheme>(read)

  useEffect(() => {
    const sync = () => setTheme(read())
    window.addEventListener('storage', sync)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  const choose = useCallback((next: StageTheme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [theme, choose]
}
