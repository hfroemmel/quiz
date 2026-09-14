/**
 * Fits the question text into the free space.
 *
 * THE PROBLEM: The question's font size used to be fixed (2.8 cqw on the
 * adults' stage). A short question looked right that way, but a long one pushed
 * the lower answer rows out of the picture - in the room, answers C and D were
 * simply missing, without anything looking like an error.
 *
 * THE RULE: The question is the yielding part of the view. It is shrunk just
 * far enough that NOTHING sticks out of the scene area any more - and not one
 * step further. If it already fits, everything stays as it was; short questions
 * therefore look as they did before.
 *
 * WHY MEASURED AND NOT COMPUTED: How much space the question has depends on the
 * image, the category, the number and wrapping of answer rows, the design
 * world, and the screen's aspect ratio. A calculation would be vulnerable at
 * every single one of those points. So instead the claim itself is measured:
 * does anything still stick out past the edge? The search is a binary search -
 * six steps are enough for a precision nobody notices any more.
 *
 * WHAT DOES NOT SCALE: Answer rows, category and image keep their sizes. They
 * carry readability in the room; the question itself is read aloud by the host
 * anyway.
 */
import { useLayoutEffect, useRef, type MutableRefObject } from 'react'

/**
 * Lower bound of the shrinking.
 *
 * Going any smaller would gain nothing on stage: from twenty metres away the
 * question would no longer be readable anyway. If that is not enough, the
 * question text is too long - that belongs in question upkeep, not in
 * rendering.
 */
const MIN_SCALE = 0.55

/** Steps of the binary search; 6 steps land within 0.7 percent. */
const STEPS = 6

/**
 * All elements that must stay within the area.
 *
 * Absolutely positioned parts are left out: the director's note under the
 * image deliberately extends past the edge, and the kids' world mascot
 * deliberately looks out of the picture. Otherwise both would permanently pin
 * the measurement to "does not fit".
 */
function measuredNodes(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>('*')].filter((node) => {
    const position = getComputedStyle(node).position
    return position !== 'absolute' && position !== 'fixed'
  })
}

/**
 * Bottom edge of an element - in LAYOUT terms, not on screen.
 *
 * Why not `getBoundingClientRect`: on a scene change the answer rows slide in
 * staggered from below and the scene fades in. Both are transforms, and those
 * are baked into the rectangle on screen. A measurement taken during that
 * entrance would therefore see an overhang that is about to disappear anyway,
 * and would permanently size the question too small - which is exactly what
 * happened in the solution scene.
 *
 * `offsetTop` and `offsetHeight` know nothing about transforms. The
 * measurement is therefore independent of timing: it holds during the
 * animation just as it does afterwards, and there is no need to wait for any
 * event.
 */
function layoutBottom(node: HTMLElement): number {
  /*
   * `offsetTop` already measures from the inner edge of its ancestor. Summed
   * up, that gives the distance to the top of the page. What that leaves out -
   * the borders of ancestors ABOVE the box and the element - is missing
   * equally on both sides of the comparison, so it cancels out.
   */
  let bottom = node.offsetHeight
  let current: HTMLElement | null = node
  while (current) {
    bottom += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }
  return bottom
}

/**
 * Bottom edge that nothing may cross.
 *
 * This means the CONTENT edge, not the outer edge: the scene's padding is the
 * margin to the screen edge and belongs to the design. Measuring to the outer
 * edge would leave the last answer row stuck to the bottom of the screen -
 * not clipped, but the composition would be ruined.
 *
 * The tolerance absorbs the rounding: `offsetHeight` is an integer, and that
 * adds up across several levels.
 */
function contentBottom(box: HTMLElement): number {
  const padding = Number.parseFloat(getComputedStyle(box).paddingBottom)
  return layoutBottom(box) - (Number.isFinite(padding) ? padding : 0) + 2
}

/** By how much does the content cross the edge? Zero means: it fits. */
function overshoot(limit: number, nodes: readonly HTMLElement[]): number {
  let worst = 0
  for (const node of nodes) worst = Math.max(worst, layoutBottom(node) - limit)
  return worst
}

/**
 * Supplies the ref for the question text.
 *
 * The area it must fit into is the nearest ancestor carrying `data-fit-box` -
 * i.e. the scene. If that is missing, nothing happens: the question then
 * stays at its base size, just as it did before.
 */
export function useFittedPrompt(promptText: string): MutableRefObject<HTMLHeadingElement | null> {
  const ref = useRef<HTMLHeadingElement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    const box = element?.closest<HTMLElement>('[data-fit-box]')
    if (!element || !box) return

    let disposed = false

    const fit = () => {
      if (disposed) return
      const scale = (value: number) => element.style.setProperty('--prompt-scale', String(value))

      // Reset to full size first, or this run would measure the previous run's result.
      scale(1)
      const nodes = measuredNodes(box)
      const limit = contentBottom(box)
      const atFullSize = overshoot(limit, nodes)
      if (atFullSize === 0) return

      /*
       * If it still does not fit even at the smallest step, the question is
       * not to blame - the answer rows alone are already too tall. In that
       * case shrinking gains nothing, so the question stays at full size: a
       * tiny question AND an overhang would be doubly bad.
       */
      scale(MIN_SCALE)
      const atMinimum = overshoot(limit, nodes)
      if (atMinimum > 0) {
        if (atMinimum >= atFullSize) scale(1)
        return
      }

      let fits = MIN_SCALE
      let tooBig = 1
      for (let step = 0; step < STEPS; step += 1) {
        const middle = (fits + tooBig) / 2
        scale(middle)
        if (overshoot(limit, nodes) > 0) tooBig = middle
        else fits = middle
      }
      scale(fits)
    }

    let frame = 0
    const refit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }

    fit()

    /*
     * Re-measure whenever the area changes - window size, fullscreen, a
     * change of target aspect ratio. What is observed is the area, not the
     * text: the text changes because of the measurement itself, the area does
     * not. Otherwise every adjustment would trigger the next one.
     */
    const observer = new ResizeObserver(refit)
    observer.observe(box)

    /*
     * Fonts arrive as files, later. Before they arrive the browser measures
     * with a fallback font and therefore against the wrong line count.
     */
    void document.fonts?.ready.then(refit)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [promptText])

  return ref
}
