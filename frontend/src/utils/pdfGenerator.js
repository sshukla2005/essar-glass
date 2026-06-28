import { jsPDF } from 'jspdf'

// ── Number to words (Indian format) ──────
const toWords = (amount) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const convert = (n) => {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' +
      (n % 10 ? ones[n % 10] + ' ' : '')
    if (n < 1000) return ones[Math.floor(n / 100)] +
      ' Hundred ' + convert(n % 100)
    if (n < 100000) return convert(Math.floor(n / 1000)) +
      'Thousand ' + convert(n % 1000)
    if (n < 10000000) return convert(Math.floor(n / 100000)) +
      'Lakh ' + convert(n % 100000)
    return convert(Math.floor(n / 10000000)) +
      'Crore ' + convert(n % 10000000)
  }
  const n = Math.round(amount)
  return ('Rupees ' + convert(n) + 'Only').replace(/\s+/g, ' ').trim()
}

// ── Fraction formatter for inches ──────
const toFraction = (d) => {
  if (!d && d !== 0) return ''
  const num = parseFloat(d)
  if (isNaN(num)) return ''
  const w = Math.floor(num), r = num - w
  if (r === 0) return `${w}`
  const s = Math.round(r * 16)
  if (s === 0) return `${w}`
  if (s === 16) return `${w + 1}`
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
  const g = gcd(s, 16)
  return w === 0 ? `${s / g}/${16 / g}` : `${w} ${s / g}/${16 / g}`
}

// ── Currency Formatter ──────
const fmtR = (v) =>
  'Rs. ' + Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

// ── Master Data Resolvers ──────
const getCompany = (id) => {
  try {
    const all = JSON.parse(localStorage.getItem('companies_master') || '[]')
    const c = all.find(x => x.id === id)
    if (c) return c
  } catch { }
  return {
    name: 'ESSAR SONS',
    tagline: "AN 'ESSAR SONS' GROUP COMPANY",
    address: 'Shop No.11, Rashmi Shopping Centre, Agashi Road',
    city: 'Virar West, Vasai Virar - 401303, Palghar, Maharashtra',
    gst: '27AAIFE0491M1Z4', phone: '08047515289',
    website: 'www.essarsons.in', email: 'sales@essarsons.in',
  }
}

// ── Color Theme and Layout Constants ──────
const C = {
  primary: [26, 35, 126],        // Deep Indigo
  primaryMid: [57, 73, 171],     // Medium Indigo
  primaryLight: [232, 234, 246], // Light Indigo background tint
  accent: [0, 150, 136],         // Teal accent
  accentLight: [224, 242, 241],
  glassHeader: [13, 71, 161],
  glassHeaderBg: [227, 242, 253],
  rowAlt: [250, 251, 254],
  rowHover: [232, 240, 254],
  procHeader: [74, 20, 140],
  procHeaderBg: [243, 229, 245],
  hwHeader: [230, 81, 0],
  hwHeaderBg: [255, 243, 224],
  summaryBg: [248, 250, 254],
  grandBg: [21, 101, 192],
  text: [30, 41, 59],            // Slate 800
  textMid: [71, 85, 105],        // Slate 600
  textLight: [148, 163, 184],    // Slate 400
  border: [203, 213, 225],       // Slate 300
  borderLight: [226, 232, 240],  // Slate 200
  white: [255, 255, 255],
}

// Spacing System (8pt-based, mapped to mm)
const SP_8 = 3.0
const SP_16 = 6.0
const SP_24 = 9.0
const SP_32 = 12.0

const MARGIN = { l: 10, r: 10, t: 10 }
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN.l - MARGIN.r

