# @hfroemmel/quiz-react

## 0.22.2

### Patch Changes

- The red variant of the stage is one flat surface - no glass, no picture behind
  it.
  
  The other two variants are BUILT on the blurred question image: the ground
  darkens or lightens it, and the panes above - score card, counter, letter chip,
  answer bar - let it through like frosted glass. That is what makes those two
  live, and it is the one thing a commissioned ground cannot survive. Every photo
  pulled the room's red somewhere else; in the running game the specified tone
  was nowhere on screen any more, and a graffiti wall put a warm patch in the
  corner of the hall.
  
  So this variant drops both. The picture behind the scene stays out, exactly as
  it does in the children's world, and the glass is switched off. The panes keep
  their white veils at five to nine percent, which over one flat ground composite
  to flat, slightly lighter reds - the same order of surfaces as in the other
  variants, without a second colour entering the room. The question's own picture
  is untouched: it stands framed in the scene, where it is content and not
  atmosphere.
  
  `--stage-glass` is the blur as a token on the stage. Four modules used to spell
  the same value out, so a variant that wants no glass needed four exceptions;
  whoever wants a stage without frosted panes now sets one value. Its default is
  the measure the other variants have always used.
- @hfroemmel/quiz-core@0.22.2
  - @hfroemmel/quiz-themes@0.22.2

## 0.22.1

### Patch Changes

- Updated dependencies
  - @hfroemmel/quiz-themes@0.22.1
  - @hfroemmel/quiz-core@0.22.1

## 0.22.0

### Minor Changes

- 98aa830: A red variant of the adults' stage - a third choice next to light and dark.
  
  IT IS THE DARK STAGE WITH ONE THING EXCHANGED: the dark grey of the ground
  becomes `#ca2f56`. `redPalette` therefore names five tokens and nothing else -
  the four ground surfaces and the operator's control band - and everything else
  stays the dark variant's, by the same mechanism the light one uses.
  
  WHY NAMING ONLY THE GROUND IS ENOUGH. The surfaces of this stage are veils, not
  paint: tile, option and their quiet forms are white at five to nine percent.
  Over the red they become lighter red by themselves, and the depth between
  ground, board and answer row survives the exchange without a single new value.
  No gradient is invented either - all four ground tokens carry the same tone.
  
  THE THREE SIGNALS STAY, and that is a decision: blue marks the selection and the
  player whose turn it is, green the right answer, red the wrong one. A red ground
  makes the wrong-answer red harder to tell apart than it is on grey - the one
  place this variant is weaker than the other two - and moving the token would
  break the agreement that a signal means the same thing in every variant.
  
  `stageThemes` is now three values, so anything that builds a switch from that
  list offers the third one without a change. The screens in front of the stage
  follow it: the device's start menu gets the same ground with its two coloured
  lights switched off, and the offer overview of a room - the `--quiz-select-*`
  family, light until now - gets a dark and a red variant. Its cards keep their
  colours in both, because those stand for their quizzes and not for the variant;
  that is what the new `ink-on-card` and `meta-on-card` are for, so the text on a
  light card stays dark while the heading above it goes light.
  
  AND `data-surface` NOW ASKS ABOUT THE INK, not about the hue. It used to name
  the one dark variant there was; the red one is dark in the sense that matters
  for a host recolouring its own frame - it carries light text - so the light side
  is named instead, and a further strong ground lands on the right side by itself.
- The list of colour variants is the offer, and it is now readable as one.
  
  `stageThemes` stands in the order a box shows them - light, dark, red - so a
  host builds its choice FROM THIS LIST instead of keeping a list of its own. That
  second list is what turned a missing release into a puzzle at the desk: an
  application that already knew the red variant offered "Rot" while its installed
  package still knew two variants, so the preference rejected the value on the
  next read, the controlled field snapped back and no colour moved. A box built
  from `stageThemes` cannot offer a variant this build is unable to paint.
  
  `stageThemeFrom` is the same rule as an exported function: what a stored value
  means, and the fallback for everything else. It is what `useStageTheme` reads
  with, and it can be read - and tested - without a window.
