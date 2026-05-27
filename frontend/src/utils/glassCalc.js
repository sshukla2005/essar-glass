// ── Read settings from localStorage ───────────────────────────
export const getSettings = () => {
  try {
    return JSON.parse(localStorage.getItem('glass_calc_settings') || '{}')
  } catch {
    return {}
  }
}

// ── CEILING function (same as Excel CEILING) ──────────────────
const ceiling = (value, significance) => {
  if (!significance) return value
  return Math.ceil(value / significance) * significance
}

// ── MAIN GLASS LINE CALCULATOR ────────────────────────────────
// All values come from settings — nothing hardcoded
export const calcGlassLine = (line) => {
  const s = getSettings()

  const w_mm   = line.width_mm  || 0
  const h_mm   = line.height_mm || 0
  const qty    = line.quantity  || 1
  const cep    = Boolean(line.cep)
  const method = line.pricing_method || 'per_sqft'
  const rate   = line.unit_price  || 0
  const rate_rft = line.rate_rft  || 0
  const disc   = line.discount_pct || 0
  const tax_rate = line.tax_rate  || s.default_gst_rate || 18

  // ── Convert mm → inches ───────────────────────────────────
  const factor  = s.mm_to_inch_factor || 0.03937
  const w_inch  = w_mm * factor
  const h_inch  = h_mm * factor

  // ── Area per piece (Excel: CEILING(W,6) × CEILING(H,6) / 144)
  const sqft_ceil = s.sqft_ceiling_inches || 6
  const sqft_div  = s.sqft_divisor || 144
  const area_sqft_pc = (ceiling(w_inch, sqft_ceil) * ceiling(h_inch, sqft_ceil)) / sqft_div
  const total_sqft   = parseFloat((area_sqft_pc * qty).toFixed(4))

  // ── Running feet (Excel: (W+H+W+H) / 12 × qty) ────────────
  const rft_div    = s.rft_divisor || 12
  const running_inch = (w_inch + h_inch) * 2 * qty
  const running_ft   = parseFloat((running_inch / rft_div).toFixed(4))

  // ── Charged size (Excel: CEILING(inch,3)) ─────────────────
  const chg_ceil    = s.charged_ceiling_inches || 3
  const chg_w_inch  = ceiling(w_inch, chg_ceil)
  const chg_h_inch  = ceiling(h_inch, chg_ceil)
  const charged_sqft = parseFloat(((chg_w_inch * chg_h_inch * qty) / sqft_div).toFixed(4))

  // ── CEP running ft (Excel: (W+H+W+H)/12 × qty × 7) ────────
  const cep_mult    = s.cep_rft_multiplier || 7
  const cep_rft     = parseFloat(((w_inch + h_inch) * 2 / rft_div * qty * cep_mult).toFixed(4))

  // ── Toughening charged size (+30mm) ────────────────────────
  const tgh_extra   = s.toughening_extra_mm || 30
  const tgh_w_mm    = w_mm + tgh_extra
  const tgh_h_mm    = h_mm + tgh_extra
  const sqmt_div    = s.sqmt_divisor || 1000000
  const tgh_sqmt    = parseFloat(((tgh_w_mm * tgh_h_mm * qty) / sqmt_div).toFixed(6))

  // ── Pricing ───────────────────────────────────────────────
  let effective_qty = qty
  if (method === 'per_sqft') effective_qty = cep ? charged_sqft : total_sqft
  else if (method === 'per_running_ft') effective_qty = running_ft
  else effective_qty = qty

  const sqft_amt  = effective_qty * rate
  const rft_amt   = (method === 'per_running_ft' ? 0 : running_ft * rate_rft)
  let subtotal    = sqft_amt + rft_amt
  subtotal        = parseFloat((subtotal * (1 - disc / 100)).toFixed(2))

  const tax_amt   = parseFloat((subtotal * tax_rate / 100).toFixed(2))
  const line_total = parseFloat((subtotal + tax_amt).toFixed(2))

  return {
    ...line,
    // Calculated fields
    w_inch:        parseFloat(w_inch.toFixed(4)),
    h_inch:        parseFloat(h_inch.toFixed(4)),
    area_sqft_pc:  parseFloat(area_sqft_pc.toFixed(4)),
    total_sqft,
    area_sqft:     total_sqft,
    running_ft,
    effective_qty: parseFloat(effective_qty.toFixed(4)),
    charged_w_inch: parseFloat(chg_w_inch.toFixed(4)),
    charged_h_inch: parseFloat(chg_h_inch.toFixed(4)),
    charged_sqft,
    cep_rft,
    tgh_w_mm,
    tgh_h_mm,
    tgh_sqmt,
    subtotal,
    tax_amount: tax_amt,
    line_total,
  }
}

