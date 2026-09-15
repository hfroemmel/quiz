# @hfroemmel/quiz-content

## 0.16.1

### Patch Changes

- 93efbf7: Let the buzzers carry the accent of the world, and go neutral when they cannot act
  
  Both corners of the touch device carry the same area now: the accent of the
  world they are playing in. They are told apart by their place, left and right,
  not by two tones of their own.
  
  That took reading the accent where it applies. The two palette tokens
  `--stage-playerOne` and `--stage-playerTwo` could not do it: a token that
  substitutes `var(--color-accent)` at the document root freezes the default
  world's tone and keeps it in the light world and in the kids' one. The device
  therefore showed `#3392C5` while its own accent was `#0077B6`. The tokens had
  exactly one consumer and are gone; the buzzer reads `--color-accent` itself.
  
  A corner that cannot act is now the stage's frosted tile with muted lettering -
  the same fill the score card above it carries while nobody has the turn. Coloured are only the
  corners that are playing: a buzzer open for the taking, and the one held by the
  player whose turn it is. Both keep their full fill instead of being dimmed to 35
  percent, because in this world the area is the statement. The kids' world keeps
  dimming, where the drawn card carries it.
- Updated dependencies [93efbf7]
  - @hfroemmel/quiz-core@0.16.1

## 0.16.0

### Minor Changes

- 7d07064: Put everything a start menu shows, and the rules of the house, into the configuration
  
  Two things were in the wrong place. What the start menus show - which player
  counts a quiz offers, which motif its card carries, how the cards are ordered -
  lived in component properties and in lists inside the hosts: the kiosk took
  `playerCounts` as a property, the Bundestags app kept its own offer list, the
  live stage its own artwork table. And the rules of the house - points, timings,
  jokers, idle watch - were constants in the code, so a second house meant a
  second build.
  
  Both are now in the quiz package.
  
  `quizzes[]` grows by `playerCounts`, `artworkAssetId`, `emphasis` and `order`.
  `deriveStartMenu(config, catalog, locale)` turns them into one model: offers in
  menu order with their labels resolved, the player counts across all offers, the
  language list, and per offer whether it can be started right now - with a
  reason, before the attempt, instead of a rejection afterwards. A package
  without `quizzes` is still a valid package: then its audiences are the offer, so
  the model is never empty for a package that plays.
  
  `config.rules` sets only rules the engine already has: scoring, the timings that
  drive the phases, jokers on or off, the idle timeout and whether the detail text
  gets its own step after the solution. Every value defaults to the constant used
  until now, so a package without `rules` plays exactly as before - that is what
  the new tests pin down. The bounds are part of the schema; the reveal grid and
  the parameters of the selection algorithm stay in code, because they are
  fairness and not taste.
  
  For hosts nothing breaks: `QuizGame` still accepts `playerCounts` and
  `idleTimeoutMs` as properties and they still win. Where they are absent, the
  package answers.

### Patch Changes

- Updated dependencies [7d07064]
  - @hfroemmel/quiz-core@0.16.0

## 0.15.3

### Patch Changes

- Tune the stage type and spacing, and shorten the submit label
  
  The category above the question is no longer set in the accent colour with wide
  letter spacing; it takes the text colour in Noto Sans with a little more room
  below. In the pause scene the category now leads and the progress line steps
  back beneath it.
  
  The kids' world shows its celebration stars on the score card again. The light
  text for the player on turn is bound to the dark and bright stage themes, which
  leaves the adults' stage as it was and keeps it off the kids' paper.
  
  The kiosk sets the notice field further above the counter, and the default label of
  the submit button reads "Antwort abgeben".
- Updated dependencies
  - @hfroemmel/quiz-core@0.15.3

## 0.15.2

### Patch Changes

- Set the score card of the player on turn in light text
  
  The card of the player who holds the turn stands on the strong accent colour, so
  its values and labels now take the light ink on the default stage as well as on
  the bright one - in the points cell too, not only beside the name.
- Updated dependencies
  - @hfroemmel/quiz-core@0.15.2

## 0.15.1

### Patch Changes

- Fix the buzzer and score card styles
  
  A disabled buzzer in the default skin no longer keeps its full-strength face: it
  steps back to muted text on the frosted tile ground, so it reads as out of play.
  
  On the stage, both player colours now follow the accent colour instead of a fixed
  red and blue. A locked-out player's points cell takes the quiet accent together
  with the name cell, and on touch stages the card of the player who holds the
  turn takes the tile ground and text colour as a whole rather than cell by cell.
  The category heading of the pause scene is set smaller.