- c51bbb9: The right/wrong mark is drawn, not filmed.
  
  Correct and incorrect were delivered WebM clips with an alpha channel, one per
  outcome. They are vectors now (`AnswerResultAnimation`): a disc that scales in
  over 480 ms with a short overshoot, then the symbol drawn along its own path -
  `pathLength` normalises it, so the check mark and the cross need no timing of
  their own. Reduced motion keeps the finished mark and drops the movement, as
  the clips' still frame did.
  
  WHY IT MATTERS BEYOND THE MOTION: a file cannot follow a theme. The clip's
  turquoise and its red were baked in, so the stage showed them whatever palette
  was running - and with a third stage variant that became visible. The disc takes
  `--color-correct` and `--color-incorrect`, the same tokens the answer rows
  carry, and the symbol the light ink that goes on a strong area. The children's
  world therefore gets its own green instead of the adults' turquoise, without a
  second file, and no decoder is needed to show a circle and a check mark.
  
  THE MOMENT KEEPS ITS SIZE. The clips carried a lot of transparent margin - the
  check mark swung out wide with sparks, the cross sat tight in its frame - so two
  frames of 34 and 16 cqw put two discs of the SAME size on the stage, and the
  word below had to be pulled back toward each of them by a different share. One
  size (14.2 cqw, disc 92 percent of it) and one ordinary gap replace all of that;
  measured against the old clips, the disc lands within a pixel of where it was.
  
  `animationClips` therefore no longer carries `correct` and `wrong`, and the two
  files are gone; `trophy`, `stars` and `question-marks` stay as they were. The
  feedback phase durations stay too (`correctFeedbackMs`, `incorrectFeedbackMs`):
  they were once matched to the clips, but what they are is the beat the room
  needs to read the mark while the score counts up underneath it.
- 7c6383f: The round can be ended where it runs.
  
  The device quiz always had a way to end a running game, but it sat in the top
  right corner in the colours of the START MENU - the least visible thing on the
  darkest screen - and it was worded as if it ended the game for good. It is a
  chip at the top CENTRE now, `Runde beenden` with a cross before it, and where
  it sits is the point: the corners of that screen belong to the players -
  buzzers below, a host's own bar above - and a control that ends the round for
  both of them belongs in neither hand.
  
  IT LOOKS THE SAME IN EVERY VARIANT, and that is a decision: light grey with
  dark blue on it, from two tokens that belong to no theme (`--stage-chip`,
  `--stage-inkOnChip` - `Hellgrau` at 20 percent and `Dunkelblau` of the federal
  spectrum, about seven to one). Whoever wants out of a round should not have to
  find a different button on the dark stage than on paper or over the children's
  drawing, and following the theme would have given it four appearances and, on
  the dark ground, the worst one.
  
  WHEN IT EXISTS IS UNCHANGED IN SUBSTANCE and now checked: only while a round
  runs - not in the start menu, not on the waiting screen, not in the result
  view, where another round and the way out are the offer - and never on a stage,
  which is `StageScreen` and not this component. A game an operator runs is not
  ended from a device either; that gate is the server's (`allowedCommands`).
  
  `kiosk.endGame` and `kiosk.endGameQuestion` are `kiosk.endRound` and
  `kiosk.endRoundQuestion`, in German and English: what the button does is end
  the ROUND and return to the quiz's own start menu - the state is reset, not
  parked. Escape now cancels the dialog, the confirming answer takes the keyboard
  when it opens, and the chip carries a focus ring, so the whole way through can
  be walked with the keyboard alone.
  
  A host that draws its own way out of a running round still says so
  (`chrome.abort`), but it should think twice: `onExit` leaves the application,
  this ends the round. A round left standing behind a way home is a round the
  next visitor walks into mid-question.
- b768fb3: A video sounds where it plays, not where the cues do.
  
  THE BUG, AND IT WAS THE NORMAL SETUP: stage and operator in two browser tabs.
  The operator clicks buttons all evening, so their window is the only one a
  browser allows to sound and it takes the audio authority. But the operator's
  window plays no video - it shows the same area empty on purpose, so the room
  sees one picture and not two. The stage played the video MUTED because it was
  not the authority. Nobody sounded it: the picture ran, the room heard nothing,
  and no error said why.
  
  The two things were coupled that should not be. The cues may sound from any
  window that is allowed to; a video is played only by the windows that carry
  the room's picture. `QuizRuntimeConnection` therefore has a second authority,
  `videoAudioMaster`, and `VideoScene` follows that one (`isVideoAudioMaster` on
  `StageScreen`, defaulting to `true` for a host that plays alone). The
  `client-info` message carries it; where a server does not send it, the cue
  authority decides as before, so an old server stays exactly as it was.
  
  AND A REFUSED CLIP TRIES AGAIN. A browser that has never been clicked in
  refuses audible playback, and the scene then plays the picture muted rather
  than not at all. That refusal used to last for the whole clip and the next
  one, until the window was reloaded. It now ends at the first click or key in
  that window, and the clip keeps its position: it goes on sounding where it is
  instead of starting over, which in a room is worse than the silence was.

### Patch Changes

- Updated dependencies [98aa830]
- Updated dependencies [a0e1e22]
- Updated dependencies [be04fe9]
- Updated dependencies [c51bbb9]
- Updated dependencies [99f87e4]
- Updated dependencies [7c6383f]
- Updated dependencies [b768fb3]
  - @hfroemmel/quiz-themes@0.22.0
  - @hfroemmel/quiz-core@0.22.0

## 0.21.1

### Patch Changes

