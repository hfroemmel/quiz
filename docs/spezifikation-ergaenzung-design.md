# Ergaenzung der Entwicklungsspezifikation: visuelle Umsetzung

Diese Ergaenzung schreibt die gelieferten Screendesigns fuer die Umsetzung fest.
Sie ist Bestandteil der Spezifikation und ordnet sich ihr unter: **Bei einem
Widerspruch zwischen Design und Spezifikation gilt die Spezifikation; das Design
bestimmt dann nur das Aussehen.**

Sie besteht aus vier Teilen:

| Teil | Datei |
|---|---|
| Farben, Raster, Typografie, Bauteile | [`docs/design-system.md`](design-system.md) |
| Zustand fuer Zustand, inklusive entworfener Zustaende | [`docs/screens.md`](screens.md) |
| Bewegungen, zur Freigabe vorgeschlagen | [`docs/animationskatalog.md`](animationskatalog.md) |
| Reihenfolge, Struktur, Abnahme | [`docs/umsetzungsplan-ui.md`](umsetzungsplan-ui.md) |

## 1. Verbindliche Antworten aus der Abstimmung

Diese Punkte waren offen und sind nun entschieden. Sie werden hier festgehalten,
damit spaeter niemand raten muss.

| Frage | Entscheidung |
|---|---|
| Was zeigt der Beamer aus der Operatoransicht? | Punktestand und `Frage x/y` ja, Bedienelemente nein |
| Verhaeltnis Design zu Spezifikation | Spezifikation gewinnt, Design ist rein optisch |
| Fehlende Screens | werden im gezeigten Stil entworfen und in `docs/screens.md` festgeschrieben |
| Schrift | Schriftdateien werden geliefert |
| Theming | jeder Modus bringt ein komplettes Farbsystem mit |
| Skalierung | Flaeche fuellen, Typografie skaliert mit |
| Animationen | Katalog wird vorgeschlagen, dann freigegeben |
| Falsch-Rueckmeldung | Kreuz fehlt in den Vorlagen und wird ergaenzt |
| Rubrik ueber der Frage | Label der ersten Kategorie der Frage |
| `klicken um mehr zu erfahren` | Bereich klappt auf und zeigt Zusatzinfos |
| Enthuellung | ausschliesslich Schaerfeaenderung, kein Zoom |
| Punktekacheln | gespiegelt angeordnet |
| Antwortoptionen | erscheinen erst nach `Starten` |
| Eingeloggte Antwort | oeffentlich blau markiert |
| Ring der Enthuellung | laeuft ab, beginnend bei 12 Uhr |
| Schwarzer Balken oben | Fensterrahmen des Betriebssystems, kein Bauteil |
| Moduschips | kommen aus der Konfiguration, Layout auf drei ausgelegt |
| Aufloesungen | Laptop 16:10, Beamer 16:9 |
| `Zurücksetzen` | verwirft Spielerzuordnung und eingeloggte Antwort |
| Punktestand | zaehlt waehrend der Richtig-Animation hoch |
| Textfrage ohne Bild | Rubrik und Frage ueber volle Breite, Optionen darunter |
| Zweite Chance | wird sichtbar gekennzeichnet |

## 2. Ergaenzung zu Abschnitt 12 - oeffentliche und private Anzeige

Die Operatoransicht enthaelt die Buehnenausgabe als eingebettete Flaeche im
Verhaeltnis 16:9. Daraus wird eine pruefbare Regel:

- In dieser Flaeche darf **ausschliesslich** das oeffentliche View-Modell
  gerendert werden. Sie benutzt dieselbe Komponente wie das Buehnenfenster.
- Private Inhalte - Loesung, Hintergrund, Regiehinweise, Diagnose - liegen
  **ausserhalb** dieser Flaeche in der unteren Bedienleiste.
- Bedienelemente des Operators duerfen die Flaeche ueberlagern (`+`/`-` neben
  den Punktekacheln), gehoeren aber nicht zum oeffentlichen Renderpfad und
  erscheinen im Buehnenfenster nicht.

Der bestehende Test, der prueft, dass die Loesung vor der Loesungsszene nirgends
im DOM des Buehnenclients auftaucht, bleibt unveraendert gueltig und ist die
Abnahme dieser Regel.

## 2b. Ergaenzung zu Abschnitt 6 - der Zwischenschritt vor jeder Runde

Jede Frage steht zuerst still da, damit der Moderator sie vorlesen kann. Erst die
Freigabe des Operators blendet die Antwortmoeglichkeiten ein bzw. startet die
Enthuellung - und erst dann darf gebuzzert werden.

| Fragetyp | Wartezustand | Freigabe |
|---|---|---|
| Auswahlfrage | `question-presented` | `OPEN_BUZZER` ("Antworten einblenden") |
| Bilderkennen | `reveal-ready` (neu) | `START_IMAGE_REVEAL` ("Enthuellung starten") |
| Videofrage | `video-ready` | `SHOW_QUESTION_AFTER_VIDEO`, danach wie Auswahlfrage |

Zwei Punkte sind dabei keine Anzeigefragen, sondern Fachlogik:

