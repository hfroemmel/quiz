/**
 * Die Wortmarke des Bundestages als Adresse, nicht als Bauteil.
 *
 * SIE STEHT NICHT NUR AUF DER BUEHNE. Die Kopfzeile der Buehne legt sie als
 * Maske ueber eine Farbflaeche, damit sie der Textfarbe der Welt folgt
 * (`StageHeader`). Ein Gastgeber, der sie schlicht als Bild braucht - etwa die
 * Quizauswahl am Pult, die auf hellem Grund steht -, bekommt hier dieselbe
 * Datei. Eine zweite Abschrift im Anwendungsrepository waere eine Marke, die an
 * zwei Stellen gepflegt werden muesste.
 */
import wordmark from '../assets/images/logo.svg'

/** Adresse der mitgelieferten Wortmarke, ueber den Build-Weg des Pakets. */
export const brandWordmarkUrl: string = wordmark
