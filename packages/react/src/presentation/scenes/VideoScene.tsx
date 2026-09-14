/**
 * Der Videoteil einer Videofrage (Spezifikation 12).
 *
 * Das Video gehoert zu DERSELBEN Frage wie die Antworten danach, es ist keine
 * eigene Frage. Waehrend es laeuft, ist der Buzzer serverseitig gesperrt.
 *
 * DER ABLAUF GEHT IN EINE RICHTUNG. Der Server veroeffentlicht einen Auftrag
 * (`view.video`), diese Szene fuehrt ihn aus, und damit ist der Weg zu Ende. Was
 * hier passiert - laedt, laeuft, ist durch -, erfaehrt niemand sonst: kein
 * Befehl zurueck, kein Status im Serverzustand, keine Anzeige am Pult. Der
 * Operator braucht davon nichts, um weiterzumachen.
 *
 * DER AUFTRAG IST EINE KENNUNG, KEIN ZUSTAND. Gemerkt wird lokal, welcher
 * Auftrag zuletzt ausgefuehrt wurde - Frage und Kennung zusammen:
 *
 *   gleicher Auftrag -> nichts tun (Rerender, wiederholter Schnappschuss)
 *   neuer Auftrag    -> von Sekunde null starten
 *
 * Damit ist auch das Wiederverbinden geklaert, ohne dass es ein Sonderfall
 * waere: Eine Buehne, die neu laedt, kennt noch keine Kennung und fuehrt den
 * stehenden Auftrag genau einmal aus.
 *
 * ABGESPIELT WIRD NUR, WO JEMAND ZUSCHAUT: auf der Buehne und am Touchgeraet.
 * Die Operatorvorschau zeigt dieselbe Flaeche in derselben Groesse, aber leer -
 * ein zweites Medium kostete Rechenzeit auf demselben Rechner und liefe
 * unweigerlich auseinander. Was der Saal sieht, steht auf der Buehne.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Command } from '@hfroemmel/quiz-core'
import { textsFor } from '../texts'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

interface VideoSceneProps extends SceneProps {
  /** Nur der Audio-Master spielt den Ton ab. */
  isAudioMaster?: boolean
  /**
   * Befehl des Geraets an den Server - nur am Touchgeraet in Gebrauch.
   *
   * Die Buehne meldet NICHTS zurueck. Am Touchgeraet gibt es aber keinen
   * Operator: Dort ist das Geraet sein eigenes Pult und blendet nach dem Video
   * selbst die Frage ein.
   */
  onCommand?: (command: Command) => void
}

/**
 * Der zuletzt ausgefuehrte Auftrag - MODULWEIT, nicht in der Komponente.
 *
 * Die Buehne baut den Szenenknoten bei jedem Uebergang neu auf (er haengt an der
 * Kennung des Uebergangs). Laege der Merker in der Komponente, verschwaende er
 * dabei, und derselbe Auftrag liefe mitten im Video ein zweites Mal los. Hier
 * ueberlebt er den Neuaufbau - und faellt genau dann weg, wenn er soll: beim
 * Neuladen der Seite, wo der stehende Auftrag nachgeholt werden MUSS.
 *
 * Ein Fenster zeigt eine Buehne, deshalb genuegt ein Wert.
 */
let lastExecuted: string | null = null

