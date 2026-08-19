/**
 * Spieleransicht des Kinderquiz (Karlchen-Welt).
 *
 * WAS DIESE ANSICHT IST: eine zweite Darstellung derselben Daten. Sie enthaelt
 * keine Spielregel, keinen eigenen Zustand und keinen Befehl. Alles, was hier
 * sichtbar wird, steht im `PublicQuizViewModel` des Servers - Frage, Antworten
 * mit ihrem Zustand, Punktestaende, Fragenzaehler.
 *
 * Sie traegt die Szenen `question` und `solution`, weil beide dieselbe
 * Komposition zeigen: Bild, Frage, vier Antwortzeilen. Alle uebrigen Szenen
 * bleiben bei den gemeinsamen Szenenkomponenten und stehen dann auf demselben
 * illustrierten Grund.
 *
 * Ebenenmodell (Assetpaket, ASSET_INTEGRATION.md Abschnitt 3):
 *   1 Hintergrundszene, 2 Inhalte, 3 Figuren, 4 gezeichnete Flaechen, 5 Koernung.
 * Die Ebenen 1, 3 und 5 sind reine Dekoration und nehmen keine Klicks entgegen.
 */
import { AnswerList } from './AnswerList.tsx'
import { MascotLayer, QuestionStage } from './QuestionStage.tsx'
import { QuizHeader } from './QuizHeader.tsx'
import type { PublicQuizViewModel } from '@quiz/contracts'

export function KidsQuizScreen({ view }: { view: PublicQuizViewModel }) {
  const question = view.question
  if (!question) return null

  return (
    <div className="kids-screen">
      <QuizHeader view={view} />
      <QuestionStage question={question} />
      {/* Die Loesungszeile steht ueber den Antworten, nicht in der Frageflaeche. */}
      {view.scene === 'solution' && <p className="kids-solution-label">Richtige Antwort:</p>}
      <AnswerList options={view.visibleOptions ?? []} scene={view.scene} />
      <MascotLayer />
    </div>
  )
}

/**
 * Deckt die Kinderansicht diese Szene ab?
 *
 * EINZIGE STELLE dieser Entscheidung - `StageScreen` fragt hier nach, damit die
 * Liste nicht an zwei Orten gepflegt werden muss.
 */
export function kidsScreenCovers(view: PublicQuizViewModel): boolean {
  return (view.scene === 'question' || view.scene === 'solution') && Boolean(view.question)
}
