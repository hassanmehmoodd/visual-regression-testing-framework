import assert from 'node:assert/strict';
import test from 'node:test';
import { PNG } from 'pngjs';
import { compareImages } from '../../src/comparison/engine';
import { createSolidPng, decodePng } from '../../src/comparison/image';
import { compareOptions } from '../helpers/options';

const white = [255, 255, 255, 255] as const;
const black = [0, 0, 0, 255] as const;

function paint(width: number, height: number, mutate: (png: PNG) => void): Buffer {
  const png = PNG.sync.read(createSolidPng(width, height, white));
  mutate(png);
  return PNG.sync.write(png);
}

test('identical images pass with zero differing pixels', async () => {
  const image = createSolidPng(32, 24, white);
  const result = await compareImages(image, image, compareOptions());
  assert.equal(result.status, 'passed');
  assert.equal(result.diffPixels, 0);
  assert.equal(result.diffPixelRatio, 0);
  assert.equal(result.dimensionMismatch, false);
});

test('the same pixel diff fails a strict budget and passes a loose budget', async () => {
  const baseline = createSolidPng(100, 100, white);
  const actual = paint(100, 100, (png) => {
    for (let y = 0; y < 20; y += 1) {
      for (let x = 0; x < 25; x += 1) {
        png.data.set(black, (y * png.width + x) * 4);
      }
    }
  });

  const strict = await compareImages(baseline, actual, compareOptions({ maxDiffPixelRatio: 0.01, maxDiffPixels: 100 }));
  const loose = await compareImages(baseline, actual, compareOptions({ maxDiffPixelRatio: 0.1, maxDiffPixels: 10_000 }));

  assert.equal(strict.diffPixels, loose.diffPixels);
  assert.equal(strict.diffPixels, 500);
  assert.equal(strict.status, 'failed');
  assert.equal(loose.status, 'passed');
  assert.match(strict.message, /exceeded the threshold/);
  assert.match(loose.message, /Within threshold/);
});

test('a pixel cap fails the check even when the ratio budget is loose', async () => {
  const baseline = createSolidPng(40, 40, white);
  const actual = paint(40, 40, (png) => {
    for (let x = 0; x < 10; x += 1) {
      png.data.set(black, x * 4);
    }
  });
  const limited = await compareImages(
    baseline,
    actual,
    compareOptions({ maxDiffPixelRatio: 1, maxDiffPixels: 5 }),
  );
  const open = await compareImages(
    baseline,
    actual,
    compareOptions({ maxDiffPixelRatio: 1, maxDiffPixels: 10 }),
  );
  assert.equal(limited.diffPixels, 10);
  assert.equal(limited.status, 'failed');
  assert.equal(open.status, 'passed');
});

test('dimension mismatches are reported and can include a padded diff', async () => {
  const baseline = createSolidPng(10, 12, [10, 20, 30, 255]);
  const actual = createSolidPng(14, 8, [200, 10, 10, 255]);

  const plain = await compareImages(baseline, actual, compareOptions({ padDimensionMismatch: false }));
  assert.equal(plain.status, 'dimension-mismatch');
  assert.equal(plain.padded, false);
  assert.equal(plain.diffPng, null);
  assert.match(plain.message, /baseline is 10×12/);
  assert.match(plain.message, /actual is 14×8/);
  assert.match(plain.message, /Diff image was not written/);

  const padded = await compareImages(baseline, actual, compareOptions({ padDimensionMismatch: true }));
  assert.equal(padded.status, 'dimension-mismatch');
  assert.equal(padded.padded, true);
  assert.ok(padded.diffPng);
  const diff = decodePng(padded.diffPng);
  assert.equal(diff.width, 14);
  assert.equal(diff.height, 12);
  assert.match(padded.message, /padded diff/);
});

test('ignoreAntialiasing drops an anti-aliased edge pixel and still counts a solid block', async () => {
  const width = 16;
  const height = 16;
  const baseline = paint(width, height, (png) => {
    fillRect(png, 2, 2, 6, 12, black);
  });
  const edged = paint(width, height, (png) => {
    fillRect(png, 2, 2, 6, 12, black);
    png.data.set([180, 180, 180, 255], (7 * width + 8) * 4);
  });

  const counted = await compareImages(baseline, edged, compareOptions({ ignoreAntialiasing: false, threshold: 0.1 }));
  const ignored = await compareImages(baseline, edged, compareOptions({ ignoreAntialiasing: true, threshold: 0.1 }));
  assert.equal(counted.diffPixels, 1);
  assert.equal(ignored.diffPixels, 0);

  const solidBaseline = createSolidPng(20, 20, white);
  const solidActual = paint(20, 20, (png) => {
    fillRect(png, 2, 2, 8, 8, [220, 30, 30, 255]);
  });
  const withAa = await compareImages(solidBaseline, solidActual, compareOptions({ ignoreAntialiasing: true, threshold: 0.1 }));
  const withoutAa = await compareImages(solidBaseline, solidActual, compareOptions({ ignoreAntialiasing: false, threshold: 0.1 }));
  assert.ok(withAa.diffPixels > 20);
  assert.equal(withAa.diffPixels, withoutAa.diffPixels);
});

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgba: readonly number[]): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      png.data.set(rgba, (row * png.width + column) * 4);
    }
  }
}
