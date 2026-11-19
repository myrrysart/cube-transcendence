# Batch Creator Studio — review build

<!-- DOC_META: status=review version=1 -->
<!-- DOC_TODO: BATCH_STUDIO_REVIEW — review the generated contact sheet and confirm the staged compiler and UI before promoting them into the game engine and frontend. -->

From the repository root, using the frontend's existing dependencies:

```sh
bun --bun srcs/frontend/node_modules/vite/bin/vite.js \
  --config .scratch/tmp/challenge-visibility/vite.config.mts \
  --host 127.0.0.1 --port 5183 --strictPort
```

Open `http://127.0.0.1:5183`. Choose a shape, material, face-X setting, and number
of camera views. **Generate batch** shows the player prompt and answer side by
side. The prompt includes visible subdivision seams and Xs on the reference
surface. Dashed strokes are targets. **Flagged only** narrows the review to
short targets and overlapping paths. Approve cards individually, then download
only those cards as JSON. Generation resets approval.

The default is 40 camera views per shape, material, and face-X setting. The
largest cube batch has 1,120 perspective challenges: seven shapes, two materials,
and two face-X settings. Select **Loomis head** for a separate batch of 40 front
and three-quarter studies. Only the triangle from the outer brow ends to just
below the nose is shown in the prompt. The cranium, jaw, and visible side plane
are targets, and the cranium arc stops where the side rim takes over. Cube settings
do not apply to the head. **Show facial guides** overlays simple brow, upper
eyelid, nose, and mouth marks in gold on the answer. Those marks are not scored
and do not appear in the player prompt or compiled export.

Export includes the shape draft and the compiled `Challenge` for each approved
record. This preview does not write
to PostgreSQL or alter the existing single-cube editor.

Run the staged unit tests and the browser smoke check:

```sh
(cd .scratch/tmp/challenge-visibility && bun test)
bun --bun srcs/frontend/node_modules/vite/bin/vite.js build \
  --config .scratch/tmp/challenge-visibility/vite.config.mts \
  --outDir /tmp/opencode/challenge-studio-dist
bun .scratch/tmp/challenge-visibility/browser-check.ts \
  /path/to/chromium /tmp/opencode/challenge-studio-dist
```