- Updated dependencies [ee78c50]
  - @hfroemmel/quiz-core@0.21.1
  - @hfroemmel/quiz-themes@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [25e4857]
  - @hfroemmel/quiz-core@0.21.0
  - @hfroemmel/quiz-themes@0.21.0

## 0.20.0

### Minor Changes

- 8e8e468: `@hfroemmel/quiz-kiosk` is gone. There are four packages.
  
  IT WAS A POINTER FOR ONE RELEASE, and that was the promise. In 0.19.0 the
  playable quiz moved into `@hfroemmel/quiz-react` and the kiosk package stayed
  behind as a re-export with an empty stylesheet, so that an unchanged
  application kept building while it took the release at its own pace. That
  release has happened. The pointer is now deleted rather than kept, because a
  package that only names another place is a place people keep arriving at.
  
  WHAT AN APPLICATION CHANGES, and it is two lines:
  
      - import { QuizGame, StartMenu, deviceStartMenu } from '@hfroemmel/quiz-kiosk'
      + import { QuizGame, StartMenu, deviceStartMenu } from '@hfroemmel/quiz-react'
  
      - import '@hfroemmel/quiz-kiosk/styles.css'
  
  The second import is not replaced by anything: since 0.19.0 the game's own
  rules travel in `@hfroemmel/quiz-react/styles.css`, which every application
  showing a quiz already imports. Nothing else moves - the components, their
  props and their behaviour are the ones from 0.19.0, byte for byte. Remove the
  dependency from `package.json` and the swap is complete.
  
  THE FOUR PACKAGES ARE NOW FOUR EVERYWHERE, not four plus a leftover: the
  fixed-version set of the changeset configuration, the tarball verification,
  the tag script and the typecheck each name exactly the packages that exist. The
  two scripts behind the release gave up their German identifiers on the way,
  which was the last of them outside a user-visible label.

### Patch Changes

- Updated dependencies [8e8e468]
- Updated dependencies [8e8e468]
  - @hfroemmel/quiz-core@0.20.0
  - @hfroemmel/quiz-themes@0.20.0

## 0.19.0

### Minor Changes

- 6d35e6a: The playable quiz lives in quiz-react, and the old names are gone
  
  **One package fewer.** `QuizGame`, `StartMenu` and `deviceStartMenu` are
  exported by `@hfroemmel/quiz-react` now. The split never drew a line: the
  device's screen is built from the same scenes, the same sounds and the same
  texts as the stage's, and every host that showed a quiz installed both halves
  anyway. What remained of the difference was a component name.
  
  `@hfroemmel/quiz-kiosk` still points at the new place, so an installation can
  follow at its own pace - the same one release of grace every renamed export in
  these libraries got:
  
  ```diff
  - import { QuizGame } from '@hfroemmel/quiz-kiosk'
  + import { QuizGame } from '@hfroemmel/quiz-react'
  - import '@hfroemmel/quiz-kiosk/styles.css'
  ```
  
  The stylesheet line simply goes: those rules travel in
  `@hfroemmel/quiz-react/styles.css`, which a host showing a quiz already
  imports. `@hfroemmel/quiz-kiosk/styles.css` is an empty file for this release
  so that an unchanged import resolves instead of breaking a build.
  
  **And the former names are gone** - twenty aliases that were kept "for one
  release" when the identifiers were translated: `standardTexte`, `textFuer`,
  `texteFuer`, `importiereTabelle`, `standardMapping`, `csvZuZeilen`,
  `gueltigeSprache`, `fragenTextFuer`, `oberflaechenTexte`,
  `uebersetzteBeschriftung`, `klemmeZoom`, the sound and image state types, and
  `GameStart`, the start screen that `StartMenu` replaced. Nothing in the four
  applications used any of them.
  
  WHAT STAYS, against the plan's own list: `audience`, `playerCounts` and
  `idleTimeoutMs` on `QuizGame`, and `brandWordmarkUrl`. The first three are
  properties of an INSTALLATION, not of the content - which audience a device
  plays in, how many people stand at it, how long it waits before it ends a game
  nobody is playing. The content answers them where it can
  (`quizzes[].playerCounts`, `rules.idleTimeoutMs`), and the props narrow that
  per device; removing them would move a table's setting into the question set it
  shares with the hall. And the word mark as a file is what a host needs when it
  shows the mark OUTSIDE the stage - the stage overview of the live quiz does
  exactly that.

### Patch Changes

- Updated dependencies [6d35e6a]
  - @hfroemmel/quiz-core@0.19.0
  - @hfroemmel/quiz-themes@0.19.0

## 0.18.0

### Minor Changes

