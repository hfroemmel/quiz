# Ein Kern, drei Kontexte

Dieses Dokument beschreibt, wie das Quiz zusaetzlich zum Buehnenbetrieb als
eigenstaendiges Touch-Spiel und als eingebettetes Spiel einer Multigame-Anwendung
laeuft - ohne den Spielkern zu duplizieren.

Es ist ein Entwurf mit Umsetzungsplan, noch keine Umsetzung. Grundlage sind die
Entscheidungen aus der Abstimmung vom 22.08.2026 (Abschnitt "Getroffene
Entscheidungen").

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
| `packages/runtime` | **neu**, aus `packages/server` herausgeloest: `QuizService`, `ContentService`, Ports, Timer | Der Kern der Anwendungsschicht darf nicht an HTTP haengen. Danach ist `packages/server` nur noch Transportadapter. |
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
| Frage sichtbar | Operator gibt Buzzer frei | Antwortflaechen sind sofort aktiv (`buzzer-open` direkt) |
| Antwort | Operator loggt ein, loest auf | Spieler tippt: ein Befehl, sofortige Auswertung |
| Nach der Loesung | Operator drueckt "Weiter" | eingeplanter Uebergang nach `solutionHoldMs` |
| Videofrage | Operator startet und blendet um | laeuft automatisch, danach automatisch die Frage |
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

## 6. Umsetzungsplan

Jede Stufe ist fuer sich lauffaehig und endet mit gruenen Tests. Der
Buehnenbetrieb bleibt nach jeder Stufe unveraendert benutzbar.

| Stufe | Inhalt | Ergebnis / Testkriterium |
|---|---|---|
| **0** | `packages/presentation` herausloesen, `apps/web` umstellen — **erledigt** | reine Verschiebung; `pnpm typecheck`, `pnpm test` (108) und `pnpm test:e2e` (32) unveraendert gruen |
| **1** | `packages/runtime` aus `packages/server` herausloesen — **erledigt** | `packages/server` haengt nur noch als Transportadapter dran; keine Verhaltensaenderung |
| **2** | Spielerzahl 1-2 im Kern (Contracts, Engine, Projektion, Szenen) — **erledigt** | neue Domaintests: Einzelspieler ohne zweite Chance, Solo-Ergebnis; Buehne weiterhin zweispielrig |
| **3** | Ablaufprofil `self-service`, Rolle `player`, `ANSWER_BY_PLAYER`, automatische Uebergaenge — **erledigt** | Domaintests fuer beide Profile; Fairnesstest "zwei Antworten im selben Millisekundenfenster" |
| **4** | `packages/game`: Touchansicht (geteilter Bildschirm, zweite Seite um 180 Grad gedreht), grosse Trefferflaechen, Start- und Ergebnisscreen | spielbar im Browser gegen den lokalen Server; Playwright-Test fuer einen kompletten Durchlauf 1 und 2 Spieler |
| **5** | `apps/kiosk`: Electron-Vollbild, Attract-Screen, Leerlauf-Aufsicht, Inhaltsfilter fuer Selbstbedienung, `image-reveal` freischalten | Geraet spielt einen Tag durch, ohne dass jemand eingreift |
| **6** | Einbettungsvertrag haerten (CSS-Kapselung, Lebenszyklus, Pause, `onFinished`), Beispielshell als erster fremder Nutzer, Dokumentation | Zwei Instanzen nacheinander in derselben Shell hinterlassen keine Timer, keine Sockets, keine Stile |

Stufen 0 und 1 sind mechanisch und risikoarm, kosten aber die Grundlage fuer alles
Weitere. Stufe 3 ist die fachlich anspruchsvollste.

### Stand nach Stufe 0 und 1

Beide Stufen sind umgesetzt und aendern kein Verhalten.

* `packages/presentation` enthaelt die Buehnenflaeche samt Szenen, Uebergaengen,
  Bausteinen, Bewegtgrafiken und eigenem Stylesheet. Zugriff nur ueber
  `src/index.ts`; das Stylesheet der Bedienoberflaechen ist getrennt. Die
  Farbtoken gelten jetzt an `:root, .stage`, damit sie auch als Gast in einer
  fremden Anwendung tragen.
* `packages/runtime` enthaelt `QuizService`, `ContentService` und den neuen
  gemeinsamen Zusammenbau `createQuizRuntime()`. `packages/server` ist nur noch
  Transport: HTTP, WebSocket, Zugriffsregeln.
* Zwei Nebenbefunde wurden mitgenommen: `apps/web` wurde von keinem
  Typecheck-Projekt geprueft (jetzt Teil von `pnpm typecheck`), und das Muster
  `runtime/` in `.gitignore` war nicht verankert - es haette das neue Quellpaket
  mit ignoriert.

Damit steht die Paketstruktur fuer Stufe 2 (Spielerzahl) und Stufe 3
(Ablaufprofil), die als erste den Kern fachlich veraendern.

### Stand nach Stufe 2

`GameState.players` ist ein Array mit einem oder zwei Eintraegen; `START_GAME`
traegt optional `playerCount`. Ohne Angabe entsteht ein Duell - der
Buehnenbetrieb bleibt damit unveraendert und muss nichts mitschicken.

Zwei Regeln haengen an der Spielerzahl, und beide an genau einer Stelle:

* **Zweite Chance** nur, wenn es einen anderen Spieler gibt, der bei dieser Frage
  noch antworten darf (`eligibleOpponent` in `buzzer.ts`). Im Einzelspiel folgt
  nach dem Fehlversuch sofort die Loesung. Beim Bilderkennen bleiben mehrere
  Versuche desselben Spielers erlaubt - diese Regel haengt am Fragetyp, nicht an
  der Spielerzahl.
* **Ergebnis** ueber `result.mode`: Im Duell Gewinner oder Unentschieden, im
  Einzelspiel Punktestand und Trefferzahl. Die Ergebnisszene entscheidet daran,
  was sie zeigt - sie zaehlt nicht die Punktestaende.

Die Entwicklungsvorschau hat dafuer einen Schalter „Einzelspiel", damit die
Solo-Darstellung pruefbar ist, obwohl der Operator noch keine Einzelspiele
startet. Das deckt die Bildregression mit ab.

### Stand nach Stufe 3

Der Kern ist damit touchfaehig; es fehlt nur noch die Oberflaeche dafuer.

* **Ablaufprofil** `operated` | `self-service` im Spielzustand, gesetzt beim Start.
  Ohne Angabe entsteht ein vom Operator gesteuertes Spiel. Die automatischen
  Uebergaenge stehen an einer Stelle (`scheduleSelfServiceFollowUp`) und nutzen
  dieselbe Mechanik mit serverseitiger Fallbackzeit wie Feedback und Pausenscreen.
  Der Uebergang aus der Loesung ist bewusst kein Phasenwechsel, sondern dieselbe
  Entscheidung wie `CONTINUE`.
* **Rolle `player`** mit genau vier Rechten: Selbstbedienungsspiel starten und
  beenden, antworten, Ton und Medienstatus. Kein Einloggen, kein Aufloesen, kein
  Weiterschalten. Die Ansicht (`PlayerQuizViewModel`) ist die oeffentliche Ansicht
  plus `allowedCommands` - dieselbe Sicherheitsregel wie beim Buehnenscreen.
  Erreichbar ist die Rolle nur ueber Loopback, also auf dem Geraet selbst.
* **`ANSWER_BY_PLAYER`** fasst Zuschlag, Einloggen und Auswerten in einer
  Serverentscheidung zusammen und ist wie der Buzzer revisionsfrei. Ueber den
  Zuschlag urteilt weiterhin `evaluateBuzz` - es gibt keine zweite Fairnessregel.
* **Sicherheitsnetz Inhalte:** Eine Frage, die nur ein Mensch bewerten kann, wird
  im Selbstbedienungsbetrieb uebersprungen und protokolliert, statt den Ablauf
  anzuhalten. Der eigentliche Filter kommt mit Stufe 5.
* **Videofragen** laufen ohne Operator: Das Video startet nach kurzem Vorlauf von
  selbst, der Wechsel zur Frage folgt aus der vom Client gemeldeten Laufzeit, und
  ein nicht abspielbares Video blendet die Frage sofort ein.

Offen bleibt bewusst die Bedienoberflaeche: Es gibt noch keinen Touchclient. Der
Kern laesst sich vollstaendig ohne ihn pruefen - genau dafuer sind die Regeltests
da.

## 7. Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Plattform der Touch-Variante | Electron-Kiosk, wie `apps/desktop` |
| Einbettung in die Multigame-App | React-Komponente aus einem Workspace-Paket |
| Einzelspielerregeln | wie heute, nur ohne Gegner: kein Zeitdruck, kein Leben-/Streak-System |
| Zwei Spieler auf einem Geraet | geteilter Bildschirm, gegenueberliegend, wer zuerst tippt hat geantwortet |

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
