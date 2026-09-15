/**
 * Every reference image belongs to a test.
 *
 * There is ONE Playwright project and it is called `preview`, so every
 * baseline Playwright writes ends in `-preview-linux.png`. A file with a
 * different ending is a leftover from before the project had a name - and
 * those are not harmless. This directory carried two sets of stage pictures
 * for weeks, and only the less obvious one was the maintained one. When five
 * references were then recorded on the wrong renderer, the mistake could hide
 * in plain sight: there was always a second file with almost the same name to
 * look at, and the reference that CI actually compares against was not the one
 * a reader would find first.
 *
 * No browser in this check - it reads the directory.
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect, test } from '@playwright/test'

test('every reference image carries the project name', ({}, testInfo) => {
  const here = dirname(testInfo.file)
  const directories = readdirSync(here).filter((entry) => entry.endsWith('-snapshots'))
  // If this is empty the suite has lost its baselines, not gained tidiness.
  expect(directories.length).toBeGreaterThan(0)

  const strays = directories.flatMap((directory) =>
    readdirSync(join(here, directory))
      .filter((file) => !file.endsWith('-preview-linux.png'))
      .map((file) => `${directory}/${file}`),
  )
  expect(strays, 'reference images that no test reads').toEqual([])
})