- In `question-presented` uebertraegt der Server die Antwortmoeglichkeiten **gar
  nicht erst**. Sie stehen also auch nicht im DOM eines Buehnenclients, bevor sie
  jemand sehen soll.
- In `reveal-ready` laeuft die Enthuellungsuhr nicht. Die Vorlesezeit kostet keine
  Sekunde des Countdowns - der Zehn-Sekunden-Wert bleibt unangetastet.

Nach einem Fehlversuch beim Bilderkennen geht es zurueck nach `reveal-running`,
nicht nach `reveal-ready`: Die Frage ist bereits vorgelesen.

## 3. Ergaenzung zu Abschnitt 13 - oeffentliches View-Modell

Neu aufgenommen:

| Feld | Typ | Zweck |
|---|---|---|
| `question.categoryLabel` | `string?` | Rubrik ueber dem Fragetext; Label der ersten Kategorie |
| `secondChance.pointsIfCorrect` | `number?` | Punktwert im Hinweis der zweiten Chance |

Beide Felder sind Anzeigewerte. Sie werden serverseitig projiziert; der Client
leitet daraus nichts ab und rechnet nichts nach.

## 4. Ergaenzung zu Abschnitt 14 - Themes im Quizpaket

`theme.colors` traegt kuenftig den vollstaendigen Tokensatz des Designsystems
statt einer Auswahl. Damit ist ein Moduswechsel ein vollstaendiger Farbwechsel
der Oberflaeche, ohne Codeaenderung.

Validierung: Ein Theme muss alle Tokens tragen; fehlende Tokens sind ein
**Fehler** im Inhaltsbericht, kein Hinweis. Ein Modus ohne Startbild
(`startVisualUrl`) erzeugt eine Warnung.

*Nachtrag zur Umsetzung:* Das gebaute Paket traegt den vollstaendigen Satz - die
Quelle dagegen nur die Abweichungen. Die Werte stehen an einer einzigen Stelle
(`packages/contracts/src/theme.ts`) und werden beim Bauen eingesetzt. Die
Zusage bleibt damit unveraendert, sie wird nur nicht mehr in jede Datei
abgeschrieben; siehe `docs/design-system.md`, Abschnitt „Wo die Farben stehen".

## 5. Ergaenzung zu Abschnitt 22 - Praesentation und Animation

- Der Animationskatalog ist die vollstaendige Liste der Bewegungen. Jede Zeile
  wird zu genau einer Definition unter `transitions/`.
- Zwei Dauern bleiben an `gameTiming` gebunden und tragen `locked`:
  Richtig- und Falsch-Rueckmeldung.
- Die Enthuellung bleibt an `packages/domain/src/reveal.ts` gebunden: Ringlaenge
  und Bildschaerfe stammen aus derselben Fortschrittsvariablen. Neu festgelegt
  ist allein die **Richtung** des Rings: Beginn bei 12 Uhr, Ablauf im
  Uhrzeigersinn.
- Neu: Der Punktestand zaehlt waehrend der Richtig-Animation hoch. Die Animation
  interpoliert zwischen zwei Snapshotwerten und erzeugt nie einen eigenen Wert.

## 6. Ergaenzung zu Abschnitt 27 - Fenster und Aufloesungen

| Rolle | Geraet | Verhaeltnis |
|---|---|---|
| Operator | Laptop | 16:10 |
| Buehne | Beamer | 16:9 |
| Moderator | iPad | frei, eigenes Layout |

Die Buehnenflaeche bleibt in jeder Umgebung 16:9 und fuellt den verfuegbaren
Platz. Typografie skaliert ueber Container-Queries mit der Flaechenbreite, nicht
ueber Geraeteabfragen. Der schwarze Balken am oberen Rand der Vorlagen ist der
Fensterrahmen des Betriebssystems und wird nicht nachgebaut.

## 7. Ergaenzung zu Abschnitt 31 - Abnahme

Zusaetzliche Abnahmekriterien:

1. Operatorvorschau und Buehnenfenster zeigen bei gleicher Phase dieselbe
   Komposition; Unterschiede gibt es nur in Groesse und Bedienrahmen.
2. Jeder in `docs/screens.md` beschriebene Zustand ist in der
   Entwicklungsansicht `/preview` anwaehlbar und dort abgenommen.
3. Jede Zeile des Animationskatalogs hat eine Definition mit
   Reduced-Motion-Wert.
4. Ein Moduswechsel auf der Startansicht taucht die Buehnenflaeche um, ohne dass
   ein Modusname im Code steht. Die Bedienoberflaeche behaelt ihr eigenes festes
   Farbsystem.
5. Kein Bauteil enthaelt einen Farbwert; alle Farben stammen aus Tokens.

## 8. Offene Punkte

- Freigabe des Animationskatalogs.
- Zulieferung der Schriftdateien, Startvisuals, Symbole und der Farbsysteme fuer
  `Kinder` und `Saarbruecken` (Liste in
  [`docs/umsetzungsplan-ui.md`](umsetzungsplan-ui.md)).
- Fensterminiatur auf Vorlage 17: bis zur Klaerung nicht umgesetzt.
