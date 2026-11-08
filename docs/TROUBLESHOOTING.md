# Troubleshooting

## The suite says a baseline is missing

`missing-baseline` means there is no approved PNG for that key. The actual capture is in `test-results/visual/actual/` and a copy is in `test-results/visual/pending/`. The manifest was not updated.

Review the image, then approve it:

```bash
npm run baseline:approve -- \
  --test dashboard/full-page \
  --browser chromium \
  --viewport desktop \
  --source pending \
  --approver "Your Name"
```

`VRT_UPDATE_BASELINES=1` creates the file only when it is absent. It will not fill in a baseline that failed comparison, and it will not replace one that already exists.

## A failure did not update the baseline

That is the intended rule. Compare the actual and the diff under `test-results/visual/`. If the new screenshot is the one you want to keep:

```bash
npm run baseline:approve -- \
  --test dashboard/full-page \
  --browser chromium \
  --viewport desktop \
  --approver "Your Name"
```

The previous PNG is copied under `baselines/history/` before the replacement. Approving the same bytes twice does not bump the version.

## Dimension mismatch

The message includes both sizes, for example `baseline is 48×48 and actual is 1280×800`. A viewport change, a `fullPage` flag change, or a document that grew will do this. With `VRT_PAD_DIMENSION_MISMATCH=true` (the default) the diff image is the larger size and magenta marks the area that existed on only one side. The status remains `dimension-mismatch`.

Make the capture options match the baseline: same viewport name, same `fullPage` value, and the same element selector. Then approve a new baseline only after you meant the size to change.

## Stable screenshots fail on another machine

Baselines in this repository were generated on Ubuntu 24.04 with Playwright 1.65.0. They do not include an OS suffix. macOS and Windows renders, and a different Playwright version, will not match them.

- Run CI on `ubuntu-24.04`, which is what the workflow does.
- Or set `VRT_INCLUDE_PLATFORM=true` and keep a baseline per OS.
- Regenerate with the same Playwright version pinned in `package.json`.

Web fonts are self-hosted so the suite does not depend on fonts installed by the OS. Remaining differences are usually a different browser build.

## A small diff fails, or a real change passes

`VRT_THRESHOLD` is the per-pixel color distance. `VRT_MAX_DIFF_RATIO` is the fraction of pixels allowed to differ. Default ratio is `0.002` (0.2000%). If `VRT_MAX_DIFF_PIXELS` is set, the check must also stay under that count.

The sample threshold test captures the color variant twice against the same baseline. One check allows a ratio of `1` and passes. The other allows a ratio of `0` and fails. Both checks record the same pixel count. Use the same pattern for a per-check override:

```ts
await visual.check({
  suite: 'dashboard',
  name: 'full-page',
  maxDiffPixelRatio: 0.01,
  goto: '/',
  fullPage: true,
});
```

Anti-aliasing tolerance is `VRT_IGNORE_ANTIALIASING`. Turn it off when you need edges counted.

## Dynamic text causes a false failure

Add a selector to `masks` in `vrt.config.ts`, or pass `masks` on the check. Give the element a fixed width and height. A masked element whose text changes width can still move the layout around it, and the mask only covers the element itself.

The demo masks `[data-vrt="timestamp"]`, `[data-vrt="random-id"]`, `[data-vrt="avatar"]`, and `[data-vrt="ad"]`. Those boxes are magenta in the screenshots. The masking test compares two loads with the masks and expects a pass at the default budget, then compares two unmasked loads and expects a real pixel difference.

## Animations or the caret flicker

The fixture disables animations in CSS, finishes animations already running, and passes `animations: 'disabled'` and `caret: 'hide'` to Playwright. Do not add `page.waitForTimeout`. If a canvas or a video keeps painting, stop that source in the page or mask it.

The demo's sponsored dot animates on purpose. The stable screenshots are taken after that animation is disabled.

## Fonts look different on the first capture

The fixture waits for `document.fonts.ready` and for each image to decode. The demo uses `font-display: block` and preloads the woff2 files. If you add a font, preload it and wait for it the same way. A font that arrives after the screenshot shifts the text.

## `baseline:verify` fails

The command prints the key and whether the file is missing, the hash differs, or the dimensions differ. It also lists PNG files that are not in the manifest. Restore the file from history or approve the current actual. Do not hand-edit a PNG without updating the manifest; the next test run will fail verification before any comparison.

## Playwright cannot launch a browser

Install the browsers and their operating system libraries:

```bash
npx playwright install --with-deps chromium firefox webkit
```

Firefox and WebKit need the packages Playwright prints when they are missing. The GitHub Actions job runs that install on `ubuntu-24.04` and caches `~/.cache/ms-playwright`.

## The HTML report does not match the tests

The report project runs after the browser projects. It reads `test-results/visual/results/*.json`, writes `test-results/visual/report/index.html`, and checks the summary attributes, the JSON island, and the embedded diff images. A stale result file from an older run is removed by global setup at the start of the suite. If you generate the report by hand, run `npm run test:visual` first so the result files exist.

## The approve command cannot find the screenshot

Pass `--source actual` or `--source pending`, and use the same `--browser` and `--viewport` the test used. The default directories are cleared at the start of a Playwright run, so approve the image before the next run deletes `test-results/`. You can also pass a PNG path:

```bash
npm run baseline:approve -- \
  --test dashboard/full-page \
  --browser chromium \
  --viewport desktop \
  --source /absolute/path/to/reviewed.png \
  --approver "Your Name"
```

## Environment variables seem to do nothing

The framework does not read a `.env` file. Export the variable in the shell, or put it in the workflow `env` block. `VRT_THRESHOLD=0.2 npm test` works. Values in the environment override `vrt.config.ts`.
