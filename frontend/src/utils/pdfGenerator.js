import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Number to words (Indian format) ──────────────────────────
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

// ── Fraction display ──────────────────────────────────────────
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

// ── Format amount ─────────────────────────────────────────────
const fmtN = (v) =>
  'Rs.' + Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

const fmtR = (v) =>
  'Rs. ' + Number(v || 0).toFixed(2)

// ── Charged size in MM ────────────────────────────────────────
const ceilMm = (inch) =>
  Math.round(Math.ceil((inch || 0) / 3) * 3 * 25.4)

// ── Get company from localStorage ────────────────────────────
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

// ── Get process master ────────────────────────────────────────
const getPM = (id) => {
  try {
    const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
    return pm.find(p => p.id === id) || null
  } catch { return null }
}

// ── Page constants ────────────────────────────────────────────
const LM = 10   // left margin
const RM = 10   // right margin
const TM = 8    // top margin after header

// ════════════════════════════════════════════════════════════════
// DRAW FUNCTIONS
// ════════════════════════════════════════════════════════════════

// Draw thick border around entire content area
const drawBorder = (doc) => {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  doc.setDrawColor(26, 35, 126)
  doc.setLineWidth(0.5)
  doc.rect(LM - 2, TM - 2, pw - LM - RM + 4, ph - TM - 8, 'S')
  doc.setLineWidth(0.2)
}

// ── Company header (Sapphire style: centered, bold) ──────────
const drawCompanyHeader = (doc, company) => {
  const pw = doc.internal.pageSize.getWidth()
  let y = TM + 2

  // Company name — large centered
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text(company.name || 'ESSAR SONS', pw / 2, y, { align: 'center' })
  y += 5

  // Tagline
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(40, 40, 40)
  doc.text(company.tagline || "AN 'ESSAR SONS' GROUP COMPANY",
    pw / 2, y, { align: 'center' })
  y += 4

  // Address
  const addr = [company.address, company.city].filter(Boolean).join(', ')
  doc.text(addr.substring(0, 75), pw / 2, y, { align: 'center' })
  y += 4

  // GST + Phone + Website
  const contact = [
    company.gst || company.gstin ? `GSTIN: ${company.gst || company.gstin}` : '',
    company.phone ? `Ph: ${company.phone}` : '',
    company.website || '',
  ].filter(Boolean).join('   |   ')
  doc.text(contact.substring(0, 80), pw / 2, y, { align: 'center' })
  y += 5

  // Divider line
  doc.setDrawColor(180, 190, 220)
  doc.setLineWidth(0.3)
  doc.line(LM, y, pw - RM, y)
  y += 4

  // "Proforma Invoice" title (centered, bold — Sapphire exact)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text('Proforma Invoice', pw / 2, y, { align: 'center' })
  y += 5

  // Divider
  doc.setDrawColor(180, 190, 220)
  doc.line(LM, y, pw - RM, y)
  y += 3

  return y
}

// ── Doc info row (like Sapphire's PROFORMA No | Date etc) ────
const drawDocInfoRow = (doc, info, y) => {
  const pw = doc.internal.pageSize.getWidth()
  const col = (pw - LM - RM) / info.length

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)

  info.forEach((item, i) => {
    const x = LM + i * col
    doc.setFont('helvetica', 'bold')
    doc.text(item.label, x, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(item.value || ''), x + item.lw, y)
  })

  doc.setDrawColor(180, 190, 220)
  doc.setLineWidth(0.2)
  doc.line(LM, y + 2, pw - RM, y + 2)
  return y + 6
}

// ── Bill To / Ship To (side by side like Sapphire) ───────────
const drawBillShipTo = (doc, billTo, shipTo, y) => {
  const pw = doc.internal.pageSize.getWidth()
  const mid = pw / 2
  const bh = 36

  // Vertical divider
  doc.setDrawColor(180, 190, 220)
  doc.line(mid, y, mid, y + bh)

  // Horizontal borders
  doc.line(LM, y, pw - RM, y)
  doc.line(LM, y + bh, pw - RM, y + bh)

  const drawSide = (data, startX, label) => {
    let ly = y + 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(label + ' :', startX, ly)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text((data.name || '').substring(0, 34), startX, ly + 4)
    ly += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 30, 30)
    if (data.address) {
      const lines = doc.splitTextToSize(data.address, mid - startX - 4)
      lines.slice(0, 2).forEach(l => { doc.text(l, startX, ly); ly += 3.5 })
    }
    if (data.phone) { doc.text(`Tel : ${data.phone}`, startX, ly); ly += 3.5 }
    if (data.gstin) { doc.text(`GSTIN: ${data.gstin}`, startX, ly); ly += 3.5 }
    if (data.state) { doc.text(`State : ${data.state}`, startX, ly) }
  }

  drawSide(billTo, LM + 2, 'Bill To')
  drawSide(shipTo, mid + 3, 'Ship To')

  return y + bh
}

