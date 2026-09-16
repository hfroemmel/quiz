/**
 * Has this image finished loading?
 *
 * WHAT FOR: the stage's blurred image background should appear once it is
 * ready - not before and not as a leftover from the previous question. A
 * `background-image` that is set directly leaves the old background standing
 * until the new one has decoded: for a moment the new question would then show
 * the old one's image.
 *
 * That is why the address is loaded here FIRST and only reported afterwards.
 * Play does not wait for it - the question stands immediately; only its
 * background arrives a blink of an eye later.
 *
 * The decision itself is a pure function (`imageStatus`), so that it is
 * testable without a browser.
 */
import { useEffect, useState } from 'react'

/** What the caller needs to know: which address is ready. */
export interface ImageState {
  /** The address that was loaded - `undefined` as long as none is ready. */
  done: string | undefined
}

/**
 * The new state once `loaded` has finished.
 *
 * A report that no longer belongs to the current address is discarded: on
 * fast clicking through, the images come back in any order, and the one that
 * arrives last is not the one asked for last.
 */
export function imageState(before: ImageState, asked: string | undefined, loaded: string): ImageState {
  if (loaded !== asked) return before
  if (before.done === loaded) return before
  return { done: loaded }
}

export function useDecodedImage(url: string | undefined): string | undefined {
  const [state, setState] = useState<ImageState>({ done: undefined })

  useEffect(() => {
    if (!url) {
      setState({ done: undefined })
      return undefined
    }

    let givenUp = false
    const report = () => {
      if (!givenUp) setState((before) => imageState(before, url, url))
    }

    const image = new Image()
    image.src = url
    /*
     * `decode()` waits not only for the bytes but also for the unpacking - an
     * `onload` alone can still mean a stutter on the first paint. Where it is
     * missing or fails (Firefox reports an error for some images even though
     * they are usable), `onload` applies.
     */
    if (image.decode) {
      void image.decode().then(report, report)
    } else {
      image.onload = report
      image.onerror = report
    }

    return () => {
      givenUp = true
    }
  }, [url])

  return state.done === url ? state.done : undefined
}
