# Umsetzungsplan Oberflaeche

Plan fuer den Umbau der bestehenden Oberflaeche auf die gelieferten
Screendesigns. Der Plan beschreibt Reihenfolge, Verantwortlichkeiten und
Abnahmekriterien; die visuellen Vorgaben stehen in
[`docs/design-system.md`](design-system.md) und [`docs/screens.md`](screens.md),
die Bewegungen in [`docs/animationskatalog.md`](animationskatalog.md).

## Was sich fachlich aendert - und was nicht

**Unveraendert:** Zustandsmaschine, Befehle, Rollenrechte, Persistenz,
Wiederherstellung, Inhaltspipeline, Punktelogik, Enthuellungsberechnung. Das
Design ist Darstellung.

**Aenderungen ausserhalb der Oberflaeche** - klein, aber notwendig:

| Aenderung | Ort | Grund |
|---|---|---|
| `question.categoryLabel` im oeffentlichen View-Modell | `contracts/viewModels.ts`, `domain/projection.ts` | Die Rubrik ueber der Frage ist das Label der ersten Kategorie |
| Vollstaendiger Farbtokensatz je Theme | `contracts/content.ts`, `content/source/config.json` | Jeder Modus bringt ein komplettes Farbsystem mit |
| `theme.startVisualUrl` je Modus verpflichtend nutzbar | `domain/projection.ts` | Startbild ist Teil des Modus, nicht des Codes |
| `pointsIfCorrect` in der Buehnenprojektion | `domain/projection.ts` | Hinweis `Zweite Chance · 50 Punkte` darf keine feste Zahl im Code sein |

Alles Weitere passiert in `apps/web`.

## Leitgedanken

1. **Eine Quelle fuer die Buehne.** `StageScreen` rendert das oeffentliche
   View-Modell. Buehnenfenster, Operatorvorschau und Entwicklungsvorschau
   benutzen dieselbe Komponente. Es gibt keinen zweiten Renderpfad.
2. **Tokens statt Farbwerte.** Kein Bauteil enthaelt einen Farb-, Radius- oder
   Abstandswert. Alles kommt aus CSS-Variablen, die aus dem Theme des
   Quizpakets gesetzt werden.
3. **Deklarative Bedienleiste.** Die Tasten stehen als Datenstruktur da, nicht
   als JSX-Kaskade. Der Zustand jeder Taste ergibt sich aus `allowedCommands`
   und dem View-Modell.
4. **Skalierung ueber Container-Queries.** Ein Layout, zwei Groessen. Keine
   Geraeteabfragen, keine zweite Typografieskala.
5. **Keine magischen Zahlen in JSX.** Zeiten kommen aus dem Uebergangsregistry,
   Groessen aus Tokens.
6. **Sperren statt Verstecken.** Bedienelemente behalten ihre Position; nicht
   erlaubte Tasten werden gesperrt.

## Zielstruktur

```text
apps/web/src/
  styles/
    tokens.css            Basistokens, Verlaeufe, Radien, Abstaende
    typography.css        @font-face, Typoskala in cqw und rem
    stage.css             Buehnenflaeche und Szenen
    chrome.css            Kopfleiste, Bedienleiste, Baender
    animations.css        Keyframes; Dauern nur ueber CSS-Variablen
  theme/
    applyTheme.ts         Theme-Tokens -> CSS-Variablen auf dem Wurzelelement
  ui/
    Tile.tsx  ActionButton.tsx  OptionBar.tsx  CircleBadge.tsx
    ProgressRing.tsx  SectionLabel.tsx  MediaFrame.tsx
  presentation/
    StageScreen.tsx       Rahmen, Szenenwahl, Uebergang, Soundmarke
    StageHeader.tsx       Punktekacheln, Fragezaehler, Slots fuer Operatortasten
    scenes/               je Szene eine Datei, nur Anordnung
    transitions/          unveraendert: Animationsvertrag und Registry
  apps/operator/
    OperatorApp.tsx       Verbindung, Vorschau, Rahmen
    OperatorChrome.tsx    Beenden, Vollbild, Ton, Punktekorrektur
    ControlBar.tsx        rendert das Modell aus controlModel.ts
    controlModel.ts       Gruppen, Tasten, Zustandsableitung - ohne JSX
    PrivateAnswerPanel.tsx  Loesungszeile mit aufklappbarem Zusatzbereich
```

`ui/` kennt nur Tokens. `presentation/` kennt nur das oeffentliche View-Modell.
`apps/operator/` kennt zusaetzlich Befehle. Diese Richtung wird nicht
umgedreht.

### Das Bedienmodell

Kern der Wartbarkeit ist eine einzige Datei ohne JSX:

```ts
export interface ControlDescriptor {
  id: string
  label: string
  group: 'round' | 'player' | 'answer' | 'resolve' | 'advance'
  command: CommandType
  payload?: (view: OperatorQuizViewModel) => unknown
  visibleWhen?: (view: OperatorQuizViewModel) => boolean
  selectedWhen?: (view: OperatorQuizViewModel) => 'active' | 'quiet' | false
  primaryWhen?: (view: OperatorQuizViewModel) => boolean
}
```

`ControlBar` rendert die Liste, `ActionButton` stellt sie dar. Eine neue Taste
ist damit ein Listeneintrag - kein neuer Sonderfall im Markup. Die
Buchstabentasten `A`-`D` entstehen aus `visibleOptions`, nicht aus vier
kopierten Bloecken.

## Arbeitspakete