// ── Drawing Utilities ──────
const setFont = (doc, size, style = 'normal', color = C.text) => {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

const drawRect = (doc, x, y, w, h, fillColor, strokeColor, lw = 0.25) => {
  if (fillColor) {
    doc.setFillColor(...fillColor)
    doc.rect(x, y, w, h, strokeColor ? 'FD' : 'F')
  }
  if (strokeColor) {
    doc.setDrawColor(...strokeColor)
    doc.setLineWidth(lw)
    if (!fillColor) doc.rect(x, y, w, h, 'S')
  }
}

const drawCard = (doc, x, y, w, h, fillColor = C.white, strokeColor = C.border, rx = 2.0) => {
  if (fillColor) doc.setFillColor(...fillColor)
  if (strokeColor) {
    doc.setDrawColor(...strokeColor)
    doc.setLineWidth(0.3)
  }
  const style = (fillColor && strokeColor) ? 'FD' : fillColor ? 'F' : 'S'
  doc.roundedRect(x, y, w, h, rx, rx, style)
}

const drawLine = (doc, x1, y1, x2, y2, color = C.border, lw = 0.25) => {
  doc.setDrawColor(...color)
  doc.setLineWidth(lw)
  doc.line(x1, y1, x2, y2)
}

const drawText = (doc, text, x, y, opts = {}) => {
  try { doc.text(String(text || ''), x, y, opts) } catch { }
}

const drawBorder = (doc) => {
  // Main page bounding box border
  drawRect(doc, MARGIN.l - 2, MARGIN.t - 2, CONTENT_W + 4, PAGE_H - MARGIN.t - 7, null, C.primary, 0.4)
}

// ── Header & Customer Cards ──────
const drawHeader = (doc, company, docTitle) => {
  let y = MARGIN.t
  // Top deep primary brand block
  drawRect(doc, MARGIN.l - 2, y - 2, CONTENT_W + 4, 30, C.primary)
  
  setFont(doc, 16, 'bold', C.white)
  drawText(doc, company.name || 'ESSAR SONS', PAGE_W / 2, y + 8, { align: 'center' })
  
  setFont(doc, 8, 'normal', C.primaryLight)
  drawText(doc, company.tagline || '', PAGE_W / 2, y + 14, { align: 'center' })
  
  setFont(doc, 7.5, 'normal', [210, 220, 245])
  const addr = [company.address, company.city].filter(Boolean).join(', ')
  drawText(doc, addr.substring(0, 90), PAGE_W / 2, y + 19.5, { align: 'center' })
  
  const contact = [
    company.gst ? `GSTIN: ${company.gst}` : '',
    company.phone ? `Ph: ${company.phone}` : '',
    company.email || '',
    company.website || '',
  ].filter(Boolean).join('   \u2022   ')
  setFont(doc, 7, 'normal', [190, 200, 235])
  drawText(doc, contact.substring(0, 100), PAGE_W / 2, y + 25, { align: 'center' })
  
  y += 32
  // Teal accent title bar
  drawRect(doc, MARGIN.l - 2, y - 1, CONTENT_W + 4, 10, C.accent)
  setFont(doc, 10, 'bold', C.white)
  drawText(doc, docTitle || 'PROFORMA INVOICE', PAGE_W / 2, y + 5.5, { align: 'center' })
  
  return y + 12
}

const drawDocInfo = (doc, quotation, y, docTitle) => {
  const boxH = 11
  drawCard(doc, MARGIN.l, y, CONTENT_W, boxH, C.summaryBg, C.border, 1.5)
  const items = [
    { label: 'Document Type', value: docTitle },
    { label: 'Quote / Ref No', value: quotation.quote_number || quotation.so_number || quotation.po_number || 'QT-NEW' },
    { label: 'Date', value: quotation.quote_date || quotation.order_date || quotation.po_date || '' },
    { label: 'Salesperson', value: quotation.salesperson || 'Admin' },
    { label: 'Payment Terms', value: quotation.payment_terms || 'Immediate' },
  ]
  const cellW = CONTENT_W / items.length
  items.forEach((item, i) => {
    const x = MARGIN.l + i * cellW
    if (i > 0) drawLine(doc, x, y, x, y + boxH, C.border, 0.2)
    setFont(doc, 6.5, 'normal', C.textLight)
    drawText(doc, item.label, x + 3, y + 4)
    setFont(doc, 7.5, 'bold', C.text)
    drawText(doc, String(item.value || '').substring(0, 20), x + 3, y + 8)
  })
  return y + boxH + SP_16
}

const drawCustomerCard = (doc, cust, y) => {
  const cardH = 34
  const mid = PAGE_W / 2
  const cardW = CONTENT_W / 2 - 2
  
  // Bill To
  drawCard(doc, MARGIN.l, y, cardW, cardH, C.white, C.border, 2.0)
  drawRect(doc, MARGIN.l + 0.3, y + 0.3, cardW - 0.6, 7, C.glassHeaderBg)
  setFont(doc, 7.5, 'bold', C.glassHeader)
  drawText(doc, 'BILL TO', MARGIN.l + 4, y + 5)
  
  // Ship To
  drawCard(doc, mid + 2, y, cardW, cardH, C.white, C.border, 2.0)
  drawRect(doc, mid + 2.3, y + 0.3, cardW - 0.6, 7, C.glassHeaderBg)
  setFont(doc, 7.5, 'bold', C.glassHeader)
  drawText(doc, 'SHIP TO', mid + 6, y + 5)
  
  const drawSide = (data, startX) => {
    let ly = y + 11.5
    setFont(doc, 8.5, 'bold', C.primaryMid)
    drawText(doc, (data.name || '').substring(0, 32), startX + 4, ly)
    ly += 5
    setFont(doc, 7.5, 'normal', C.textMid)
    if (data.address) {
      const lines = doc.splitTextToSize(data.address, cardW - 8)
      lines.slice(0, 2).forEach(l => {
        drawText(doc, l, startX + 4, ly)
        ly += 4
      })
    }
    if (data.phone) {
      drawText(doc, `Ph: ${data.phone}`, startX + 4, ly)
      ly += 4
    }
    if (data.gstin) {
      setFont(doc, 7, 'bold', C.textLight)
      drawText(doc, `GSTIN: ${data.gstin}`, startX + 4, ly)
    }
  }
  
  drawSide(cust, MARGIN.l)
  drawSide(cust, mid + 2)
  
  return y + cardH + SP_16
}

// Vendor card helper for PO
const drawVendorCard = (doc, vend, y) => {
  const cardH = 34
  drawCard(doc, MARGIN.l, y, CONTENT_W, cardH, C.white, C.border, 2.0)
  drawRect(doc, MARGIN.l + 0.3, y + 0.3, CONTENT_W - 0.6, 7, C.glassHeaderBg)
  setFont(doc, 7.5, 'bold', C.glassHeader)
  drawText(doc, 'VENDOR DETAILS', MARGIN.l + 4, y + 5)
  
  let ly = y + 11.5
  setFont(doc, 8.5, 'bold', C.primaryMid)
  drawText(doc, (vend.name || '').substring(0, 60), MARGIN.l + 4, ly)
  ly += 5
  setFont(doc, 7.5, 'normal', C.textMid)
  if (vend.address) {
    const lines = doc.splitTextToSize(vend.address, CONTENT_W - 8)
    lines.slice(0, 2).forEach(l => {
      drawText(doc, l, MARGIN.l + 4, ly)
      ly += 4
    })
  }
  if (vend.phone) {
    drawText(doc, `Ph: ${vend.phone}`, MARGIN.l + 4, ly)
    ly += 4
  }
  if (vend.gstin) {
    setFont(doc, 7, 'bold', C.textLight)
    drawText(doc, `GSTIN: ${vend.gstin}`, MARGIN.l + 4, ly)
  }
  return y + cardH + SP_16
}

// ── Table Column Definitions ──────
const COLS_CEP = [
  { h: 'Sr', w: 8, a: 'c' },
  { h: 'Actual W"', w: 24, a: 'c' },
  { h: 'Actual H"', w: 24, a: 'c' },
  { h: 'Charged Size', w: 32, a: 'c' },
  { h: 'Qty', w: 8, a: 'c' },
  { h: 'Sqft', w: 22, a: 'r' },
  { h: 'Rft', w: 20, a: 'r' },
  { h: 'CEP Rs.', w: 20, a: 'r' },
  { h: 'Amount Rs.', w: 0, a: 'r' },
]

const COLS_NOCEP = [
  { h: 'Sr', w: 8, a: 'c' },
  { h: 'Actual W"', w: 28, a: 'c' },
  { h: 'Actual H"', w: 28, a: 'c' },
  { h: 'Charged Size', w: 38, a: 'c' },
  { h: 'Qty', w: 8, a: 'c' },
  { h: 'Sqft', w: 28, a: 'r' },
  { h: 'Rft', w: 20, a: 'r' },
  { h: 'Amount Rs.', w: 0, a: 'r' },
]

const buildCols = (hasCep) => {
  const base = hasCep ? COLS_CEP : COLS_NOCEP
  const fixed = base.slice(0, -1).reduce((s, c) => s + c.w, 0)
  const cols = base.map(c => ({ ...c }))
  cols[cols.length - 1].w = CONTENT_W - fixed
  let x = MARGIN.l
  cols.forEach(c => { c.x = x; x += c.w })
  return cols
}

const drawTableHeader = (doc, cols, y) => {
  const rowH = 8
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, rowH, C.glassHeader)
  setFont(doc, 7.5, 'bold', C.white)
  cols.forEach((c, i) => {
    if (i > 0) drawLine(doc, c.x, y, c.x, y + rowH, [100, 130, 180], 0.2)
    const isAmountCol = (i === cols.length - 1)
    const cx = isAmountCol ? c.x + c.w - 5.0 : (c.a === 'r' ? c.x + c.w - 2.0 : c.a === 'c' ? c.x + c.w / 2 : c.x + 2.0)
    const al = isAmountCol ? 'right' : (c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left')
    drawText(doc, c.h, cx, y + 5.5, { align: al })
  })
  return y + rowH
}

const drawGroupBanner = (doc, groupNo, desc, isToughened, hasCep, y) => {
  const bannerH = 8
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, bannerH, C.glassHeaderBg)
  drawLine(doc, MARGIN.l + 0.3, y + bannerH, MARGIN.l + CONTENT_W - 0.3, y + bannerH, C.border, 0.25)
  setFont(doc, 8.5, 'bold', C.glassHeader)
  drawText(doc, `${groupNo}. ${desc}`, MARGIN.l + 4, y + 5.5)
  
  let bx = MARGIN.l + CONTENT_W - 4
  if (hasCep) {
    const bw = 12
    drawCard(doc, bx - bw, y + 1.5, bw, 5, C.accent, null, 1)
    setFont(doc, 6, 'bold', C.white)
    drawText(doc, 'CEP', bx - bw / 2, y + 5, { align: 'center' })
    bx -= bw + SP_8
  }
  if (isToughened) {
    const bw = 22
    drawCard(doc, bx - bw, y + 1.5, bw, 5, [230, 74, 25], null, 1)
    setFont(doc, 6, 'bold', C.white)
    drawText(doc, 'TOUGHENED', bx - bw / 2, y + 5, { align: 'center' })
  }
  return y + bannerH
}