- 0f2d613: The background of a question, read where nobody tells it
  
  An explanation is written for the moderator. They tell it, in their own words,
  while the hall listens - which is why nothing of it ever left the server
  publicly: a screen writing it out would compete with the person speaking.
  
  At a device there is nobody to tell it. The two people at the table read it
  themselves, and a quiz set up for that place now says so:
  `rules.showDetailsAfterSolution` - the flag has been in the configuration since
  the last release, and no component read it. With it on, the detail text travels
  with the solution (`visibleSolution.details`), in the language of the question,
  and the device gives it its own step.
  
  `DetailsStep` (`@hfroemmel/quiz-react`, put in place by `QuizGame`) is that
  step: the card covers the stage, carries the only way onward, and the round
  waits until somebody has read it. Where a question brings no background there is
  no step at all - an empty in-between screen would be worse than none. The round
  is held from the moment the solution stands, not only once the card is there: in
  those seconds the device's own way onward would be one thumb away from skipping
  the step.
  
  Of the explanation only `details` travels, and only in the solution scene. The
  short version is the moderator's lead-in, the source is an editorial note, the
  directing notes are stage directions - none of the three is meant for a player,
  and the projection keeps them where they were.
  
  Two smaller things came with it. The times of the step stand in its stylesheet
  (`--stage-details-delay` beside `--stage-fade-duration`), so the component reads
  how long its way out lasts instead of keeping a number of its own in step with
  the CSS by hand - the host this step comes from carried a 220 and a comment
  asking whoever changed one to remember the other. And a card lying on the stage
  has a shadow of its own now (`--stage-cardShadow`): the distance to the ground
  is a physical situation, the same in the dark world and in the bright one.
  
  A host whose room wants a different card passes `renderAfterSolution` and draws
  its own body. It is handed the text and the way onward; the holding of the round
  and the withdrawn footer button stay with the package.
- de3ecc8: The interface speaks two languages by itself
  
  The packages shipped their wording in German and left everything else to the
  content. That sounds like flexibility and worked out as a chore: an
  English-speaking host had to state EVERY visible string in its configuration -
  the media table carried fifty of them in a build script, the test bench of this
  repository twenty more - and a set of overrides in a config file is a
  translation nobody reviews.
  
  `englishTexts` is the same set in English, and `textFor` picks it by the
  language of the running game. The content still wins over both, because that is
  where a host words a screen its own way ("Welcome to the quiz." instead of
  "Start a game") and where a third language arrives without a new program
  version. A region is read as its language, so `en-US` gets the English set, and
  an unknown locale falls back to German rather than to key names.
  
  Three tests hold what makes the pair trustworthy: both sets carry the same
  keys, no English text is accidentally the German one, and the placeholders of a
  text - `{player}`, `{current}` - are the same on both sides, because they are
  its contract.
  
  One fix came with it, and it is the reason the whole thing was worth testing in
  the browser: `StartMenu` asked for its texts without saying which language the
  game runs in, so the menu fell back to German however the content was
  configured. It reads `model.locale` now - the model always knew.

### Patch Changes

- Updated dependencies [0f2d613]
  - @hfroemmel/quiz-core@0.18.0
  - @hfroemmel/quiz-themes@0.18.0

## 0.17.0

### Minor Changes

- cac43ab: Three things a host had to build itself
  
  **Reading a package.** `loadQuizPackage(raw, { rootDir })` parses manifest,
  configuration and questions, builds the asset map and hands back the package.
  Four hosts carried the same twenty lines; the rule they implement matters - a
  package that is only half read fails at the start and not in the middle of a
  game, where nobody can intervene.
  
  **Resolving media.** `LocalQuizRuntime` takes a `media` resolver. An
  application whose media live in its own bundle - imported by a bundler,
  addressed by a protocol of its own - used to replace a method of the content
  service from outside, and a rename in the package would have broken it
  silently. A resolver that answers with nothing means: no medium for this id, so
  the question runs without an image rather than with a broken frame.
  
  **Its own frame.** `<QuizProvider chrome={{ brand, abort, settings }}>` says
  which parts of the frame the host supplies itself - word mark, the way back,
  the settings gear. What it takes over is not rendered at all; until now such a
  host hid them with three `display: none` rules that had to be kept in step with
  the package's markup.
  
  And one word for the room: the quiz root and the stage element carry
  `data-surface="light|dark"`, so a host can recolour its own bar around the quiz
  without knowing the package's worlds - `data-theme` names a world, and the
  children's paper is light too.
  
  The hall reads the offers with their motifs: `view.quizOffers` carries
  `artworkUrl` and `emphasis` beside name and subtitle, both from the quiz
  configuration. A stage that kept its own table of pictures left every quiz
  added later without one.
