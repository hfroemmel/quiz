/**
 * Whose picture that is.
 *
 * A question's image is somebody's work, and the licence line belongs with it -
 * next to the file name, ON the question, where the editorial table writes it
 * (`img_credit`) and the import carries it through. Where it is missing, the
 * editorial side has to find it, and the moment to say so is THE IMPORT:
 * whoever has just read a workbook still has the mail with the picture in it
 * open. Two days later the same warning at the end of a build report is a
 * research job.
 *
 * ONLY THE IMAGES OF QUESTIONS. A word mark and a quiz motif come from the
 * house itself, and nobody researches those; a rule that fires on every asset
 * without a credit is a rule people switch off.
 */
import type { Question } from '@hfroemmel/quiz-core'

export interface UncreditedImage {
  questionId: string
  /** The file whose licence line is missing - the question names it itself. */
  filename: string
}

/**
 * The question images without a licence line, in the order of the questions.
 *
 * THE ONE PLACE THIS IS DECIDED. Validation asks here and so does the import;
 * a second condition in one of the two would drift from the other, and the
 * import would promise a clean set that the build then complains about.
 */
export function uncreditedImages(questions: readonly Question[]): UncreditedImage[] {
  const found: UncreditedImage[] = []

  for (const question of questions) {
    const image = question.image
    if (image === undefined) continue
    // A credit of spaces is none - an editor who types one is not done yet.
    if ((image.credit ?? '').trim() !== '') continue
    found.push({ questionId: question.id, filename: image.filename })
  }

  return found
}
