// Client "S.O." Excel sheet → glass groups, shared by the Quotation and Sales Order forms.
//
// Sheet layout (first sheet whose name contains "S.O."):
//   rows 1-5   "Order No:" | <no>   and   "Client…" | <name>
//   data rows  C: glass / item name (starts a new group; blank = same group as above)
//              D: CEP (Y/N)   E: width (inch)   F: height (inch)   G: qty
//              J: rate per running ft   N: rate per sqft
// Rows without a numeric width and height are skipped (titles, headers, totals).
import * as XLSX from 'xlsx'

export const SO_SHEET_NAME = 'S.O.'

// Thickness / glass type / category from a free-text item name ("Clear Toughened 12mm")
export const parseGlassDescription = (name, dropdownConfig) => {
  if (!name) return {}

  const result = {
    glass_thickness: null,
    glass_type: null,
    glass_category: null,
  }

  const str = name.trim()

  // ── Thickness: match patterns like "3.5mm", "6 mm", "10MM" ──
  const thicknessMatch = str.match(/(\d+(?:\.\d+)?)\s*mm/i)
  if (thicknessMatch) {
    result.glass_thickness = parseFloat(thicknessMatch[1])
  }

  // ── Glass Types (order matters — check longer names first) ──
  const glassTypes = dropdownConfig?.glass_types?.length
    ? dropdownConfig.glass_types
    : ['Annealed', 'Toughened', 'Laminated', 'DGU']

  // Type aliases for common abbreviations
  const GLASS_TYPE_SYNONYMS = {
    'toughened': ['tough', 'temp', 'tempered', 'tgh'],
    'annealed':  ['ann', 'float', 'normal'],
    'laminated': ['lam', 'pvb'],
    'dgu':       ['double glazed', 'insulated', 'igu'],
  }

  const sortedTypes = [...glassTypes].sort((a, b) => b.length - a.length)
  const strLowerType = str.toLowerCase()

  // Pass 1: direct substring match
  for (const t of sortedTypes) {
    if (strLowerType.includes(t.toLowerCase())) {
      result.glass_type = t
      break
    }
  }

  // Pass 2: synonym match if Pass 1 found nothing
  if (!result.glass_type) {
    for (const t of sortedTypes) {
      const aliases = GLASS_TYPE_SYNONYMS[t.toLowerCase()] || []
      if (aliases.some(alias => strLowerType.includes(alias))) {
        result.glass_type = t
        break
      }
    }
  }

  // ── Glass Categories ──
  const glassCategories = dropdownConfig?.categories?.length
    ? dropdownConfig.categories
    : ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']

  // Category aliases for common client Excel abbreviations not in the master list
  const GLASS_CAT_SYNONYMS = {
    'clear':      ['plain clear', 'fl clear', 'float clear'],
    'xtra clear': ['extra clear', 'xtraclear', 'low iron', 'optiwhite', 'diamant'],
    'tinted':     ['frosted', 'frost', 'obscure', 'satin', 'acid', 'etched', 'colored', 'coloured'],
    'reflective': ['solar', 'coated', 'spandrel'],
    'mirror':     ['mir', 'silvered'],
  }

  const sortedCats = [...glassCategories].sort((a, b) => b.length - a.length)
  const strLowerCat = str.toLowerCase()

  // Pass 1: direct substring match
  for (const c of sortedCats) {
    if (strLowerCat.includes(c.toLowerCase())) {
      result.glass_category = c
      break
    }
  }

  // Pass 2: synonym match if Pass 1 found nothing
  if (!result.glass_category) {
    for (const c of sortedCats) {
      const aliases = GLASS_CAT_SYNONYMS[c.toLowerCase()] || []
      if (aliases.some(alias => strLowerCat.includes(alias))) {
        result.glass_category = c
        break
      }
    }
  }

  return result
}

const newGroup = (key, fields) => ({
  group_key: key,
  product_id: null,
  description: 'Imported Glass',
  glass_thickness: null,
  glass_type: null,
  glass_category: null,
  is_toughened: false,
  ceiling_inches: 6,
  rate: 0,
  rate_rft: 0,
  cep: false,
  cep_polish_rate: 15,
  cep_polish_rate_custom: null,
  pricing_method: 'per_sqft',
  discount_pct: 0,
  tax_rate: 18,
  custom_costing: true,
  manual_rate: null,
  cep_rft_multiplier: null,
  sizes: [],
  processes: [],
  ...fields,
})

// Product whose thickness/category/type match, else whose name matches the item name
const matchProduct = (itemName, parsed, products) => {
  let matched = null
  if (parsed.glass_thickness && parsed.glass_category) {
    matched = products.find(p =>
      p.thickness_mm === parsed.glass_thickness &&
      String(p.glass_category).toLowerCase() === String(parsed.glass_category).toLowerCase() &&
      (!parsed.glass_type || String(p.glass_type).toLowerCase() === String(parsed.glass_type).toLowerCase())
    )
  }
  if (!matched) {
    const itemLower = itemName.toLowerCase().trim()
    matched = [...products]
      .sort((a, b) => b.name.length - a.name.length)
      .find(p => {
        const prodLower = p.name.toLowerCase()
        if (itemLower.includes(prodLower) || prodLower.includes(itemLower)) return true
        const pWords = prodLower.split(/\s+/).filter(w => w !== 'mm' && w.length > 2)
        return pWords.length > 0 && pWords.every(w => itemLower.includes(w))
      })
  }
  return matched || null
}