Jedes Paket ist fuer sich lauffaehig, typgeprueft und getestet.

### P1 - Fundament

Tokens, Typografie, Theme-Anwendung, Container-Query-Rahmen. Ergebnis: Die
Anwendung laeuft im neuen Grauton, ohne dass ein Layout umgebaut ist.

*Abnahme:* `themeToCssVariables()` deckt alle Tokens ab; kein Farbwert mehr in
Komponenten; `pnpm typecheck` und `pnpm test` gruen.

### P2 - Primitive

`Tile`, `ActionButton`, `OptionBar`, `CircleBadge`, `ProgressRing`,
`SectionLabel`, `MediaFrame` samt Zustandsmatrix.

*Abnahme:* Alle Varianten in `/preview` sichtbar; Zustandsmatrix vollstaendig.

### P3 - Buehnenflaeche und Kopfzeile

16:9-Flaeche, gespiegelte Punktekacheln, Fragezaehler, Slots fuer die
Operatortasten. Szenen `question`, `reveal`, `feedback`, `solution`, `result`
auf die neue Anordnung umgestellt, inklusive Rubrikzeile und Textfragelayout
ueber die volle Breite.

*Abnahme:* Vorschau im Operatorfenster und Buehnenfenster zeigen pixelgleiche
Kompositionen; `test/e2e/presentation.spec.ts` mit neuen Screenshot-Baselines.

### P4 - Bedienrahmen

`OperatorChrome`, `ControlBar` aus `controlModel.ts`, private Antwortzeile mit
aufklappbarem Zusatzbereich, `Zurücksetzen`, Vollbild- und Tonschalter.
Beschriftungen wechseln auf echte Umlaute; die E2E-Selektoren werden
mitgezogen.

*Abnahme:* Jede Taste des Designs vorhanden, Position stabil ueber alle Phasen;
`test/e2e/game-flows.spec.ts` gruen.

### P5 - Startansicht

Startbild je Modus, Modus- und Schwierigkeitschips aus `catalog`,
`Spiel starten`, `Spiel fortsetzen` bei wiederaufnehmbarem Spiel.

*Abnahme:* Moduswechsel taucht sofort die gesamte Oberflaeche um; kein
Modusname steht im Code.

### P6 - Entworfene Zustaende

Pausenbild, Videofrage, zweite Chance mit sichtbarer Kennzeichnung, Abbruch,
Verbindungsband, Fehlerhinweise, Moderatoransicht.

*Abnahme:* Jeder Zustand aus `docs/screens.md` ist in `/preview` anwaehlbar.

### P7 - Animationen

Katalog nach Freigabe in `transitions/` eintragen: Kreuz-Symbol,
Punkte-Hochzaehlen waehrend der Richtig-Animation, Ringrichtung ab 12 Uhr,
Einlaufregel der Optionen, Baender.

*Abnahme:* Jede Zeile des Katalogs hat eine Definition mit
`reducedMotionDurationMs`; gesperrte Dauern tragen `locked` mit Begruendung;
Reduced-Motion-Test gruen.

### P8 - Abnahme

Vollstaendiger Durchlauf auf 16:10 und 16:9, Screenshotvergleich gegen die
Vorlagen, Kontrollgang durch `docs/operator-kurzanleitung.md`.

## Tests

| Ebene | Was abgesichert wird |
|---|---|
| `pnpm test` | Ableitung der Tastenzustaende aus `allowedCommands`; Theme-Tokens vollstaendig; Rubrik aus der ersten Kategorie |
| `pnpm test:e2e --project=preview` | Alle Szenen und Zustaende, Reduced Motion, Screenshots je Modus |
| `pnpm test:e2e --project=live` | Bedienleiste ueber einen ganzen Spieldurchlauf, private Inhalte nie im Buehnen-DOM |

Der bestehende Test "der Buehnenscreen erhaelt die Loesung erst in der
Loesungsszene" bleibt die wichtigste Absicherung des Umbaus: Er beweist, dass
die neue Vorschau im Operatorfenster die Trennung nicht aufweicht.

## Offene Zulieferungen

Ohne diese Dateien wird mit den benannten Platzhaltern gearbeitet; der Austausch
ist danach ein reiner Dateitausch ohne Codeaenderung.

| Zulieferung | Wofuer | Platzhalter bis dahin |
|---|---|---|
| Schriftdateien `woff2` samt Name und Lizenz | gesamte Oberflaeche | Systemserifen-Kette |
| Adler-Wasserzeichen und `?`-Signet | Startbild Erwachsene | Rasterausschnitt aus der Vorlage |
| Kindergrafik | Startbild Kinder | Rasterausschnitt aus der Vorlage |
| Symbole Vollbild und Ton | Kopfbereich | nachgezeichnete Inline-SVG |
| Farbsysteme `Kinder` und `Saarbruecken` | Themes | erben von `Erwachsene` |
| Startbild `Saarbruecken` | Startansicht | Titelkarte im Stil der Vorlage |

## Beobachtung ohne Festlegung

Auf Vorlage 17 liegt unten rechts eine kleine Fensterminiatur, die den
Startbildschirm des anderen Modus zeigt. Sie wird **nicht** umgesetzt, weil
unklar ist, ob sie ein gestaltetes Bauteil oder ein Artefakt der
Bildschirmaufnahme ist. Falls eine Vorschau des Buehnenfensters im
Operatorfenster gewuenscht ist, wird sie als eigenes Arbeitspaket nachgezogen.
