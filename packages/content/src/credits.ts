/**
 * Whose picture that is.
 *
 * A question's image is somebody's work, and the licence line belongs with it
 * (`assets.json`, `credit`). Where it is missing, the editorial side has to
 * find it - and the moment to say so is THE IMPORT: whoever has just read a
 * workbook still has the mail with the picture in it open. Two days later the
 * same warning at the end of a build report is a research job.
 *
 * ONLY THE IMAGES OF QUESTIONS. A word mark and a quiz motif come from the
 * house itself, and nobody researches those; the rule that fires on every
 * asset without a credit is a rule people switch off.
 */
import type { MediaAsset, Question } from '@hfroemmel/quiz-core'

export interface UncreditedImage {
  questionId: string
  assetId: string
  /**
   * Is the asset declared in `assets.json` at all?
   *
   * An undeclared one has no credit either, but it is a different problem with
   * a different fix - and validation reports it as an error of its own
   * (`asset-reference`). Saying which of the two it is saves the reader a
   * lookup.
   */
  declared: boolean
}

/**
 * The question images without a licence line, in the order of the questions.
 *
 * THE ONE PLACE THIS IS DECIDED. Validation asks here and so does the import;
 * a second condition in one of the two would drift from the other, and the
 * import would promise a clean set that the build then complains about.
 */
export function uncreditedImages(questions: readonly Question[], assets: readonly MediaAsset[]): UncreditedImage[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  const found: UncreditedImage[] = []

  for (const question of questions) {
    const assetId = question.media?.imageAssetId
    if (assetId === undefined) continue
    const asset = byId.get(assetId)
    // A credit of spaces is none - an editor who types one is not done yet.
    if (asset !== undefined && (asset.credit ?? '').trim() !== '') continue
    found.push({ questionId: question.id, assetId, declared: asset !== undefined })
  }

  return found
}