// ── Account row (Account To | Outstanding | Credit Limit) ────
const drawAccountRow = (doc, accountName, outstanding, creditLimit, y) => {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(`Account To : ${accountName || ''}`, LM + 2, y + 4)
  doc.text(`Total OutStanding : ${outstanding || ''}`,
    pw / 2 - 20, y + 4)
  doc.text(`Credit Limit : ${creditLimit || '0'}`, pw - 50, y + 4)
  doc.setDrawColor(180, 190, 220)
  doc.line(LM, y + 6, pw - RM, y + 6)
  return y + 8
}

// ── Product group header (like "1 OB252629480 10MM CLEAR...") ─
const drawGroupHeader = (doc, num, code, desc, y) => {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFillColor(240, 244, 255)
  doc.rect(LM, y, pw - LM - RM, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 50)
  doc.text(`${num})  ${desc || ''}`, LM + 2, y + 4.5)
  doc.setDrawColor(180, 190, 220)
  doc.line(LM, y + 6, pw - RM, y + 6)
  return y + 6
}

// ── Table column definitions (Sapphire-exact) ─────────────────
// Portrait A4 usable = 190mm
// Sr | Actual W | Actual H | Chg W mm | Chg H mm | Qty |
// Hole | Cutout | Area | Rate | [CEP] | Amount
const buildCols = (hasCep) => {
  if (hasCep) {
    return [
      { h: 'Sr.\nNo', x: LM, w: 8, a: 'c' },
      { h: 'Description', x: 18, w: 52, a: 'l' },
      { h: 'Actual W\n(inch)', x: 70, w: 20, a: 'r' },
      { h: 'Actual H\n(inch)', x: 90, w: 20, a: 'r' },
      { h: 'Qty', x: 110, w: 10, a: 'r' },
      { h: 'Sqft', x: 120, w: 18, a: 'r' },
      { h: 'Rft', x: 138, w: 16, a: 'r' },
      { h: 'CEP\n(Rs.)', x: 154, w: 18, a: 'r' },
      { h: 'Amount', x: 172, w: 26, a: 'r' },
    ]
  }
  return [
    { h: 'Sr.\nNo', x: LM, w: 8, a: 'c' },
    { h: 'Description', x: 18, w: 56, a: 'l' },
    { h: 'Actual W\n(inch)', x: 74, w: 22, a: 'r' },
    { h: 'Actual H\n(inch)', x: 96, w: 22, a: 'r' },
    { h: 'Qty', x: 118, w: 10, a: 'r' },
    { h: 'Sqft', x: 128, w: 20, a: 'r' },
    { h: 'Rft', x: 148, w: 18, a: 'r' },
    { h: 'Amount', x: 166, w: 32, a: 'r' },
  ]
}

// ── Draw table header row ─────────────────────────────────────
const drawTH = (doc, y, cols) => {
  const pw = doc.internal.pageSize.getWidth()
  // Blue header like Sapphire
  doc.setFillColor(220, 228, 250)
  doc.rect(LM, y, pw - LM - RM, 11, 'F')
  doc.setDrawColor(160, 175, 220)
  doc.rect(LM, y, pw - LM - RM, 11, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 50)

  cols.forEach(c => {
    const lines = c.h.split('\n')
    const cx = c.a === 'r' ? c.x + c.w - 1 : c.a === 'c' ? c.x + c.w / 2 : c.x + 1
    const al = c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left'
    if (lines.length === 2) {
      doc.text(lines[0], cx, y + 4, { align: al })
      doc.text(lines[1], cx, y + 8.5, { align: al })
    } else {
      doc.text(lines[0], cx, y + 6.5, { align: al })
    }
    // Column vertical dividers
    doc.setDrawColor(160, 175, 220)
    doc.line(c.x, y, c.x, y + 11)
  })
  // Last divider
  const lastCol = cols[cols.length - 1]
  doc.line(lastCol.x + lastCol.w, y, lastCol.x + lastCol.w, y + 11)
  doc.setTextColor(0, 0, 0)
  return y + 11
}

