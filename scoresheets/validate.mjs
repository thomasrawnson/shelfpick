// Validates every template and fixture. Run: node scoresheets/validate.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSchema } from './lib/json-schema.mjs';
import { checkInputs, playerTotal, resultBand, winners } from './score.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf8'));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function templateProblems(t) {
  const problems = validateSchema(readJson('schema.v1.json'), t);
  if (problems.length) return problems;
  const ids = t.categories.map((c) => c.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate category id');
  if (t.supported_players[0] > t.supported_players[1]) problems.push('supported_players min is above max');
  if (t.win_condition === 'target' && t.target_score === undefined) problems.push('target win_condition needs target_score');
  if (t.win_condition === 'cooperative' && t.target_score !== undefined) problems.push('cooperative games take no target_score');
  if (t.win_condition === 'cooperative' && t.tie_breakers.length) problems.push('cooperative games take no tie_breakers');
  t.tie_breakers.forEach((id, i) => {
    if (id === 'shared') { if (i !== t.tie_breakers.length - 1) problems.push('"shared" must be last in tie_breakers'); }
    else if (!ids.includes(id)) problems.push(`tie_breaker ${id} is not a category id`);
  });
  if (t.categories.some((c) => c.scope === 'per_round') && t.rounds === 0) problems.push('per_round needs rounds');
  for (const c of t.categories) {
    if (c.type === 'boolean' && c.allow_negative) problems.push(`${c.id}: boolean cannot allow_negative`);
    if (c.type === 'boolean' && c.scope === 'per_round') problems.push(`${c.id}: boolean must be once-scope`);
  }
  if (t.result_bands) {
    const mins = t.result_bands.map((b) => b.min_total);
    if (new Set(mins).size !== mins.length) problems.push('duplicate result_bands min_total');
  }
  return problems;
}

export function fixtureProblems(t, f) {
  const problems = validateSchema(readJson('fixture.schema.v1.json'), f);
  if (problems.length) return problems;
  if (f.bgg_id !== t.bgg_id) problems.push('fixture bgg_id does not match template');
  const coop = t.win_condition === 'cooperative';
  const [min, max] = t.supported_players;
  if (!coop && (f.players.length < min || f.players.length > max)) problems.push('fixture player count outside supported_players');
  if (coop && f.players.length !== 1) problems.push('cooperative fixture must have one entry for the team');
  const names = f.players.map((p) => p.name);
  if (new Set(names).size !== names.length) problems.push('duplicate player names');
  for (const p of f.players) for (const msg of checkInputs(t, p.scores)) problems.push(`${p.name}: ${msg}`);
  if (problems.length) return problems;
  if (!sameSet(Object.keys(f.expected.totals), names)) problems.push('expected.totals must list exactly the players');
  for (const p of f.players) {
    const total = playerTotal(t, p.scores);
    if (total !== f.expected.totals[p.name]) problems.push(`${p.name}: computed ${total}, expected ${f.expected.totals[p.name]}`);
  }
  const won = winners(t, f.players);
  if (!sameSet(won, f.expected.winner)) problems.push(`winner computed [${won}], expected [${f.expected.winner}]`);
  if (t.result_bands) {
    const band = resultBand(t, playerTotal(t, f.players[0].scores));
    if (band !== f.expected.result_band) problems.push(`result band computed ${band}, expected ${f.expected.result_band}`);
  }
  return problems;
}

export function validateAll() {
  const results = [];
  for (const file of readdirSync(join(root, 'templates')).filter((n) => n.endsWith('.json')).sort()) {
    const problems = [];
    let t;
    try { t = readJson('templates', file); } catch (e) { results.push({ file, problems: [`unreadable: ${e.message}`] }); continue; }
    const m = /^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(file);
    if (!m) problems.push('file name must be <bgg_id>-<slug>.json');
    else if (Number(m[1]) !== t.bgg_id) problems.push('file name bgg_id does not match template');
    problems.push(...templateProblems(t));
    if (!problems.length) {
      try { problems.push(...fixtureProblems(t, readJson('fixtures', `${t.bgg_id}.json`))); }
      catch (e) { problems.push(`fixture: ${e.message}`); }
    }
    results.push({ file, problems });
  }
  const fixtureFiles = readdirSync(join(root, 'fixtures')).filter((n) => n.endsWith('.json'));
  const templateIds = results.map((r) => r.file.split('-')[0]);
  for (const f of fixtureFiles) {
    if (!templateIds.includes(f.replace('.json', ''))) results.push({ file: `fixtures/${f}`, problems: ['fixture has no template'] });
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = validateAll();
  let bad = 0;
  for (const r of results) {
    if (r.problems.length) { bad++; console.error(`FAIL ${r.file}\n  ${r.problems.join('\n  ')}`); }
    else console.log(`ok   ${r.file}`);
  }
  console.log(`${results.length - bad}/${results.length} templates valid`);
  process.exit(bad ? 1 : 0);
}