const drawDataRow = (doc, cols, vals, isAlt, y) => {
  const rowH = 6.5
  if (isAlt) drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, rowH, C.rowAlt)
  setFont(doc, 7.5, 'normal', C.text)
  cols.forEach((c, i) => {
    if (i > 0) drawLine(doc, c.x, y, c.x, y + rowH, C.borderLight, 0.15)
    const v = String(vals[i] ?? '')
    const isAmountCol = (i === cols.length - 1)
    const cx = isAmountCol ? c.x + c.w - 5.0 : (c.a === 'r' ? c.x + c.w - 2.0 : c.a === 'c' ? c.x + c.w / 2 : c.x + 2.0)
    const al = isAmountCol ? 'right' : (c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left')
    const maxLen = isAmountCol ? 24 : Math.max(5, Math.floor(c.w / 1.6))
    if (v) drawText(doc, v.substring(0, maxLen), cx, y + 4.5, { align: al })
  })
  drawLine(doc, MARGIN.l + 0.3, y + rowH, MARGIN.l + CONTENT_W - 0.3, y + rowH, C.borderLight, 0.15)
  return y + rowH
}

const drawGroupSubtotal = (doc, cols, qty, sqft, cep, amt, hasCep, y) => {
  const rowH = 7.5
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, rowH, C.glassHeaderBg)
  drawLine(doc, MARGIN.l + 0.3, y, MARGIN.l + CONTENT_W - 0.3, y, C.border, 0.3)
  setFont(doc, 7.5, 'bold', C.glassHeader)
  
  const qtyC = cols.find(c => c.h === 'Qty')
  const sqftC = cols.find(c => c.h === 'Sqft')
  const cepC = hasCep ? cols.find(c => c.h.includes('CEP')) : null
  const amtC = cols[cols.length - 1]
  
  drawText(doc, 'Group Subtotal', MARGIN.l + 4, y + 5)
  if (qtyC) drawText(doc, String(qty), qtyC.x + qtyC.w / 2, y + 5, { align: 'center' })
  if (sqftC) drawText(doc, sqft.toFixed(3), sqftC.x + sqftC.w - 2.0, y + 5, { align: 'right' })
  if (cepC && hasCep) drawText(doc, fmtR(cep), cepC.x + cepC.w - 2.0, y + 5, { align: 'right' })
  if (amtC) drawText(doc, fmtR(amt), amtC.x + amtC.w - 5.0, y + 5, { align: 'right' })
  return y + rowH
}

// ── Glass Card Height Estimator ──
const calculateGroupHeight = (group, hasCep) => {
  let h = SP_8 // top card padding
  h += 8 // group banner height
  h += 8 // table header height
  h += (group.sizes || []).length * 6.5 // size rows
  
  // inline processes if present
  const sizeProcs = (group.sizes || []).flatMap(s => s.size_processes || []).filter(p => (p.amount || 0) > 0)
  const grpProcs = (group.processes || []).filter(p => (p.amount || 0) > 0)
  const allProcs = [...sizeProcs, ...grpProcs]
  
  if (allProcs.length > 0) {
    h += 6.5 // header height
    h += allProcs.length * 6.5 // row heights
    h += SP_8 // inline spacer
  }
  
  h += 7.5 // subtotal row
  h += SP_8 // bottom card padding
  return h
}