- 715a8dd: One start menu, and the configuration fills it
  
  The device's start selection asked two questions and answered them from a
  property and the catalogue; which quiz was played it could not ask at all. A
  host that wanted a quiz choice had to bring its own screen - the media table
  did, with its own three cards in its own code.
  
  `StartMenu` (`@hfroemmel/quiz-kiosk`) takes the model of `deriveStartMenu` and
  asks what the configuration offers: which quiz, how many are playing, how hard.
  Every step with a single option falls away, because a choice of one is a hurdle
  and not a choice. The offer cards carry the motif of the content
  (`artworkAssetId`), and the emphasised quiz takes the whole row (`emphasis`).
  `GameStart` keeps its old interface for one release and builds the model itself.
  
  Two rules of a device moved into the core, where the catalogue is built. A quiz
  whose levels need somebody to judge an answer does not appear in a device's menu
  at all - at the device there is nobody to ask - and a quiz that keeps only some
  of its levels there is shortened to them. And `deriveStartMenu` takes the
  audience of the installation: a device shows its own audience's offers and never
  the other one's.
  
  An offer that cannot be started now says so before the attempt: the content
  service counts the questions of every quiz and reports the empty ones
  (`quizAvailability`), the menu shows the reason and keeps its button disabled.
  The two sentences are interface texts (`start.rejected.no-questions`,
  `start.rejected.missing-pool`) and therefore translatable like everything else
  on that screen; `kiosk.quizChoice` names the new step.
  
  Levels in the menu model now carry the length of their round (`slotCount`), and
  an audience offer always names its levels even when there is only one - the
  start command needs the id, and whether there is anything to choose is said by
  the length of the list.
- dc76ce6: A theme is one object, and it belongs to one quiz
  
  Whoever wanted their own design had to know four things: the scene theme for
  the stage, the stylesheet with the start menu's tokens, the font stacks and the
  word mark as a property. Where they could not be reached they were copied - the
  media table repeated three colour values as SCSS variables, with the comment
  that whoever changes them there changes them here by hand.
  
  `ThemeDefinition` (`@hfroemmel/quiz-themes`) states a design once: which
  built-in set it starts from, what it overrides on the stage, above it and in the
  menu, which fonts it brings, which word mark, and whether it stands still.
  `resolveTheme` turns it into the values the components read, `themeStyles` into
  the `@font-face` rules, and the schema refuses a misspelled token group instead
  of reading it as "changes nothing". The built-ins are the worlds that exist:
  `brightTheme`, `darkTheme`, `kidsTheme`.
  
  `QuizProvider` (`@hfroemmel/quiz-react`) puts a theme on the quiz's own
  element. Custom properties inherit downwards only, so two quizzes on one page
  cannot recolour each other any more - until now a host design had to be written
  onto the document, where it applied to every quiz on the page. Where a theme is
  meant for the world being shown, it also wins against the package's own variant
  rules: those declare their colours on the stage element and on the device's root
  element, so the resolved theme is written inline onto exactly those two, and its
  base decides whether the stage stands light or dark.
  
  In the light variant the menu mirrors the stage - the selected card carries the
  accent of a tapped answer, the button the green of "reveal". That relationship
  now survives an override: a host that gives its stage a green accent gets a
  green selection without naming it twice.
  
  `useQuizTheme` reports the host's theme, `themeForSkin` picks the right one for
  the world being shown - a theme for the adults' stage does not recolour the
  children's paper. Hosts that pass nothing keep exactly what they had.

### Patch Changes

- Updated dependencies [cac43ab]
- Updated dependencies [715a8dd]
- Updated dependencies [dc76ce6]
  - @hfroemmel/quiz-core@0.17.0
  - @hfroemmel/quiz-themes@0.17.0

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
  - @hfroemmel/quiz-themes@0.16.1

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
  - @hfroemmel/quiz-themes@0.16.0

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
  - @hfroemmel/quiz-themes@0.15.3

## 0.15.2

### Patch Changes

- Set the score card of the player on turn in light text
  
  The card of the player who holds the turn stands on the strong accent colour, so
  its values and labels now take the light ink on the default stage as well as on
  the bright one - in the points cell too, not only beside the name.
- Updated dependencies
  - @hfroemmel/quiz-core@0.15.2
  - @hfroemmel/quiz-themes@0.15.2

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
  - @hfroemmel/quiz-themes@0.15.1

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
  - @hfroemmel/quiz-themes@0.15.0

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
  - @hfroemmel/quiz-themes@0.14.0

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
  - @hfroemmel/quiz-themes@0.13.0

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
  - @hfroemmel/quiz-themes@0.12.0

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
  - @hfroemmel/quiz-themes@0.11.0

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
  - @hfroemmel/quiz-themes@0.10.0

## 0.9.1

### Patch Changes

- 3d262cd: Die Fussleiste des Touchgeraets liegt am unteren Bildrand
  
  Punktestand, Zaehler und die beiden Buzzer stehen an der Kante, an der jemand
  vor dem Geraet steht - auch auf einem Fenster, das hoeher als 16:9 ist. Der
  uebrige Platz liegt jetzt zwischen Szene und Leiste statt gleichmaessig
  darueber und darunter. Auf 16:9 aendert sich nichts.
