#!/usr/bin/env node
// Unit tests for frontend/src/utils/shipTo.js (Ship To on quotation / SO PDFs).
// Run from the repo root:  node --test scripts/test-ship-to.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src', 'utils', 'shipTo.js')
const { customerShippingAddress, defaultShipToText, formatAddressText, resolveShipToParty } =
  await import('data:text/javascript,' + encodeURIComponent(readFileSync(file, 'utf8')))

const billing = {
  name: 'Patel Construction', address: '12 MG Road', address_line2: 'Near Station', city: 'Virar',
  state: 'Maharashtra', state_name: 'Maharashtra', pincode: '401305', phone: '99999', gstin: '27AAAAA0000A1Z5',
}
const customerSame = { ...billing }
const customerSite = {
  ...billing, ship_same_as_billing: false, ship_address: 'Plot 7, MIDC', ship_address_line2: 'Gate 2',
  ship_city: 'Vasai', ship_state: 'Maharashtra', ship_pincode: '401208',
}

test('no separate shipping address: Ship To is the same as Bill To (null)', () => {
  assert.equal(customerShippingAddress(customerSame), null)
  assert.equal(customerShippingAddress({ ...billing, ship_same_as_billing: true, ship_address: 'x' }), null)
  assert.equal(resolveShipToParty(billing, customerSame, ''), null)
})

test('customer master shipping address is used when the document has none', () => {
  const p = resolveShipToParty(billing, customerSite, '')
  assert.deepEqual([p.address, p.address_line2, p.city, p.state, p.pincode], ['Plot 7, MIDC', 'Gate 2', 'Vasai', 'Maharashtra', '401208'])
  assert.equal(p.name, 'Patel Construction')
  assert.equal(p.gstin, billing.gstin)
})

test("the document's own Ship To text wins over the master", () => {
  const p = resolveShipToParty(billing, customerSite, 'Site office\nBlock C, Nalasopara')
  assert.equal(p.address, 'Site office\nBlock C, Nalasopara')
  assert.equal(p.city, '')
})

test('old documents that stored the billing street line print the same as today', () => {
  assert.equal(resolveShipToParty(billing, customerSame, '12 MG Road'), null)
  assert.equal(resolveShipToParty(billing, customerSame, ' 12 mg road, '), null)
  assert.equal(resolveShipToParty(billing, customerSame, formatAddressText(billing)), null)
})

test('pre-fill text for a new quotation / SO', () => {
  assert.equal(defaultShipToText(customerSame), '')
  assert.equal(defaultShipToText(customerSite), 'Plot 7, MIDC\nGate 2\nVasai, Maharashtra, 401208')
  // and printing that pre-filled text gives the shipping address, not billing
  assert.equal(resolveShipToParty(billing, customerSite, defaultShipToText(customerSite)).address,
    'Plot 7, MIDC\nGate 2\nVasai, Maharashtra, 401208')
})
