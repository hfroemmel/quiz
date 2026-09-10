---
"@hfroemmel/quiz-react": minor
---

Der unscharfe Bildgrund blendet auf, und die Buehne der Erwachsenen ist im
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