- Updated dependencies
  - @hfroemmel/quiz-core@0.15.1

## 0.15.0

### Minor Changes

- 1b64ce5: Give the two jokers their drawn signs
  
  The joker signs were placeholders: three outlined circles for the audience, a
  split circle for the 50:50. They are now the drawn artwork - three figures with
  the middle one carried forward, and the `50:50` lettering between two arcs.
  
  Both signs keep the mask over `currentColor` as their default, and that is a
  decision rather than a leftover. The 50:50 is lettered in a near-black grey; on
  the dark stage of the adults' quiz it would sink into the ground, and the group
  mark in a score card has to carry the colour of the digit it replaces, never one
  of its own. A face whose ground is known to be light can ask for the drawing
  with its own colours: `<JokerTypeIcon type="audience" tone="art" />`.
  
  Neither sign is square, and they are not cut alike. `JokerTypeIcon` now sets
  only the height and derives the width from the file, so both stand equally tall
  wherever they appear together and neither is squeezed into a square box - the
  audience mark would otherwise have stood beside the player number at 62 per cent
  of its height. The proportions ship as `jokerIconRatios` for a host that shapes
  its own box around the file.
- ac1d181: Make the quiz type a configured value, not a decision spread over the screens
  
  The desk picks ONE thing before an evening: which quiz runs. Until now that was
  three pickers - audience, preset, pool - and lately five cards that each carried
  their own `START_GAME` payload. Both said the same thing twice, in two places
  that could drift apart.
  
  `quizzes` in the quiz package is now that one thing. An entry names its audience,
  its theme, its pools and the difficulty presets it offers, each as a separate
  value: "Bremen-Quiz" is a line in the configuration, not a condition in a
  component. `START_GAME` takes `quizId` instead of `audience`, and the server
  resolves the rest and writes it into the game state - so a reload or a
  reconnect reads the confirmed configuration back instead of recomputing it.
  
  The difficulty choice is not a flag beside the list, it FOLLOWS from it:
  `presetIds` with one entry means there is nothing to choose, more than one means
  the operator chooses. `catalog.quizzes[].supportsDifficulty` hands that decision
  to the form already made, and the server refuses a difficulty for a quiz that
  offers none - and a missing one for a quiz that does.
  
  `PublicQuizViewModel` gains `quizOffers`, the names of the quizzes on offer, so a
  stage can announce to the hall what there is to play. Deliberately without
  audience, pools, presets or theme: the stage should not be able to derive any
  configuration, only to write the names on the wall.
  
  The selection palette loses `shadow-lifted` and `focus`. Those five cards moved
  to the stage, where they are a poster: nothing about them can be hovered,
  focused or picked. A colour kept for a state that no longer exists is an
  invitation to build the state back in.

### Patch Changes

- Updated dependencies [1b64ce5]
- Updated dependencies [ac1d181]
  - @hfroemmel/quiz-core@0.15.0

## 0.14.0

### Minor Changes

- 57092c6: Show the kids world the same way in every host
  
  The character, the pause card and the gap beside the question picture used to
  come out differently depending on where the stage was running. The world now
  decides all three, and the host decides nothing.
  
  The character is the one `Mascot` component with the one asset it always was;
  what kept it off the device were two rules keyed on `.stage--touch` - a
  `display: none` and a content width of 100 %. Both are gone. Instead, scene and
  figure share a new `.sceneArea`, and on touch that area is the 16:9 island with
  its own size container. The figure therefore measures itself against the scene
  in every host and stands in the same place of the same composition, in the hall,
  on the device and in the embedded app, with one player or with two.
  
  The counter and the category before a question are one drawn card now
  (`.pauseCard` around `[data-pause-progress]` and `[data-pause-category]`), with
  the counter as the loud part. Adults keep the plain stack - there the wrapper is
  `display: contents` and changes nothing. Timing and scene transitions are
  untouched: the pause still fades through in 400 ms.
  
  The picture column of question and solution is as wide as the picture (`auto
  minmax(0, 1fr)`) instead of a fixed 38 % share. The share left slack inside the
  column - over a hundred pixels on the device - which looked like a much wider
  gap. The distance to the question panel is now `--kids-stage-gap` and nothing
  else, in every host.