/**
 * Read an S.O. workbook. Returns { orderNo, clientName, groups, totalItems, totalProducts }.
 * Throws an Error with a user-facing message when the sheet or its glass rows are missing.
 *   calcGroupSize(group, size)          → size with sqft / charged / subtotal filled in
 *   calcRateFromMatrix(category, thick) → ₹/sqft from the Glass Rate Matrix (0 if none)
 */
export const parseSalesOrderExcel = (buffer, { products = [], dropdownConfig, calcGroupSize, calcRateFromMatrix }) => {
  const wb = XLSX.read(buffer, { type: 'array' })
  const wsName = wb.SheetNames.find(n => n.includes(SO_SHEET_NAME))
  if (!wsName) throw new Error(`Could not find the "${SO_SHEET_NAME}" sheet in the Excel file`)
  const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, defval: null })

  let orderNo = null
  let clientName = null
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i]
    if (row && row[0] === 'Order No:') orderNo = row[1]
    if (row && String(row[0] || '').includes('Client')) clientName = row[1]
  }

  const groups = []
  let current = null
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i]
    if (!row) continue

    const itemName = row[2]  // Column C
    const cep = String(row[3] || '').toUpperCase() === 'Y'
    const w_inch = typeof row[4] === 'number' ? row[4] : null
    const h_inch = typeof row[5] === 'number' ? row[5] : null
    const qty = typeof row[6] === 'number' ? row[6] : null
    const rft_rate = typeof row[9] === 'number' ? row[9] : 0
    const sqft_rate = typeof row[13] === 'number' ? row[13] : 0

    if (!w_inch || !h_inch) continue

    if (itemName && typeof itemName === 'string' && itemName.trim()) {
      const parsed = parseGlassDescription(itemName.trim(), dropdownConfig)
      const product = matchProduct(itemName, parsed, products)
      let rate = sqft_rate || product?.sale_price || 0
      if (!rate && parsed.glass_category && parsed.glass_thickness) {
        rate = calcRateFromMatrix(parsed.glass_category, parsed.glass_thickness)
      }
      current = newGroup(Date.now() + Math.random() + i, {
        product_id: product?.id || null,
        description: itemName.trim(),
        glass_thickness: parsed.glass_thickness || product?.thickness_mm || null,
        glass_type: parsed.glass_type || null,
        glass_category: parsed.glass_category || null,
        is_toughened: parsed.glass_type === 'Toughened',
        rate,
        rate_rft: rft_rate || 0,
        cep,
      })
      groups.push(current)
    }

    if (!current) {
      current = newGroup(Date.now() + Math.random() + i, { rate: sqft_rate || 0, rate_rft: rft_rate || 0, cep })
      groups.push(current)
    }

    if (sqft_rate > 0) current.rate = sqft_rate
    if (rft_rate > 0) current.rate_rft = rft_rate

    current.sizes.push(calcGroupSize(current, {
      size_key: Date.now() + Math.random() + i,
      width_inch: w_inch,
      height_inch: h_inch,
      quantity: qty || 1,
    }))
  }

  if (groups.length === 0) throw new Error('No glass items found in the Excel file')

  return {
    orderNo,
    clientName,
    groups,
    totalItems: groups.reduce((s, g) => s + g.sizes.length, 0),
    totalProducts: groups.length,
  }
}

// Blank workbook in the S.O. format the import reads, with two example rows
export const downloadSalesOrderTemplate = () => {
  const header = ['Sr', '', 'Glass / Item (C)', 'CEP Y/N (D)', 'Width inch (E)', 'Height inch (F)', 'Qty (G)',
    '', '', 'Rate / RFT (J)', '', '', '', 'Rate / Sqft (N)']
  const rows = [
    ['Order No:', ''],
    ['Client Name:', ''],
    [],
    header,
    [1, '', 'Clear Toughened 12mm', 'N', 24, 36, 2, '', '', 0, '', '', '', 0],
    [2, '', '', 'N', 18.5, 30, 1, '', '', 0, '', '', '', 0],
    [3, '', 'Clear Annealed 5mm', 'Y', 12, 48, 4, '', '', 0, '', '', '', 0],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 3 }, { wch: 28 }, { wch: 11 }, { wch: 14 }, { wch: 15 }, { wch: 8 },
    { wch: 3 }, { wch: 3 }, { wch: 13 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, { wch: 14 }]
  const notes = XLSX.utils.aoa_to_sheet([
    ['How to fill the S.O. sheet'],
    ['Order No and Client Name go in column B of rows 1-2 (the client is matched to a customer).'],
    ['One row per size. Write the glass name in column C on the first size of each glass;'],
    ['leave C blank on the following sizes of the same glass.'],
    ['Width and height are in inches (decimals allowed, e.g. 18.5). Qty is pieces.'],
    ['CEP: Y or N. Rate / Sqft (N) is optional: when 0 the product price or Glass Rate Matrix is used.'],
    ['Rows without a width and height (titles, totals) are ignored. Replace the example rows with your sizes.'],
  ])
  notes['!cols'] = [{ wch: 100 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SO_SHEET_NAME)
  XLSX.utils.book_append_sheet(wb, notes, 'How to fill')
  XLSX.writeFile(wb, 'Sales_Order_Import_Template.xlsx')
}
