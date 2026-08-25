# Ein Kern, drei Kontexte

Dieses Dokument beschreibt, wie das Quiz zusaetzlich zum Buehnenbetrieb als
eigenstaendiges Touch-Spiel und als eingebettetes Spiel einer Multigame-Anwendung
laeuft - ohne den Spielkern zu duplizieren.

Der Kern ist umgesetzt (Abschnitt 6); die Oberflaechen dafuer stehen noch aus.
Grundlage sind die Entscheidungen aus Abschnitt 7.

## 1. Die drei Kontexte

| Kontext | Bedienung | Wer steuert den Ablauf | Fenster/Prozess |
|---|---|---|---|
| **A - Buehne** | Operator, Moderator, Hardware-Buzzer | Mensch (Operator/Moderator) | Electron mit Operator- und Praesentationsfenster, LAN-Clients |
| **B - Alleinstehend** | Touch, 1 oder 2 Spieler | Automatik, Spieler tippen selbst | Electron-Kiosk, ein Vollbildfenster |
| **C - Multigame** | Touch, 1 oder 2 Spieler | Automatik, Spieler tippen selbst | fremde React-Shell, das Quiz ist eine Komponente darin |

B und C unterscheiden sich fachlich **nicht**. Sie unterscheiden sich nur darin, wer
das Fenster besitzt, wer das Spiel startet und beendet und wo Datenbank und
Quizpaket liegen. Deshalb gibt es nicht drei Anwendungen, sondern **ein Spielmodul
und drei Huellen**.

## 2. Leitentscheidung

Der Kern (`@quiz/contracts`, `@quiz/domain`, `@quiz/content`, Anwendungsschicht)
bleibt die einzige Quelle der Spielregeln. Er wird **erweitert**, nicht kopiert.

Zwei naheliegende Abkuerzungen werden ausdruecklich **nicht** genommen:

1. **Kein zweiter Ablauf.** Es entsteht keine zweite Zustandsmaschine "fuer Touch".
   Der Unterschied zwischen Buehne und Selbstbedienung ist Konfiguration im
   Spielzustand (`flowProfile`), keine zweite Codebahn. Sonst driften die beiden
   Ablaeufe innerhalb weniger Monate auseinander und jede Regelaenderung muss
   zweimal gedacht und zweimal getestet werden.