### Patch Changes

- Updated dependencies [57092c6]
  - @hfroemmel/quiz-core@0.14.0

## 0.13.0

### Minor Changes

- cef9ecc: Reveal the drawn joker when the card reaches the middle
  
  `jokerRevealCompleteMs` becomes `jokerRevealAtMs`, and
  `PublicJokerDraw.revealCompleteMs` becomes `revealAtMs`. Both now mark the
  moment the card arrives in the middle rather than the end of the whole draw.
  
  The reason is what a client may know: the variant is deliberately withheld while
  the card is flying, so a card that turned before `revealed` arrived showed an
  empty back and filled the result in afterwards. The server now holds `drawing`
  for the flight alone, and the snapshot that carries the result is the one the
  stage turns the card on.
- 33b59de: Allow the joker on picture questions, where only the audience joker can come out
  
  A question without answer options has nothing for a 50:50 to halve, so until now
  it refused the draw altogether. It is now drawable, and the only result it can
  produce is the audience joker - asking the room is the one help that means
  anything there.
  
  New `drawableJokerTypes(state)` says which variants a question can produce, and
  `drawJokerType(random, possible)` takes that set: with a single possibility it
  returns it and never touches `random`, so a draw cannot come out as something
  the question cannot carry. `OperatorJokerControl.onlyType` carries the same
  information to the desk before the draw.
  
  A choice question with too few open answers stays undrawable, with the reason it
  had before, and the draw leaves the question itself untouched: neither command
  writes to the reveal clock, the buzzer or the phase, so a picture question comes
  back from the draw frozen exactly where the buzzer stopped it.
- 7a110fb: Add the colours of the quiz selection, and the wordmark as a file
  
  The live quiz replaces its start form with a screen of five quiz cards, and two
  things it needs belong in the packages rather than beside them.
  
  `quizSelectPalette` is the colour set of that screen, prefixed `quiz-select-` in
  the generated palette. It is its own set on purpose: the operator shell is dark
  and wants nothing, the stage belongs to the quiz that has not been chosen yet,
  and the device start screen is a different design altogether.
  
  `brandWordmarkUrl` exports the bundled Bundestag wordmark as an address. The
  stage header lays it over a colour area as a mask so it follows the ink of the
  world; a host that simply needs the file - a selection screen on a light ground -
  now gets the same one instead of keeping a second copy.
- 00756de: Turn the video question into a one-way flow: an order out, nothing back
  
  The video used to be modelled twice - once in the browser that played it and once
  in the server state, which carried a status, a position, a reported duration and
  an error, and scheduled the end of the phase from that duration. Two truths about
  one playback drift apart, and everything the operator saw about the stage was the
  drifting copy.
  
  Now the server publishes an order and stops there:
  
  ```ts
  interface VideoPlaybackRequest { questionId: string; requestId: string; requestedAt: string }
  ```
  
  `START_VIDEO` carries the `questionId` it was clicked for and writes a fresh
  `requestId`; the stage remembers the last one it executed and starts from zero on
  any other. A second click is simply a new order. Nothing is reported back, and the
  end of the video is no longer a server-side transition - the last frame stands
  until the operator shows the question.
  
  Breaking changes for hosts:
  
  - The phases `video-ready`, `video-playing` and `video-ended` are one phase,
    `video`.
  - `START_VIDEO` now requires `{ questionId }`; `PAUSE_VIDEO`, `RESTART_VIDEO` and
    `REPORT_VIDEO_STATUS` are gone, as is `gameTiming.videoTailMs`.
  - `PublicVideoState` (status, position, duration, error) becomes
    `PublicVideoRequest` (`questionId`, `requestId`).
  - `SHOW_QUESTION_AFTER_VIDEO` is open to the `player` role, because a self-service
    device has no operator to press it.
  - `PublicQuestion` gained `id`, so a client can tell whether an order belongs to
    what it is showing.
  - `StageScreen`'s `onReport` prop is now `onCommand` - the stage does not report,
    and in the operated flow it sends nothing at all.
  
  The empty host overlay pad no longer swallows pointer events, which it did over
  anything laid out beside a scaled stage.

### Patch Changes

- Updated dependencies [cef9ecc]
- Updated dependencies [33b59de]
- Updated dependencies [7a110fb]
- Updated dependencies [00756de]
  - @hfroemmel/quiz-core@0.13.0