// ── Draw Glass Card (Splits Dynamically across pages) ──
const drawGroupCard = (doc, group, groupNo, hasCep, cols, startY, pageNum, quotation) => {
  const sizes = group.sizes || []
  const sizeProcs = sizes.flatMap(s => s.size_processes || []).filter(p => (p.amount || 0) > 0)
  const grpProcs = (group.processes || []).filter(p => (p.amount || 0) > 0)
  const allProcs = [...sizeProcs, ...grpProcs]
  
  const groupHeight = calculateGroupHeight(group, hasCep)
  const remainingSpace = (PAGE_H - 18) - startY
  const cleanPageSpace = (PAGE_H - 18) - (MARGIN.t + 18)
  
  let y = startY
  // Push completely to the next page ONLY if it can fit there AND y leaves very little space (< 50mm)
  if (groupHeight <= cleanPageSpace && groupHeight > remainingSpace && remainingSpace < 50) {
    y = checkPageBreak(doc, y, 999, pageNum, quotation)
  }
  
  let cardStartY = y
  const headerHeight = SP_8 + 8 + 8 // padding + banner + header
  
  // If remaining space cannot even hold the header + 1 size row + padding, push before starting
  if ((PAGE_H - 18) - y < headerHeight + 6.5 + SP_8) {
    y = checkPageBreak(doc, y, 999, pageNum, quotation)
    cardStartY = y
  }
  
  let ly = y + SP_8
  
  // 1. Group Banner
  ly = drawGroupBanner(doc, groupNo, group.description || `Group ${groupNo}`, group.is_toughened, group.cep, ly)
  // 2. Table Header
  ly = drawTableHeader(doc, cols, ly)
  
  let grpQty = 0, grpSqft = 0, grpCep = 0, grpAmt = 0
  
  // 3. Sizes list with loop split logic
  sizes.forEach((size, si) => {
    const w = size.width_inch || 0
    const h = size.height_inch || 0
    const qty = size.quantity || 1
    const sqft = size.total_sqft || 0
    const rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(3))
    const cep = size.cep_charges || 0
    const amt = size.subtotal || 0
    
    grpQty += qty; grpSqft += sqft; grpCep += cep; grpAmt += amt
    
    // Check if we need to split before drawing this row (row + padding + subtotal)
    if ((PAGE_H - 18) - ly < 6.5 + SP_8 + 7.5) {
      // Close current card box neatly on current page
      drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
      
      // Force page break
      y = checkPageBreak(doc, y, 999, pageNum, quotation)
      cardStartY = y
      ly = y + SP_8
      
      // Start a continuation card box
      ly = drawGroupBanner(doc, groupNo, (group.description || `Group ${groupNo}`) + ' (Continued)', group.is_toughened, group.cep, ly)
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = size.charged_w_inch || 0
    const chargedH = size.charged_h_inch || 0
    const chargedSizeStr = (chargedW > 0 || chargedH > 0) ? `${chargedW}" x ${chargedH}"` : '-'
    
    const vals = [
      String.fromCharCode(97 + si) + ')',
      w > 0 ? toFraction(w) + '"' : '',
      h > 0 ? toFraction(h) + '"' : '',
      chargedSizeStr,
      String(qty),
      sqft.toFixed(3),
      rft.toFixed(3),
      ...(hasCep ? [cep > 0 ? fmtR(cep) : '-'] : []),
      fmtR(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, si % 2 === 1, ly)
  })
  
  // 4. Processes
  if (allProcs.length > 0) {
    const procsHeight = 6.5 + allProcs.length * 6.5 + SP_8 * 2
    if ((PAGE_H - 18) - ly < procsHeight + 7.5) {
      // Close current card
      drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
      
      // Page break
      y = checkPageBreak(doc, y, 999, pageNum, quotation)
      cardStartY = y
      ly = y + SP_8
      
      // Continuation banner
      ly = drawGroupBanner(doc, groupNo, (group.description || `Group ${groupNo}`) + ' - Processes (Continued)', group.is_toughened, group.cep, ly)
    }
    
    ly += SP_8
    drawRect(doc, MARGIN.l + SP_8, ly, CONTENT_W - 2 * SP_8, 6.5, C.procHeader)
    setFont(doc, 7, 'bold', C.white)
    drawText(doc, 'GROUP & SIZE PROCESS CHARGES', MARGIN.l + SP_8 + 3, ly + 4.5)
    ly += 6.5
    
    allProcs.forEach((p, pi) => {
      if (pi % 2 === 1) {
        drawRect(doc, MARGIN.l + SP_8, ly, CONTENT_W - 2 * SP_8, 6.5, C.rowAlt)
      }
      setFont(doc, 7, 'normal', C.text)
      drawText(doc, (p.process_name || p.name || '-').substring(0, 45), MARGIN.l + SP_8 + 3, ly + 4.5)
      
      setFont(doc, 7, 'bold', C.text)
      drawText(doc, `${p.qty_area || 0} x ${fmtR(p.rate || 0)} = ${fmtR(p.amount || 0)}`, MARGIN.l + CONTENT_W - SP_8 - 5.0, ly + 4.5, { align: 'right' })
      drawLine(doc, MARGIN.l + SP_8, ly + 6.5, MARGIN.l + CONTENT_W - SP_8, ly + 6.5, C.borderLight, 0.15)
      ly += 6.5
    })
    ly += SP_8
  }
  
  // 5. Group Subtotal
  ly = drawGroupSubtotal(doc, cols, grpQty, grpSqft, grpCep, grpAmt, hasCep, ly)
  
  // Close the final container box
  drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
  
  return { endY: ly, grpQty, grpSqft, grpCep, grpAmt }
}

// ── Total Summary Bar ──
const drawTotalBar = (doc, totalQty, totalSqft, totalAmt, y) => {
  const barH = 9
  drawCard(doc, MARGIN.l, y, CONTENT_W, barH, C.primaryLight, C.primary, 1.5)
  setFont(doc, 8, 'bold', C.primaryMid)
  drawText(doc, 'GLASS TOTALS SUMMARY', MARGIN.l + 4, y + 6)
  drawText(doc, `Qty: ${totalQty}`, MARGIN.l + 65, y + 6)
  drawText(doc, `Area: ${totalSqft.toFixed(3)} Sqft`, MARGIN.l + 105, y + 6)
  drawText(doc, `Glass Amount: ${fmtR(totalAmt)}`, MARGIN.l + CONTENT_W - 5.0, y + 6, { align: 'right' })
  return y + barH
}

// ── Hardware / Labor / Wastage Card Drawing ──
const calculateHardwareHeight = (items) => {
  if (!items?.length) return 0
  return SP_8 + 7 + 7 + items.length * 6.5 + 7.5 + SP_8 + SP_16
}

const drawHardwareCard = (doc, items, y) => {
  const h = calculateHardwareHeight(items)
  drawCard(doc, MARGIN.l, y, CONTENT_W, h - SP_16, C.white, C.border, 2.0)
  
  let ly = y + SP_8
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, C.hwHeaderBg)
  setFont(doc, 8, 'bold', C.hwHeader)
  drawText(doc, 'HARDWARE ITEMS', MARGIN.l + 4, ly + 5)
  ly += 7
  
  const hcols = [
    { l: 'Description', x: MARGIN.l + 4, w: CONTENT_W - 90, a: 'left' },
    { l: 'Qty', x: MARGIN.l + CONTENT_W - 86, w: 12, a: 'c' },
    { l: 'UOM', x: MARGIN.l + CONTENT_W - 74, w: 14, a: 'c' },
    { l: 'Rate', x: MARGIN.l + CONTENT_W - 60, w: 25, a: 'r' },
    { l: 'Amount', x: MARGIN.l + CONTENT_W - 35, w: 31, a: 'r' },
  ]
  
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, C.white)
  drawLine(doc, MARGIN.l + 0.3, ly + 7, MARGIN.l + CONTENT_W - 0.3, ly + 7, C.border, 0.2)
  setFont(doc, 7, 'bold', C.hwHeader)
  hcols.forEach(c => {
    const cx = c.l === 'Amount' ? MARGIN.l + CONTENT_W - 5.0 : (c.a === 'r' ? c.x + c.w : c.a === 'c' ? c.x + c.w / 2 : c.x)
    drawText(doc, c.l, cx, ly + 5, { align: c.l === 'Amount' ? 'right' : (c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left') })
  })
  ly += 7
  
  items.forEach((item, i) => {
    if (i % 2 === 1) {
      drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 6.5, C.rowAlt)
    }
    setFont(doc, 7.5, 'normal', C.text)
    drawText(doc, (item.description || '-').substring(0, 48), MARGIN.l + 4, ly + 4.5)
    drawText(doc, String(item.qty || 0), MARGIN.l + CONTENT_W - 86 + 6, ly + 4.5, { align: 'center' })
    drawText(doc, (item.uom || 'Nos').substring(0, 6), MARGIN.l + CONTENT_W - 74 + 7, ly + 4.5, { align: 'center' })
    drawText(doc, fmtR(item.rate || 0), MARGIN.l + CONTENT_W - 35, ly + 4.5, { align: 'right' })
    drawText(doc, fmtR(item.amount || 0), MARGIN.l + CONTENT_W - 5.0, ly + 4.5, { align: 'right' })
    drawLine(doc, MARGIN.l + 0.3, ly + 6.5, MARGIN.l + CONTENT_W - 0.3, ly + 6.5, C.borderLight, 0.15)
    ly += 6.5
  })
  
  const tot = items.reduce((s, item) => s + (item.amount || 0), 0)
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7.5, C.hwHeaderBg)
  drawLine(doc, MARGIN.l + 0.3, ly, MARGIN.l + CONTENT_W - 0.3, ly, C.border, 0.3)
  setFont(doc, 7.5, 'bold', C.hwHeader)
  drawText(doc, 'Hardware Items Total', MARGIN.l + 4, ly + 5.5)
  drawText(doc, fmtR(tot), MARGIN.l + CONTENT_W - 5.0, ly + 5.5, { align: 'right' })
  
  return y + h
}

const calculateLaborHeight = (items) => {
  if (!items?.length) return 0
  return SP_8 + 7 + 7 + items.length * 6.5 + 7.5 + SP_8 + SP_16
}

