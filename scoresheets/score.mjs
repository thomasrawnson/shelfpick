// Scoring engine for scoresheet templates. Pure functions, no I/O.
// Semantics are documented in SCHEMA.md.

function rawValue(category, value) {
  if (value === undefined) return category.scope === 'per_round' ? [] : 0;
  return value;
}

/** Sum of the raw inputs for one category (booleans count as 1/0, per-round arrays are summed). */
export function rawTotal(category, value) {
  const v = rawValue(category, value);
  if (category.type === 'boolean') return v ? 1 : 0;
  return Array.isArray(v) ? v.reduce((a, b) => a + b, 0) : v;
}

export function categoryPoints(category, value) {
  return rawTotal(category, value) * category.points_per;
}

export function playerTotal(template, scores) {
  return template.categories.reduce((sum, c) => sum + categoryPoints(c, scores[c.id]), 0);
}

/** Returns a list of input problems for one player's scores (empty when valid). */
export function checkInputs(template, scores) {
  const problems = [];
  const byId = new Map(template.categories.map((c) => [c.id, c]));
  for (const id of Object.keys(scores)) {
    if (!byId.has(id)) problems.push(`unknown category ${id}`);
  }
  for (const c of template.categories) {
    const v = scores[c.id];
    if (v === undefined) continue;
    const list = c.scope === 'per_round' ? v : [v];
    if (c.scope === 'per_round') {
      if (!Array.isArray(v)) { problems.push(`${c.id}: per_round needs an array`); continue; }
      if (template.rounds !== null && v.length !== template.rounds) problems.push(`${c.id}: needs ${template.rounds} rounds`);
    } else if (Array.isArray(v)) {
      problems.push(`${c.id}: once-scope needs a single value`); continue;
    }
    for (const item of list) {
      if (c.type === 'boolean') {
        if (typeof item !== 'boolean') problems.push(`${c.id}: must be true or false`);
      } else if (typeof item !== 'number') {
        problems.push(`${c.id}: must be a number`);
      } else if (c.type === 'count' && (!Number.isInteger(item) || item < 0)) {
        problems.push(`${c.id}: count must be a whole number, 0 or more`);
      } else if (c.type === 'number' && item < 0 && !c.allow_negative) {
        problems.push(`${c.id}: negative values are not allowed`);
      }
    }
  }
  return problems;
}

export function resultBand(template, total) {
  if (!template.result_bands) return null;
  const bands = [...template.result_bands].sort((a, b) => b.min_total - a.min_total);
  return bands.find((b) => total >= b.min_total)?.label ?? null;
}

/** Winner names for a competitive game; [] for cooperative games or a target not yet reached. */
export function winners(template, players) {
  if (template.win_condition === 'cooperative') return [];
  const rows = players.map((p) => ({ name: p.name, scores: p.scores, total: playerTotal(template, p.scores) }));
  let pool = rows;
  if (template.win_condition === 'target') {
    pool = rows.filter((r) => r.total >= template.target_score);
    if (pool.length === 0) return [];
  }
  const best = (list, key, dir) => {
    const target = dir === 'lower' ? Math.min(...list.map(key)) : Math.max(...list.map(key));
    return list.filter((r) => key(r) === target);
  };
  pool = best(pool, (r) => r.total, template.win_condition === 'lowest' ? 'lower' : 'higher');
  const byId = new Map(template.categories.map((c) => [c.id, c]));
  for (const id of template.tie_breakers) {
    if (pool.length === 1 || id === 'shared') break;
    const c = byId.get(id);
    pool = best(pool, (r) => rawTotal(c, r.scores[id]), c.tie_break_direction ?? 'higher');
  }
  return pool.map((r) => r.name);
}
