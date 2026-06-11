import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import app from '../src/index';
import { _resetStore } from '../src/store/briefStore';

const server = app.listen(0);
const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(() => server.close());
beforeEach(() => _resetStore());

const validBrief = {
  brief_name: 'Spring Promo',
  owner: 'Nic',
  industry: 'retail',
  city: 'Pittsburgh',
  objective: 'TRAFFIC',
  tone: 'bold',
  target_audience: 'Local shoppers 25-45',
  product_description: 'Handmade leather goods',
  key_message: 'Built to last a lifetime',
  daily_budget_usd: 25,
  start_date: '2026-07-01',
  end_date: '2026-07-31',
};

async function post(path: string, body?: unknown) {
  return fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('health check responds ok', async () => {
  const res = await fetch(`${base()}/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('creates a valid brief as draft', async () => {
  const res = await post('/api/briefs', validBrief);
  assert.equal(res.status, 201);
  const { brief } = await res.json();
  assert.equal(brief.status, 'draft');
  assert.ok(brief.id);
  assert.equal(brief.brief_name, 'Spring Promo');
});

test('rejects invalid brief with field errors', async () => {
  const res = await post('/api/briefs', { ...validBrief, brief_name: '', daily_budget_usd: 2 });
  assert.equal(res.status, 422);
  const { errors } = await res.json();
  const fields = errors.map((e: { field: string }) => e.field);
  assert.ok(fields.includes('brief_name'));
  assert.ok(fields.includes('daily_budget_usd'));
});

test('rejects end date before start date', async () => {
  const res = await post('/api/briefs', { ...validBrief, end_date: '2026-06-01' });
  assert.equal(res.status, 422);
  const { errors } = await res.json();
  assert.ok(errors.some((e: { field: string }) => e.field === 'end_date'));
});

test('defaults city to Pittsburgh when omitted', async () => {
  const { city, ...noCity } = validBrief;
  const res = await post('/api/briefs', noCity);
  assert.equal(res.status, 201);
  assert.equal((await res.json()).brief.city, 'Pittsburgh');
});

test('clone creates a fresh draft with provenance', async () => {
  const created = await (await post('/api/briefs', validBrief)).json();
  const id = created.brief.id;
  const res = await post(`/api/briefs/${id}/clone`);
  assert.equal(res.status, 201);
  const { brief } = await res.json();
  assert.notEqual(brief.id, id);
  assert.equal(brief.status, 'draft');
  assert.equal(brief.cloned_from, id);
  assert.match(brief.brief_name, /\(copy\)$/);
});

test('lists briefs sorted by last_modified descending', async () => {
  await post('/api/briefs', { ...validBrief, brief_name: 'First' });
  await new Promise((r) => setTimeout(r, 5));
  await post('/api/briefs', { ...validBrief, brief_name: 'Second' });
  const { briefs } = await (await fetch(`${base()}/api/briefs`)).json();
  assert.equal(briefs[0].brief_name, 'Second');
});