- Updated dependencies [3d262cd]
  - @hfroemmel/quiz-core@0.9.1
  - @hfroemmel/quiz-themes@0.9.1

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
- Updated dependencies [2258ccf]
  - @hfroemmel/quiz-core@0.9.0
  - @hfroemmel/quiz-themes@0.9.0

## 0.8.0

### Minor Changes

- cdf1303: Der unscharfe Bildgrund blendet auf, und die Buehne der Erwachsenen ist im
  Zweifel hell.
  
  **DER BILDGRUND TRUG BEIM WECHSEL KURZ DAS VORIGE BILD.** Ein
  `background-image` wechselt erst, wenn das neue Bild geladen ist - auf einer
  neuen Frage stand deshalb einen Moment lang der Grund der alten. Die Adresse
  wird jetzt zuerst geladen UND dekodiert (`useDecodedImage`) und erst danach
  gezeigt; die Adresse selbst ist die Kennung des Elements, sodass eine neue
  Frage von vorn beginnt und die alte im selben Moment weg ist. Der Spielablauf
  wartet nicht darauf - die Frage steht sofort, nur ihr Grund kommt einen
  Wimpernschlag spaeter dazu. Bis dahin liegt dort der Verlauf der Buehne, also
  nie eine ungestylte Flaeche.
  
  **EIN MASS FUER DIE KLEINEN UEBERGAENGE.** Neu an der Buehne:
  `--stage-fade-duration` (220 ms) und `--stage-fade-easing`. Gemeint sind nicht
  die Szenenwechsel - die bringen ihre Dauer aus dem Uebergangsregistry mit -,
  sondern alles, was innerhalb einer Szene erscheint und wieder geht. Sie stehen
  an der Buehne, damit auch eine Ebene des Gastgebers (`pads.overlay`) in
  derselben Zeit laufen kann. Unter `prefers-reduced-motion` fallen sie auf 1 ms.
  
  **DIE BUEHNE DER ERWACHSENEN IST IM ZWEIFEL HELL.** Sie war dunkel, weil sie
  fuer den abgedunkelten Saal entworfen wurde; ihr haeufigster Ort ist inzwischen
  ein Touchtisch in einem Foyer mit Tageslicht. Der Umschalter bleibt, nur die
  Vorgabe wechselt - eine gespeicherte Wahl gilt weiter. Die helle Fassung ist
  die vorhandene `.stage--bright`; ein neuer Farbwert kommt nicht dazu. Die
  Kinderwelt bringt ihr eigenes Papier mit und kennt den Umschalter nicht.
  
  Neu am Markup: `[data-backdrop]` und dort `[data-ready]` - der Bildgrund ist
  damit von aussen pruefbar.
- bc9579a: Die Startauswahl gehoert jetzt auch in der Kinderwelt zum Kinderquiz.
  
  **Sie war es bisher nicht - und konnte es nicht sein.** Die Welt steht als
  `.stage--kids` an der Buehne, und die entsteht erst mit dem Spiel; Startauswahl,
  Einstellungen und Rueckfragen liegen darueber. Regeln, die an der Buehnenklasse
  haengen, greifen dort nie. Die Welt steht deshalb ab jetzt als `data-skin` am
  Wurzelelement von `<QuizGame>`, und die Namen der Welt - Tinte, Papier,
  Handschrift, Zeiten - stehen in `styles/stage.css` an `[data-skin='kids']`
  statt an der Buehnenklasse. Die Buehne selbst behaelt dort nur, was ihre Flaeche
  betrifft.
  
  **Die Welt kommt jetzt aus der Zielgruppe, nicht erst aus dem Spiel.** Vor dem
  Start meldet `theme` die Grundwelt - ein Kindergeraet zeigte damit die Auswahl
  der Erwachsenen und wechselte erst mit der ersten Frage. Der Katalog nennt die
  Gestaltungswelt deshalb je Zielgruppe (`catalog.audiences[].skin`), und die
  Startauswahl liest sie dort.
  
  **Gezeichnet statt gezogen.** Karten, Knoepfe und die Bedienspalte tragen die
  Zeichnungen aus dem Assetpaket des Kinderquiz - dieselben Dateien, die im Spiel
  die Antwortzeilen und die Fragetafel tragen, nicht nachgebaute. Eine gewaehlte
  Karte sieht aus wie eine gewaehlte Antwort: rote Karte, weisse Schrift. Der
  gruene Ring und die gruene Kante entfallen dort; sie sind die Auswahlfarbe der
  Erwachsenenauswahl und haben in dieser Welt keine Bedeutung.
  
  **Ein primaerer Knopf fuer die ganze Welt.** "Los geht's" in der Auswahl,
  "Weiter" und "Antwort abgeben und aufloesen" in der Fussleiste kommen aus
  EINEM Satz Token (`--kids-frame`, `--kids-frame-slice`, `--kids-frame-width`).
  Der Aufbau der gezeichneten Flaeche steht genau einmal; ein Ort, der dazukommt,
  nennt nur noch die drei Namen. Weil die Kontur ein `border-image` ist, behalten
  die Ecken bei jeder Knopfbreite ihre Groesse - gedehnt werden nur die Kanten.
  
  Der Erwachsenenmodus ist unveraendert.

