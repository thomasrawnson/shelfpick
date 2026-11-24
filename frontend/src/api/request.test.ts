import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request, responseError, FieldValidationError } from './request.ts'

test('network failure can be explicitly retried successfully; mutations are not replayed', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { if (++calls === 1) throw new TypeError('offline'); return Response.json({ saved: true }) }
  try {
    await assert.rejects(request('http://fixture', { method: 'POST' }), /Check your connection/)
    assert.equal(calls, 1)
    assert.deepEqual(await (await request('http://fixture', { method: 'POST' })).json(), { saved: true })
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})

test('stalled headers and stalled bodies both become recoverable, including non-abortable fetch', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = () => new Promise(() => {})
    await assert.rejects(request('http://fixture', {}, 5), /took too long/)
    globalThis.fetch = async () => new Response(new ReadableStream({ start() {} }))
    await assert.rejects(request('http://fixture', { method: 'POST' }, 5), /may have completed/)
    globalThis.fetch = async () => Response.json({ recovered: true })
    assert.equal((await request('http://fixture')).status, 200)
  } finally { globalThis.fetch = original }
})

test('HTTP authentication failures and no-content responses retain their status', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ detail: 'Expired' }, { status: 401 })
    assert.equal((await request('http://fixture')).status, 401)
    globalThis.fetch = async () => new Response(null, { status: 204 })
    assert.equal((await request('http://fixture')).status, 204)
  } finally { globalThis.fetch = original }
})

test('backend field validation is mapped without exposing submitted input', async () => {
  const error = await responseError(Response.json({ detail: [{loc: ['body', 'password'], msg: 'Use at least 8 characters', input: 'secret'}] }), 'Failed')
  assert.ok(error instanceof FieldValidationError)
  assert.deepEqual(error.fields, { password: 'Use at least 8 characters' })
  assert.ok(!JSON.stringify(error).includes('secret'))
})

test('a native iOS HTTP failure (NSURLErrorDomain) is reported as a lost connection, like a fetch TypeError', async () => {
  const original = globalThis.fetch
  const native = Object.assign(new Error('The Internet connection appears to be offline.'), { code: 'NSURLErrorDomain' })
  try {
    globalThis.fetch = async () => { throw native }
    const error = await request('http://fixture', { method: 'POST' }).catch((caught: unknown) => caught) as Error
    assert.match(error.message, /Check your connection/)
    assert.equal(error.cause, native)
  } finally { globalThis.fetch = original }
})