// ── PROCESS CHARGE CALCULATOR ────────────────────────────────
export const calcProcessCharge = (process, lineData) => {
  const rate = process.rate || 0
  let amount = 0
  switch (process.charge_type) {
    case 'per_sqft':   amount = (lineData.total_sqft   || 0) * rate; break
    case 'per_rft':    amount = (lineData.running_ft   || 0) * rate; break
    case 'per_piece':  amount = (lineData.quantity     || 1) * rate; break
    case 'per_sqmt':   amount = (lineData.tgh_sqmt     || 0) * rate; break
    case 'fixed':      amount = rate; break
    default:           amount = rate
  }
  return parseFloat(amount.toFixed(2))
}

// ── TOUGHENING PO CALCULATOR ─────────────────────────────────
export const calcTougheningLine = (line) => {
  const s = getSettings()
  const tgh_extra = s.toughening_extra_mm || 30
  const sqmt_div  = s.sqmt_divisor || 1000000

  const w_mm = (line.width_mm  || 0) + tgh_extra
  const h_mm = (line.height_mm || 0) + tgh_extra
  const qty  = line.quantity || 1
  const rate = line.tgh_rate || 1200

  const sqmt   = parseFloat(((w_mm * h_mm * qty) / sqmt_div).toFixed(6))
  const amount = parseFloat((sqmt * rate).toFixed(2))

  return { ...line, tgh_w_mm: w_mm, tgh_h_mm: h_mm, tgh_sqmt: sqmt, tgh_amount: amount }
}

// ── QUOTATION TOTALS CALCULATOR ──────────────────────────────
export const calcQuotationTotals = (lines, processCharges, dcCharge, discount, isIGST) => {
  const s = getSettings()

  const subtotal1 = lines.reduce((sum, l) => sum + (l.subtotal || 0), 0)
  const processTot = processCharges.reduce((sum, p) => sum + (p.amount || 0), 0)
  const subtotal2  = subtotal1 + processTot + (dcCharge || 0)
  const subtotal3  = subtotal2 - (discount || 0)

  const cgst_rate = s.default_cgst_rate || 9
  const sgst_rate = s.default_sgst_rate || 9
  const igst_rate = s.default_igst_rate || 18

  const cgst = isIGST ? 0 : parseFloat((subtotal3 * cgst_rate / 100).toFixed(2))
  const sgst = isIGST ? 0 : parseFloat((subtotal3 * sgst_rate / 100).toFixed(2))
  const igst = isIGST ? parseFloat((subtotal3 * igst_rate / 100).toFixed(2)) : 0

  const grand_total = parseFloat((subtotal3 + cgst + sgst + igst).toFixed(2))

  return {
    subtotal1: parseFloat(subtotal1.toFixed(2)),
    process_total: parseFloat(processTot.toFixed(2)),
    dc_charge: dcCharge || 0,
    subtotal2: parseFloat(subtotal2.toFixed(2)),
    discount: discount || 0,
    subtotal3: parseFloat(subtotal3.toFixed(2)),
    cgst,
    sgst,
    igst,
    grand_total,
  }
}
