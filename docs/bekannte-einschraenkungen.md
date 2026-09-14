# Known limitations

## Deliberately not part of the initial scope

Per section 4.2 of the specification, the following are deliberately absent:
a publicly hosted cloud backend, user accounts over the internet, a full
editorial CMS, multiple simultaneous games, freely configurable buzzer keys,
buzzer lighting, negative scores, manual winner selection, an automatic
tiebreaker question, automatically displayed extra information on the stage
screen, and unreviewed AI corrections.

## Content

* The catalog contains the **199 adopted questions** from the delivered set,
  plus two lorem-ipsum test questions (`test-video`, `test-person`). The
  images are real material, not placeholders.
* Validation reports **85 warnings**. Most of them are missing explanation
  texts (42) and missing image credits (17) - both editorial work, not a
  technical shortcoming. 21 warnings concern the deliberately small pools of
  the two test slots (see below). Two questions (119, 127) carry two
  identical answer options and are therefore not playable.

## Test slots at the start of every game

Question slots 1 and 2 are fixed in **all** presets to the two test
questions, so the video question and portrait layout can be checked without
playing through a full game. This is a development fixture, not dramaturgy:
before the event, the two slots are replaced again by editorial filters in
`content/source/config.json`.

The test questions carry the category `saarbruecken` as a second category.
This is not content but the key to the regional mode - it filters on this
category and would otherwise have no candidate for the two slots.

## Video questions

The bundled `testvideo.mp4` is **test material without editorial approval**.
It lives under `content/source/assets/video/` and is attached to the
question `test-video`.

The video logic is fully implemented and tested: buzzer lock during the
video, start/pause/restart, `Frage einblenden` (show question) as the second
phase of the same question, error message with `Frage überspringen` (skip
question) when the medium fails to load. End-to-end case 7 of the
specification runs.

Two points about this:

* **The Chromium of the test environment does not play the file.** It does
  not recognize H.264 and AAC (`canPlayType` returns empty) and shows "Video
  unavailable". The same file plays in the shipped browser and in the
  desktop application. The end-to-end test therefore checks the flow, not
  the playback.
* **There is no seeking in the video.** The operator starts, pauses, and
  restarts from the beginning. A position slider would require the playback
  duration, and that is not available in the server state. Whoever needs it
  must add the duration to the state - the stage client knows it from
  `loadedmetadata`.

## Native SQLite module

`better-sqlite3` is a native module and only ever matches **one** runtime at
a time. After `pnpm desktop:rebuild-native` (Electron), `pnpm server` and
`pnpm test` only work again after `pnpm server:rebuild-native` (Node). The
application detects this case and states the matching command in plain text.

The Electron rebuild needs **Node 22.12 or newer**: `@electron/rebuild`
requires it starting with version 4. Server, web, and tests still run from
Node 20. Older versions of the tool are not an option for installation - they
fetch `@electron/node-gyp` over SSH from a Git repository. Newer pnpm
versions reject that with `ERR_PNPM_EXOTIC_SUBDEP`, and without a configured
SSH key it fails anyway.

## Security on the local network

* The operator view is reachable only via loopback; remote access is not
  supported.
* Host access is protected by a six-digit session code that is regenerated
  on startup. There is no rate limiting - this is deliberately kept simple
  for event operation on one's own LAN.
* Stage clients may connect without a code. They receive only public data
  and cannot send control commands. On a foreign network, anyone could read
  along the public view this way.
* The connection is unencrypted HTTP/WS on the local network.

## Other points

* **No general undo.** Every change is fully traceable (audit log, score
  transactions, hotfix report), but there is no undo button. Scores can be
  corrected manually.
* **Not every sound cue has a file.** `solution`, `scene-change`, and
  `result` are set up but silent; as soon as a file is placed in
  `apps/web/src/assets/audio/`, `soundCues.ts` picks it up without a code
  change.
* **Screenshot baselines are platform-dependent.** On a new system, run
  `npx playwright test --project=preview --update-snapshots` once.
* **Fullscreen control of the stage window from the operator window** only
  works in the Electron application. In pure browser operation, the stage
  client toggles its own fullscreen (key `F` or double-click).
* **No installer.** There is no `electron-builder` step; the desktop
  application is launched from the project directory.

## Sound and media in browser operation

- **Sound output needs an interaction per window.** Browsers only allow
  audio after a click or a keypress in the respective document. The operator
  and stage windows obtain that permission on the first click themselves;
  the desktop application allows playback regardless. A stage window that is
  never clicked can stay silent in the browser - the diagnostics under
  `Tonausgabe` (sound output) then show which window currently holds sound.
- **Media files are looked up in the built package first, then under
  `content/source/assets`.** The copies in the package are only created by
  `pnpm content:build`; without this fallback, a freshly cloned working copy
  would show replacement images everywhere. In a shipped application, the
  source directory does not exist - only the package applies there.
- **Rebuild after `git pull`.** `apps/web/dist` and the image copies in
  `content/dist/assets` are not part of the repository. Anyone who wants to
  test the shipped state runs `pnpm build`; day to day, `pnpm dev` is enough,
  because Vite serves the sources directly.