const drawLaborCard = (doc, items, y) => {
  const h = calculateLaborHeight(items)
  drawCard(doc, MARGIN.l, y, CONTENT_W, h - SP_16, C.white, C.border, 2.0)
  
  let ly = y + SP_8
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, C.procHeaderBg)
  setFont(doc, 8, 'bold', C.procHeader)
  drawText(doc, 'LABOR & SERVICE CHARGES', MARGIN.l + 4, ly + 5)
  ly += 7
  
  const hcols = [
    { l: 'Description', x: MARGIN.l + 4, w: CONTENT_W - 90, a: 'left' },
    { l: 'Qty', x: MARGIN.l + CONTENT_W - 86, w: 12, a: 'c' },
    { l: 'UOM', x: MARGIN.l + CONTENT_W - 74, w: 14, a: 'c' },
    { l: 'Rate', x: MARGIN.l + CONTENT_W - 60, w: 25, a: 'r' },
    { l: 'Amount', x: MARGIN.l + CONTENT_W - 35, w: 31, a: 'r' },
  ]
  
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, C.white)
  drawLine(doc, MARGIN.l + 0.3, ly + 7, MARGIN.l + CONTENT_W - 0.3, ly + 7, C.border, 0.2)
  setFont(doc, 7, 'bold', C.procHeader)
  hcols.forEach(c => {
    const cx = c.l === 'Amount' ? MARGIN.l + CONTENT_W - 5.0 : (c.a === 'r' ? c.x + c.w : c.a === 'c' ? c.x + c.w / 2 : c.x)
    drawText(doc, c.l, cx, ly + 5, { align: c.l === 'Amount' ? 'right' : (c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left') })
  })
  ly += 7
  
  items.forEach((item, i) => {
    if (i % 2 === 1) {
      drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 6.5, C.rowAlt)
    }
    setFont(doc, 7.5, 'normal', C.text)
    drawText(doc, (item.description || '-').substring(0, 48), MARGIN.l + 4, ly + 4.5)
    drawText(doc, String(item.qty || 0), MARGIN.l + CONTENT_W - 86 + 6, ly + 4.5, { align: 'center' })
    drawText(doc, (item.uom || 'Nos').substring(0, 6), MARGIN.l + CONTENT_W - 74 + 7, ly + 4.5, { align: 'center' })
    drawText(doc, fmtR(item.rate || 0), MARGIN.l + CONTENT_W - 35, ly + 4.5, { align: 'right' })
    drawText(doc, fmtR(item.amount || 0), MARGIN.l + CONTENT_W - 5.0, ly + 4.5, { align: 'right' })
    drawLine(doc, MARGIN.l + 0.3, ly + 6.5, MARGIN.l + CONTENT_W - 0.3, ly + 6.5, C.borderLight, 0.15)
    ly += 6.5
  })
  
  const tot = items.reduce((s, item) => s + (item.amount || 0), 0)
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7.5, C.procHeaderBg)
  drawLine(doc, MARGIN.l + 0.3, ly, MARGIN.l + CONTENT_W - 0.3, ly, C.border, 0.3)
  setFont(doc, 7.5, 'bold', C.procHeader)
  drawText(doc, 'Labor Charges Total', MARGIN.l + 4, ly + 5.5)
  drawText(doc, fmtR(tot), MARGIN.l + CONTENT_W - 5.0, ly + 5.5, { align: 'right' })
  
  return y + h
}

const calculateWastageHeight = (items) => {
  if (!items?.length) return 0
  return SP_8 + 7 + 7 + items.length * 6.5 + 7.5 + SP_8 + SP_16
}

const drawWastageCard = (doc, items, y) => {
  const h = calculateWastageHeight(items)
  drawCard(doc, MARGIN.l, y, CONTENT_W, h - SP_16, C.white, C.border, 2.0)
  
  let ly = y + SP_8
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, [254, 242, 242])
  setFont(doc, 8, 'bold', [220, 38, 38])
  drawText(doc, 'WASTAGE CHARGES', MARGIN.l + 4, ly + 5)
  ly += 7
  
  const hcols = [
    { l: 'Description', x: MARGIN.l + 4, w: CONTENT_W - 90, a: 'left' },
    { l: 'Qty', x: MARGIN.l + CONTENT_W - 86, w: 12, a: 'c' },
    { l: 'UOM', x: MARGIN.l + CONTENT_W - 74, w: 14, a: 'c' },
    { l: 'Rate', x: MARGIN.l + CONTENT_W - 60, w: 25, a: 'r' },
    { l: 'Amount', x: MARGIN.l + CONTENT_W - 35, w: 31, a: 'r' },
  ]
  
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, C.white)
  drawLine(doc, MARGIN.l + 0.3, ly + 7, MARGIN.l + CONTENT_W - 0.3, ly + 7, C.border, 0.2)
  setFont(doc, 7, 'bold', [220, 38, 38])
  hcols.forEach(c => {
    const cx = c.l === 'Amount' ? MARGIN.l + CONTENT_W - 5.0 : (c.a === 'r' ? c.x + c.w : c.a === 'c' ? c.x + c.w / 2 : c.x)
    drawText(doc, c.l, cx, ly + 5, { align: c.l === 'Amount' ? 'right' : (c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left') })
  })
  ly += 7
  
  items.forEach((item, i) => {
    if (i % 2 === 1) {
      drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 6.5, C.rowAlt)
    }
    setFont(doc, 7.5, 'normal', C.text)
    drawText(doc, (item.description || '-').substring(0, 48), MARGIN.l + 4, ly + 4.5)
    drawText(doc, String(item.qty || 0), MARGIN.l + CONTENT_W - 86 + 6, ly + 4.5, { align: 'center' })
    drawText(doc, (item.uom || 'sqft').substring(0, 6), MARGIN.l + CONTENT_W - 74 + 7, ly + 4.5, { align: 'center' })
    drawText(doc, fmtR(item.rate || 0), MARGIN.l + CONTENT_W - 35, ly + 4.5, { align: 'right' })
    drawText(doc, fmtR(item.amount || 0), MARGIN.l + CONTENT_W - 5.0, ly + 4.5, { align: 'right' })
    drawLine(doc, MARGIN.l + 0.3, ly + 6.5, MARGIN.l + CONTENT_W - 0.3, ly + 6.5, C.borderLight, 0.15)
    ly += 6.5
  })
  
  const tot = items.reduce((s, item) => s + (item.amount || 0), 0)
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7.5, [254, 242, 242])
  drawLine(doc, MARGIN.l + 0.3, ly, MARGIN.l + CONTENT_W - 0.3, ly, C.border, 0.3)
  setFont(doc, 7.5, 'bold', [220, 38, 38])
  drawText(doc, 'Wastage Charges Total', MARGIN.l + 4, ly + 5.5)
  drawText(doc, fmtR(tot), MARGIN.l + CONTENT_W - 5.0, ly + 5.5, { align: 'right' })
  
  return y + h
}

// ── Financial Summary & Amount in Words Card (Perfect Side-by-Side) ──
const calculateSummaryHeight = (totalsRows) => {
  let h = SP_16 // top and bottom padding
  totalsRows.forEach(r => {
    if (r.divider) h += 4
    else if (r.grand) h += 9
    else h += 7
  })
  return h
}

