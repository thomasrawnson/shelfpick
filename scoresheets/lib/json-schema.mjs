// Minimal JSON Schema (2020-12 subset) validator, so scoresheets/ needs no dependencies.
// Supported keywords: type, enum, const, required, properties, additionalProperties,
// items, minItems, maxItems, minLength, minimum, pattern, $ref (to #/$defs/...).
// Any other keyword in a schema throws, so the subset cannot silently grow.

const IGNORED = new Set(['$schema', '$id', 'title', '$defs']);
const KNOWN = new Set([
  'type', 'enum', 'const', 'required', 'properties', 'additionalProperties',
  'items', 'minItems', 'maxItems', 'minLength', 'minimum', 'pattern', '$ref',
]);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  return type === actual || (type === 'number' && actual === 'integer');
}

export function validateSchema(root, value) {
  const errors = [];

  function walk(schema, data, path) {
    for (const key of Object.keys(schema)) {
      if (!KNOWN.has(key) && !IGNORED.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
    }
    if (schema.$ref) {
      const name = schema.$ref.replace('#/$defs/', '');
      walk(root.$defs[name], data, path);
      return;
    }
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((t) => matchesType(data, t))) {
        errors.push(`${path || '/'}: expected ${types.join('|')}, got ${typeOf(data)}`);
        return;
      }
    }
    if ('const' in schema && data !== schema.const) errors.push(`${path || '/'}: must equal ${JSON.stringify(schema.const)}`);
    if (schema.enum && !schema.enum.includes(data)) errors.push(`${path || '/'}: must be one of ${schema.enum.join(', ')}`);
    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) errors.push(`${path || '/'}: too short`);
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push(`${path || '/'}: does not match ${schema.pattern}`);
    }
    if (typeof data === 'number' && schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path || '/'}: below minimum ${schema.minimum}`);
    }
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`${path || '/'}: needs at least ${schema.minItems} items`);
      if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`${path || '/'}: allows at most ${schema.maxItems} items`);
      if (schema.items) data.forEach((item, i) => walk(schema.items, item, `${path}/${i}`));
    }
    if (typeOf(data) === 'object') {
      for (const key of schema.required ?? []) {
        if (!(key in data)) errors.push(`${path || '/'}: missing required property ${key}`);
      }
      const props = schema.properties ?? {};
      for (const [key, child] of Object.entries(data)) {
        if (key in props) walk(props[key], child, `${path}/${key}`);
        else if (schema.additionalProperties === false) errors.push(`${path}/${key}: unexpected property`);
        else if (typeof schema.additionalProperties === 'object') walk(schema.additionalProperties, child, `${path}/${key}`);
      }
    }
  }

  walk(root, value, '');
  return errors;
}
