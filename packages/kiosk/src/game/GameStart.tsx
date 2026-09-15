/**
 * The former start selection - now the menu, built from the view.
 *
 * WHAT HAPPENED HERE: this component asked two questions and got its answers
 * from the view by itself - player counts from a property, difficulties from
 * the catalogue. Both are configuration, and a third question was missing
 * entirely: WHICH quiz. The menu that asks all three is `StartMenu`, and it
 * takes one derived model instead of a view (`deriveStartMenu` in
 * `@hfroemmel/quiz-core`).
 *
 * What is left standing here is the old interface: a host that renders
 * `<GameStart>` keeps its screen for one release. It builds the model and
 * renders the menu - nothing more.
 */
import type { PlayerCount, PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import { StartMenu } from './StartMenu'
import { deviceStartMenu } from './startMenuModel'

interface GameStartProps {
  view: PlayerQuizViewModel
  /** Audience this device plays in. */
  audience: string
  /** Player counts this device offers. Without one, what the package says. */
  playerCounts?: readonly PlayerCount[] | undefined
  onStart(input: { playerCount: PlayerCount; presetId: string }): void
  /** Only set when the quiz is a guest inside another application. */
  onExit?: (() => void) | undefined
  /** Open the device's settings - only set where they exist. */
  onOpenSettings?: (() => void) | undefined
  onSelectLocale(locale: string): void
}

/** @deprecated Renamed to `StartMenu`, which takes the derived menu model. */
export function GameStart({
  view,
  audience,
  playerCounts,
  onStart,
  onExit,
  onOpenSettings,
  onSelectLocale,
}: GameStartProps) {
  return (
    <StartMenu
      model={deviceStartMenu(view, audience, playerCounts)}
      texts={view.texts}
      brand={{ visualUrl: view.theme.startVisualUrl, title: view.theme.startTitle }}
      /*
       * The old interface knows audience and preset, not a quiz type. A menu
       * offer without a preset would therefore lose the level here - so the
       * empty string is passed on, exactly as before.
       */
      onStart={(choice) => onStart({ playerCount: choice.playerCount, presetId: choice.presetId ?? '' })}
      onSelectLocale={onSelectLocale}
      {...(onOpenSettings === undefined ? {} : { onOpenSettings })}
      {...(onExit === undefined ? {} : { onExit })}
    />
  )
}