### Patch Changes

- Updated dependencies [bc9579a]
  - @hfroemmel/quiz-core@0.8.0
  - @hfroemmel/quiz-themes@0.8.0

## 0.7.1

### Patch Changes

- 1aa4abb: Der Startbildschirm und zwei Buehnenbauteile ohne ihre Zierteile.
  
  Von der Startauswahl fallen weg: das Funkenzeichen auf der Markentafel, der
  Chip mit dem Umfang der gewaehlten Stufe, die beiden nummerierten
  Schrittueberschriften ueber Modus und Schwierigkeit und die Fussnote darunter.
  Was bleibt, sind die Karten selbst - sie sagen ohnehin, was sie sind, und die
  Reihenfolge steht schon in der Anordnung.
  
  Damit entfaellt auch der Oberflaechentext `kiosk.setupNote`. Ein Gastgeber, der
  ihn in seinen `interfaceStrings` stehen hat, muss nichts tun: Ein Schluessel,
  den niemand liest, stoert nicht.
  
  Auf der Buehne verlieren das Hochformat der Medienflaeche und die Kacheln der
  Bildenthuellung ihre eingesetzte Kantenlinie (`box-shadow: inset`).
- @hfroemmel/quiz-core@0.7.1
  - @hfroemmel/quiz-themes@0.7.1

## 0.7.0

### Minor Changes

- Ein Knopfsystem fuer die ganze Buehne - und eine eigene Flaeche fuer den
  Gastgeber darin.
  
  **Die Schaltflaechen der Buehne kommen jetzt aus einer Quelle.** `Weiter`,
  `Antwort abgeben und aufloesen` und der Buzzer waren drei Knoepfe aus zwei
  Dateien mit drei Groessen; nebeneinander sah das aus wie drei Systeme. Kasten,
  Hoehe, Rundung, Typografie und die Zustaende (gedrueckt, gesperrt, Tastaturfokus)
  stehen jetzt als Token und als globale Klasse `stage-button` in
  `@hfroemmel/quiz-react/styles/stage.css`, dazu `stage-button--primary` fuer die
  Handlungsfarbe. Was einen Knopf ausmacht, sagt er weiterhin selbst - der Buzzer
  seine Spielerfarbe, seine Groesse und seine Versalien -, und zwar ueber die
  Token statt ueber ueberschriebene Regeln. Die Regeln der Klasse stehen in
  `:where(...)` und haben damit kein Gewicht: Ein Bauteil, das sie benutzt, gewinnt
  immer, unabhaengig von der Reihenfolge der Stylesheets.
  
  Sichtbar aendert sich dabei eins: Die Aufschrift der Knoepfe in der Fussleiste
  ist kleiner (`--stage-button-size`, 1,5 cqw statt 2 cqw). `Antwort abgeben und
  aufloesen` ist der laengste Satz der Buehne und drueckte die Mitte der Leiste
  auseinander. Flaeche und Trefferfeld bleiben unveraendert - der Knopf fuellt
  weiterhin das ganze Hinweisfeld.
  
  **Der Gastgeber kann eine eigene Ebene IN die Buehne setzen** - `pads.overlay`
  an `QuizScene`/`StageScreen`, `overlay` an `QuizGame`. Sie wird ueber Szene,
  Fussleiste und Koernung gerendert, aber innerhalb der Buehnenflaeche: Nur dort
  gelten deren Farben, deren Containereinheiten und vor allem deren Zoomstufe.
  Daneben behielte so eine Ebene ihre volle Groesse, waehrend alles darunter
  kleiner wird. Gedacht ist sie fuer Schritte, die ein Gastgeber zwischen zwei
  Fragen einschiebt; mit `stage-button` sieht sein Knopf darin aus wie der der
  Buehne.
  
  **Im Einzelspiel gibt es keinen Buzzerklang mehr.** Es gibt dort auch keinen
  Buzzer: Der erste Fingertipp auf eine Antwort holt sich den Zuschlag selbst, und
  die Buehne quittierte diesen einen Tipp mit zwei Klaengen uebereinander - dem
  Auswahlton und dem Buzzer. Der Buzzer meldet, dass jemand einem anderen
  zuvorgekommen ist, und niemand ist da. Im Duell bleibt er unveraendert. Die
  Entscheidung steht als reine Funktion (`klaengeFuer`) und ist damit geprueft.