export function VideoScene({ view, variant, isAudioMaster = true, onCommand }: VideoSceneProps) {
  const t = textsFor(view)
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const question = view.question
  const request = view.video
  const plays = variant !== 'preview'
  /*
   * Am Touchgeraet steht niemand, der "Frage einblenden" druecken koennte -
   * dort geht es nach dem Video von selbst weiter. Im Saal gehoert dieser
   * Schritt dem Operator, und die Buehne schickt keinen einzigen Befehl.
   */
  const advancesItself = variant === 'touch'
  /*
   * Genau EINMAL je Frage. Der Befehl waere zwar beim zweiten Mal abgewiesen
   * (die Phase ist dann vorbei), aber ein Geraet, das dieselbe Bitte mehrfach
   * schickt, ist ein Geraet, das man nicht verstanden hat.
   */
  const advancedRef = useRef<string | null>(null)
  const goOn = useCallback(() => {
    if (!advancesItself || !question || advancedRef.current === question.id) return
    advancedRef.current = question.id
    onCommand?.({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
  }, [advancesItself, question?.id, onCommand])

  /*
   * Der Browser hat die hoerbare Wiedergabe verweigert.
   *
   * Das ist kein Medienfehler, sondern die Autoplay-Regel eines Fensters, in dem
   * noch niemand geklickt hat - in der Desktophuelle tritt sie nicht auf (siehe
   * `autoplayPolicy` dort). Das Bild muss trotzdem laufen: Ein stummes Video ist
   * im Saal unangenehm, ein stehendes ist ein Ausfall. Gemeldet wird es in der
   * Konsole des Fensters, das es betrifft, und sonst nirgends.
   */
  const [soundRefused, setSoundRefused] = useState(false)
  useEffect(() => setSoundRefused(false), [isAudioMaster])
  const muted = !isAudioMaster || soundRefused

  const games = useCallback((element: HTMLVideoElement) => {
    void element.play().catch((error: Error) => {
      if (error.name === 'NotAllowedError' && !element.muted) {
        console.warn('Video ohne Ton gestartet: Das Fenster erlaubt noch keine hörbare Wiedergabe.', error)
        setSoundRefused(true)
        return
      }
      /*
       * "AbortError" heisst: Ein neuerer Auftrag hat den Startversuch abgeloest.
       * Alles andere ist ein echtes Problem mit der Datei - und bleibt in diesem
       * Fenster, weil der Operator davon nichts hat.
       */
      if (error.name === 'AbortError') return
      console.error('Video konnte nicht abgespielt werden.', error)
    })
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element || !plays) return

    /*
     * Kein Auftrag, oder einer fuer eine andere Frage: Dann steht das Video
     * einfach da. Ein Auftrag, der nicht zur angezeigten Frage gehoert, ist ein
     * Nachzuegler - er startete sonst das falsche Video.
     */
    if (!request || !question || request.questionId !== question.id) return
    // Frage UND Kennung: Zwei Fragen koennten sonst dieselbe Kennung tragen.
    const task = `${request.questionId}:${request.requestId}`
    if (lastExecuted === task) return
    lastExecuted = task

    /*
     * Von vorn heisst von vorn: anhalten, zuruecksetzen, starten.
     *
     * GESTARTET WIRD SOFORT, auch wenn die Datei noch laedt - der Browser
     * beginnt dann, sobald er kann, und zwar bei null. Ist er noch nicht so
     * weit, holt der Nachschlag unten den Start nach; das ist der Fall, in dem
     * `play()` nichts bewirkt hat. Gewartet wird dabei ausschliesslich lokal:
     * niemand ausserhalb dieses Fensters erfaehrt davon.
     */
    element.pause()
    element.currentTime = 0
    games(element)
    if (element.readyState >= 2 /* HAVE_CURRENT_DATA */) return

    const ready = () => {
      if (element.paused) games(element)
    }
    element.addEventListener('canplay', ready, { once: true })
    return () => element.removeEventListener('canplay', ready)
  }, [request?.questionId, request?.requestId, question?.id, plays, games])

  /*
   * FRAGENWECHSEL UND ABGANG HALTEN AN. Das Element gehoert der Szene: Bliebe es
   * beim Verlassen laufen, spielte der Ton unter der naechsten Frage weiter.
   *
   * Der Merker wird dabei NICHT geleert - er traegt die Frage in sich, und ein
   * Neuaufbau der Szene ist kein neuer Auftrag.
   */
  useEffect(() => {
    const element = elementRef.current
    return () => element?.pause()
  }, [question?.id])

  /*
   * OHNE DATEI GIBT ES NICHTS ABZUWARTEN.
   *
   * Im Saal steht dann der Operator davor und geht weiter, wenn er so weit ist.
   * Am Geraet steht niemand - dort darf eine fehlende Datei den Ablauf nicht
   * anhalten, sonst bliebe das Quiz an dieser Frage haengen.
   */
  useEffect(() => {
    if (!question || question.videoUrl) return
    goOn()
  }, [question?.id, question?.videoUrl, goOn])

  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.video}`}>
      <div className={styles.videoBox}>
        {/*
         * Der Platzhalter ist die Flaeche des Videos, nicht seine Beigabe: Buehne
         * und Operatorvorschau zeigen dasselbe Rechteck an derselben Stelle, und
         * das Medium legt sich auf der Buehne hinein. Fehlt es oder laedt es noch,
         * bleibt die Komposition trotzdem stehen.
         */}
        <div className={styles.videoFrame} data-video-placeholder>
          {plays && question.videoUrl && (
            <video
              ref={elementRef}
              className={styles.videoPlayer}
              src={question.videoUrl}
              muted={muted}
              /*
               * VORGELADEN, ABER NICHT GESTARTET. Die Datei liegt bereit, sobald
               * die Frage steht; losgehen darf sie erst auf Auftrag.
               */
              preload="auto"
              playsInline
              loop={false}
              /*
               * Das Ende ist ein lokales Ereignis. Im Saal passiert daraufhin
               * NICHTS - das letzte Bild bleibt stehen, bis der Operator
               * weitergeht. Nur das Touchgeraet, das keinen Operator hat,
               * blendet danach selbst die Frage ein.
               */
              onEnded={goOn}
              /*
               * Und wenn die Datei gar nicht spielt, ist das am Geraet genau
               * dasselbe: weitergehen. Im Saal bleibt es folgenlos - dort
               * entscheidet der Operator, ob er es noch einmal versucht, die
               * Frage einblendet oder sie ueberspringt.
               */
              onError={goOn}
            />
          )}
          {!question.videoUrl && <p className={styles.videoMissing}>{t('video.missing')}</p>}
        </div>
      </div>
    </div>
  )
}
