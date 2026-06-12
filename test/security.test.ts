import assert from 'node:assert/strict';
import { test } from 'node:test';
import { credentialsValid } from '../src/middleware/auth';
import { parseImageHashResponse } from '../src/services/meta';
import { parseConversionRows } from '../src/services/posthog';

function basic(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

test('credentialsValid accepts matching credentials', () => {
  assert.equal(credentialsValid(basic('nic', 's3cret'), 'nic', 's3cret'), true);
});

test('credentialsValid rejects wrong password / user / scheme / missing', () => {
  assert.equal(credentialsValid(basic('nic', 'wrong'), 'nic', 's3cret'), false);
  assert.equal(credentialsValid(basic('mallory', 's3cret'), 'nic', 's3cret'), false);
  assert.equal(credentialsValid('Bearer abc', 'nic', 's3cret'), false);
  assert.equal(credentialsValid(undefined, 'nic', 's3cret'), false);
});

test('credentialsValid handles passwords containing a colon', () => {
  assert.equal(credentialsValid(basic('nic', 'a:b:c'), 'nic', 'a:b:c'), true);
});

test('parseImageHashResponse extracts the first image hash', () => {
  const hash = parseImageHashResponse({ images: { asset: { hash: 'abc123', url: 'http://x' } } });
  assert.equal(hash, 'abc123');
});

test('parseImageHashResponse returns null when absent', () => {
  assert.equal(parseImageHashResponse({}), null);
  assert.equal(parseImageHashResponse({ images: {} }), null);
  assert.equal(parseImageHashResponse(null), null);
});

test('parseConversionRows maps PostHog rows to per-brief counts', () => {
  const out = parseConversionRows([
    ['brief-abc', 7, 3],
    ['brief-xyz', 2, 0],
    ['', 9, 9], // empty brief skipped
    'not-an-array',
  ]);
  assert.deepEqual(out['brief-abc'], { trial_started: 7, trial_converted: 3 });
  assert.deepEqual(out['brief-xyz'], { trial_started: 2, trial_converted: 0 });
  assert.equal('' in out, false);
});

test('parseConversionRows handles non-array input', () => {
  assert.deepEqual(parseConversionRows(null), {});
  assert.deepEqual(parseConversionRows(undefined), {});
});
