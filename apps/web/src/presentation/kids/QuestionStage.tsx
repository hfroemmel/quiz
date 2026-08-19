/**
 * Mittlere Zone der Kinderansicht: Fragebild, Fragepanel, Karlchen.
 *
 * Die drei Spalten stehen im Verhaeltnis der Designreferenz (27 / 46 / 25).
 * Karlchen ist reine Dekoration und nimmt keine Klicks entgegen; die Figur darf
 * niemals Inhalt verdecken, deshalb liegt sie in einer eigenen Spalte und nicht
 * ueber dem Text.
 */
import { kidsAssets } from './kidsAssets.ts'
import { KidsSurface } from './KidsSurface.tsx'
import type { PublicQuestion } from '@quiz/contracts'

export function QuestionStage({ question }: { question: PublicQuestion }) {
  return (
    <div className={`kids-stage ${question.imageUrl ? '' : 'kids-stage--textonly'}`}>
      {question.imageUrl && <QuestionMedia imageUrl={question.imageUrl} prompt={question.prompt} />}
      <QuestionPanel category={question.categoryLabel} prompt={question.prompt} />
    </div>
  )
}

/**
 * Fragebild im gezeichneten Rahmen.
 *
 * Das Foto liegt INNERHALB des Rahmens, nie in der Rahmen-SVG: Es wechselt mit
 * jeder Frage, der Rahmen nie. Fehlt das Bild, entfaellt die Spalte und die
 * Frageflaeche nimmt ihren Platz ein - die Reihenfolge Bild, Frage, Antworten
 * bleibt dabei unveraendert.
 */
function QuestionMedia({ imageUrl, prompt }: { imageUrl: string; prompt: string }) {
  return (
    <KidsSurface image={kidsAssets.mediaFrame} className="kids-media">
      <img className="kids-media__image" src={imageUrl} alt={`Bild zur Frage: ${prompt}`} />
      {/* Karlchen schaut ueber die obere Bildkante - reine Dekoration. */}
      <img className="kids-media__peek" src={kidsAssets.mini} alt="" aria-hidden="true" />
    </KidsSurface>
  )
}

function QuestionPanel({ category, prompt }: { category?: string; prompt: string }) {
  return (
    <KidsSurface image={kidsAssets.questionPanel} className="kids-panel">
      {category && <p className="kids-panel__category">{category}</p>}
      <p className="kids-panel__prompt">{prompt}</p>
    </KidsSurface>
  )
}

/**
 * Karlchen in ganzer Figur.
 *
 * Reine Dekoration: ohne Alternativtext, ohne Klickflaeche. Die Figur steht am
 * unteren rechten Rand der ganzen Ansicht - nicht in der Fragezeile -, damit sie
 * wie in der Referenz auf dem Boden steht und niemals Text verdeckt.
 */
export function MascotLayer() {
  return (
    <div className="kids-mascot" aria-hidden="true">
      <img className="kids-mascot__figure" src={kidsAssets.presenter} alt="" />
    </div>
  )
}