// ── Draw data row ─────────────────────────────────────────────
const drawTR = (doc, y, cols, vals, isAlt) => {
  const pw = doc.internal.pageSize.getWidth()
  const rh = 6
  if (isAlt) {
    doc.setFillColor(250, 252, 255)
    doc.rect(LM, y, pw - LM - RM, rh, 'F')
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(10, 10, 40)

  cols.forEach((c, i) => {
    const v = String(vals[i] ?? '')
    if (!v) return
    const al = c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left'
    const cx = c.a === 'r' ? c.x + c.w - 1 : c.a === 'c' ? c.x + c.w / 2 : c.x + 1
    const mc = Math.max(3, Math.floor(c.w / 1.7))
    try { doc.text(v.substring(0, mc), cx, y + 4, { align: al }) } catch { }
    // Vertical divider
    doc.setDrawColor(200, 210, 230)
    doc.line(c.x, y, c.x, y + rh)
  })
  const lc = cols[cols.length - 1]
  doc.line(lc.x + lc.w, y, lc.x + lc.w, y + rh)

  doc.setDrawColor(210, 218, 235)
  doc.line(LM, y + rh, pw - RM, y + rh)
  return y + rh
}

// ── Draw sub-total row at end of table (Sapphire style) ───────
const drawSubTotalRow = (doc, y, cols, qty, area, cep, amt, hasCep) => {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFillColor(235, 240, 255)
  doc.rect(LM, y, pw - LM - RM, 6.5, 'F')
  doc.setDrawColor(180, 195, 230)
  doc.rect(LM, y, pw - LM - RM, 6.5, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 50)

  // Find cols by header keyword
  const qtyC = cols.find(c => c.h === 'Qty')
  const sqftC = cols.find(c => c.h === 'Sqft')
  const cepC = hasCep ? cols.find(c => c.h.includes('CEP')) : null
  const amtC = cols[cols.length - 1]

  if (qtyC)
    doc.text(String(qty), qtyC.x + qtyC.w - 1, y + 4.5, { align: 'right' })
  if (sqftC)
    doc.text(area.toFixed(3), sqftC.x + sqftC.w - 1, y + 4.5, { align: 'right' })
  if (cepC && hasCep)
    doc.text(fmtN(cep), cepC.x + cepC.w - 1, y + 4.5, { align: 'right' })
  if (amtC)
    doc.text(fmtN(amt), amtC.x + amtC.w - 1, y + 4.5, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  return y + 6.5
}

// ── HSN row ───────────────────────────────────────────────────
const drawHSNRow = (doc, y, hsnCode) => {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 50)
  doc.text(`HSN #:${hsnCode || '7007'}`, LM + 2, y + 4)
  doc.setDrawColor(180, 195, 230)
  doc.line(LM, y + 6, pw - RM, y + 6)
  return y + 7
}

// ── Total Summery row (full width, bold) ──────────────────────
const drawTotalSummery = (doc, y, totalQty, totalArea, totalAmt) => {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFillColor(220, 228, 250)
  doc.rect(LM, y, pw - LM - RM, 8, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 50)
  doc.text('Total Summery', LM + 2, y + 5.5)
  doc.text(String(totalQty), LM + 60, y + 5.5, { align: 'right' })
  doc.text(totalArea.toFixed(4), LM + 120, y + 5.5, { align: 'right' })
  doc.text(fmtN(totalAmt), pw - RM - 2, y + 5.5, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  return y + 8
}

// ── Two-column bottom section (like Sapphire) ─────────────────
// Left: payment/delivery info | Right: totals
const drawBottomSection = (doc, leftItems, totalsRows, amtWords, y) => {
  const pw = doc.internal.pageSize.getWidth()
  const mid = pw / 2 - 5
  const startY = y

  // Left side content
  let ly = startY + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  leftItems.forEach(item => {
    if (!item) return
    doc.setFont('helvetica', 'bold')
    doc.text(item.label, LM + 2, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(String(item.value || ''), LM + 2, ly + 3.5)
    ly += 8
  })

  // Right side: totals
  let ry = startY + 2
  const lx = mid + 8
  const vx = pw - RM - 2

  // Vertical divider
  doc.setDrawColor(180, 195, 230)
  doc.line(mid + 4, startY, mid + 4, startY + 80)

  totalsRows.forEach(row => {
    if (!row) return
    if (row.divider) {
      doc.setDrawColor(180, 195, 230)
      doc.line(lx - 2, ry + 2, vx, ry + 2)
      ry += 5; return
    }
    if (row.grand) {
      doc.setFillColor(26, 35, 126)
      doc.rect(lx - 3, ry - 1, vx - lx + 6, 9, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(row.label, lx, ry + 6)
      doc.text(fmtN(row.value), vx, ry + 6, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      ry += 11; return
    }
    if (row.pct) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text(row.label, lx, ry + 4)
      doc.text(`${row.pct} %`, lx + 45, ry + 4)
      doc.text(fmtN(row.value), vx, ry + 4, { align: 'right' })
    } else if (row.sub) {
      doc.setFillColor(235, 241, 255)
      doc.rect(lx - 3, ry - 1, vx - lx + 6, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(26, 35, 126)
      doc.text(row.label, lx, ry + 5)
      doc.text(fmtN(row.value), vx, ry + 5, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      ry += 9; return
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text(row.label, lx, ry + 4)
      doc.text(fmtN(row.value), vx, ry + 4, { align: 'right' })
    }
    ry += 7
  })

  // Amount in words — below totals on right side
  if (amtWords) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(0, 0, 0)
    doc.text('Amt. in Words:', lx, ry + 4)
    doc.setFont('helvetica', 'normal')
    const wlines = doc.splitTextToSize(amtWords, vx - lx - 2)
    wlines.slice(0, 2).forEach((l, i) =>
      doc.text(l, lx, ry + 8 + i * 4)
    )
    ry += 16
  }

  return Math.max(ly, ry) + 4
}

// ── PI Remark row ─────────────────────────────────────────────
const drawRemarkRow = (doc, remark, note, y) => {
  const pw = doc.internal.pageSize.getWidth()
  const mid = pw / 2
  doc.setDrawColor(180, 195, 230)
  doc.line(LM, y, pw - RM, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text('PI Remark:', LM + 2, y + 4)
  doc.text('Gen. Note:', mid + 2, y + 4)
  doc.setFont('helvetica', 'normal')
  if (remark) doc.text(remark.substring(0, 40), LM + 22, y + 4)
  if (note) doc.text(note.substring(0, 40), mid + 20, y + 4)
  doc.line(LM, y + 6, pw - RM, y + 6)
  return y + 8
}

// ── Terms & Conditions ────────────────────────────────────────
const drawTerms = (doc, terms, y) => {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text('Terms & Conditions :', LM + 2, y + 4)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  terms.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, pw - LM - RM - 4)
    lines.forEach(l => { doc.text(l, LM + 2, y); y += 3.5 })
  })
  return y + 3
}

// ── Page footer ───────────────────────────────────────────────
const drawPageFooter = (doc, docNo, pageNum, totalPages) => {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  doc.setDrawColor(180, 190, 220)
  doc.line(LM, ph - 10, pw - RM, ph - 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 100)
  doc.text(`Proforma No : ${docNo}`, LM + 2, ph - 6)
  doc.text(`Print DateTime : ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pw / 2, ph - 6, { align: 'center' })
  doc.text(`Page ${pageNum} of ${totalPages}`, pw - RM - 2, ph - 6, { align: 'right' })
}

// ════════════════════════════════════════════════════════════════
// MAIN: QUOTATION / PROFORMA INVOICE PDF
// ════════════════════════════════════════════════════════════════
export const generateQuotationPDF = (quotation) => {
  try {
    const {
      hardware_items = [],
      labor_items = [],
    } = quotation
    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const company = getCompany(quotation.company_id)

    // Fetch customer
    let cust = {
      name: quotation.customer_name || '',
      address: '', phone: '', gstin: '', state: ''
    }
    try {
      const all = JSON.parse(localStorage.getItem('customers') || '[]')
      const c = all.find(x => x.id === quotation.customer_id)
      if (c) cust = {
        name: c.name,
        address: [c.address, c.city].filter(Boolean).join(', '),
        phone: c.phone || c.mobile || '',
        gstin: c.gstin || '',
        state: c.state || 'Maharashtra',
      }
    } catch { }

    drawBorder(doc)

    // ── Header ──────────────────────────────────────────────
    let y = drawCompanyHeader(doc, company)

    // ── Doc info row ─────────────────────────────────────────
    y = drawDocInfoRow(doc, [
      { label: 'PROFORMA No :', value: quotation.quote_number, lw: 28 },
      { label: 'Date :', value: quotation.quote_date, lw: 14 },
      { label: 'Valid Until :', value: quotation.valid_until, lw: 22 },
      { label: 'Salesperson :', value: quotation.salesperson, lw: 23 },
    ], y)

    y = drawDocInfoRow(doc, [
      { label: 'Payment :', value: quotation.payment_terms, lw: 18 },
      { label: 'Delivery Date :', value: '', lw: 24 },
      { label: 'Prepared By :', value: quotation.salesperson || 'Admin', lw: 23 },
      { label: 'Project :', value: '', lw: 15 },
    ], y)

    // ── Bill To / Ship To ────────────────────────────────────
    y = drawBillShipTo(doc, cust, cust, y)

    // ── Account row ──────────────────────────────────────────
    y = drawAccountRow(doc, cust.name, '', '0', y)

    // ── Build table data from groups ─────────────────────────
    const groups = quotation.groups || []
    const hasCep = groups.some(g => g.cep)
    const cols = buildCols(hasCep)

    let totalQty = 0
    let totalArea = 0
    let totalCep = 0
    let grandGlass = 0
    let procTotal = 0
    let groupNo = 0

    // Collect all rows to render
    const allRows = []

    groups.forEach((group, gi) => {
      groupNo++
      // Group header row (like "1 OB252629480 10MM CLEAR TGH...")
      let desc = group.description || ''
      if (group.is_toughened && !desc.toLowerCase().includes('toughen'))
        desc += ' Toughen'
      if (group.cep) desc += ' CEP'
      allRows.push({ type: 'groupHeader', num: groupNo, desc })

      // Count processes
      let holes = 0, cutouts = 0
        ; (group.processes || []).forEach(p => {
          const pm = getPM(p.process_id)
          if (pm?.process_type === 'hole') holes += Math.round(p.qty_area || 0)
          if (pm?.process_type === 'cutout') cutouts += Math.round(p.qty_area || 0)
          if (pm && pm.process_type !== 'polishing')
            procTotal += parseFloat(p.amount || 0)
        })

      group.sizes?.forEach((size, si) => {
        const w = size.width_inch || 0
        const h = size.height_inch || 0
        const qty = size.quantity || 1
        const area = size.total_sqft || 0
        const cep = size.cep_charges || 0
        const amt = size.subtotal || 0

        totalQty += qty
        totalArea += area
        totalCep += cep
        grandGlass += amt

        const sizeLabel = String.fromCharCode(97 + si) + ')'

        const vals = [
          sizeLabel,
          si === 0 ? desc.substring(0, 28) : '',
          w > 0 ? toFraction(w) + '"' : '',
          h > 0 ? toFraction(h) + '"' : '',
          String(qty),
          area.toFixed(3),
          parseFloat(((w + h) * 2 / 12 * qty).toFixed(3)).toString(),
          ...(hasCep ? [cep > 0 ? fmtN(cep) : ''] : []),
          fmtN(amt),
        ]

        allRows.push({
          type: 'data',
          vals: vals,
          isAlt: si % 2 === 0
        })
      })
    })

    // ── Render table rows ─────────────────────────────────────
    y = drawTH(doc, y, cols)
    let pageNum = 1

    allRows.forEach(row => {
      if (y > ph - 90) {
        drawPageFooter(doc, quotation.quote_number || 'QT', pageNum, '?')
        doc.addPage()
        pageNum++
        drawBorder(doc)
        y = drawCompanyHeader(doc, company)
        y = drawTH(doc, y, cols)
      }
      if (row.type === 'groupHeader') {
        y = drawGroupHeader(doc, row.num, '', row.desc, y)
      } else {
        y = drawTR(doc, y, cols, row.vals, row.isAlt)
      }
    })

    // ── Sub-total row ─────────────────────────────────────────
    y = drawSubTotalRow(doc, y, cols,
      totalQty, totalArea, totalCep, grandGlass, hasCep)

    // ── HSN row ───────────────────────────────────────────────
    y = drawHSNRow(doc, y, '7007')

    // ── Total Summery row ─────────────────────────────────────
    y = drawTotalSummery(doc, y, totalQty, totalArea, grandGlass)

    const margin = LM

    // ── PROCESS CHARGES (FIX G: custom layout) ─────────────────────────
    const allProcesses = (groups || []).flatMap(g => [
      ...(g.processes || []),
      ...(g.sizes || []).flatMap(s => s.size_processes || [])
    ]).filter(p => (p.amount || 0) > 0)

    if (allProcesses.length > 0) {
      y += 6
      if (y + 20 > ph - 20) { doc.addPage(); drawBorder(doc); y = 20 }

      // Section header
      doc.setFillColor(230, 230, 250)
      doc.rect(LM, y, pw - LM - RM, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(50, 50, 180)
      doc.text('Process Charges', LM + 2, y + 4.5)
      y += 6

      // Column headers
      const pcols = [
        { label: 'Process', x: LM, w: 70, a: 'left' },
        { label: 'Charge Type', x: LM + 70, w: 32, a: 'left' },
        { label: 'Qty/Area', x: LM + 102, w: 24, a: 'right' },
        { label: 'Rate', x: LM + 126, w: 26, a: 'right' },
        { label: 'Amount', x: LM + 152, w: 36, a: 'right' },
      ]
      doc.setFillColor(220, 228, 250)
      doc.rect(LM, y, pw - LM - RM, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(0, 0, 60)
      pcols.forEach(c => {
        const cx = c.a === 'right' ? c.x + c.w - 1 : c.x + 1
        doc.text(c.label, cx, y + 5, { align: c.a === 'right' ? 'right' : 'left' })
      })
      y += 7

      // Rows
      allProcesses.forEach((p, i) => {
        if (y + 10 > ph - 20) { doc.addPage(); drawBorder(doc); y = 20 }
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 255)
          doc.rect(LM, y, pw - LM - RM, 6, 'F')
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(20, 20, 60)
        const name = (p.process_name || p.name || '-').substring(0, 38)
        const type = (p.charge_type || '-').substring(0, 16)
        const qty = String(p.qty_area || 0)
        const rate = 'Rs.' + Number(p.rate || 0).toFixed(2)
        const amt = 'Rs.' + Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        doc.text(name, LM + 1, y + 4)
        doc.text(type, LM + 71, y + 4)
        doc.text(qty, LM + 125, y + 4, { align: 'right' })
        doc.text(rate, LM + 151, y + 4, { align: 'right' })
        doc.text(amt, LM + 187, y + 4, { align: 'right' })
        doc.setDrawColor(210, 218, 240)
        doc.line(LM, y + 6, pw - RM, y + 6)
        y += 6
      })

      // Process total row
      const procTotalAmt = allProcesses.reduce((s, p) => s + (p.amount || 0), 0)
      doc.setFillColor(235, 240, 255)
      doc.rect(LM, y, pw - LM - RM, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 100)
      doc.text('Process Total', LM + 1, y + 5)
      doc.text('Rs.' + procTotalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        LM + 187, y + 5, { align: 'right' })
      y += 7
    }

    // ── HARDWARE ITEMS (FIX H: autoTable with explicit width & Rs. format) ──
    if (hardware_items?.length > 0) {
      y += 6
      if (y + 10 > ph - 20) { doc.addPage(); y = 20 }

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(180, 100, 0)
      doc.text('Hardware Items', margin, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Description', 'Qty', 'UOM', 'Rate', 'Amount']],
        body: hardware_items.map(h => [
          h.description || '—',
          String(h.qty || 0),
          h.uom || '—',
          'Rs.' + Number(h.rate || 0).toFixed(2),
          'Rs.' + Number(h.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [180, 120, 0], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 14, halign: 'right' },
          2: { cellWidth: 18 },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 46, halign: 'right' },
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => { drawBorder(doc) }
      })
      y = doc.lastAutoTable.finalY
    }

    // ── LABOR CHARGES (FIX H: autoTable with explicit width & Rs. format) ──
    if (labor_items?.length > 0) {
      y += 6
      if (y + 10 > ph - 20) { doc.addPage(); y = 20 }

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 50, 180)
      doc.text('Labor Charges', margin, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Description', 'Qty', 'UOM', 'Rate', 'Amount']],
        body: labor_items.map(l => [
          l.description || '—',
          String(l.qty || 0),
          l.uom || '—',
          'Rs.' + Number(l.rate || 0).toFixed(2),
          'Rs.' + Number(l.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [100, 50, 180], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 14, halign: 'right' },
          2: { cellWidth: 18 },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 46, halign: 'right' },
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => { drawBorder(doc) }
      })
      y = doc.lastAutoTable.finalY
    }

    y += 4

    // ── Two-column bottom section ─────────────────────────────
    const t = quotation.totals || {}
    const subI = t.subI || grandGlass || 0
    const procTot = t.procTotal || procTotal || 0
    const hwTot = t.hwTotal || quotation.hardware_items?.reduce((s, h) => s + (h.amount || 0), 0) || 0
    const lbTot = t.lbTotal || quotation.labor_items?.reduce((s, l) => s + (l.amount || 0), 0) || 0
    const dcChg = t.dcCharges || quotation.dc_charge || 0
    const subII = t.subII || (subI + procTot + hwTot + lbTot + dcChg)
    const disc = t.discountAmt || quotation.discount_amount || 0
    const subIII = t.subIII || Math.max(0, subII - disc)
    const cgst = t.cgst || quotation.cgst || 0
    const sgst = t.sgst || quotation.sgst || 0
    const igst = t.igst || quotation.igst || 0
    const grand = t.grandTotal || quotation.total_amount ||
      (subIII + cgst + sgst + igst)
    const roundOff = parseFloat((Math.round(grand) - grand).toFixed(2))
    const adv = quotation.advance_received || 0
    const bal = Math.round(grand) - adv

    const leftItems = [
      { label: 'Payment Term :', value: quotation.payment_terms || '' },
      { label: 'Delivery Period :', value: quotation.delivery_date || '' },
      { label: 'Validity :', value: '8 days from date of issue' },
      { label: 'Note :', value: 'Unloading by Buyer' },
    ]

    const totalsRows = [
      { label: 'BASIC', value: subI },
      procTot > 0
        ? { label: 'DOCUMENTATION\nCHARGES', value: procTot }
        : null,
      hwTot > 0
        ? { label: 'HARDWARE', value: hwTot }
        : null,
      lbTot > 0
        ? { label: 'LABOR', value: lbTot }
        : null,
      dcChg > 0
        ? { label: 'D/C CHARGES', value: dcChg }
        : null,
      (procTot > 0 || dcChg > 0 || hwTot > 0 || lbTot > 0)
        ? { label: 'ASSESSABLE VALUE', value: subII, sub: true }
        : null,
      disc > 0
        ? { label: 'DISCOUNT', value: disc }
        : null,
      { divider: true },
      cgst > 0
        ? { label: 'CGST', value: cgst, pct: '9.00' }
        : null,
      sgst > 0
        ? { label: 'SGST', value: sgst, pct: '9.00' }
        : null,
      igst > 0
        ? { label: 'IGST', value: igst, pct: '18.00' }
        : null,
      Math.abs(roundOff) > 0
        ? { label: 'ROUND OFF', value: roundOff }
        : null,
      { label: 'Grand Total', value: Math.round(grand), grand: true },
      adv > 0
        ? { label: 'Advance Received', value: adv }
        : null,
      adv > 0
        ? { label: 'Balance Due', value: bal, sub: true }
        : null,
    ].filter(Boolean)

    y = drawBottomSection(doc, leftItems, totalsRows,
      toWords(Math.round(grand)), y)

    // ── PI Remark row ─────────────────────────────────────────
    y = drawRemarkRow(doc, '', '', y)

    // ── Terms & Conditions ────────────────────────────────────
    y = drawTerms(doc, [
      'Please double check Billing & Delivery Address, GST No., Glass Specifications, Size, Quantity, Rates & Taxes.',
      'Goods sold cannot be exchanged or returned after confirmation.',
      'Accepted tolerance: +/- 2mm in dimensions.',
      'Delivery, unloading & hauling charges are extra and payable by buyer.',
      'Delayed payment charges @ 2% per month after due date.',
      'All disputes subject to Palghar jurisdiction.',
    ], y)

    // ── Page footer ───────────────────────────────────────────
    drawPageFooter(doc, quotation.quote_number || 'QT', pageNum, pageNum)

    doc.save(`${quotation.quote_number || 'QT'}_Essar.pdf`)

  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF failed: ' + e.message)
  }
}

// ════════════════════════════════════════════════════════════════
// SALES ORDER PDF (same structure, simpler)
// ════════════════════════════════════════════════════════════════
export const generateSOPDF = (so) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const co = getCompany(so.company_id)

    let cust = { name: so.customer_name || '', address: '', phone: '', gstin: '' }
    try {
      const all = JSON.parse(localStorage.getItem('customers') || '[]')
      const c = all.find(x => x.id === so.customer_id)
      if (c) cust = {
        name: c.name,
        address: [c.address, c.city].filter(Boolean).join(', '),
        phone: c.phone || '', gstin: c.gstin || ''
      }
    } catch { }

    drawBorder(doc)
    let y = drawCompanyHeader(doc, co)
    y = drawDocInfoRow(doc, [
      { label: 'SO Number :', value: so.so_number, lw: 23 },
      { label: 'Date :', value: so.order_date, lw: 14 },
      { label: 'Delivery :', value: so.delivery_date || 'TBD', lw: 18 },
      { label: 'Salesperson :', value: so.salesperson, lw: 23 },
    ], y)
    y = drawBillShipTo(doc, cust, cust, y)
    y = drawAccountRow(doc, cust.name, '', '0', y)

    const hasCep = (so.lines || []).some(l => l.cep)
    const cols = buildCols(hasCep)
    y = drawTH(doc, y, cols)

    let tQty = 0, tArea = 0, tCep = 0, tAmt = 0
      ; (so.lines || []).forEach((line, i) => {
        if (y > ph - 90) {
          drawPageFooter(doc, so.so_number || 'SO', 1, 1)
          doc.addPage(); drawBorder(doc)
          y = drawCompanyHeader(doc, co)
          y = drawTH(doc, y, cols)
        }
        const w = line.width_inch || (line.width_mm ? line.width_mm / 25.4 : 0)
        const h = line.height_inch || (line.height_mm ? line.height_mm / 25.4 : 0)
        const qty = line.quantity || 1
        const area = line.total_sqft || 0
        const cep = line.cep_charges || 0
        const amt = line.subtotal || line.line_total || 0
        tQty += qty; tArea += area; tCep += cep; tAmt += amt
        const vals = [
          String(i + 1),
          (line.description || '').substring(0, 30),
          w > 0 ? toFraction(w) + '"' : '',
          h > 0 ? toFraction(h) + '"' : '',
          String(line.quantity || 1),
          Number(line.total_sqft || 0).toFixed(3),
          ...(hasCep ? [line.cep_charges > 0 ? fmtN(line.cep_charges) : ''] : []),
          fmtN(line.subtotal || line.line_total || 0),
        ]
        y = drawTR(doc, y, cols, vals, i % 2 === 0)
      })

    y = drawSubTotalRow(doc, y, cols, tQty, tArea, tCep, tAmt, hasCep)
    y = drawHSNRow(doc, y, '7007')
    y = drawTotalSummery(doc, y, tQty, tArea, tAmt, cols)

    const grand = so.total_amount || 0
    y = drawBottomSection(doc,
      [
        { label: 'Payment :', value: so.payment_terms || '' },
        { label: 'Delivery :', value: so.delivery_date || 'TBD' },
      ],
      [
        { label: 'BASIC', value: so.subtotal || 0 },
        so.tax_amount > 0 ? { label: 'GST', value: so.tax_amount, pct: '18.00' } : null,
        { label: 'Grand Total', value: grand, grand: true },
      ].filter(Boolean),
      toWords(Math.round(grand)), y
    )
    y = drawRemarkRow(doc, '', '', y)
    drawPageFooter(doc, so.so_number || 'SO', 1, 1)
    doc.save(`${so.so_number || 'SO'}_Essar.pdf`)
  } catch (e) {
    console.error('SO PDF:', e)
    alert('SO PDF failed: ' + e.message)
  }
}

// ════════════════════════════════════════════════════════════════
// PURCHASE ORDER PDF
// ════════════════════════════════════════════════════════════════
export const generatePOPDF = (po) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const co = getCompany(po.company_id)

    let vend = { name: po.vendor_name || '', address: '', phone: '', gstin: '' }
    try {
      const all = JSON.parse(localStorage.getItem('vendors') || '[]')
      const v = all.find(x => x.id === po.vendor_id)
      if (v) vend = {
        name: v.name,
        address: [v.address, v.city].filter(Boolean).join(', '),
        phone: v.phone || '', gstin: v.gstin || ''
      }
    } catch { }

    drawBorder(doc)
    let y = drawCompanyHeader(doc, co)
    y = drawDocInfoRow(doc, [
      { label: 'PO Number :', value: po.po_number, lw: 20 },
      { label: 'Date :', value: po.po_date, lw: 14 },
      { label: 'Expected :', value: po.expected_delivery || 'TBD', lw: 18 },
      { label: 'Ref SO :', value: po.so_id || '', lw: 15 },
    ], y)
    y = drawBillShipTo(doc, vend, vend, y)
    y = drawAccountRow(doc, vend.name, '', '0', y)

    const cols = buildCols(false)
    y = drawTH(doc, y, cols)

    let tQty = 0, tArea = 0, tAmt = 0
      ; (po.lines || []).forEach((line, i) => {
        if (y > ph - 90) {
          drawPageFooter(doc, po.po_number || 'PO', 1, 1)
          doc.addPage(); drawBorder(doc)
          y = drawCompanyHeader(doc, co)
          y = drawTH(doc, y, cols)
        }
        const w = line.width_inch || (line.width_mm ? line.width_mm / 25.4 : 0)
        const h = line.height_inch || (line.height_mm ? line.height_mm / 25.4 : 0)
        const qty = line.quantity || 1
        const area = line.charged_sqft || line.total_sqft || 0
        const amt = line.subtotal || line.line_total || 0
        tQty += qty; tArea += area; tAmt += amt
        const vals = [
          String(i + 1),
          (line.description || '').substring(0, 30),
          w > 0 ? toFraction(w) + '"' : '',
          h > 0 ? toFraction(h) + '"' : '',
          String(line.quantity || 1),
          Number(line.charged_sqft || line.total_sqft || 0).toFixed(3),
          fmtN(line.subtotal || line.line_total || 0),
        ]
        y = drawTR(doc, y, cols, vals, i % 2 === 0)
      })
    y = drawSubTotalRow(doc, y, cols, tQty, tArea, 0, tAmt, false)
    y = drawHSNRow(doc, y, '7007')
    y = drawTotalSummery(doc, y, tQty, tArea, tAmt, cols)

    const grand = po.total_amount || 0
    y = drawBottomSection(doc,
      [{ label: 'Vendor :', value: vend.name }, { label: 'Payment :', value: po.payment_terms || '' }],
      [
        { label: 'BASIC', value: po.subtotal || 0 },
        po.tax_amount > 0 ? { label: 'GST', value: po.tax_amount, pct: '18.00' } : null,
        { label: 'Grand Total', value: grand, grand: true },
      ].filter(Boolean),
      toWords(Math.round(grand)), y
    )
    y = drawRemarkRow(doc, '', '', y)
    drawPageFooter(doc, po.po_number || 'PO', 1, 1)
    doc.save(`${po.po_number || 'PO'}_Essar.pdf`)
  } catch (e) {
    console.error('PO PDF:', e)
    alert('PO PDF failed: ' + e.message)
  }
}
