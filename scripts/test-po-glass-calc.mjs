#!/usr/bin/env node
// Unit tests for frontend/src/utils/poGlassCalc.js (Purchase Order glass Sqft and
// Amount). The repo has no frontend test runner, so this uses node's built-in one.
//
// Run from the repo root:  node --test scripts/test-po-glass-calc.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src', 'utils', 'poGlassCalc.js')
const po = await import('data:text/javascript,' + encodeURIComponent(readFileSync(file, 'utf8')))
const {
  poGlassSqft, poGlassAmount, applyGlassSizeEdit, clearSqftOverride, applyOtherItemEdit,
  glassSizeFromSavedLine, glassSizeFromSource, groupFlatGlassLines, createEmptyGlassSize, PO_COST_CEILING_IN,
} = po

const row = (over = {}) => ({ ...createEmptyGlassSize(), ...over })

// ── Formula ─────────────────────────────────────────────────────────────────

test('24 x 36 in, qty 2, 3" ceiling = 12 sqft exactly', () => {
  assert.equal(PO_COST_CEILING_IN, 3)
  // ceil(24/3)*3 = 24, ceil(36/3)*3 = 36 -> 24 * 36 * 2 / 144 = 12
  assert.equal(poGlassSqft(24, 36, 2), 12)
})

test('sizes off the 3" grid round up before multiplying', () => {
  // 25 -> 27, 37 -> 39: 27 * 39 / 144 = 7.3125
  assert.equal(poGlassSqft(25, 37, 1), 7.3125)
  // 24.1 -> 27, 36 -> 36, qty 3: 27 * 36 * 3 / 144 = 20.25
  assert.equal(poGlassSqft(24.1, 36, 3), 20.25)
})

test('missing width or height gives 0 sqft', () => {
  assert.equal(poGlassSqft(0, 36, 2), 0)
  assert.equal(poGlassSqft(24, null, 2), 0)
})

// ── Editing ─────────────────────────────────────────────────────────────────

test('editing W, H or Qty recalculates Sqft and Amount', () => {
  let r = row({ unit_price: 40 })
  r = applyGlassSizeEdit(r, 'width_inch', 24)
  r = applyGlassSizeEdit(r, 'height_inch', 36)
  assert.equal(r.sqft, 6)
  assert.equal(r.subtotal, 240)
  r = applyGlassSizeEdit(r, 'quantity', 2)
  assert.equal(r.sqft, 12)
  assert.equal(r.subtotal, 480)
  assert.equal(r.sqft_manual, false)
})

test('typing Sqft sets the override, and later W/H/Qty edits leave it alone', () => {
  let r = row({ width_inch: 24, height_inch: 36, quantity: 2, sqft: 12, unit_price: 40, subtotal: 480 })
  r = applyGlassSizeEdit(r, 'sqft', 12.5)
  assert.equal(r.sqft_manual, true)
  assert.equal(r.subtotal, 500)
  r = applyGlassSizeEdit(r, 'width_inch', 48)
  r = applyGlassSizeEdit(r, 'height_inch', 48)
  r = applyGlassSizeEdit(r, 'quantity', 5)
  assert.equal(r.sqft, 12.5, 'typed Sqft kept')
  assert.equal(r.subtotal, 500, 'Amount still follows the typed Sqft')
})

test('clearing the override recalculates from W/H/Qty', () => {
  let r = row({ width_inch: 24, height_inch: 36, quantity: 2, sqft: 12.5, sqft_manual: true, unit_price: 40, subtotal: 500 })
  r = clearSqftOverride(r)
  assert.equal(r.sqft_manual, false)
  assert.equal(r.sqft, 12)
  assert.equal(r.subtotal, 480)
})

test('glass Amount = Sqft x unit cost on every edit, including a unit cost change', () => {
  let r = row({ width_inch: 24, height_inch: 36, quantity: 2, sqft: 12, unit_price: 40, subtotal: 480 })
  r = applyGlassSizeEdit(r, 'unit_price', 45.5)
  assert.equal(r.subtotal, 546)             // 12 * 45.5, not qty 2 * 45.5 = 91
  assert.equal(poGlassAmount(12, 45.5), 546)
})

test('editing remarks changes nothing else', () => {
  const r = row({ width_inch: 24, height_inch: 36, quantity: 2, sqft: 12.5, unit_price: 40, subtotal: 480 })
  const n = applyGlassSizeEdit(r, 'remarks', 'rush')
  assert.equal(n.sqft, 12.5)
  assert.equal(n.subtotal, 480)
})