- Der Startbildschirm des Geraets nach dem Entwurf `Startmenue v1`
  (`docs/entwuerfe/startmenue/`) - und das Einstellungsfenster daran angeglichen.
  
  Statt eines mittigen Bogens aus Bild, Titel und zwei Fragen stehen jetzt zwei
  Spalten nebeneinander. Links die Markentafel: Zielgruppe, Motiv, Titel, ein Satz
  dazu und der Umfang der gewaehlten Stufe - sie wird nicht angefasst und ist das
  Plakat, das jemanden herholt. Rechts die Bedienung: zwei nummerierte Schritte
  mit Karten, darunter die Startschaltflaeche - alles beisammen und in der
  Reihenfolge, in der entschieden wird.
  
  Eine gewaehlte Karte ist an DREI Dingen zugleich zu erkennen: gruene Kante,
  gruen gekippte Flaeche und Haekchen. Eine Kante allein verschwindet aus zwei
  Metern und schraeg von der Seite - und genau so steht man an einem Geraet im
  Foyer.
  
  Im Einzelnen:
  
  - `quiz-themes`: neue `startPalette` (`--start-*`) - die Farbwelt des
    Startbildschirms, bewusst getrennt vom Bedienrahmen des Operators.
  - `quiz-core`: die Zielgruppe kann eine `startDescription` tragen, je Sprache
    als `startDescriptions` - wie schon Titel und Startbild. Sie steht als
    `theme.startDescription` im Ansichtsmodell.
  - `quiz-react`: fuenf neue Oberflaechentexte (`kiosk.setupTitle`,
    `kiosk.setupSubtitle`, `kiosk.soloHint`, `kiosk.duoHint`).
  - `quiz-kiosk`: neuer Aufbau der Startauswahl, Einstellungen und Rueckfragen in
    derselben Formensprache, das Quizmotiv des Entwurfs als mitgeliefertes
    Rueckfallbild.
  
  An Geraeten mit nur einer Spielerzahl - dem Kiosk - entfaellt der Modusschritt,
  und die Schwierigkeit traegt die 01. Untereinander stehen beide Spalten, sobald
  die Breite fehlt.
  
  Aendert sich fuer Gastgeber: Die Startauswahl setzt nicht mehr die globalen
  `button`-Klassen. Sie werden weiterhin mit `@hfroemmel/quiz-kiosk/styles.css`
  ausgeliefert - fuer die Umgebung, die der Gastgeber selbst baut.

### Patch Changes

- Das Videobild flackerte, sobald zwei Fenster nebeneinander liefen.
  
  Der Client glich die Position des Videoelements bei JEDEM Schnappschuss an die
  Serverposition an. Die fuehrt der Server mit der Wanduhr, eine Wiedergabe haelt
  da nie exakt mit - und jeder Ausgleichssprung setzte den Dekoder zurueck, was
  Zeit kostete, was die naechste Abweichung erzeugte. Mit zwei Fenstern um
  denselben Dekoder wurde daraus ein sichtbares Flackern.
  
  Angeglichen wird jetzt nur noch, wenn dabei nichts zu zerstoeren ist: wenn das
  Element steht - der Fall eines Fensters, das mitten im Video dazukommt - oder
  wenn die Serverposition zurueckgeht, was nur ein Neustart tut. Ein Vorlauf des
  Servers bleibt unbeantwortet; die Frage kommt ohnehin zur Serverzeit.
  
  Dazu zwei kleinere Korrekturen an derselben Stelle: Die gemessene Laufzeit wird
  nur gemeldet, wenn der Server sie noch nicht kennt - jede Meldung ist ein
  Befehl, der gespeichert und an alle verteilt wird, und zwei Fenster messen
  dieselbe Datei. Und ein Element, das am Ende steht, wird nicht mehr gestartet:
  `play()` spulte dort von selbst zurueck und spielte das Video ein zweites Mal.
- Updated dependencies
  - @hfroemmel/quiz-core@0.7.0
  - @hfroemmel/quiz-themes@0.7.0

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
  - @hfroemmel/quiz-themes@0.6.1

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
  - @hfroemmel/quiz-themes@0.6.0

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
  - @hfroemmel/quiz-themes@0.5.0

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
  - @hfroemmel/quiz-themes@0.2.0

## 0.1.0

### Minor Changes

- c00fcd5: Erste Veroeffentlichung der fuenf Quiz-Pakete: Kern (Vertraege, Engine,
  Laufzeit), Inhalts-Pipeline, Themes, React-Buehne und spielbares Quiz.

### Patch Changes

- Updated dependencies [c00fcd5]
  - @hfroemmel/quiz-core@0.1.0
  - @hfroemmel/quiz-themes@0.1.0
