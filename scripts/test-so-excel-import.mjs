// node --test scripts/test-so-excel-import.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { parseSalesOrderExcel, parseGlassDescription } from '../frontend/src/utils/soExcelImport.js'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const XLSX = require('xlsx')

const book = (rows, sheet = 'S.O.') => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
const opts = {
  products: [{ id: 7, name: 'Clear Toughened 12mm', thickness_mm: 12, glass_category: 'Clear', glass_type: 'Toughened', sale_price: 150 }],
  calcGroupSize: (g, s) => ({ ...s, total_sqft: s.width_inch * s.height_inch * s.quantity / 144, subtotal: g.rate }),
  calcRateFromMatrix: () => 42,
}

test('reads the S.O. sheet into glass groups and sizes', () => {
  const buf = book([
    ['Order No:', 'PO-77'],
    ['Client Name:', 'Shankar Sliding'],
    [],
    ['Sr', '', 'Glass / Item (C)', 'CEP', 'W', 'H', 'Qty', '', '', 'RFT', '', '', '', 'Sqft'],
    [1, '', 'Clear Toughened 12mm', 'N', 24, 36, 2, '', '', 0, '', '', '', 0],
    [2, '', '', 'N', 18.5, 30, 1, '', '', 0, '', '', '', 0],
    [3, '', 'Clear Annealed 5mm', 'Y', 12, 48, 4, '', '', 0, '', '', '', 55],
    ['', '', 'Total', '', '', '', 7],
  ])
  const r = parseSalesOrderExcel(buf, opts)
  assert.equal(r.orderNo, 'PO-77')
  assert.equal(r.clientName, 'Shankar Sliding')
  assert.equal(r.totalProducts, 2)
  assert.equal(r.totalItems, 3)
  const [a, b] = r.groups
  assert.equal(a.product_id, 7)                       // matched product
  assert.equal(a.rate, 150)                           // product sale price
  assert.equal(a.glass_thickness, 12)
  assert.equal(a.is_toughened, true)
  assert.deepEqual(a.sizes.map(s => [s.width_inch, s.height_inch, s.quantity]), [[24, 36, 2], [18.5, 30, 1]])
  assert.equal(b.cep, true)
  assert.equal(b.rate, 55)                            // rate from column N
  assert.equal(b.glass_type, 'Annealed')
})

test('falls back to the Glass Rate Matrix when there is no rate or product', () => {
  const r = parseSalesOrderExcel(book([[1, '', 'Tinted Annealed 6mm', 'N', 10, 10, 1]]), opts)
  assert.equal(r.groups[0].rate, 42)
})

test('clear errors for a missing sheet or no glass rows', () => {
  assert.throws(() => parseSalesOrderExcel(book([[1]], 'Sheet1'), opts), /Could not find the "S.O." sheet/)
  assert.throws(() => parseSalesOrderExcel(book([['Order No:', 'X']]), opts), /No glass items/)
})

test('parses glass descriptions', () => {
  assert.deepEqual(parseGlassDescription('Xtra Clear Toughened 3.5mm'), { glass_thickness: 3.5, glass_type: 'Toughened', glass_category: 'Xtra Clear' })
  assert.equal(parseGlassDescription('frosted tgh 8 mm').glass_category, 'Tinted')
})
