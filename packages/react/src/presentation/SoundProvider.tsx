/**
 * Access to the sound cues for the scenes.
 *
 * Why a context: whether anything sounds at all depends on two pieces of
 * information that only the frame knows - the game's sound switch and
 * whether this client is the audio master. Without a context both would have
 * to be passed through every scene, just so that a tile can play a sound in
 * the end.
 *
 * Components call `useSound()('score')` and know nothing about the master or
 * the switch state.
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