## 0.12.0

### Minor Changes

- ee2c6ff: Das Video tritt auf und ab - und danach wartet der Ablauf auf den Operator
  
  Die Videoflaeche waechst beim Eintritt in die Videoszene aus der Mitte heraus
  und blendet ein (`video-enter`, 640 ms). Ist das Video durchgelaufen, blendet
  sie wieder aus (`presentationTiming.videoExitMs`); das Element haelt erst an,
  wenn die Blende durch ist.
  
  Im gefuehrten Spiel geht ein durchgelaufenes Video nicht mehr von selbst in die
  Frage ueber. Die neue Phase `video-ended` haelt den Ablauf an, bis der Operator
  `SHOW_QUESTION_AFTER_VIDEO` sendet; erlaubt sind dort ausserdem `RESTART_VIDEO`
  und `SKIP_QUESTION`. Der Buzzer bleibt gesperrt, die Szene bleibt `video`. Am
  Geraet (`self-service`) folgt die Frage weiterhin unmittelbar.
  
  Die Restzeituhr der Operatorvorschau ist wieder ausgebaut. Die Vorschau spielt
  kein Video ab und zeigt nur noch den Stand: bereit, laeuft, angehalten, zu Ende
  (`[data-video-status]`). Mit ihr entfallen `videoProgress`, `formatiereDauer`
  und die Texte `video.remaining`, `video.paused` und `video.unknownDuration`;
  neu sind `video.status.ready`, `video.status.playing`, `video.status.paused`
  und `video.status.ended`.
  
  "Video neu starten" kommt jetzt auf der Buehne an. Die Szene erkannte einen
  Neustart daran, dass die gemeldete Position zurueckging - waehrend das Video
  laeuft, kommen aber keine Schnappschuesse, und die Position stand vor wie nach
  dem Neustart bei null. Verglichen wird nun mit der auf jetzt hochgerechneten
  Serverposition: Liegt das Element deutlich davor, war es ein Neustart.
  
  Gastgeber, die Phasen selbst abbilden, muessen `video-ended` kennen. Wer Medien
  selbst ausliefert, muss Range-Anfragen beantworten (206) - sonst ist das
  Videoelement nicht spulbar, und weder Neustart noch Angleichen greifen.

### Patch Changes

- Updated dependencies [ee2c6ff]
  - @hfroemmel/quiz-core@0.12.0

## 0.11.0

### Minor Changes

- 73dacf9: The joker is drawn, not chosen
  
  A player who has buzzed asks for their joker, the operator draws it, and the
  SERVER flips a fair coin between the 50:50 and the audience joker. Nobody picks
  the variant - not the player, not the operator, and no client. A choice would be
  a tactical decision; a draw is a moment.
  
  `USE_JOKER { playerId, jokerType }` and `RESTORE_JOKER` are gone. In their place
  `DRAW_JOKER` (no payload at all: the coin belongs to the server, and the player
  follows from who holds the buzz) and `CONTINUE_JOKER { sequenceId }`, which
  applies what came out. A draw cannot be taken back - the joker is spent from its
  first moment, and no command hands it back.
  
  `GameState.jokerSequence` replaces `activeFiftyFifty` and carries the draw as it
  runs: `idle → drawing → revealed → applied`. The turn of the card is a server
  step, scheduled as a timed transition, so a client that reconnects mid-draw
  finds the same phase as everybody else and never re-draws. The variant reaches
  the clients with `revealed` and the eliminated answers with `applied` - early
  enough to show, too late to give away.
  
  A running draw holds the question: logging, resolving, continuing and buzzing
  are refused and are not offered in `allowedCommands`.
  
  `PublicOption.hidden` becomes `PublicOption.eliminated` and is drawn as a line
  struck across the answer; `PublicScore.joker` stays; `PublicQuizViewModel`
  gains `jokerDraw`, and the operator's `joker` control is now one button rather
  than four.
  
  New in `@hfroemmel/quiz-react`: `JokerTypeIcon` with the two joker faces (the
  audience shape doubles as the group mark that replaces the active player's
  number while an audience joker is in effect), and the timings for strike,
  marker crossfade and dismissal in `presentationTiming`.

### Patch Changes

- Updated dependencies [73dacf9]
  - @hfroemmel/quiz-core@0.11.0

## 0.10.0

### Minor Changes

