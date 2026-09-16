---
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

The interface speaks two languages by itself

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
