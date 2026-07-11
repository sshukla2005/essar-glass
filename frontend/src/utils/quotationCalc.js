// ── Shared Quotation/Sales-Order calculation engine ──────────────────────
// Single source of truth for glass pricing math, used by BOTH
// QuotationForm and SalesOrderForm. Any formula change happens HERE only.
//
// Reads from localStorage: 'glass_rate_matrix', 'process_masters'.
// `products` (the products master array) is passed in explicitly.

export const getGroupBaseCostRate = (g, products) => {
  let costPerSqft = g.manual_cost_price || 0
  if (!costPerSqft) {
    const prod = (products || []).find(p => p.id === g.product_id)
    if (prod?.cost_price) {
      costPerSqft = prod.cost_price
    } else if (g.glass_category && g.glass_thickness) {
      try {
        const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
        const costRate = matrix?.cost_rates?.[g.glass_category]
        if (costRate) costPerSqft = parseFloat((parseFloat(g.glass_thickness) * costRate / 10.764).toFixed(2))
      } catch { }
    }
    if (!costPerSqft && (g.base_glass_rate || g.rate) > 0) {
      costPerSqft = parseFloat(((g.base_glass_rate || g.rate) * 0.70).toFixed(2))
    }
  }
  return costPerSqft
}

/**
 * Single source of truth for "what does this glass actually cost per sqft,
 * fully loaded" — base cost + toughening addon, with one consistent rule
 * for whether the addon gets added on top:
 *
 *   - If `manual_cost_price` is NOT set: the base cost is derived (product /
 *     matrix / 0.70-fallback) and the toughening addon is computed fresh and
 *     added on top. This is the "system is pricing it for you" path.
 *
 *   - If `manual_cost_price` IS set: it is treated as the FULLY LOADED cost
 *     already (this is what the Cost Analysis wizard saves). The addon
 *     is NOT added again on top of it — doing so would silently compound
 *     the toughening charge every time this function runs.
 *
 * Returns { loadedCost, baseCost, addon, isManual }.
 */
export const getGroupLoadedCostRate = (g, products) => {
  const isManual = !!(g.manual_cost_price && g.manual_cost_price > 0)

  if (isManual) {
    // manual_cost_price already represents the loaded total — addon is
    // informational only here (e.g. for a breakdown subtext), never re-applied.
    return { loadedCost: g.manual_cost_price, baseCost: g.manual_cost_price, addon: 0, isManual: true }
  }

  const baseCost = getGroupBaseCostRate(g, products)
  let addon = 0

  if (g.is_toughened || g.glass_type === 'Toughened') {
    try {
      const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
      const toughProc = pm.find(p => p.process_type === 'toughening' && p.is_active !== false)
      if (toughProc && toughProc.rate > 0) {
        const avgAddon = g.sizes && g.sizes.length > 0
          ? g.sizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / g.sizes.length
          : 0
        if (avgAddon > 0) addon = avgAddon
      }
    } catch { }
  }

  const loadedCost = parseFloat((baseCost + addon).toFixed(2))
  return { loadedCost, baseCost, addon, isManual: false }
}