- 978a5db: One shared joker per player, for the live quiz alone
  
  Every player of an OPERATED game holds a single joker and may spend it either as
  a 50:50 or as an audience joker. Spending either one exhausts that player's
  joker for the whole game; it comes back only with a new game or the operator's
  explicit reset.
  
  LIVE QUIZ ONLY, WITHOUT A FLAG. `START_GAME` creates the supply only for
  `flowProfile: 'operated'`, so a kiosk, a standalone build or a touch device
  carries no joker state, no joker command and not one element more in the DOM
  than before. `gameHasJokers(state)` is the single place that decides it.
  
  New commands `USE_JOKER { playerId, jokerType }` and
  `RESTORE_JOKER { playerId }`, both operator-only and server-validated. New state
  `GameState.jokerByPlayer` and `GameState.activeFiftyFifty`, new snapshot fields
  `PublicScore.joker`, `PublicOption.hidden`,
  `PublicQuizViewModel.activeFiftyFifty` and `OperatorQuizViewModel.jokers`.
  
  `StageHeaderSlots` gains `besidePlayer`: a relatively positioned frame around
  each scoreboard, so a host can hang something behind a player's card without
  widening the header. The live quiz uses it for its joker card.
  
  This replaces the two separate lifelines, which were never released: the
  `USE_LIFELINE` / `RESTORE_LIFELINE` commands, `LifelineConfig`,
  `PlayerState.lifelines`, the `lifelineUsed` / `lifelineRestored` events and the
  exported `Lifelines` component are gone.

### Patch Changes

- 33add5d: Die Auswahlkarten der hellen Startauswahl sind Flaechen, keine Rahmen
  
  Eine gewaehlte Karte steht jetzt voll in demselben Blau, das im Spiel eine
  angetippte Antwort traegt - derselbe Wert aus derselben Palette; Titel, Zeile,
  Zeichen und Haekchen darauf in Weiss. Eine offene Karte ist das ruhige Grau
  einer nicht angetippten Antwort. Keine Kante, in keinem Zustand: Die
  Tastaturmarke ist ein weicher Schein und ein Hauch Groesse statt eines Rings,
  sodass sich Auswahl und Fokus nicht mehr zu zwei Linien uebereinanderlegen.
  Der sekundaere Knopf traegt dieselbe gefuellte Flaeche, der gruene Startknopf
  bleibt, wie er war.
  
  Neue Token: `--start-option`, `--start-option-hover` und `--start-option-icon`.
  Die Auswahlkarten hatten keinen eigenen Namen und hiessen `surface` wie das
  Einstellungsfenster und die Rueckfrage; in der hellen Fassung gehen sie
  getrennte Wege.
  
  Dunkle Fassung und Kinderwelt sind unveraendert - nachgemessen, Pixel fuer
  Pixel. Im Dunkeln behaelt die Karte ihre Kante: Dort liegt ein fast schwarzer
  Kasten auf fast schwarzem Grund, und ohne Kante schwaemmen die Karten.
- 44bc385: Die Spielerfarbe traegt allein der Buzzer
  
  Am Touchgeraet ist die Punktekarte jetzt neutral - dieselbe Milchglaskachel wie
  im Saal, im Einzelspiel wie im Duell und in jedem Zustand. Der Buzzer steht
  dafuer vollflaechig im reinen Ton seines Spielers, ohne Kante: rot links, blau
  rechts. Weisse Aufschrift auf beiden (5,9:1 und 8,4:1), und weder `hover`,
  `active`, `disabled` noch der geholte Zuschlag aendern Grund, Kante oder
  Deckkraft.
  
  Masse, Positionen und Funktion sind unveraendert. Die Kinderwelt ist
  unberuehrt: Ihr Buzzer ist eine gezeichnete Karte und trug nie eine
  Spielerfarbe.
- Updated dependencies [978a5db]
- Updated dependencies [33add5d]
- Updated dependencies [44bc385]
  - @hfroemmel/quiz-core@0.10.0

## 0.9.1

### Patch Changes

- 3d262cd: Die Fussleiste des Touchgeraets liegt am unteren Bildrand
  
  Punktestand, Zaehler und die beiden Buzzer stehen an der Kante, an der jemand
  vor dem Geraet steht - auch auf einem Fenster, das hoeher als 16:9 ist. Der
  uebrige Platz liegt jetzt zwischen Szene und Leiste statt gleichmaessig
  darueber und darunter. Auf 16:9 aendert sich nichts.
