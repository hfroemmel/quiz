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
 * THE LIST IS THE OFFER, AND IN THIS ORDER. Whoever adds a variant adds it
 * here, and every place that shows the choice grows by one option on its own -
 * the stage carries it as `stage--<name>`, the screens in front of it as
 * `data-theme="<name>"`, and `packages/themes/src/palette.css` holds the
 * colours under those names. A host builds its box FROM THIS LIST rather than
 * from a list of its own: a box that offers a variant this build does not know
 * shows a choice that cannot take effect - the value is rejected on the next
 * read, the field snaps back and nothing is recoloured. That was a real
 * evening's confusion at the desk, with an application newer than its package.
 */
import { useCallback, useEffect, useState } from 'react'

export const stageThemes = ['bright', 'dark', 'red'] as const
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

/**
 * What a stored value means - and the fallback for everything else.
 *
 * Exported because this is the rule the whole preference stands on, and it can
 * be read and tested here without a window: an unknown name gives the
 * fallback, so a storage written by another build never puts a variant on the
 * stage that this one cannot paint.
 */
export function stageThemeFrom(stored: string | null): StageTheme {
  return stageThemes.includes(stored as StageTheme) ? (stored as StageTheme) : FALLBACK
}

function read(): StageTheme {
  return stageThemeFrom(window.localStorage.getItem(STORAGE_KEY))
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
