/**
 * Which image address counts as ready - without a browser.
 *
 * The interesting case is clicking through fast: the images come back in any
 * order, and the one that arrives last is not the one asked for last.
 */
import { describe, expect, it } from 'vitest'
import { imageState, type ImageState } from '../src/presentation/useDecodedImage'

const empty: ImageState = { done: undefined }

describe('imageState', () => {
  it('reports the image that is currently wanted', () => {
    expect(imageState(empty, '/a.jpg', '/a.jpg')).toEqual({ done: '/a.jpg' })
  })

  it('discards an image nobody asks for anymore', () => {
    const before = { done: '/b.jpg' }
    expect(imageState(before, '/b.jpg', '/a.jpg')).toBe(before)
  })

  it('discards every report when no image is wanted at all', () => {
    expect(imageState(empty, undefined, '/a.jpg')).toBe(empty)
  })

  it('returns the same state on a repeat - no new render', () => {
    const before = { done: '/a.jpg' }
    expect(imageState(before, '/a.jpg', '/a.jpg')).toBe(before)
  })
})