- Updated dependencies [3d262cd]
  - @hfroemmel/quiz-core@0.9.1

## 0.9.0

### Minor Changes

- 7fe9bd1: Die Breite ist das einzige Mass der Buehne
  
  Alle Groessen der Buehne und des Touchgeraets rechnen ab jetzt gegen die
  BREITE der Flaeche und gegen nichts sonst: `cqw` in der Buehne, `vw` in der
  Startauswahl davor. `clamp()`, `cqh` und `vh` sind verschwunden, ebenso die
  Schwelle `max-aspect-ratio` und die Ausnahme fuer flache Fenster - alles drei
  liessen die HOEHE mitentscheiden.
  
  Bezugsbreite ist 1440 px, die Zeichenflaeche der Entwuerfe (1440x810): Auf
  16:9 ist die Darstellung dieselbe wie vorher, Zahl fuer Zahl. Auf einer
  hoeheren Flaeche - 4:3-Bildschirm, Fenster eines Gastgebers, Einzelspiel ohne
  Buzzer - bleibt jetzt Luft, statt dass die Komposition sich streckt. Am
  Touchgeraet liegt sie gleichmaessig ueber und unter der Szene.
  
  Sichtbare Folge fuer Gastgeber: In einem Kasten, der hoeher als 16:9 ist,
  steht das Quiz kleiner als bisher und nutzt die Hoehe nicht aus. Dafuer zeigen
  zwei Geraete gleicher Breite dieselbe Frage in derselben Groesse.

### Patch Changes

- Updated dependencies [7fe9bd1]
  - @hfroemmel/quiz-core@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [bc9579a]
  - @hfroemmel/quiz-core@0.8.0

## 0.7.1

### Patch Changes

- @hfroemmel/quiz-core@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies
  - @hfroemmel/quiz-core@0.7.0

## 0.6.1

### Patch Changes

- e144665: Die Videophase lief in eine Schleife: Bild flackerte, das Video kam nie zum
  Abspielen, und der Uebergang zur Frage wurde nie faellig.
  
  Der Buehnenclient haengt seinen Szenenknoten an die Kennung des letzten
  Uebergangs. Der Zeitgeber fuer das Videoende trug diese Kennung mit - jede
  Laufzeitmeldung erzeugte damit eine neue, React baute die Szene samt
  Videoelement neu auf, das frische Element meldete seine Laufzeit, und der Kreis
  begann von vorn. Mit zwei Fenstern, die dasselbe Video zeigen, schaukelten sich
  beide gegenseitig hoch.
  
  Behoben an drei Stellen:
  
  - Zeitgeber und Praesentationsuebergang sind getrennt. `scheduleTimedTransition`
    kennt jetzt eine stille Fassung: Beim Video animiert nichts, und seine
    Laufzeit ist keine Animationsdauer.
  - Eine Statusmeldung plant das Ende nur noch, wenn keines steht. Die Laufzeit
    meldet jeder Client, der das Video zeigt; nur ein Befehl - Starten,
    Fortsetzen, Zuruecksetzen - plant neu.
  - `PAUSE_VIDEO` nimmt den geplanten Uebergang zurueck. Sonst zeigte der Saal die
    Frage, waehrend der Operator gerade angehalten hatte, um etwas zu sagen.
- Updated dependencies [e144665]
  - @hfroemmel/quiz-core@0.6.1

## 0.6.0

### Minor Changes