// ── Hardware / labour / wastage ────────────────────────────────────────────

test('hardware, labour and wastage Amount stays qty x unit cost', () => {
  let item = { description: 'Hinge', quantity: 1, unit_price: 0, subtotal: 0 }
  item = applyOtherItemEdit(item, 'quantity', 4)
  item = applyOtherItemEdit(item, 'unit_price', 25)
  assert.equal(item.subtotal, 100)
  assert.equal(item.sqft, undefined, 'no Sqft on these lines')
  assert.equal(applyOtherItemEdit(item, 'description', 'Handle').subtotal, 100)
})

// ── Rows from a Sales Order / Workshop Order ───────────────────────────────

test('an SO-created row inherits Sqft, is not overridden, and Amount = Sqft x cost', () => {
  const r = glassSizeFromSource({ key: 1, width_inch: 24, height_inch: 36, sqft: 13.0625, quantity: 2, unit_price: 40 })
  assert.equal(r.sqft, 13.0625, 'inherited value kept even though the 3" formula gives 12')
  assert.equal(r.sqft_manual, false)
  assert.equal(r.subtotal, 522.5)
  const edited = applyGlassSizeEdit(r, 'quantity', 3)
  assert.equal(edited.sqft, 18, 'not overridden, so a Qty edit recalculates')
})

test('groupFlatGlassLines with the source mapper marks every row not overridden', () => {
  const lines = [
    { description: 'A', width_inch: 24, height_inch: 36, sqft: 12, quantity: 2, unit_price: 10 },
    { description: 'A', width_inch: 30, height_inch: 30, sqft: 99, quantity: 1, unit_price: 10 },
  ]
  const groups = groupFlatGlassLines(lines, (l, key) => glassSizeFromSource({ ...l, key }))
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].sizes.map(s => [s.sqft, s.sqft_manual, s.subtotal]), [[12, false, 120], [99, false, 990]])
})

// ── Saved POs ───────────────────────────────────────────────────────────────

const savedLines = [
  // silently repriced earlier: stored amount = qty * price (2 * 40), not sqft * price (480)
  { description: 'G', width_inch: 24, height_inch: 36, sqft: 12, quantity: 2, unit_price: 40, subtotal: 80 },
  // stored amount 0 while price > 0: the old loader recomputed this on screen
  { description: 'G', width_inch: 24, height_inch: 36, sqft: 12, quantity: 2, unit_price: 40, subtotal: 0 },
  // typed Sqft saved before the override flag existed
  { description: 'H', width_inch: 24, height_inch: 36, sqft: 12.5, quantity: 2, unit_price: 40, subtotal: 500 },
  // saved with the flag
  { description: 'H', width_inch: 24, height_inch: 36, sqft: 15, sqft_manual: true, quantity: 2, unit_price: 40, subtotal: 600 },
]

test('loading a saved PO shows stored amounts and Sqft unchanged', () => {
  const before = JSON.stringify(savedLines)
  const sizes = groupFlatGlassLines(savedLines).flatMap(g => g.sizes)
  assert.deepEqual(sizes.map(s => s.subtotal), [80, 0, 500, 600])
  assert.deepEqual(sizes.map(s => s.sqft), [12, 12, 12.5, 15])
  assert.equal(JSON.stringify(savedLines), before, 'the stored lines themselves are not mutated')
})

test('a saved line is repriced only when that row is edited', () => {
  const s = glassSizeFromSavedLine(savedLines[0], 1)
  assert.equal(s.subtotal, 80)
  assert.equal(applyGlassSizeEdit(s, 'unit_price', 40).subtotal, 480)
})

test('override flag on load: stored flag wins; legacy typed Sqft counts as overridden', () => {
  assert.equal(glassSizeFromSavedLine(savedLines[0], 1).sqft_manual, false)  // matches the formula
  assert.equal(glassSizeFromSavedLine(savedLines[2], 1).sqft_manual, true)   // 12.5 != 12, no flag saved
  assert.equal(glassSizeFromSavedLine(savedLines[3], 1).sqft_manual, true)
  assert.equal(glassSizeFromSavedLine({ ...savedLines[2], sqft_manual: false }, 1).sqft_manual, false)
})
