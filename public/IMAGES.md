# Shipped artwork

Twelve files, watercolour illustrations rather than photographs. `src/lib/imagery.ts` is the
only place that names them.

## `public/covers/` — what stands behind a roll's title

Full-bleed behind a phone-shaped invitation, and cropped again to 110×200 and 84×104 in the
picker and the roll list. Keep the subject centred and the bottom third quiet: the roll title,
the host's name and two counters are laid over it.

| File                   | Occasion                                     |
| ---------------------- | -------------------------------------------- |
| `wedding-mandap.jpg`   | Wedding — **the default cover for every new roll** |
| `wedding-morning.jpg`  | Wedding                                      |
| `wedding-evening.jpg`  | Wedding                                      |
| `wedding-rings.jpg`    | Wedding                                      |
| `wedding-western.jpg`  | Wedding                                      |
| `birthday.jpg`         | Birthday                                     |
| `trip.jpg`             | Trip                                         |
| `celebration.jpg`      | Any celebration, office included             |

## `public/frames/` — stand-ins for a guest's photograph

Sharp in the marketing hero and on the wizard's reveal step, heavily blurred in the marketing
page's sealed grid.

`wedding-toast.jpg` · `wedding-walk.jpg` · `wedding-dance.jpg` · `birthday-candles.jpg`

## Adding or replacing one

1. Drop the file in, any format, any name, any size.
2. Run `npm run images`.

That re-encodes to JPEG at a 1440px long edge and lowercases the name. Both halves matter: the
source art arrives as ~2 MB PNGs and nine of them land on one marketing page, and we develop on
Windows but deploy to Linux, where a capital letter in a path 404s only in production.

Then add the new file to `COVERS` or `FRAMES` in `src/lib/imagery.ts`. Every entry needs a
`wash` — a gradient painted underneath, which is what shows if the file ever goes missing,
since CSS skips a background layer that fails to load rather than drawing a broken frame.

Prefer replacing a file over reordering the list: `Roll.coverPreset` stores a position in
`COVERS`, so reordering silently changes which cover an existing roll shows. The lookup wraps,
so shortening the list leaves old rows on *a* cover, just not the one the host picked.