export const calcGroupSize = (group, size, products) => {
  const w_inch = size.width_inch || 0
  const h_inch = size.height_inch || 0
  const qty = size.quantity || 1

  // Separate ceiling for W and H
  const ceilW = group.ceiling_w_inches ?? group.ceiling_inches ?? 6
  const ceilH = group.ceiling_h_inches ?? group.ceiling_inches ?? 6

  const ceilFnW = (x) => {
    if (ceilW === 'plus30mm') return x + (30 / 25.4)
    if (ceilW === 'custom') {
      const customMm = group.ceiling_w_custom_mm || 30
      return x + (customMm / 25.4)
    }
    return Math.ceil(x / ceilW) * ceilW
  }
  const ceilFnH = (x) => {
    if (ceilH === 'plus30mm') return x + (30 / 25.4)
    if (ceilH === 'custom') {
      const customMm = group.ceiling_h_custom_mm || 30
      return x + (customMm / 25.4)
    }
    return Math.ceil(x / ceilH) * ceilH
  }
  const area_sqft_pc = (ceilFnW(w_inch) * ceilFnH(h_inch)) / 144
  const total_sqft = area_sqft_pc * qty
  const running_ft = (w_inch + h_inch) * 2 * qty / 12
  const charged_w_inch = parseFloat(ceilFnW(w_inch).toFixed(4))
  const charged_h_inch = parseFloat(ceilFnH(h_inch).toFixed(4))
  const charged_sqft = (charged_w_inch * charged_h_inch * qty) / 144
  const getCepMultiplier = () => {
    if (group.cep_rft_multiplier) return group.cep_rft_multiplier
    try {
      const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
      return matrix?.cep_rft_default || 5
    } catch { return 5 }
  }
  const cepMult = getCepMultiplier()
  const cep_rft = parseFloat(((w_inch + h_inch) * 2 / 12 * qty * cepMult).toFixed(4))
  const tgh_sqmt = ((size.width_inch || 0) * 25.4 + 30) * ((size.height_inch || 0) * 25.4 + 30) * qty / 1000000

  let cep_charges = 0
  if (group.cep) {
    if (group.cep_polish_rate === 'custom') {
      // Custom rate per running foot
      const polishRate = group.cep_polish_rate_custom ?? 0
      cep_charges = parseFloat((running_ft * polishRate).toFixed(2))
    } else if (group.cep_polish_rate === 'custom_mm') {
      // Custom rate per mm of perimeter (2 × W + 2 × H in mm)
      const perimeterMm = ((w_inch + h_inch) * 2 * 25.4) * qty
      const polishRateMm = group.cep_polish_rate_custom ?? 0
      cep_charges = parseFloat((perimeterMm * polishRateMm).toFixed(2))
    } else {
      const polishRate = group.cep_polish_rate || 15
      cep_charges = parseFloat((running_ft * polishRate).toFixed(2))
    }
  }

  let effective_qty = 0
  if (group.pricing_method === 'per_sqft')
    effective_qty = group.cep ? charged_sqft : total_sqft
  else if (group.pricing_method === 'per_rft') effective_qty = running_ft
  else effective_qty = qty

  // Toughening — compute per-sqft addon (NOT added to subtotal here)
  // It will be incorporated into group.rate directly
  let tgh_charge = 0
  let tgh_rate_addon = 0

  if (group.glass_type === 'Toughened' || group.is_toughened) {
    try {
      const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
      const toughProc = pm.find(p =>
        p.process_type === 'toughening' &&
        p.is_active !== false
      )
      if (toughProc && toughProc.rate > 0) {
        tgh_charge = parseFloat((tgh_sqmt * toughProc.rate).toFixed(2))
        const base_sqft = effective_qty || total_sqft || 0.001
        tgh_rate_addon = base_sqft > 0
          ? parseFloat((tgh_charge / base_sqft).toFixed(4))
          : 0
        // DO NOT add to subtotal — tgh is included in group.rate already
      }
    } catch { }
  }

  // ── COST SIDE ── (stable & immutable)
  // If manual_cost_price is set, it's already the fully-loaded cost — do
  // NOT add the toughening addon on top of it again (see getGroupLoadedCostRate).
  // Only derive+add the addon when there's no manual override, i.e. the
  // system is computing the cost for the user from product/matrix/fallback.
  let costPerSqft = getGroupBaseCostRate(group, products)
  const hasManualCostPrice = !!(group.manual_cost_price && group.manual_cost_price > 0)

  if (!hasManualCostPrice && (group.is_toughened || group.glass_type === 'Toughened')) {
    try {
      const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
      const toughProc = pm.find(p => p.process_type === 'toughening' && p.is_active !== false)
      if (toughProc && toughProc.rate > 0) {
        const size_tgh_sqmt = ((size.width_inch || 0) * 25.4 + 30) * ((size.height_inch || 0) * 25.4 + 30) * qty / 1000000
        const size_tgh_charge = parseFloat((size_tgh_sqmt * toughProc.rate).toFixed(2))
        const size_base_sqft = effective_qty || total_sqft || 0.001
        const size_addon = size_base_sqft > 0 ? parseFloat((size_tgh_charge / size_base_sqft).toFixed(4)) : 0
        if (size_addon > 0) costPerSqft = parseFloat((costPerSqft + size_addon).toFixed(2))
      }
    } catch { }
  }

  const cost_ceil_w = group.wizard_cost_ceil_w || 3
  const cost_ceil_h = group.wizard_cost_ceil_h || 3
  const costCeilFn = (x, c, customMm) => {
    if (c === 'plus30mm') return x + (30 / 25.4)
    if (c === 'custom') return x + ((customMm || 30) / 25.4)
    return Math.ceil(x / c) * c
  }
  const cost_ceil_w_custom_mm = group.wizard_cost_ceil_w_custom_mm || 30
  const cost_ceil_h_custom_mm = group.wizard_cost_ceil_h_custom_mm || 30
  const cost_charged_w = parseFloat(costCeilFn(w_inch, cost_ceil_w, cost_ceil_w_custom_mm).toFixed(4))
  const cost_charged_h = parseFloat(costCeilFn(h_inch, cost_ceil_h, cost_ceil_h_custom_mm).toFixed(4))
  const cost_charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144
  const glass_cost = parseFloat((cost_charged_sqft * costPerSqft).toFixed(2))

  const CEP_COST_RATE = 5
  const initCepRate = (typeof group.wizard_cep_cost_rate === 'number' && group.wizard_cep_cost_rate > 0)
    ? group.wizard_cep_cost_rate
    : CEP_COST_RATE
  const cep_cost = group.cep
    ? parseFloat((running_ft * initCepRate).toFixed(2))
    : 0

  const proc_cost = parseFloat(
    ((size.size_processes || []).reduce((sum, p) => {
      const spCostRate = p.cost_rate ?? (p.rate * 0.70)
      return sum + ((p.qty_area || 0) * spCostRate)
    }, 0)).toFixed(2)
  )

  const cost_amount = parseFloat((glass_cost + cep_cost + proc_cost).toFixed(2))

  // ── SELLING SIDE ──
  const sqft_amt = effective_qty * (group.rate || 0)
  const rft_amt = running_ft * (group.rate_rft || 0)
  let subtotal = (sqft_amt + rft_amt) * (1 - (group.discount_pct || 0) / 100)
  subtotal = parseFloat((subtotal + cep_charges).toFixed(2))

  const tax_amt = parseFloat((subtotal * (group.tax_rate || 18) / 100).toFixed(2))
  const line_total = parseFloat((subtotal + tax_amt).toFixed(2))

  return {
    ...size,
    area_sqft_pc: parseFloat(area_sqft_pc.toFixed(4)),
    total_sqft: parseFloat(total_sqft.toFixed(4)),
    running_ft: parseFloat(running_ft.toFixed(4)),
    charged_sqft: parseFloat(charged_sqft.toFixed(4)),
    charged_w_inch,
    charged_h_inch,
    cep_rft: parseFloat(cep_rft.toFixed(4)),
    cep_charges,
    tgh_sqmt: parseFloat(tgh_sqmt.toFixed(6)),
    tgh_charge: parseFloat(tgh_charge.toFixed(2)),
    tgh_rate_addon: parseFloat(tgh_rate_addon.toFixed(4)),
    effective_qty: parseFloat(effective_qty.toFixed(4)),
    subtotal,
    tax_amount: tax_amt,
    line_total,

    // Cost Side properties
    cost_charged_w,
    cost_charged_h,
    glass_cost,
    cep_cost,
    proc_cost,
    cost_amount,
    margin_amount: parseFloat((subtotal - cost_amount).toFixed(2)),
    margin_pct: cost_amount > 0 ? parseFloat((((subtotal - cost_amount) / cost_amount) * 100).toFixed(2)) : 100
  }
}