const drawFinalSummaryBlock = (doc, totalsRows, amtWords, quotation, y) => {
  const h = calculateSummaryHeight(totalsRows)
  const mid = PAGE_W / 2
  const colW = CONTENT_W / 2 - 2
  
  // --- Left Column Box (Details and Amount in Words) ---
  drawCard(doc, MARGIN.l, y, colW, h, C.white, C.border, 2.0)
  
  let ly = y + SP_8 + 2
  setFont(doc, 6.5, 'bold', C.textLight)
  drawText(doc, 'PAYMENT TERMS', MARGIN.l + 5, ly)
  setFont(doc, 7.5, 'bold', C.text)
  drawText(doc, String(quotation.payment_terms || 'Immediate').substring(0, 30), MARGIN.l + 5, ly + 4)
  
  ly += 9.5
  setFont(doc, 6.5, 'bold', C.textLight)
  drawText(doc, 'VALIDITY PERIOD', MARGIN.l + 5, ly)
  setFont(doc, 7.5, 'normal', C.text)
  drawText(doc, '8 days from date of issue', MARGIN.l + 5, ly + 4)
  
  ly += 9.5
  setFont(doc, 6.5, 'bold', C.textLight)
  drawText(doc, 'HSN CODE / CLASSIFICATION', MARGIN.l + 5, ly)
  setFont(doc, 7.5, 'normal', C.text)
  drawText(doc, '7007 (Safety/Toughened Glass)', MARGIN.l + 5, ly + 4)
  
  // Amount in Words box placed at bottom of Left Card
  const amtBoxH = 14
  const amtBoxY = y + h - amtBoxH - SP_8
  drawCard(doc, MARGIN.l + SP_8, amtBoxY, colW - 2 * SP_8, amtBoxH, C.summaryBg, C.borderLight, 1.5)
  
  setFont(doc, 7, 'bold', C.primaryMid)
  drawText(doc, 'Amount in Words:', MARGIN.l + SP_8 + 4, amtBoxY + 4.5)
  setFont(doc, 7, 'normal', C.text)
  const wlines = doc.splitTextToSize(amtWords, colW - 2 * SP_8 - 8)
  wlines.slice(0, 2).forEach((l, i) => {
    drawText(doc, l, MARGIN.l + SP_8 + 4, amtBoxY + 8.5 + i * 3.5)
  })
  
  // --- Right Column Box (Financial Summary Card) ---
  drawCard(doc, mid + 2, y, colW, h, C.white, C.border, 2.0)
  
  let ry = y + SP_8
  const rxLabel = mid + 6
  const rxValue = mid + 2 + colW - 4
  
  totalsRows.forEach(row => {
    if (row.divider) {
      drawLine(doc, rxLabel, ry + 1, rxValue, ry + 1, C.borderLight, 0.25)
      ry += 4
      return
    }
    if (row.grand) {
      drawRect(doc, mid + 2.3, ry - 1, colW - 0.6, 8, C.grandBg)
      setFont(doc, 8.5, 'bold', C.white)
      drawText(doc, row.label, rxLabel, ry + 4.5)
      drawText(doc, fmtR(row.value), rxValue, ry + 4.5, { align: 'right' })
      ry += 8
      return
    }
    if (row.sub) {
      drawRect(doc, mid + 2.3, ry - 1, colW - 0.6, 7, C.primaryLight)
      setFont(doc, 7.5, 'bold', C.primaryMid)
      drawText(doc, row.label, rxLabel, ry + 4)
      drawText(doc, fmtR(row.value), rxValue, ry + 4, { align: 'right' })
      ry += 7
      return
    }
    
    setFont(doc, 7.5, 'normal', C.text)
    drawText(doc, row.label, rxLabel, ry + 4.5)
    
    if (row.pct) {
      setFont(doc, 6.5, 'normal', C.textLight)
      drawText(doc, `(${row.pct}%)`, rxLabel + 32, ry + 4.5)
    }
    
    setFont(doc, 7.5, row.bold ? 'bold' : 'normal', C.text)
    drawText(doc, fmtR(row.value), rxValue, ry + 4.5, { align: 'right' })
    drawLine(doc, mid + 2.3, ry + 6, mid + 2 + colW - 0.3, ry + 6, C.borderLight, 0.15)
    ry += 6.5
  })
  
  return y + h
}

// ── Terms & Signature Section ──
const drawTerms = (doc, y) => {
  const terms = [
    'Please double-check glass specifications, size, quantity, rates and taxes before confirming.',
    'Goods sold cannot be exchanged or returned after confirmation.',
    'Accepted tolerance: +/- 2mm in dimensions.',
    'Delivery, unloading & hauling charges are extra and payable by buyer.',
    'Delayed payment charges @ 2% per month after due date.',
    'All disputes subject to Palghar jurisdiction.',
  ]
  setFont(doc, 7.5, 'bold', C.primaryMid)
  drawText(doc, 'Terms & Conditions', MARGIN.l + 2, y)
  y += 4.5
  setFont(doc, 7, 'normal', C.textMid)
  terms.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, CONTENT_W - 4)
    lines.forEach(l => { drawText(doc, l, MARGIN.l + 2, y); y += 3.2 })
  })
  return y
}

const drawSignatureStrip = (doc, company, y) => {
  const cardW = (CONTENT_W - SP_16) / 3
  const cardH = 22
  
  const blocks = [
    { label: 'Customer Acceptance', info: 'I/We accept specs & rates.', line: 'Signature & Stamp / Date' },
    { label: 'Prepared By', info: 'Sales & Estimations Desk', line: 'Account Executive Signature' },
    { label: `For ${company.name || 'ESSAR SONS'}`, info: 'Office Seal Area', line: 'Authorised Signatory' }
  ]
  
  blocks.forEach((b, i) => {
    const x = MARGIN.l + i * (cardW + SP_8)
    drawCard(doc, x, y, cardW, cardH, C.white, C.border, 1.5)
    
    setFont(doc, 7, 'bold', C.primaryMid)
    drawText(doc, b.label, x + 4, y + 4.5)
    
    setFont(doc, 6.5, 'normal', C.textLight)
    drawText(doc, b.info, x + 4, y + 8.5)
    
    drawLine(doc, x + 4, y + 15.5, x + cardW - 4, y + 15.5, C.border, 0.25)
    
    setFont(doc, 6.5, 'normal', C.textLight)
    drawText(doc, b.line, x + cardW / 2, y + 19.5, { align: 'center' })
  })
  
  return y + cardH
}

