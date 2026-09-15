/**
 * The menu of THIS device, out of the view of the moment.
 *
 * The model itself comes from the core (`deriveStartMenu`); what is added here
 * are the two facts only the device knows: which audience it belongs to, and
 * which player counts a host has narrowed it to.
 *
 * The narrowing is deliberately not a second model: a host that says
 * `playerCounts={[1]}` takes options away, it does not add any - so the modes
 * of the model are filtered, and everything else stays as the configuration
 * says it.
 */
import { deriveStartMenu, type PlayerCount, type PlayerQuizViewModel, type StartMenuModel } from '@hfroemmel/quiz-core'

export function deviceStartMenu(
  view: PlayerQuizViewModel,
  audienceId: string,
  playerCounts?: readonly PlayerCount[] | undefined,
): StartMenuModel {
  /*
   * The locales come from the catalogue, not from a configuration: a device has
   * the view, not the package. The wording of the play modes travels the same
   * way - as interface texts in `view.texts`, which is where the menu reads it.
   */
  const model = deriveStartMenu({ locales: view.catalog.locales }, view.catalog, view.locale, { audienceId })
  if (!playerCounts || playerCounts.length === 0) return model

  const playModes = model.playModes.filter((mode) => playerCounts.includes(mode.playerCount))
  if (playModes.length === 0) return model

  const preselect = {
    ...model.preselect,
    ...(playModes.length === 1 ? { playerCount: playModes[0]!.playerCount } : {}),
  }
  /*
   * A preselected count the host has just taken away would name something that
   * is not on offer any more.
   */
  if (preselect.playerCount !== undefined && !playModes.some((mode) => mode.playerCount === preselect.playerCount)) {
    delete preselect.playerCount
  }

  return {
    ...model,
    playModes,
    ...(Object.keys(preselect).length > 0 ? { preselect } : {}),
  }
}