- 6856432: **Mehrsprachigkeit.** Fragen, Medien und Beschriftungen lassen sich in weiteren
  Sprachen hinterlegen; ein Umschalter im Startmenue erscheint, sobald mehr als
  eine Sprache konfiguriert ist.
  
  - `config.locales` meldet die Sprachen an - die erste ist die Grundsprache.
  - Fragen tragen `translations` je Sprache (Text, Optionen, Medium, Erklaerung).
    Optionen werden EINZELN nach Bezeichner ersetzt, damit eine Uebersetzung die
    Wertung nicht verschieben kann.
  - Alles mit einem `label` bekommt ein `labels`; Zielgruppen zusaetzlich
    `startTitles`.
  - `config.interfaceStrings` uebersetzt die Oberflaeche. Die deutschen Fassungen
    stehen im Code (`standardTexte` in `@hfroemmel/quiz-react`), damit ein Quiz
    ohne einen einzigen Eintrag laeuft.
  - Neuer Befehl `SET_LOCALE`; er greift wie `SET_SOUND_ENABLED` auch ohne
    laufendes Spiel. `QuizGame` nimmt `locale` als Vorgabe aus dem Config File.
  - Was fehlt, faellt auf die Grundsprache zurueck; eine unbekannte Sprache wird
    auf sie zurueckgeholt statt abgewiesen.
  
  **Video.** Ein durchgelaufenes Video geht jetzt in JEDEM Ablaufprofil von selbst
  in die Frage ueber - bisher blieb im gefuehrten Spiel ein schwarzes Bild stehen,
  bis der Operator umschaltete. Sein Knopf bleibt, um frueher umzuschalten. Das
  Ende wird ausserdem geplant, sobald das Video laeuft und die Laufzeit bekannt
  ist; bisher nur beim Melden der Laufzeit, was ein Video ohne Ende
  zuruecklassen konnte. `videoTailMs` ist deshalb von `selfServiceTiming` nach
  `gameTiming` gezogen.
  
  Die Operatorvorschau zeigt an der Stelle des Videos die **Restzeit** statt eines
  leeren Rechtecks. Im Saal steht sie nicht - dort laeuft das Bild.
  
  **Inhaltspipeline.** `quiz-content import-sheet` macht aus einer Google-Tabelle
  `questions.json`: Spaltenzuordnung als Konfigurationsdatei, `--print-headers`,
  `--dry-run`, Zeilenfehler mit Zeilennummer statt Abbruch.

### Patch Changes

- 723b035: Die Wortmarke oben links blieb im GEBAUTEN Paket ein weisser Balken. Sie ist
  eine Maske ueber einer Farbflaeche; der Bundler bettet die Grafik als
  `data:`-Adresse ein und schreibt deren Attribute mit Hochkommata
  (`width='339.417'`). In einem unquotierten `url()` ist das ein ungueltiges
  Zeichen - die Regel fiel stillschweigend aus, und die nackte Flaeche blieb
  stehen. In der Entwicklung fiel es nicht auf, weil dort eine Dateiadresse
  steht.
  
  Adressen in Inline-Stilen laufen jetzt durch `cssUrl()`, das sie in
  Anfuehrungszeichen setzt - auch das Fragebild im Hintergrund.
- Updated dependencies [723b035]
- Updated dependencies [6856432]
  - @hfroemmel/quiz-core@0.6.0

## 0.5.0

### Minor Changes

- c68cb08: Die Bedienelemente des Operatorpults sind jetzt die gemeinsame Fassung fuer
  alle Anwendungen: `@hfroemmel/quiz-themes/controls.css`. Startauswahl,
  Einstellungen und Rueckfragen des Kiosks tragen dieselben Klassen (`button`,
  `button--primary`, `button--large`, `button--selected`) und damit dieselbe
  Flaeche, Kante, Schrift und Rueckmeldung beim Druecken. Am Geraet bleibt allein
  die Groesse eine andere - ein Pult wird mit der Maus bedient, ein Foyergeraet
  mit dem Daumen.
  
  Die Rundung steht in `--ui-radius` (Vorgabe 6px), die Farben wie bisher in den
  `--ui-*`-Token der Palette.
  
  `@hfroemmel/quiz-kiosk/styles.css` bringt die Klassen MIT - wer das Quiz
  einbettet, muss nichts nachtragen. Eine Anwendung mit eigener Oberflaeche
  ausserhalb des Quiz (das Operatorpult) importiert das Stylesheet neben der
  Palette:
  
      import '@hfroemmel/quiz-themes/palette.css'
      import '@hfroemmel/quiz-themes/controls.css'
  
  Die Buehne bleibt unberuehrt: Antwortzeilen, Buzzer und Punktekarten gehoeren
  zur Vorstellung und tragen weiter deren Farben und Containereinheiten.
