---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Das Video tritt auf und ab - und danach wartet der Ablauf auf den Operator

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
