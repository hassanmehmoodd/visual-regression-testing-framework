import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVariant } from '../../demo/variant';

test('query variant wins and unknown values fall back to stable', () => {
  assert.equal(resolveVariant('font', 'color'), 'font');
  assert.equal(resolveVariant(null, 'layout'), 'layout');
  assert.equal(resolveVariant(null, undefined), 'stable');
  assert.equal(resolveVariant('not-a-variant', undefined), 'stable');
  assert.equal(resolveVariant('<script>', 'color'), 'stable');
});
