import assert from 'node:assert/strict';
import { test } from 'node:test';
import { credentialsValid } from '../src/middleware/auth';
import { parseImageHashResponse } from '../src/services/meta';

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