2. **Kein Operator-Simulator in der Oberflaeche.** Der Touch-Client sendet nicht
   heimlich Operatorbefehle (`OPEN_BUZZER`, `LOG_OPTION_ANSWER`, `RESOLVE_ATTEMPT`).
   Das wuerde die Rollenrechte aushebeln, das Auditlog verfaelschen ("Operator hat
   eingeloggt", obwohl niemand da war) und die Fairness beim gleichzeitigen Tippen
   von der Netzlaufzeit dreier Nachrichten abhaengig machen. Stattdessen gibt es
   eine eigene Rolle `player` mit genau einem atomaren Befehl.

## 3. Zielarchitektur

```text
                 apps/web            apps/kiosk          fremde Multigame-Shell
              (Operator, Buehne,   (Electron-Vollbild,     (React-Anwendung)
               Moderator)           Attract-Screen)
                    |                    |                        |
                    |                    +-----------+------------+
                    |                                |
                    v                                v
        packages/presentation  <---------  packages/game
        (Szenen, Uebergaenge,              (<QuizGame/>: Verbindung,
         Tokens, Buehnenflaeche)            Touch-Eingabe, Lebenszyklus)
                    \                              /
                     \                            /
                      v                          v
                        packages/contracts (Vertraege)
                        packages/domain    (Regeln, Projektion)
                                |
                        packages/runtime   (QuizService, Ports, Timer)
                        /               \
        packages/server                 In-Prozess-Start
        (HTTP + WebSocket)              (Electron-Hauptprozess)
                        \               /
                packages/persistence, packages/content
```

### Paketaenderungen

| Paket | Aenderung | Begruendung |
|---|---|---|
| `packages/presentation` | **neu**, aus `apps/web/src/presentation`, `ui/`, `theme/`, `styles.css` | `docs/architektur.md` verzichtet bisher bewusst auf dieses Paket, weil es nur einen Nutzer gab. Ab jetzt gibt es drei. Die dort formulierte Bedingung ist damit erfuellt. |
| `packages/game` | **neu** | Das spielbare Quiz als eine React-Komponente mit Lebenszyklus-API. Einziger Baustein, den die Multigame-Shell kennt. |
| `packages/runtime` | **erledigt**, aus `packages/server` herausgeloest: `QuizService`, `ContentService`, Zusammenbau | Der Kern der Anwendungsschicht darf nicht an HTTP haengen. Danach ist `packages/server` nur noch Transportadapter. |
| `packages/server` | schrumpft auf HTTP, WebSocket, Netzwerkzugang, Auslieferung | - |
| `apps/kiosk` | **neu** | Electron-Huelle fuer Kontext B. |
| `apps/web`, `apps/desktop` | importieren `packages/presentation` statt lokaler Ordner | keine Verhaltensaenderung |
| `packages/contracts`, `packages/domain` | erweitert (Abschnitt 4) | - |
| `packages/persistence`, `packages/content` | unveraendert | - |

### Transport: bewusst ueberall derselbe

`startServer()` laeuft heute schon im Electron-Hauptprozess (`apps/desktop/src/main.ts`).
Kiosk und Multigame machen es genauso, nur auf `127.0.0.1` mit Port `0` und ohne
LAN-Freigabe. Der Renderer spricht in allen drei Kontexten ueber denselben
WebSocket-Vertrag mit demselben `QuizService`.

Das ist die wichtigste Vereinfachung dieses Entwurfs: **es gibt keinen zweiten
Transport, keine zweite Persistenz und keinen zweiten Inhaltszugriff.** SQLite,
Wiederherstellung nach Absturz, Idempotenz, Auditlog und die serverseitige
Filterung der Loesung gelten im Kiosk unveraendert.

Damit das so bleibt, wird in `packages/game` trotzdem eine schmale
Transportschnittstelle eingezogen (`send(envelope)`, `onMessage(...)`), heute mit
genau einer Implementierung (WebSocket). Falls die Multigame-Shell spaeter doch
eine reine Browseranwendung ohne Node-Prozess ist, kommt eine zweite
Implementierung dazu, ohne dass eine einzige Szene angefasst wird.

## 4. Was der Kern zusaetzlich koennen muss

### 4.1 Ablaufprofil statt zweitem Ablauf

Neu in `GameState` und in `START_GAME`:

```ts
export type FlowProfile = 'operated' | 'self-service'
```

Das Profil steuert ausschliesslich, **wer** einen Uebergang ausloest und **welche
Uebergaenge automatisch eingeplant werden**. Die Phasen selbst bleiben identisch.

| Stelle | `operated` (heute) | `self-service` (neu) |
|---|---|---|
| Frage sichtbar | Operator gibt Buzzer frei | die Frage steht `questionLeadInMs` allein, dann oeffnet der Server die Antworten |
| Antwort | Operator loggt ein, loest auf | Spieler tippt: ein Befehl, sofortige Auswertung |
| Nach der Loesung | Operator drueckt "Weiter" | ein SPIELER drueckt "Weiter" - der Server plant hier nichts ein |
| Videofrage | Operator startet und blendet um | laeuft automatisch, danach die Frage - auch sie zuerst allein |
| Bilderkennen | Operator kann pausieren | laeuft durch, Tippen friert wie ein Buzzer ein |

Technisch braucht es dafuer **keine neue Mechanik**: die vorhandene
`pendingTransition` mit `ADVANCE_TIMED_PHASE` und serverseitigem Fallback-Timer
deckt alle automatischen Uebergaenge ab. Erweitert werden `engine.ts`
(Uebergaenge einplanen, wenn `flowProfile === 'self-service'`) und
`allowedCommands.ts` (Operatorbefehle im Selbstbedienungsprofil gar nicht erst
anbieten).

Die neuen Haltezeiten kommen als `selfServiceTiming` in
`packages/contracts/src/config.ts` - dieselbe Quelle der Wahrheit wie `gameTiming`.

### 4.2 Ein bis zwei Spieler

Heute ist die Zweierbesetzung strukturell festgeschrieben:
`players: [PlayerState, PlayerState]`.

Aenderung: `players: PlayerState[]` mit 1 oder 2 Eintraegen, gesetzt beim
`START_GAME` (`playerCount: 1 | 2`). `PlayerId` bleibt `player-1 | player-2`.

Fachliche Folgen (Einzelspieler = "wie heute, nur ohne Gegner"):

| Regel | Duell | Einzelspieler |
|---|---|---|
| Zweite Chance | anderer Spieler, 50 Punkte | entfaellt - nach dem Fehlversuch direkt `solution` |
| Sperre nach Fehlversuch | wie heute | wirkungslos, da kein zweiter Spieler |
| Bilderkennen | beide duerfen erneut buzzern | ein Versuch, danach Loesung |
| Ergebnis | Gewinner oder Unentschieden | kein Gewinner: Punktestand und Trefferquote |

`nextPhaseAfterAttempt()` bekommt dafuer genau eine zusaetzliche Bedingung
("gibt es einen anderen, nicht gesperrten Spieler?"). `determineResult()` liefert
zusaetzlich `mode: 'duel' | 'solo'`, damit die Ergebnisszene nicht raten muss.

Betroffen sind ausserdem: `projection.ts` (`playerScores`, `result`),
`StageHeader`/`ScoreTile` (einspaltige Darstellung) und die Domaintests.

### 4.3 Neue Rolle `player`, ein atomarer Befehl

```ts
z.object({
  type: z.literal('ANSWER_BY_PLAYER'),
  playerId: playerIdSchema,
  optionId: z.string().min(1),
})
```

Rollenrechte: `ANSWER_BY_PLAYER: ['player']`. Zusaetzlich `player` in `actorRoles`
und `ClientRole`, mit Zugang nur ueber Loopback (`checkAccess`).

Der Befehl fasst drei heutige Schritte in **einer** serverseitigen Entscheidung
zusammen: Zuschlag pruefen (`evaluateBuzz`), Antwort einloggen, auswerten. Das ist
der Grund fuer die Zusammenfassung: Wenn zwei Spieler auf demselben Bildschirm
gleichzeitig tippen, darf nicht die Netzlaufzeit dreier Nachrichten entscheiden.
Wie `BUZZ` ist der Befehl deshalb `revisionExempt` - er ist ein physisches
Ereignis, keine Entscheidung auf Basis eines gesehenen Zustands.

Ausserdem darf `player` `START_GAME` senden, aber nur mit
`flowProfile: 'self-service'`; das prueft die Anwendungsschicht, nicht die
Oberflaeche.

Der Buehnenbetrieb bleibt davon vollstaendig unberuehrt: `operator` kann
`ANSWER_BY_PLAYER` nicht senden, `player` keinen Operatorbefehl.

### 4.4 Inhalte: Welche Fragen taugen fuer Selbstbedienung?

Fragen mit `evaluationMode: 'manual-correct-incorrect'` (muendliche Antwort, vom
Operator bewertet) sind ohne Operator **nicht spielbar**. Sie duerfen im Kiosk
nicht gezogen werden.

Loesung ohne Sondercode in der Engine: `questionSlotRuleSchema.filters` bekommt
`evaluationModes`. Ein Kiosk-Preset filtert damit auf `option-comparison`. Die
Inhaltsvalidierung (`packages/content`) prueft zusaetzlich pro Preset, ob genug
selbstbedienungstaugliche Kandidaten uebrig bleiben - dieselbe Warnschwelle wie
heute bei kleinen Pools.

Empfehlung fuer die Reihenfolge: Kiosk startet mit `text-choice` und
`image-choice`; `image-reveal` folgt in Stufe 5 (funktioniert auf Touch sehr gut),
`video-then-question` zuletzt.

## 5. Die drei Huellen

### 5.1 Kontext A - Buehne

Unveraendert. `apps/web` und `apps/desktop` bekommen nur den Import aus
`packages/presentation` und starten Spiele weiterhin mit
`flowProfile: 'operated'`, `playerCount: 2`. Die bestehenden E2E-Tests sind das
Regressionsnetz fuer alle Stufen.

### 5.2 Kontext B - Alleinstehend (`apps/kiosk`)

- Electron, ein Fenster, `kiosk: true`, kein Menue, kein Operatorfenster.
- Hauptprozess startet `startServer({ host: '127.0.0.1', port: 0 })`.
- Renderer zeigt: Attract-Screen -> Auswahl "1 Spieler / 2 Spieler" (und, falls
  gewuenscht, Quizmodus) -> `<QuizGame/>` -> Ergebnis -> zurueck zum Attract-Screen.
- **Leerlauf-Aufsicht** (gehoert in die Huelle, nicht in den Spielkern): Passiert
  laenger als `idleTimeoutMs` nichts, wird das Spiel abgebrochen und der
  Attract-Screen kehrt zurueck. Ohne das bleibt ein Kiosk-Geraet mit einer offenen
  Frage stehen, weil im gewaehlten Einzelspielermodus bewusst kein Zeitdruck
  existiert.
- Veranstaltungstag: Der vorhandene automatische Tageswechsel (`ensureEventDay`
  mit Rollover) genuegt; die Wiederholungsvermeidung arbeitet damit pro Geraet und
  Tag.

### 5.3 Kontext C - Multigame

Die Shell ist eine React-Anwendung. Sie bindet ein:

```tsx
import { QuizGame, startQuizBackend } from '@quiz/game'   // Renderer
// im Electron-Hauptprozess der Shell:
const backend = await startQuizBackend({ databaseFile, packageDir })

<QuizGame
  endpoint={backend.endpoint}          // ws://127.0.0.1:<port>
  match={{ playerCount: 1 | 2, quizModeId?, presetId? }}
  idleTimeoutMs={120_000}
  onFinished={(result) => shell.showScore(result)}   // Punkte, Dauer, Trefferzahl
  onExit={() => shell.backToMenu()}                  // Abbruch durch die Spieler
/>
```

Regeln, damit die Komponente sich als Gast benimmt - sie sind Teil des Vertrags
und werden getestet:

- kein `window.location`-Routing, keine globalen Tastaturhandler ohne `opt-in`;
- kein globales CSS: alle Stile unter `.quiz-root` und ueber die vorhandenen
  Farbtoken als CSS-Custom-Properties;
- Assets ueber eine konfigurierbare Basis-URL, nie ueber absolute Pfade;
- `unmount` beendet Verbindung, Timer und Audio vollstaendig;
- pausiert bei `document.visibilitychange`, wenn die Shell das Spiel verdeckt.

Falls die Shell doch kein React ist, aendert sich nur die aeusserste Schicht:
`packages/game` bekommt zusaetzlich eine Web-Component- oder iframe-Huelle mit
demselben Lebenszyklus. Der Kern bleibt gleich.

## 6. Stand und offene Arbeiten

Die Entwicklung lief zeitweise auf zwei Linien: `main` baute die
Praesentationsschicht neu auf (CSS Modules, eigene Bauteile unter `stage/`,
Palette, Kinderwelt), waehrend parallel die Mehrkontext-Faehigkeit entstand. Beide
haben dieselben Dateien angefasst. Zusammengefuehrt wurde deshalb nicht per Merge,
sondern in der Reihenfolge, in der die Stufen aufeinander aufbauen - und die
Oberflaechenstufen werden auf den neuen Bauteilen neu gebaut statt auf den alten.

### Erledigt auf `main`

| Stufe | Inhalt |
|---|---|
| **Laufzeitpaket** | `packages/runtime` aus `packages/server` herausgeloest. `createQuizRuntime()` ist der gemeinsame Zusammenbau; `packages/server` ist nur noch Transport. |
| **Spielerzahl** | `players` ist ein Array mit ein oder zwei Eintraegen. Zweite Chance nur bei vorhandenem Gegner, Solo-Ergebnis mit Trefferzahl statt Gewinner. |
| **Ablaufprofil** | `operated` und `self-service` im Spielzustand, Rolle `player`, atomarer Befehl `ANSWER_BY_PLAYER`, automatische Uebergaenge ueber die vorhandene Timer-Mechanik. |
| **Inhaltsfilter** | `evaluationModes` im Slotfilter, drei Touch-Presets im Quizpaket, Eignung im Validierungsbericht, gefilterter Katalog fuer die Spieleransicht. |
| **Touchansicht** | `apps/web/src/game` mit `<QuizGame/>`: Startauswahl, Fussleiste, Ergebnis. Beide Spieler stehen nebeneinander vor demselben Bild; unten hat jeder seine Ecke aus Punktekarte und Buzzer, die vier Antworten stehen einmal darueber und benutzen `AnswerList` - dieselben Zeilen wie im Saal. Erreichbar unter `/play`. |
| **Kiosk** | `apps/kiosk` als Electron-Vollbild: Laufzeit im selben Prozess, nur Loopback, kein Operatorfenster, Leerlauf-Aufsicht als Betriebsangabe. |
| **Einbettung** | `onFinished`/`onExit`, Abraeumen beim Entfernen, Beispielsammlung unter `/shell` als Pruefstand. |

Damit sind zwei der drei Kontexte fertig: Ein Spiel laesst sich ohne einen
einzigen Operatorbefehl von der ersten Frage bis zum Ergebnis spielen - im
Browser unter `/play` und am Kioskgeraet. Geprueft ist das an 167 Unit-Tests und
74 End-to-End-Tests, darunter ein vollstaendiges Einzelspiel ohne Operator; der
Buehnenbetrieb blieb dabei unveraendert, inklusive der Bildregression der Buehne.

Von den vier Fehlern des ersten Anlaufs sind drei beim Wiederaufbau vermieden
worden - die beiden Socket-Fehler traten nicht wieder auf, weil die
Verbindungsschicht auf `main` sie bereits behoben hat, und das fremde Ergebnis
haelt ein eigener Test fest. Der vierte (`pendingStart`) ist als Zwischenzustand
umgesetzt.

### Offen: der dritte Kontext

Was heute geht: Buehne (`/stage` mit Operator) und eigenstaendiges Touchspiel
(`/play`, Kiosk). Was noch nicht geht: das Quiz als importierbares Bauteil einer
FREMDEN Anwendung.

Die Beispielsammlung unter `/shell` zeigt den Lebenszyklus bereits vollstaendig -
einbinden, verlassen, wieder einbinden, ohne Rest - aber sie lebt in derselben
Anwendung und benutzt deshalb dieselben globalen Stylesheets. Eine fremde
Anwendung wuerde die mitladen muessen, und dann bekaeme sie mehr, als ihr lieb ist.

| Stufe | Inhalt | Was dabei zu loesen ist |
|---|---|---|
| **Paketschnitt der Praesentation** | `apps/web/src/presentation` und `ui/` nach `packages/presentation` | Ueberwiegend Dateien verschieben. Die Bildregression der Buehne ist das Sicherheitsnetz. |
| **Verbindung als Paket** | `useQuizConnection` nach `packages/client` | Klein und mechanisch. |
| **Spielpaket** | `apps/web/src/game` nach `packages/game`, Ausgabe `<QuizGame/>` | Erst danach kann eine fremde Anwendung `import { QuizGame } from '@quiz/game'` schreiben. |
| **CSS-Kapselung** | Der globale Tokenlayer muss mit | Das ist der eigentliche Punkt, siehe unten. |

**Die CSS-Kapselung ist die offene Frage.** Alles Bauteilhafte liegt schon in
CSS-Modulen und kann nichts anfassen, was ihm nicht gehoert. Der globale Layer
kann es sehr wohl:

| Datei | Was daran der Gast braucht | Warum sie so nicht mitkann |
|---|---|---|
| `palette.css` | die `--color-*`-Rueckfallwerte | setzt sie an `:root` |
| `tokens.css` | Schriften, Radien, Dauern | setzt sie an `:root` |
| `stage.css` | `.stage`, `.stage--*` | Klassenselektoren, geht mit |
| `motion.css` | Keyframes und Uebergangsklassen | geht mit |
| `base.css` | nichts | Reset mit `*`, `html`, `body` - gehoert dem Gastgeber |

Die Farben reisen ohnehin schon inline mit (`themeVariables` setzt sie am
Wurzelelement der Komponente); zu loesen ist der Rest von `tokens.css`. Der Weg
dahin ist eine Anforderungsklasse am eigenen Wurzelelement statt `:root` - und
ein Test, der genau das festhaelt: Kein Selektor eines mitgelieferten
Stylesheets darf mit einem Elementnamen, `*`, `html`, `body` oder einem nackten
`:root` beginnen.

## 7. Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Plattform der Touch-Variante | Electron-Kiosk, wie `apps/desktop` |
| Einbettung in die Multigame-App | React-Komponente aus einem Workspace-Paket |
| Einzelspielerregeln | wie im Duell, nur ohne Gegner: kein Zeitdruck, kein Leben-/Streak-System |
| Zwei Spieler auf einem Geraet | beide stehen nebeneinander vor demselben Bild: unten je eine Ecke aus Punktekarte und Buzzer in der Farbe des Spielers, die Antworten einmal darueber, wer zuerst drueckt bekommt sie. Frueher lagen sich zwei gespiegelte Antwortleisten gegenueber - dieselben vier Antworten standen dann doppelt auf dem Geraet. |
| Auswahl am Geraet | Spielerzahl und Schwierigkeit; der Quizmodus gehoert zur Aufstellung |

## 8. Offene Punkte

1. **Auswahl vor dem Spiel im Kiosk**: nur "1 oder 2 Spieler", oder zusaetzlich
   Quizmodus und Schwierigkeit? Beides ist billig, es ist eine reine Frage der
   Bedienfuehrung am Geraet.
2. **Bestenliste**: soll der Kiosk Punktestaende ueber Spiele hinweg zeigen? Die
   Datenbank kann es ohne Schemaaenderung nicht; es waere eine kleine Migration.
3. **Ton im Kiosk**: dauerhaft an, oder stumm mit sichtbarem Schalter?
4. **Quizpaket im Kiosk**: mitgeliefert und nur bei einer neuen Programmversion
   aktualisiert, oder soll ein Geraet Inhalte nachladen koennen?
5. **Multigame-Shell**: liegt sie in diesem Repository oder in einem fremden? Das
   entscheidet, ob `@quiz/game` ein Workspace-Paket bleibt oder als Paket
   veroeffentlicht werden muss.

## 9. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Der Buehnenablauf bricht durch Kernaenderungen | Jede Regelaenderung wird fuer beide Ablaufprofile getestet; die bestehenden E2E-Tests laufen in jeder Stufe |
| Der Touch-Client umgeht die Rollenrechte | `player` darf ausschliesslich `ANSWER_BY_PLAYER` und ein eingeschraenktes `START_GAME`; geprueft wird serverseitig |
| Unfaire Antwort bei gleichzeitigem Tippen | ein atomarer, revisionsfreier Befehl; der Server entscheidet in einer Transaktion |
| Die eingebettete Komponente stoert die Shell | Kapselungsregeln aus Abschnitt 5.3 als Teil des Vertrags, mit Test auf Mehrfach-Einbindung |
| Fragen ohne Optionen landen im Kiosk | Filter im Preset plus Validierungswarnung, nicht erst zur Laufzeit |
