---
'@hfroemmel/quiz-themes': patch
---

The red variant writes the dark ink on its bold areas, as the stage it comes from does.

WHAT THE ROOM SHOWED: a white score card with white writing on it, and a white
answer bar with neither its letter nor its answer - the card of the player on
turn and the answer they had tapped.

Both of those areas belong to the DARK stage: this variant names the ground and
the tile that sits on it, and nothing else, so what a strong area carries is the
dark world's white accent. Its ink has to be that world's too - dark. The
variant's own rule named the light one, which is right for paper, where the
strong areas are black, and is nothing at all on white.

The value stays in the variant's own rule rather than moving back to the
fallback layer, and that is deliberate: `inkOnStrong` is emitted once, on
`:root`, from where it is handed down to the stage - so an application whose
root says something else would decide what the room can read, and the variant
would have no way of saying otherwise.
