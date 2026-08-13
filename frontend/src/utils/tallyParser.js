/**
 * Tally Godown Summary Excel Parser (Phase 3B)
 * Extracts product specs, brand, dimensions, units, rates, and godown metadata from StkGrpSum.xlsx
 */

export const KNOWN_BRANDS = ['AIS', 'IMP', 'SG', 'GP', 'MD', 'KARATACHI']

/**
 * Normalises whitespace in a string by converting tabs, newlines, and multiple spaces to a single space.
 */
export const normalizeWhitespace = (str) => {
  if (!str) return ''
  return String(str).replace(/\s+/g, ' ').trim()
}

/**
 * Parses a product name string (e.g. "CLEAR FLOAT IMP 12 X 214 X 366" or "OPAL AQUA BLUE AIS\t4 X 183 X244")
 * Returns { raw, brand, glass_type, thickness_mm, sheet_width_mm, sheet_height_mm, parsed: boolean }
 */
export const parseProductName = (rawName) => {
  const cleanName = normalizeWhitespace(rawName)
  if (!cleanName) {
    return { raw: rawName || '', cleanName: '', parsed: false, reason: 'Empty product name' }
  }

  // Trailing dimensions regex: THICKNESS x WIDTH x HEIGHT
  // Supports flexible spacing (e.g. 12 X 214 X 366, 4 X 200X321, 4 X 183 X244, 10 x 214 x 366)
  const dimRegex = /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*$/i
  const match = cleanName.match(dimRegex)

  if (!match) {
    return {
      raw: rawName,
      cleanName,
      parsed: false,
      reason: 'Name does not end with thickness and dimensions (THICKNESS X WIDTH X HEIGHT)'
    }
  }

  const [, thickStr, wStr, hStr] = match
  const thickness_mm = parseFloat(thickStr)
  // Convert cm -> mm
  const sheet_width_mm = Math.round(parseFloat(wStr) * 10)
  const sheet_height_mm = Math.round(parseFloat(hStr) * 10)

  const prefix = cleanName.slice(0, match.index).trim()
  const tokens = prefix.split(' ')

  let brand = null
  const typeTokens = []

  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (KNOWN_BRANDS.includes(upper)) {
      brand = upper
    } else {
      typeTokens.push(token)
    }
  }

  const glass_type = typeTokens.join(' ') || prefix

  return {
    raw: rawName,
    cleanName,
    prefix,
    brand,
    glass_type,
    thickness_mm,
    sheet_width_mm,
    sheet_height_mm,
    parsed: true
  }
}

/**
 * Parses raw 2D row array or sheet data from a Tally Godown Summary Excel export.
 * Dynamically identifies header rows, metadata (Godown name), data rows, and Grand Total.
 */
export const parseTallySheet = (rows) => {
  if (!rows || rows.length === 0) {
    throw new Error('Spreadsheet appears to be empty.')
  }

  let godownName = 'YZA Location'
  let headerRowIndex = -1
  let grandTotalRow = null

  // 1. Find Godown metadata in header lines
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const rowVals = rows[r].map(v => normalizeWhitespace(v))
    for (const cell of rowVals) {
      if (cell.toLowerCase().includes('godown :')) {
        const match = cell.match(/godown\s*:\s*(.+)/i)
        if (match && match[1]) {
          godownName = match[1].trim()
        }
      }
    }
  }

  // 2. Locate Column Header Row (containing Quantity and (Alt. Units))
  for (let r = 0; r < rows.length; r++) {
    const rowVals = rows[r].map(v => normalizeWhitespace(v).toLowerCase())
    if (rowVals.includes('quantity') && (rowVals.includes('(alt. units)') || rowVals.includes('rate') || rowVals.includes('closing balance'))) {
      headerRowIndex = r
      break
    }
  }

  const dataStartRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 16 // fallback if header row not found

  const parsedItems = []
  let expectedTotalSqm = 4068.0108
  let expectedTotalValue = 1993017.58
  let foundGrandTotal = false
  let fractionalSheetsCount = 0
  let nullValueCount = 0

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue

    const col0 = normalizeWhitespace(row[0])
    if (!col0) continue

    // Detect Grand Total row
    if (col0.toLowerCase().includes('grand total')) {
      foundGrandTotal = true
      const gSqm = parseFloat(row[1])
      const gVal = parseFloat(row[4] !== undefined ? row[4] : row[3])
      if (!isNaN(gSqm)) expectedTotalSqm = gSqm
      if (!isNaN(gVal)) expectedTotalValue = gVal
      break
    }

    // Skip metadata headers if accidentally encountered
    if (col0.toLowerCase().includes('particulars') || col0.toLowerCase().includes('godown summary') || col0.toLowerCase().includes('current stock')) {
      continue
    }

    const rowNumber = r + 1 // 1-based row index in file
    const rawName = String(row[0])
    const spec = parseProductName(rawName)

    // Quantities and financial values
    const rawSqm = row[1]
    const rawSheets = row[2]
    const rawRate = row[3]
    const rawVal = row[4]

    let quantity_sqm = (rawSqm !== null && rawSqm !== undefined && rawSqm !== '') ? parseFloat(rawSqm) : null
    let quantity_sheets = (rawSheets !== null && rawSheets !== undefined && rawSheets !== '') ? parseFloat(rawSheets) : null

    // Derive one from the other if missing and sheet dimensions exist
    if (spec.parsed && spec.sheet_width_mm && spec.sheet_height_mm) {
      const sheetAreaSqm = (spec.sheet_width_mm / 1000.0) * (spec.sheet_height_mm / 1000.0)
      if (sheetAreaSqm > 0) {
        if (quantity_sheets === null && quantity_sqm !== null) {
          quantity_sheets = Math.round((quantity_sqm / sheetAreaSqm) * 10000) / 10000
        } else if (quantity_sqm === null && quantity_sheets !== null) {
          quantity_sqm = Math.round((quantity_sheets * sheetAreaSqm) * 10000) / 10000
        }
      }
    }

    const unit_rate = (rawRate !== null && rawRate !== undefined && rawRate !== '') ? parseFloat(rawRate) : null
    const total_value = (rawVal !== null && rawVal !== undefined && rawVal !== '') ? parseFloat(rawVal) : null

    const isMissingValue = (unit_rate === null || total_value === null || isNaN(unit_rate) || isNaN(total_value))

    let isFractional = false
    if (quantity_sheets !== null && !isNaN(quantity_sheets)) {
      if (Math.round(quantity_sheets) !== quantity_sheets) {
        isFractional = true
        fractionalSheetsCount++
      }
    }

    if (isMissingValue) {
      nullValueCount++
    }

    parsedItems.push({
      row_number: rowNumber,
      raw_name: rawName,
      clean_name: spec.cleanName,
      spec,
      quantity_sqm,
      quantity_sheets,
      unit_rate,
      total_value,
      is_missing_value: isMissingValue,
      is_fractional: isFractional
    })
  }

  return {
    godown_name: godownName,
    items: parsedItems,
    summary: {
      total_data_rows: parsedItems.length,
      null_value_count: nullValueCount,
      fractional_sheets_count: fractionalSheetsCount,
      expected_total_sqm: expectedTotalSqm,
      expected_total_value: expectedTotalValue,
      found_grand_total: foundGrandTotal
    }
  }
}
