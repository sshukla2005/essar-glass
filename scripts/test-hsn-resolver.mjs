#!/usr/bin/env node
// Unit tests for frontend/src/utils/hsnResolver.js (the batching used by the PDF
// generator and InvoiceForm). The repo has no frontend test runner, so this uses
// node's built-in one.
//
// Run from the repo root:  node --test scripts/test-hsn-resolver.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src', 'utils', 'hsnResolver.js')
const { resolveHsnFor, distinctHsnCodes, hsnRequestItem } =
  await import('data:text/javascript,' + encodeURIComponent(readFileSync(file, 'utf8')))

// Stand-in for POST /hsn-mappings/resolve-batch: records calls, answers from a table
const fakeServer = (table) => {
  const calls = []
  const fetchBatch = async (items) => {
    calls.push(items)
    return { codes: items.map(i => table(i)) }
  }
  return { calls, fetchBatch }
}

const serverRules = (i) => {
  if (i.product_id === 7) return '7007'                       // product with its own code
  const t = (i.glass_type || '').trim().toLowerCase()
  const c = (i.glass_category || '').trim().toLowerCase()
  if (t === 'annealed' && c === 'clear') return '70052990'
  if (t === 'toughened') return '70071900'
  return '70051090'                                            // server default
}

// 20 groups using 4 distinct type/category/product combinations, with messy spacing and case
const twentyGroups = Array.from({ length: 20 }, (_, n) => [
  { glass_type: 'Annealed', glass_category: 'Clear' },
  { glass_type: ' annealed ', glass_category: 'CLEAR ' },      // same key as above once normalized
  { glass_type: 'Toughened', glass_category: 'Tinted' },
  { product_id: 7, glass_type: 'Toughened' },
  { glass_type: 'Unobtanium' },
][n % 5])

test('a 20-group quotation makes exactly one request', async () => {
  const { calls, fetchBatch } = fakeServer(serverRules)
  await resolveHsnFor(twentyGroups, fetchBatch)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].length, 4, 'one entry per distinct product/type/category')
})

test('every group gets its resolved code (the value the PDF prints)', async () => {
  const { fetchBatch } = fakeServer(serverRules)
  const codeFor = await resolveHsnFor(twentyGroups, fetchBatch)
  const printed = twentyGroups.map(g => ({ ...g, hsn: codeFor(g) }))   // same mapping as pdfGenerator
  assert.deepEqual(printed.slice(0, 5).map(g => g.hsn), ['70052990', '70052990', '70071900', '7007', '70051090'])
  assert.deepEqual(distinctHsnCodes(printed, g => g.hsn), ['70052990', '70071900', '7007', '70051090'])
})

test("a product's own code comes back unchanged", async () => {
  const { fetchBatch } = fakeServer(serverRules)
  const codeFor = await resolveHsnFor([{ product_id: 7, glass_type: 'DGU' }], fetchBatch)
  assert.equal(codeFor({ product_id: 7, glass_type: 'DGU' }), '7007')
})

test('the server default is used when nothing matches', async () => {
  const { fetchBatch } = fakeServer(serverRules)
  const codeFor = await resolveHsnFor([{ glass_type: 'Nope' }], fetchBatch)
  assert.equal(codeFor({ glass_type: 'Nope' }), '70051090')
})

test('no request when the document has no glass', async () => {
  const { calls, fetchBatch } = fakeServer(serverRules)
  const codeFor = await resolveHsnFor([], fetchBatch)
  assert.equal(calls.length, 0)
  assert.equal(codeFor({ glass_type: 'Annealed' }), null)
})

test('a failed request gives null (printed as a dash), never a guessed code', async () => {
  const codeFor = await resolveHsnFor(twentyGroups, async () => { throw new Error('offline') })
  assert.equal(codeFor(twentyGroups[0]), null)
})

test('only product_id, glass_type and glass_category are sent', () => {
  assert.deepEqual(hsnRequestItem({ product_id: 3, glass_type: 'A', glass_category: 'B', rate: 9, sizes: [] }),
    { product_id: 3, glass_type: 'A', glass_category: 'B' })
})
