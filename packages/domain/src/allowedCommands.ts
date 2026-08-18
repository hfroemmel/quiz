/**
 * Ableitung der aktuell sinnvollen Befehle aus dem Zustand (Spezifikation 21.1).
 *
 * DRY-Regel: Operator- und Moderatorclient bauen diese Tabelle nicht nach. Sie
 * bekommen `allowedCommands` im View-Modell und blenden ihre Bedienelemente danach ein.
 * Dadurch benennt ein Button immer genau die Aktion, die er im aktuellen Zustand
 * tatsaechlich ausfuehrt - statt dauerhaft viele deaktivierte Buttons zu zeigen.
 *
 * Diese Funktion ist eine Vorschau, keine zweite Validierung: verbindlich entscheidet
 * weiterhin die Engine beim Verarbeiten des Befehls.
 */
import { roleMayIssue, type ActorRole, type CommandType, type GameState } from '@quiz/contracts'

export function availableCommands(state: GameState | null): CommandType[] {
  const list = new Set<CommandType>()

  if (!state || state.status !== 'active') {
    list.add('START_GAME')
    if (state) {
      list.add('SET_SOUND_ENABLED')
      // Auf der Ergebnisansicht bleibt die manuelle Punktkorrektur verfuegbar;
      // das Ergebnis wird danach deterministisch neu berechnet.
      if (state.status === 'completed') list.add('ADJUST_SCORE')
    }
    return [...list]
  }

  list.add('SET_SOUND_ENABLED')
  list.add('ABORT_GAME')
  list.add('ADJUST_SCORE')

  const question = state.currentQuestion?.question
  const hasOptions = (question?.options?.length ?? 0) > 0
  const addAnswerLogging = () => {
    if (hasOptions) list.add('LOG_OPTION_ANSWER')
    list.add('MARK_MANUAL_ANSWER')
    list.add('RESOLVE_ATTEMPT')
  }

  switch (state.phase) {
    case 'pause-screen':
      list.add('SKIP_QUESTION')
      break

    case 'question-presented':
      list.add('OPEN_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'buzzer-open':
      list.add('BUZZ')
      list.add('SELECT_PLAYER_MANUALLY')
      list.add('RESET_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'answer-locked':
      addAnswerLogging()
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('RESET_BUZZER')
      list.add('SKIP_QUESTION')
      if (question?.presentationType === 'image-reveal') list.add('REVEAL_IMAGE_COMPLETELY')
      break

    case 'second-chance':
      addAnswerLogging()
      list.add('PASS_SECOND_CHANCE')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('RESET_BUZZER')
      list.add('SKIP_QUESTION')
      break

    case 'reveal-running':
      list.add('BUZZ')
      list.add('SELECT_PLAYER_MANUALLY')
      list.add('PAUSE_IMAGE_REVEAL')
      list.add('REVEAL_IMAGE_COMPLETELY')
      list.add('RESET_IMAGE_REVEAL')
      list.add('RESET_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'reveal-paused':
      list.add('BUZZ')
      list.add('SELECT_PLAYER_MANUALLY')
      list.add('RESUME_IMAGE_REVEAL')
      list.add('REVEAL_IMAGE_COMPLETELY')
      list.add('RESET_IMAGE_REVEAL')
      list.add('RESET_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'video-ready':
      list.add('START_VIDEO')
      list.add('SEEK_VIDEO')
      list.add('RESTART_VIDEO')
      list.add('SHOW_QUESTION_AFTER_VIDEO')
      list.add('SKIP_QUESTION')
      break

    case 'video-playing':
      list.add('PAUSE_VIDEO')
      list.add('SEEK_VIDEO')
      list.add('RESTART_VIDEO')
      list.add('SHOW_QUESTION_AFTER_VIDEO')
      list.add('SKIP_QUESTION')
      break

    case 'solution':
      list.add('CONTINUE')
      break

    case 'attempt-feedback':
    default:
      // Waehrend der Feedbacksequenz gibt es bewusst keine Aktion: der Wechsel
      // laeuft ueber die definierte Fallbackzeit des Servers.
      break
  }

  return [...list]
}

/** Auf die Rolle eingeschraenkte Befehlsliste. */
export function allowedCommandsForRole(state: GameState | null, role: ActorRole): CommandType[] {
  return availableCommands(state).filter((type) => roleMayIssue(role, type))
}
