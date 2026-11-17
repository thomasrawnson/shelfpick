// Run: node --test scoresheets/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { fixtureProblems, templateProblems, validateAll } from './validate.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const load = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const clone = (v) => structuredClone(v);

test('there are 25 templates and each validates against the schema and its fixture', () => {
  const results = validateAll();
  assert.equal(results.length, 25);
  for (const r of results) assert.deepEqual(r.problems, [], r.file);
});

test('the set covers low-score, cooperative, per-round and target games', () => {
  const ts = validateAll().map((r) => load('templates', r.file));
  assert.ok(ts.some((t) => t.win_condition === 'lowest'));
  assert.ok(ts.some((t) => t.win_condition === 'cooperative'));
  assert.ok(ts.some((t) => t.win_condition === 'target'));
  assert.ok(ts.some((t) => t.categories.some((c) => c.scope === 'per_round')));
});

test('every template records its rulebook source and edition', () => {
  for (const r of validateAll()) {
    const t = load('templates', r.file);
    assert.ok(t.source.rulebook_title && t.source.edition_or_year, r.file);
  }
});

test('every template was checked against a named rulebook text', () => {
  for (const r of validateAll()) {
    const t = load('templates', r.file);
    assert.equal(t.source.checked_against_rulebook, true, r.file);
    assert.match(t.source.url, /^https:\/\//, r.file);
  }
});

test('a wrong expected total is caught', () => {
  const t = load('templates', '266192-wingspan.json');
  const f = clone(load('fixtures', '266192.json'));
  f.expected.totals.Ana += 1;
  assert.match(fixtureProblems(t, f).join(), /computed 113, expected 114/);
});

test('a wrong winner is caught, and tie-breakers decide ties', () => {
  const t = load('templates', '266192-wingspan.json');
  const f = clone(load('fixtures', '266192.json'));
  f.expected.winner = ['Ana'];
  assert.match(fixtureProblems(t, f).join(), /winner computed \[Dev\]/);
  f.players.find((p) => p.name === 'Dev').scores.food_left = 2;
  f.expected.winner = ['Ana', 'Dev'];
  assert.deepEqual(fixtureProblems(t, f), []);
});

test('lower-is-better tie-breakers and negative inputs are enforced', () => {
  const t = load('templates', '148228-splendor.json');
  const f = clone(load('fixtures', '148228.json'));
  f.players[1].scores.cards_owned = 5;
  f.expected.winner = ['Ben'];
  assert.deepEqual(fixtureProblems(t, f), []);
  f.players[0].scores.card_points = -1;
  assert.match(fixtureProblems(t, f).join(), /negative values are not allowed/);
});

test('schema violations in a template are reported', () => {
  const t = clone(load('templates', '822-carcassonne.json'));
  delete t.source;
  t.categories[0].type = 'text';
  assert.ok(templateProblems(t).length >= 2);
  const u = clone(load('templates', '822-carcassonne.json'));
  u.tie_breakers = ['missing_category'];
  assert.match(templateProblems(u).join(), /not a category id/);
});

test('cooperative result band is checked', () => {
  const t = load('templates', '98778-hanabi.json');
  const f = clone(load('fixtures', '98778.json'));
  f.players[0].scores.blue = 5;
  f.players[0].scores.yellow = 5;
  f.expected.totals.Team = 25;
  assert.match(fixtureProblems(t, f).join(), /result band computed Perfect/);
  f.expected.result_band = 'Perfect';
  assert.deepEqual(fixtureProblems(t, f), []);
});

test('a target game has no winner until someone reaches the target', () => {
  const t = load('templates', '13-catan.json');
  const f = clone(load('fixtures', '13.json'));
  f.players[0].scores.longest_road = false;
  f.expected.totals.Ana = 8;
  f.expected.winner = [];
  assert.deepEqual(fixtureProblems(t, f), []);
});