const drawFooter = (doc, quoteNo, pageNum, totalPages) => {
  const y = PAGE_H - 18 // starts at 279 mm
  drawRect(doc, MARGIN.l - 1.8, y, CONTENT_W + 3.6, 7.5, C.primary)
  setFont(doc, 6.5, 'normal', [180, 190, 230])
  drawText(doc, `Ref No: ${quoteNo || ''}`, MARGIN.l + 2, y + 4.8)
  drawText(doc, `Confidential &bull; Computer Generated Document`, PAGE_W / 2, y + 4.8, { align: 'center' })
  drawText(doc, `Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN.r - 4, y + 4.8, { align: 'right' })
}

// Page Break Manager with precise heights and page numbering pass
const checkPageBreak = (doc, y, heightNeeded, pageNum, quotation) => {
  const usablePageHeight = PAGE_H - 20
  if (y + heightNeeded > usablePageHeight) {
    doc.addPage()
    pageNum.val++
    drawBorder(doc)
    
    let ny = MARGIN.t + SP_8
    setFont(doc, 9, 'bold', C.primary)
    drawText(doc, getCompany(quotation.company_id).name || 'ESSAR SONS', MARGIN.l + 2, ny + 4)
    setFont(doc, 7, 'normal', C.textLight)
    drawText(doc, `Ref No: ${quotation.quote_number || quotation.so_number || quotation.po_number || ''}`, PAGE_W - MARGIN.r - 2, ny + 4, { align: 'right' })
    drawLine(doc, MARGIN.l, ny + 7, MARGIN.l + CONTENT_W, ny + 7, C.border, 0.3)
    
    return ny + 10
  }
  return y
}

const addFootersAndPageNumbers = (doc, quoteNo) => {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, quoteNo, i, totalPages)
  }
}

// ── Public Exported APIs ──────

export const generateQuotationPDF = (quotation) => {
  try {
    const { hardware_items = [], labor_items = [], wastage_items = [] } = quotation
    const doc = new jsPDF('p', 'mm', 'a4')
    const company = getCompany(quotation.company_id)

    let cust = {
      name: quotation.customer_name || '',
      address: '', phone: quotation.customer_phone || '', gstin: quotation.customer_gstin || ''
    }
    try {
      const all = JSON.parse(localStorage.getItem('customers') || '[]')
      const c = all.find(x => x.id === quotation.customer_id)
      if (c) cust = {
        name: c.name,
        address: [c.address, c.city].filter(Boolean).join(', '),
        phone: c.phone || c.mobile || '',
        gstin: c.gstin || '',
      }
    } catch { }

    const groups = quotation.groups || []
    const hasCep = groups.some(g => g.cep)
    const cols = buildCols(hasCep)
    let pageNum = { val: 1, total: '?' }

    // Page 1 Setup
    drawBorder(doc)
    let y = drawHeader(doc, company, 'PROFORMA INVOICE')
    y = drawDocInfo(doc, quotation, y, 'PROFORMA INVOICE')
    y = drawCustomerCard(doc, cust, y)

    let totalQty = 0, totalSqft = 0, totalCep = 0, grandGlass = 0
    let groupNo = 0

    groups.forEach((group) => {
      groupNo++
      const res = drawGroupCard(doc, group, groupNo, hasCep, cols, y, pageNum, quotation)
      totalQty += res.grpQty
      totalSqft += res.grpSqft
      totalCep += res.grpCep
      grandGlass += res.grpAmt
      y = res.endY + SP_16
    })

    // Glass total bar
    y = checkPageBreak(doc, y, 9 + SP_16, pageNum, quotation)
    y = drawTotalBar(doc, totalQty, totalSqft, grandGlass, y) + SP_16

    // Hardware Card
    if (hardware_items.length > 0) {
      const hwHeight = calculateHardwareHeight(hardware_items)
      y = checkPageBreak(doc, y, hwHeight, pageNum, quotation)
      y = drawHardwareCard(doc, hardware_items, y) + SP_16
    }

    // Labor Card
    if (labor_items.length > 0) {
      const lbHeight = calculateLaborHeight(labor_items)
      y = checkPageBreak(doc, y, lbHeight, pageNum, quotation)
      y = drawLaborCard(doc, labor_items, y) + SP_16
    }

    // Wastage Card
    if (wastage_items.length > 0) {
      const wstHeight = calculateWastageHeight(wastage_items)
      y = checkPageBreak(doc, y, wstHeight, pageNum, quotation)
      y = drawWastageCard(doc, wastage_items, y) + SP_16
    }

    // Processes block height calculations for processes
    const t = quotation.totals || {}
    const subI = t.subI || grandGlass || 0
    const procTot = t.procTotal || 0
    const hwTot = t.hwTotal || hardware_items.reduce((s, h) => s + (h.amount || 0), 0) || 0
    const lbTot = t.lbTotal || labor_items.reduce((s, l) => s + (l.amount || 0), 0) || 0
    const wstTot = t.wstTotal || wastage_items.reduce((s, w) => s + (w.amount || 0), 0) || 0
    const dcChg = t.dcCharges || 0
    const subII = t.subII || (subI + procTot + hwTot + lbTot + wstTot + dcChg)
    const disc = t.discountAmt || 0
    const subIII = t.subIII || Math.max(0, subII - disc)
    const cgst = t.cgst || 0
    const sgst = t.sgst || 0
    const igst = t.igst || 0
    const grand = t.grandTotal || quotation.total_amount || (subIII + cgst + sgst + igst)
    const roundOff = parseFloat((Math.round(grand) - grand).toFixed(2))
    const adv = quotation.advance_received || 0
    const bal = Math.round(grand) - adv

    const totalsRows = [
      { label: 'Glass Items Subtotal', value: subI },
      procTot > 0 ? { label: 'Process Charges', value: procTot } : null,
      hwTot > 0 ? { label: 'Hardware Accessories', value: hwTot } : null,
      lbTot > 0 ? { label: 'Labor & Services', value: lbTot } : null,
      wstTot > 0 ? { label: 'Wastage Charges', value: wstTot } : null,
      dcChg > 0 ? { label: 'Delivery / Cartage', value: dcChg } : null,
      (procTot > 0 || dcChg > 0 || hwTot > 0 || lbTot > 0 || wstTot > 0) ? { label: 'Total Taxable Value', value: subII, sub: true } : null,
      disc > 0 ? { label: 'Discount Applied', value: disc } : null,
      { divider: true },
      cgst > 0 ? { label: 'CGST', value: cgst, pct: '9.00' } : null,
      sgst > 0 ? { label: 'SGST', value: sgst, pct: '9.00' } : null,
      igst > 0 ? { label: 'IGST', value: igst, pct: '18.00' } : null,
      Math.abs(roundOff) > 0.009 ? { label: 'Round Off', value: roundOff } : null,
      { label: 'GRAND TOTAL', value: Math.round(grand), grand: true },
      adv > 0 ? { label: 'Advance Received', value: adv } : null,
      adv > 0 ? { label: 'Balance Due', value: bal, sub: true } : null,
    ].filter(Boolean)

    const summaryHeight = calculateSummaryHeight(totalsRows)
    
    // Check page break for summary block + signature strip + terms section
    y = checkPageBreak(doc, y, summaryHeight + 22 + 28, pageNum, quotation)
    
    y = drawFinalSummaryBlock(doc, totalsRows, toWords(Math.round(grand)), quotation, y) + SP_16
    
    // Check page break for signature strip + terms
    y = checkPageBreak(doc, y, 22 + 28, pageNum, quotation)
    y = drawSignatureStrip(doc, company, y) + SP_16
    
    // Check page break for terms section
    y = checkPageBreak(doc, y, 28, pageNum, quotation)
    drawTerms(doc, y)

    // Complete footers rendering pass
    addFootersAndPageNumbers(doc, quotation.quote_number || 'QT')

    doc.save(`${quotation.quote_number || 'QT'}_Essar.pdf`)
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF failed: ' + e.message)
  }
}

// ── Draw Sales Order Items Card (Splits dynamically) ──
const drawSOItemsCard = (doc, lines, hasCep, cols, startY, pageNum, so) => {
  let y = startY
  let cardStartY = y
  let ly = y + SP_8
  
  // Group Header
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 8, C.glassHeaderBg)
  setFont(doc, 8.5, 'bold', C.glassHeader)
  drawText(doc, 'ORDER LINE ITEMS', MARGIN.l + 4, ly + 5.5)
  ly += 8

  ly = drawTableHeader(doc, cols, ly)
  
  let tQty = 0, tArea = 0, tCep = 0, tAmt = 0
  
  lines.forEach((line, i) => {
    const w = line.width_inch || (line.width_mm ? line.width_mm / 25.4 : 0)
    const h = line.height_inch || (line.height_mm ? line.height_mm / 25.4 : 0)
    const qty = line.quantity || 1
    const area = line.total_sqft || 0
    const cep = line.cep_charges || 0
    const amt = line.subtotal || line.line_total || 0
    tQty += qty; tArea += area; tCep += cep; tAmt += amt
    
    // Check page break before row
    if ((PAGE_H - 18) - ly < 6.5 + SP_8 + 7.5) {
      drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
      y = checkPageBreak(doc, y, 999, pageNum, so)
      cardStartY = y
      ly = y + SP_8
      
      drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 8, C.glassHeaderBg)
      setFont(doc, 8.5, 'bold', C.glassHeader)
      drawText(doc, 'ORDER LINE ITEMS (Continued)', MARGIN.l + 4, ly + 5.5)
      ly += 8
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = line.charged_w_inch || w
    const chargedH = line.charged_h_inch || h
    const chargedSizeStr = `${chargedW}" x ${chargedH}"`

    const vals = [
      String(i + 1),
      w > 0 ? toFraction(w) + '"' : '',
      h > 0 ? toFraction(h) + '"' : '',
      chargedSizeStr,
      String(qty),
      area.toFixed(3),
      parseFloat(((w + h) * 2 / 12 * qty).toFixed(3)).toString(),
      ...(hasCep ? [cep > 0 ? fmtR(cep) : '-'] : []),
      fmtR(amt)
    ]
    ly = drawDataRow(doc, cols, vals, i % 2 === 1, ly)
  })
  
  ly = drawGroupSubtotal(doc, cols, tQty, tArea, tCep, tAmt, hasCep, ly)
  drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
  
  return { endY: ly, tQty, tArea, tAmt }
}

export const generateSOPDF = (so) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const company = getCompany(so.company_id)
    let cust = { name: so.customer_name || '', address: '', phone: '', gstin: '' }
    try {
      const all = JSON.parse(localStorage.getItem('customers') || '[]')
      const c = all.find(x => x.id === so.customer_id)
      if (c) cust = { name: c.name, address: [c.address, c.city].filter(Boolean).join(', '), phone: c.phone || '', gstin: c.gstin || '' }
    } catch { }

    const hasCep = (so.lines || []).some(l => l.cep)
    const cols = buildCols(hasCep)
    let pageNum = { val: 1, total: '?' }

    drawBorder(doc)
    let y = drawHeader(doc, company, 'SALES ORDER')
    y = drawDocInfo(doc, {
      quote_number: so.so_number,
      quote_date: so.order_date,
      valid_until: so.delivery_date || 'TBD',
      salesperson: so.salesperson,
      payment_terms: so.payment_terms,
      company_id: so.company_id
    }, y, 'SALES ORDER')
    y = drawCustomerCard(doc, cust, y)

    // Render items card (using splits if needed)
    const res = drawSOItemsCard(doc, so.lines || [], hasCep, cols, y, pageNum, so)
    const tQty = res.tQty
    const tArea = res.tArea
    const tAmt = res.tAmt
    y = res.endY + SP_16

    y = checkPageBreak(doc, y, 9 + SP_16, pageNum, so)
    y = drawTotalBar(doc, tQty, tArea, tAmt, y) + SP_16

    // Summary block
    const grand = so.total_amount || 0
    const totalsRows = [
      { label: 'Items Subtotal', value: so.subtotal || 0 },
      so.tax_amount > 0 ? { label: 'GST', value: so.tax_amount, pct: '18.00' } : null,
      { label: 'GRAND TOTAL', value: grand, grand: true }
    ].filter(Boolean)

    const summaryHeight = calculateSummaryHeight(totalsRows)
    y = checkPageBreak(doc, y, summaryHeight + 22 + 28, pageNum, so)

    y = drawFinalSummaryBlock(doc, totalsRows, toWords(Math.round(grand)), { payment_terms: so.payment_terms }, y) + SP_16
    y = drawSignatureStrip(doc, company, y) + SP_16
    drawTerms(doc, y)

    addFootersAndPageNumbers(doc, so.so_number || 'SO')
    doc.save(`${so.so_number || 'SO'}_Essar.pdf`)
  } catch (e) {
    console.error('SO PDF:', e)
    alert('SO PDF failed: ' + e.message)
  }
}

// ── Draw Purchase Order Items Card (Splits dynamically) ──
const drawPOItemsCard = (doc, lines, cols, startY, pageNum, po) => {
  let y = startY
  let cardStartY = y
  let ly = y + SP_8
  
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 8, C.glassHeaderBg)
  setFont(doc, 8.5, 'bold', C.glassHeader)
  drawText(doc, 'PURCHASE ITEMS', MARGIN.l + 4, ly + 5.5)
  ly += 8

  ly = drawTableHeader(doc, cols, ly)
  
  let tQty = 0, tArea = 0, tAmt = 0
  
  lines.forEach((line, i) => {
    const w = line.width_inch || (line.width_mm ? line.width_mm / 25.4 : 0)
    const h = line.height_inch || (line.height_mm ? line.height_mm / 25.4 : 0)
    const qty = line.quantity || 1
    const area = line.charged_sqft || line.total_sqft || 0
    const amt = line.subtotal || line.line_total || 0
    tQty += qty; tArea += area; tAmt += amt
    
    // Check page break before row
    if ((PAGE_H - 18) - ly < 6.5 + SP_8 + 7.5) {
      drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
      y = checkPageBreak(doc, y, 999, pageNum, po)
      cardStartY = y
      ly = y + SP_8
      
      drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 8, C.glassHeaderBg)
      setFont(doc, 8.5, 'bold', C.glassHeader)
      drawText(doc, 'PURCHASE ITEMS (Continued)', MARGIN.l + 4, ly + 5.5)
      ly += 8
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = line.charged_w_inch || w
    const chargedH = line.charged_h_inch || h
    const chargedSizeStr = `${chargedW}" x ${chargedH}"`

    const vals = [
      String(i + 1),
      w > 0 ? toFraction(w) + '"' : '',
      h > 0 ? toFraction(h) + '"' : '',
      chargedSizeStr,
      String(qty),
      area.toFixed(3),
      parseFloat(((w + h) * 2 / 12 * qty).toFixed(3)).toString(),
      fmtR(amt)
    ]
    ly = drawDataRow(doc, cols, vals, i % 2 === 1, ly)
  })
  
  ly = drawGroupSubtotal(doc, cols, tQty, tArea, 0, tAmt, false, ly)
  drawCard(doc, MARGIN.l, cardStartY, CONTENT_W, ly - cardStartY, null, C.border, 2.0)
  
  return { endY: ly, tQty, tArea, tAmt }
}

export const generatePOPDF = (po) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const company = getCompany(po.company_id)
    let vend = { name: po.vendor_name || '', address: '', phone: '', gstin: '' }
    try {
      const all = JSON.parse(localStorage.getItem('vendors') || '[]')
      const v = all.find(x => x.id === po.vendor_id)
      if (v) vend = { name: v.name, address: [v.address, v.city].filter(Boolean).join(', '), phone: v.phone || '', gstin: v.gstin || '' }
    } catch { }

    const cols = buildCols(false)
    let pageNum = { val: 1, total: '?' }

    drawBorder(doc)
    let y = drawHeader(doc, company, 'PURCHASE ORDER')
    y = drawDocInfo(doc, {
      quote_number: po.po_number,
      quote_date: po.po_date,
      valid_until: po.expected_delivery || 'TBD',
      salesperson: '',
      payment_terms: po.payment_terms,
      company_id: po.company_id
    }, y, 'PURCHASE ORDER')
    y = drawVendorCard(doc, vend, y)

    // Render items card (using splits if needed)
    const res = drawPOItemsCard(doc, po.lines || [], cols, y, pageNum, po)
    const tQty = res.tQty
    const tArea = res.tArea
    const tAmt = res.tAmt
    y = res.endY + SP_16

    y = checkPageBreak(doc, y, 9 + SP_16, pageNum, po)
    y = drawTotalBar(doc, tQty, tArea, tAmt, y) + SP_16

    // Summary block
    const grand = po.total_amount || 0
    const totalsRows = [
      { label: 'Items Subtotal', value: po.subtotal || 0 },
      po.tax_amount > 0 ? { label: 'GST', value: po.tax_amount, pct: '18.00' } : null,
      { label: 'GRAND TOTAL', value: grand, grand: true }
    ].filter(Boolean)

    const summaryHeight = calculateSummaryHeight(totalsRows)
    y = checkPageBreak(doc, y, summaryHeight + 22 + 28, pageNum, po)

    y = drawFinalSummaryBlock(doc, totalsRows, toWords(Math.round(grand)), { payment_terms: po.payment_terms }, y) + SP_16
    y = drawSignatureStrip(doc, company, y) + SP_16
    drawTerms(doc, y)

    addFootersAndPageNumbers(doc, po.po_number || 'PO')
    doc.save(`${po.po_number || 'PO'}_Essar.pdf`)
  } catch (e) {
    console.error('PO PDF:', e)
    alert('PO PDF failed: ' + e.message)
  }
}