- 36c0741: Einstellungen am Geraet: Der Startbildschirm von `QuizGame` bekommt ein
  Zahnrad, dahinter Ton an/aus, eine Tonprobe und die Anzeigegroesse. Es
  erscheint nur dort, wo der Gastgeber seine eigene Laufzeit mitbringt - haengt
  das Quiz an einem Server, gehoert der Ton der Vorstellung.
  
  Neue Props `soundEnabled` und `zoom` reichen die Vorgaben eines Config Files
  durch. `zoom` liegt zwischen 0,6 und 1; 1 ist die entworfene Groesse und damit
  das Maximum. Kleinere Werte verkleinern die Szene zur Mitte hin, waehrend Logo,
  Punktekarten und Fragezaehler am Bildrand bleiben und mitschrumpfen. Die Stufe
  steht als `--stage-zoom` ueber der Buehne.
  
  `SET_SOUND_ENABLED` greift jetzt auch, wenn kein Spiel laeuft: Der Ton gehoert
  dem Geraet, und am Kiosk sitzt der Schalter im Startbildschirm.
  
  Im laufenden Spiel steht oben rechts "Spiel beenden" mit einer Rueckfrage; er
  fuehrt zurueck in die Auswahl und erscheint nur, wenn der Serverstand
  `ABORT_GAME` erlaubt.
  
  Die Kopfzeile zeigt das Logo aus dem Inhalt (`themes[].logoAssetId`), wenn eines
  konfiguriert ist, und behaelt sonst die mitgelieferte Wortmarke. Am Touchgeraet
  hat sie mehr Luft nach oben.
  
  Die Startauswahl bekommt runde Ecken, vertikal mittig gesetzte Beschriftungen
  und groessere Zweitzeilen.
- 9e1bda7: Der Moderator darf den Zuschlag von Hand setzen (`SELECT_PLAYER_MANUALLY`) und
  die Antwort einloggen (`LOG_OPTION_ANSWER`). Am Buehnenabend steht er neben den
  Spielern und sieht als Erster, wer sich gemeldet hat; Punkte, Abbruch, Technik
  und Inhalte bleiben beim Operator.
  
  `QuizGame` und `GameStart` nehmen `playerCounts` entgegen - die Spielerzahlen,
  die ein Geraet anbietet. Bleibt nur eine uebrig, entfaellt die Frage danach
  ganz.

### Patch Changes

- dcc13bf: Die Zoomstufe steht jetzt in der eigenen CSS-Eigenschaft `scale` statt in
  `transform`. Auf der Szene liegen die Szenenuebergaenge, und die animieren
  `transform`: Als Transformation geschrieben wurde die Stufe davon
  ueberschrieben - eine Frage erschien in voller Groesse und sprang am Ende der
  Animation klein.
  
  Ausserdem folgen jetzt auch Startauswahl, Einstellungen, Rueckfrage,
  Abschlussleiste und der Beenden-Knopf der Zoomstufe. Sie ist eine Einstellung
  des Geraets, nicht eine des laufenden Spiels.
- Updated dependencies [c68cb08]
- Updated dependencies [36c0741]
- Updated dependencies [9e1bda7]
- Updated dependencies [dcc13bf]
  - @hfroemmel/quiz-core@0.5.0

## 0.4.0

Diese Fassung und 0.3.0 wurden von Hand veroeffentlicht, weil die GitHub
Actions des Repositories stillstanden. Der Versionsstand, den
`changeset version` dabei schreibt, ist damals nicht ins Repository
zurueckgeflossen - das Repository fuehrte weiter 0.2.0, waehrend in der
Registry schon 0.4.0 lag. Dieser Eintrag holt den Stand nach; was in den
beiden Fassungen steckt, steht in der Git-Historie.

## 0.2.0

### Minor Changes

- 2aea7b1: `QuizGame` nimmt die Laufzeit vom Gastgeber entgegen (`runtime`-Prop). Ohne
  Angabe verbindet es sich wie bisher als Spieler mit dem ausliefernden Server;
  mit Angabe spielt es gegen jede `QuizRuntime` - insbesondere die
  `LocalQuizRuntime` der Offline-Anwendungen. Dazu neu: `useQuizSnapshot(runtime)`
  abonniert den Stand einer beliebigen Laufzeit, und `useQuizRuntime(null)` baut
  bewusst keine Verbindung auf.

### Patch Changes

- Updated dependencies [2aea7b1]
  - @hfroemmel/quiz-core@0.2.0

## 0.1.0

### Minor Changes

- c00fcd5: Erste Veroeffentlichung der fuenf Quiz-Pakete: Kern (Vertraege, Engine,
  Laufzeit), Inhalts-Pipeline, Themes, React-Buehne und spielbares Quiz.

### Patch Changes

- Updated dependencies [c00fcd5]
  - @hfroemmel/quiz-core@0.1.0
