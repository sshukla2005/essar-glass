// Purchase Order glass-line math. The single place PurchaseOrderForm gets glass
// Sqft and Amount from. No imports, so scripts/test-po-glass-calc.mjs can run it
// under plain node.
//
//   Sqft   = ceil(W/3)*3 * ceil(H/3)*3 * qty / 144      (W, H in inches, 3" cost ceiling)
//   Amount = Sqft * unit cost                           (glass lines, always)
//
// Hardware, labour and wastage lines have no Sqft: Amount = qty * unit cost.
//
// A typed Sqft sets `sqft_manual`, and W/H/Qty edits then leave it alone until the
// override is cleared. Loading a saved PO shows the stored numbers unchanged; they
// are only recalculated when the user edits that row.

export const PO_COST_CEILING_IN = 3

const round = (v, dp) => parseFloat(Number(v || 0).toFixed(dp))
const ceilTo = (x, step) => Math.ceil(x / step) * step

export const poGlassSqft = (widthInch, heightInch, quantity) => {
  const w = Number(widthInch) || 0
  const h = Number(heightInch) || 0
  if (w <= 0 || h <= 0) return 0
  const qty = Number(quantity) || 1
  return round(ceilTo(w, PO_COST_CEILING_IN) * ceilTo(h, PO_COST_CEILING_IN) * qty / 144, 4)
}

export const poGlassAmount = (sqft, unitPrice) => round((Number(sqft) || 0) * (Number(unitPrice) || 0), 2)

// Fields whose edit re-derives Sqft (unless overridden) and Amount
const SQFT_INPUTS = ['width_inch', 'height_inch', 'quantity']
const AMOUNT_INPUTS = [...SQFT_INPUTS, 'sqft', 'unit_price']

/** A glass row after the user sets `field` to `value`. */
export const applyGlassSizeEdit = (size, field, value) => {
  const next = { ...size, [field]: value }
  if (field === 'sqft') next.sqft_manual = true
  if (SQFT_INPUTS.includes(field) && !next.sqft_manual) {
    next.sqft = poGlassSqft(next.width_inch, next.height_inch, next.quantity)
  }
  if (AMOUNT_INPUTS.includes(field)) next.subtotal = poGlassAmount(next.sqft, next.unit_price)
  return next
}

/** Drop a typed Sqft and go back to the formula (the row's "recalculate" action). */
export const clearSqftOverride = (size) => {
  const sqft = poGlassSqft(size.width_inch, size.height_inch, size.quantity)
  return { ...size, sqft_manual: false, sqft, subtotal: poGlassAmount(sqft, size.unit_price) }
}

/** Hardware / labour / wastage row after an edit: Amount = qty * unit cost. */
export const applyOtherItemEdit = (item, field, value) => {
  const next = { ...item, [field]: value }
  if (field === 'quantity' || field === 'unit_price') {
    next.subtotal = round((next.quantity || 1) * (next.unit_price || 0), 2)
  }
  return next
}

/**
 * Glass row for a line loaded from a saved PO. Shows exactly what was stored; nothing
 * is recalculated. Lines saved before the override flag existed count as overridden
 * when their stored Sqft doesn't match the formula, so a later W/H/Qty edit can't
 * silently replace a Sqft someone typed.
 */
export const glassSizeFromSavedLine = (line, key) => {
  const width_inch = line.width_inch ?? (line.width_mm ? round(line.width_mm / 25.4, 4) : 0)
  const height_inch = line.height_inch ?? (line.height_mm ? round(line.height_mm / 25.4, 4) : 0)
  const quantity = line.quantity || 1
  const sqft = line.sqft ?? 0
  const sqft_manual = typeof line.sqft_manual === 'boolean'
    ? line.sqft_manual
    : sqft > 0 && Math.abs(sqft - poGlassSqft(width_inch, height_inch, quantity)) > 0.005
  return {
    key,
    width_inch,
    height_inch,
    sqft,
    sqft_manual,
    quantity,
    unit_price: line.unit_price || 0,
    remarks: line.remarks || '',
    subtotal: line.subtotal ?? 0,
  }
}

/**
 * Glass row for a new PO built from a Sales Order or Workshop Order line: keeps the
 * inherited Sqft, is not overridden (so W/H/Qty edits recalculate it), and prices
 * Amount = Sqft * unit cost.
 */
export const glassSizeFromSource = ({ key, width_inch, height_inch, sqft, quantity, unit_price, remarks }) => {
  const s = Number(sqft) || 0
  return {
    key,
    width_inch: width_inch || 0,
    height_inch: height_inch || 0,
    sqft: s,
    sqft_manual: false,
    quantity: quantity || 1,
    unit_price: unit_price || 0,
    remarks: remarks || '',
    subtotal: poGlassAmount(s, unit_price),
  }
}

export const createEmptyGlassSize = () => ({
  key: Date.now() + Math.random(),
  width_inch: 0,
  height_inch: 0,
  sqft: 0,
  sqft_manual: false,
  quantity: 1,
  unit_price: 0,
  remarks: '',
  subtotal: 0,
})

export const createEmptyGlassGroup = (description = '', product_id = null) => ({
  key: Date.now() + Math.random(),
  description,
  product_id,
  sizes: [createEmptyGlassSize()],
})

/**
 * Group flat glass lines by description. `toSize(line, key)` builds each row:
 * glassSizeFromSavedLine for a saved PO, glassSizeFromSource for SO/WO lines.
 */
export const groupFlatGlassLines = (lines, toSize = glassSizeFromSavedLine) => {
  if (!lines || lines.length === 0) return [createEmptyGlassGroup()]
  const groupsMap = new Map()
  lines.forEach((l, idx) => {
    const descKey = (l.description || '').trim()
    if (!groupsMap.has(descKey)) {
      groupsMap.set(descKey, {
        key: Date.now() + idx + Math.random(),
        description: l.description || '',
        product_id: l.product_id || null,
        sizes: [],
      })
    }
    const group = groupsMap.get(descKey)
    if (!group.product_id && l.product_id) group.product_id = l.product_id
    group.sizes.push(toSize(l, l.id || l.key || (Date.now() + idx + Math.random())))
  })
  return Array.from(groupsMap.values())
}
