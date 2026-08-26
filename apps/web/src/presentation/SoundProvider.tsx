/**
 * Zugang zu den Soundmarken fuer die Szenen.
 *
 * Warum ein Kontext: Ob ueberhaupt geklungen wird, haengt an zwei Angaben, die
 * nur der Rahmen kennt - dem Soundschalter des Spiels und der Frage, ob dieser
 * Client der Audio-Master ist. Ohne Kontext muesste beides durch jede Szene
 * durchgereicht werden, nur damit am Ende eine Kachel einen Ton abspielen kann.
 *
 * Bauteile rufen `useSound()('score')` und wissen nichts ueber Master oder
 * Schalterstellung.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { playCue, type SoundCueId } from './soundCues'

type PlayCue = (cueId: SoundCueId) => void

const SoundContext = createContext<PlayCue>(() => undefined)

export function SoundProvider({
  enabled,
  isAudioMaster,
  children,
}: {
  enabled: boolean
  isAudioMaster: boolean
  children: ReactNode
}) {
  const play = useMemo<PlayCue>(
    () => (cueId) => playCue(cueId, { enabled, isAudioMaster }),
    [enabled, isAudioMaster],
  )
  return <SoundContext.Provider value={play}>{children}</SoundContext.Provider>
}

export function useSound(): PlayCue {
  return useContext(SoundContext)
}
