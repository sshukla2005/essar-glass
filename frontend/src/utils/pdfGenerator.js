import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { customerApi, vendorApi } from '../api'

// ── Date formatter ──────────────────────
const formatDate = (d) => {
  if (!d) return ''
  if (typeof d.format === 'function') {
    return d.format('DD-MM-YYYY')
  }
  if (typeof d === 'string') {
    const parts = d.split('T')[0].split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
    return d
  }
  return String(d)
}

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
  if (n === 0) return 'Rupees Zero Only'
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

const fmtN = (v) =>
  Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

export const cepRateLabel = (group) => {
  if (group.cep_polish_rate === 'custom')    return `₹${group.cep_polish_rate_custom ?? 0}/rft`
  if (group.cep_polish_rate === 'custom_mm') return `₹${group.cep_polish_rate_custom ?? 0}/mm`
  return `₹${group.cep_polish_rate || 15}/rft`
}

const STATE_CODES = {
  '27': 'MAHARASHTRA',
  '24': 'GUJARAT',
  '07': 'DELHI',
  '09': 'UTTAR PRADESH',
  '08': 'RAJASTHAN',
  '19': 'WEST BENGAL',
  '29': 'KARNATAKA',
  '33': 'TAMIL NADU',
  '36': 'TELANGANA',
  '37': 'ANDHRA PRADESH',
  '32': 'KERALA',
}

const getStateStr = (gstin, state) => {
  let code = ''
  let name = state || ''
  if (gstin && gstin.length >= 2) {
    code = gstin.substring(0, 2)
    if (!name && STATE_CODES[code]) {
      name = STATE_CODES[code]
    }
  }
  if (code && name) return `${code}-${name.toUpperCase()}`
  if (code) return code
  if (name) return name.toUpperCase()
}

const composeGroupDesc = (group) => {
  const desc = (group.description || '').toUpperCase()
  const thicknessStr = group.glass_thickness ? `${group.glass_thickness}MM` : ''
  const typeStr = (group.glass_type || '').toUpperCase()
  const catStr = (group.glass_category || '').toUpperCase()
  const toughStr = group.is_toughened ? 'TOUGHENED' : ''
  
  const prefixes = [thicknessStr, typeStr, catStr, toughStr].filter(Boolean)
  
  const hasThickness = thicknessStr && desc.includes(thicknessStr)
  
  if (hasThickness) {
    return desc
  }
  
  const prefix = prefixes.join(' ')
  if (prefix) {
    return `${prefix} — ${desc}`
  }
  return desc
}

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
    bank_ac_name: 'ESSAR SONS',
    bank_name: 'HDFC Bank Ltd',
    bank_branch: 'Virar West',
    bank_ac_no: '50200012345678',
    bank_ifsc: 'HDFC0000123'
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

const drawCustomerCard = (doc, cust, y, shipCust = null) => {
  const cardH = 40
  const mid = PAGE_W / 2
  const cardW = CONTENT_W / 2 - 2
  const actualShipCust = shipCust || cust
  
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
    ly += 4.5
    setFont(doc, 7.5, 'normal', C.textMid)
    
    // Address up to 3 wrapped lines
    const addr = data.address || ''
    const lines = doc.splitTextToSize(addr, cardW - 8)
    const addrLines = lines.slice(0, 3)
    for (let k = 0; k < 3; k++) {
      drawText(doc, addrLines[k] || '', startX + 4, ly)
      ly += 3.5
    }
    
    // Tel / Email
    const tel = data.phone || data.mobile || ''
    const email = data.email || ''
    drawText(doc, `Tel : ${tel}    E-Mail : ${email}`, startX + 4, ly)
    ly += 3.5
    
    // PAN
    const pan = data.pan || data.pan_number || ''
    drawText(doc, `PAN No: ${pan}`, startX + 4, ly)
    ly += 3.5
    
    // GSTIN
    const gstin = data.gstin || ''
    drawText(doc, `GSTIN: ${gstin}`, startX + 4, ly)
    ly += 3.5
    
    // Code / State
    const stateStr = getStateStr(gstin, data.state)
    drawText(doc, `Code / State : ${stateStr}`, startX + 4, ly)
  }
  
  drawSide(cust, MARGIN.l)
  drawSide(actualShipCust, mid + 2)
  
  return y + cardH + SP_16
}

const drawInfoStrips = (doc, cust, y) => {
  const rowH = 6
  
  // Row 1: Delivery Note
  drawCard(doc, MARGIN.l, y, CONTENT_W, rowH, C.white, C.border, 1.5)
  setFont(doc, 7.5, 'bold', C.text)
  drawText(doc, 'Delivery Note:', MARGIN.l + 4, y + 4.2)
  
  // Row 2: Account Info
  const y2 = y + rowH
  drawCard(doc, MARGIN.l, y2, CONTENT_W, rowH, C.white, C.border, 1.5)
  
  setFont(doc, 7.5, 'bold', C.text)
  drawText(doc, 'Account To :', MARGIN.l + 4, y2 + 4.2)
  setFont(doc, 7.5, 'normal', C.text)
  drawText(doc, String(cust.name || '').substring(0, 45), MARGIN.l + 22, y2 + 4.2)
  
  setFont(doc, 7.5, 'bold', C.text)
  drawText(doc, 'Total OutStanding :', MARGIN.l + 100, y2 + 4.2)
  
  drawText(doc, 'Credit Limit :', MARGIN.l + 155, y2 + 4.2)
  setFont(doc, 7.5, 'normal', C.text)
  drawText(doc, String(cust.credit_limit || '0'), MARGIN.l + 175, y2 + 4.2)
  
  return y2 + rowH + SP_16
}

const drawBankDetails = (doc, company, y) => {
  const cardH = 22
  const cardW = CONTENT_W / 2 - 2
  
  drawCard(doc, MARGIN.l, y, cardW, cardH, C.white, C.border, 1.5)
  
  let ly = y + 4.5
  setFont(doc, 7.5, 'bold', C.primaryMid)
  drawText(doc, 'BANK DETAILS', MARGIN.l + 4, ly)
  
  ly += 4
  setFont(doc, 7, 'normal', C.textMid)
  drawText(doc, `A/C Name : ${company.bank_ac_name || company.name || ''}`, MARGIN.l + 4, ly)
  ly += 3.2
  drawText(doc, `Bank     : ${company.bank_name || ''}`, MARGIN.l + 4, ly)
  ly += 3.2
  drawText(doc, `Branch   : ${company.bank_branch || ''}`, MARGIN.l + 4, ly)
  ly += 3.2
  drawText(doc, `A/C No.  : ${company.bank_ac_no || ''}`, MARGIN.l + 4, ly)
  ly += 3.2
  drawText(doc, `IFSC     : ${company.bank_ifsc || ''}`, MARGIN.l + 4, ly)
  
  return y + cardH
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
// ── Table Column Definitions ──────
const getColsConfig = (hasCep) => {
  if (hasCep) {
    return [
      { id: 'sr', h: 'Sr\nNo', w: 8 },
      { id: 'act_w', h: 'WIDTH', w: 17, parent: 'Actual Size-Inch' },
      { id: 'act_h', h: 'HEIGHT', w: 17, parent: 'Actual Size-Inch' },
      { id: 'chg_w', h: 'WIDTH', w: 17, parent: 'Charge Size-Inch' },
      { id: 'chg_h', h: 'HEIGHT', w: 17, parent: 'Charge Size-Inch' },
      { id: 'qty', h: 'Qty', w: 10, a: 'c' },
      { id: 'sqft', h: 'Sqft', w: 20, a: 'r' },
      { id: 'cep', h: 'CEP Rs.', w: 18, a: 'r' },
      { id: 'rate', h: 'Rate', w: 22, a: 'r' },
      { id: 'amount', h: 'Amount Rs.', w: 44, a: 'r' },
    ]
  } else {
    return [
      { id: 'sr', h: 'Sr\nNo', w: 8 },
      { id: 'act_w', h: 'WIDTH', w: 17, parent: 'Actual Size-Inch' },
      { id: 'act_h', h: 'HEIGHT', w: 17, parent: 'Actual Size-Inch' },
      { id: 'chg_w', h: 'WIDTH', w: 17, parent: 'Charge Size-Inch' },
      { id: 'chg_h', h: 'HEIGHT', w: 17, parent: 'Charge Size-Inch' },
      { id: 'qty', h: 'Qty', w: 10, a: 'c' },
      { id: 'sqft', h: 'Sqft', w: 24, a: 'r' },
      { id: 'rate', h: 'Rate', w: 24, a: 'r' },
      { id: 'amount', h: 'Amount Rs.', w: 56, a: 'r' },
    ]
  }
}

const buildCols = (hasCep) => {
  const base = getColsConfig(hasCep)
  let x = MARGIN.l
  const cols = base.map(c => {
    const res = { ...c, x }
    x += c.w
    return res
  })
  return cols
}

const drawTableHeader = (doc, cols, y) => {
  const rowH = 11 // total height
  const halfH = 5.5
  
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, rowH, C.glassHeader)
  setFont(doc, 7, 'bold', C.white)
  
  const drawVerticalBorder = (x, yStart, yEnd) => {
    drawLine(doc, x, yStart, x, yEnd, [255, 255, 255], 0.25)
  }
  
  const drawHorizontalBorder = (x1, x2, py) => {
    drawLine(doc, x1, py, x2, py, [255, 255, 255], 0.25)
  }
  
  let i = 0
  while (i < cols.length) {
    const col = cols[i]
    if (col.parent) {
      const siblings = []
      let temp = i
      while (temp < cols.length && cols[temp].parent === col.parent) {
        siblings.push(cols[temp])
        temp++
      }
      
      const parentW = siblings.reduce((sum, s) => sum + s.w, 0)
      const parentX = col.x
      
      drawText(doc, col.parent, parentX + parentW / 2, y + 4.0, { align: 'center' })
      drawHorizontalBorder(parentX, parentX + parentW, y + halfH)
      
      siblings.forEach((sib, sibIdx) => {
        if (sibIdx > 0) {
          drawVerticalBorder(sib.x, y + halfH, y + rowH)
        }
        drawText(doc, sib.h, sib.x + sib.w / 2, y + halfH + 4.0, { align: 'center' })
      })
      
      i = temp
      if (i < cols.length) {
        drawVerticalBorder(cols[i].x, y, y + rowH)
      }
    } else {
      const isAmountCol = (i === cols.length - 1)
      const cx = isAmountCol ? col.x + col.w - 3.0 : (col.a === 'r' ? col.x + col.w - 2.0 : col.a === 'c' ? col.x + col.w / 2 : col.x + 2.0)
      const al = isAmountCol ? 'right' : (col.a === 'r' ? 'right' : col.a === 'c' ? 'center' : 'left')
      
      const lines = col.h.split('\n')
      if (lines.length > 1) {
        lines.forEach((line, li) => {
          drawText(doc, line, cx, y + 4.2 + li * 3.5, { align: al })
        })
      } else {
        drawText(doc, col.h, cx, y + 6.8, { align: al })
      }
      
      i++
      if (i < cols.length) {
        drawVerticalBorder(cols[i].x, y, y + rowH)
      }
    }
  }
  
  // Draw outer borders for the header
  drawLine(doc, MARGIN.l, y, MARGIN.l + CONTENT_W, y, [60, 60, 60], 0.25)
  drawLine(doc, MARGIN.l, y + rowH, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.25)
  drawLine(doc, MARGIN.l, y, MARGIN.l, y + rowH, [60, 60, 60], 0.25)
  drawLine(doc, MARGIN.l + CONTENT_W, y, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.25)
  
  return y + rowH
}

const drawGroupBanner = (doc, groupNo, refCode, desc, isToughened, hasCep, y) => {
  const maxW = CONTENT_W - 55
  const wrappedDesc = doc.splitTextToSize(desc, maxW)
  const lineCount = wrappedDesc.length
  const bannerH = lineCount > 1 ? 13 : 8
  
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, bannerH, C.glassHeaderBg)
  
  drawLine(doc, MARGIN.l, y, MARGIN.l, y + bannerH, [60, 60, 60], 0.2)
  drawLine(doc, MARGIN.l + CONTENT_W, y, MARGIN.l + CONTENT_W, y + bannerH, [60, 60, 60], 0.2)
  drawLine(doc, MARGIN.l, y + bannerH, MARGIN.l + CONTENT_W, y + bannerH, [60, 60, 60], 0.25)
  
  setFont(doc, 8.5, 'bold', C.glassHeader)
  drawText(doc, String(groupNo), MARGIN.l + 4, y + 5.5)
  drawText(doc, String(refCode), MARGIN.l + 12, y + 5.5)
  
  setFont(doc, 8, 'bold', C.text)
  wrappedDesc.forEach((line, idx) => {
    drawText(doc, line, MARGIN.l + 32, y + 5.5 + idx * 4.5)
  })
  
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
  setFont(doc, 7, 'normal', C.text)
  
  cols.forEach((c, i) => {
    drawLine(doc, c.x, y, c.x, y + rowH, [60, 60, 60], 0.2)
    const v = String(vals[i] ?? '')
    const isAmountCol = (i === cols.length - 1)
    const cx = isAmountCol ? c.x + c.w - 3.0 : (c.a === 'r' ? c.x + c.w - 2.0 : c.a === 'c' ? c.x + c.w / 2 : c.x + 2.0)
    const al = isAmountCol ? 'right' : (c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left')
    const maxLen = isAmountCol ? 24 : Math.max(5, Math.floor(c.w / 1.6))
    if (v) drawText(doc, v.substring(0, maxLen), cx, y + 4.5, { align: al })
  })
  
  const lastCol = cols[cols.length - 1]
  drawLine(doc, lastCol.x + lastCol.w, y, lastCol.x + lastCol.w, y + rowH, [60, 60, 60], 0.2)
  drawLine(doc, MARGIN.l, y + rowH, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.2)
  
  return y + rowH
}

const drawGroupSubtotal = (doc, cols, qty, sqft, rft, cep, amt, hasCep, y) => {
  const rowH = 7.5
  const labelW = cols.slice(0, 5).reduce((sum, c) => sum + c.w, 0)
  
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, rowH, C.glassHeaderBg)
  
  drawLine(doc, MARGIN.l, y, MARGIN.l, y + rowH, [60, 60, 60], 0.2)
  drawLine(doc, MARGIN.l + labelW, y, MARGIN.l + labelW, y + rowH, [60, 60, 60], 0.2)
  
  setFont(doc, 7.5, 'bold', C.glassHeader)
  drawText(doc, 'Subtotal', MARGIN.l + 4, y + 5)
  
  cols.slice(5).forEach((col) => {
    drawLine(doc, col.x, y, col.x, y + rowH, [60, 60, 60], 0.2)
    let val = ''
    if (col.id === 'qty') val = String(qty)
    else if (col.id === 'sqft') val = sqft.toFixed(3)
    else if (col.id === 'rft') val = rft.toFixed(3)
    else if (col.id === 'cep') val = (hasCep && cep > 0) ? fmtN(cep) : ''
    else if (col.id === 'amount') val = fmtN(amt)
    
    if (val) {
      const isAmountCol = (col.id === 'amount')
      const cx = isAmountCol ? col.x + col.w - 3.0 : (col.a === 'r' ? col.x + col.w - 2.0 : col.a === 'c' ? col.x + col.w / 2 : col.x + 2.0)
      const al = isAmountCol ? 'right' : (col.a === 'r' ? 'right' : col.a === 'c' ? 'center' : 'left')
      drawText(doc, val, cx, y + 5, { align: al })
    }
  })
  
  const lastCol = cols[cols.length - 1]
  drawLine(doc, lastCol.x + lastCol.w, y, lastCol.x + lastCol.w, y + rowH, [60, 60, 60], 0.2)
  drawLine(doc, MARGIN.l, y + rowH, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.2)
  
  return y + rowH
}

const drawGroupHsnRow = (doc, group, y) => {
  const rowH = 5.5
  
  drawLine(doc, MARGIN.l, y, MARGIN.l, y + rowH, [60, 60, 60], 0.2)
  drawLine(doc, MARGIN.l + CONTENT_W, y, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.2)
  
  setFont(doc, 7, 'bold', C.text)
  drawText(doc, `HSN #: ${group.hsn || '7007'}     CS: ${group.cs || '400'}`, MARGIN.l + 4, y + 4.0)
  drawLine(doc, MARGIN.l, y + rowH, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.2)
  
  return y + rowH
}

const calculateGroupHeight = (group, hasCep) => {
  const sizes = group.sizes || []
  const desc = composeGroupDesc(group)
  
  const charsPerLine = Math.floor((CONTENT_W - 55) / 1.6)
  const approxLines = Math.max(1, Math.ceil(desc.length / charsPerLine))
  
  let h = SP_8
  h += approxLines > 1 ? 13 : 8
  h += 11 // two-tier header
  h += sizes.length * 6.5
  
  const sizeProcs = sizes.flatMap(s => s.size_processes || []).filter(p => (p.amount || 0) > 0)
  const grpProcs = (group.processes || []).filter(p => (p.amount || 0) > 0)
  const allProcs = [...sizeProcs, ...grpProcs]
  
  if (allProcs.length > 0) {
    h += 6.5
    h += allProcs.length * 6.5
    h += SP_8
  }
  
  h += 7.5 // subtotal row
  h += 5.5 // HSN row
  h += SP_8
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
  if (groupHeight <= cleanPageSpace && groupHeight > remainingSpace && remainingSpace < 50) {
    y = checkPageBreak(doc, y, 999, pageNum, quotation)
  }
  
  const headerHeight = 13 + 11 + 6.5 + SP_8
  if ((PAGE_H - 18) - y < headerHeight) {
    y = checkPageBreak(doc, y, 999, pageNum, quotation)
  }
  
  let ly = y + SP_8
  
  // 1. Group Banner
  const refCode = `${quotation.quote_number || 'QT'}-${groupNo}`
  const groupDesc = composeGroupDesc(group)
  ly = drawGroupBanner(doc, groupNo, refCode, groupDesc, group.is_toughened, group.cep, ly)
  
  // 2. Table Header
  ly = drawTableHeader(doc, cols, ly)
  
  let grpQty = 0, grpSqft = 0, grpRft = 0, grpCep = 0, grpAmt = 0
  
  // 3. Sizes list
  sizes.forEach((size, si) => {
    const w = size.width_inch || 0
    const h = size.height_inch || 0
    const qty = size.quantity || 1
    const sqft = size.total_sqft || 0
    const rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(3))
    const cep = size.cep_charges || 0
    const amt = size.subtotal || 0
    
    grpQty += qty; grpSqft += sqft; grpRft += rft; grpCep += cep; grpAmt += amt
    
    if ((PAGE_H - 18) - ly < 6.5 + 7.5 + 5.5) {
      y = checkPageBreak(doc, y, 999, pageNum, quotation)
      ly = y + SP_8
      ly = drawGroupBanner(doc, groupNo, refCode, groupDesc + ' (Continued)', group.is_toughened, group.cep, ly)
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = size.charged_w_inch || 0
    const chargedH = size.charged_h_inch || 0
    const rate = size.selling_rate || size.rate || 0
    
    const vals = [
      String(si + 1),
      w > 0 ? toFraction(w) : '',
      h > 0 ? toFraction(h) : '',
      chargedW > 0 ? toFraction(chargedW) : '',
      chargedH > 0 ? toFraction(chargedH) : '',
      String(qty),
      sqft.toFixed(3),
      ...(hasCep ? [cep > 0 ? fmtN(cep) : '-'] : []),
      fmtN(rate),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  // 4. Processes
  if (allProcs.length > 0) {
    const procsHeight = 6.5 + allProcs.length * 6.5 + SP_8 * 2
    if ((PAGE_H - 18) - ly < procsHeight + 7.5 + 5.5) {
      y = checkPageBreak(doc, y, 999, pageNum, quotation)
      ly = y + SP_8
      ly = drawGroupBanner(doc, groupNo, refCode, groupDesc + ' - Processes (Continued)', group.is_toughened, group.cep, ly)
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
  
  // 5. Group Subtotal & HSN row
  ly = drawGroupSubtotal(doc, cols, grpQty, grpSqft, grpRft, grpCep, grpAmt, hasCep, ly)
  ly = drawGroupHsnRow(doc, group, ly)
  
  return { endY: ly, grpQty, grpSqft, grpCep, grpAmt }
}

const drawTotalSummaryGridRow = (doc, qty, sqft, amt, y) => {
  const rowH = 8
  drawRect(doc, MARGIN.l + 0.3, y, CONTENT_W - 0.6, rowH, C.primaryLight)
  
  drawLine(doc, MARGIN.l, y, MARGIN.l, y + rowH, [60, 60, 60], 0.25)
  drawLine(doc, MARGIN.l + CONTENT_W, y, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.25)
  drawLine(doc, MARGIN.l, y, MARGIN.l + CONTENT_W, y, [60, 60, 60], 0.25)
  drawLine(doc, MARGIN.l, y + rowH, MARGIN.l + CONTENT_W, y + rowH, [60, 60, 60], 0.25)
  
  setFont(doc, 8, 'bold', C.primaryMid)
  const amtStr = fmtN(amt)
  const text = `Total Summary           Qty: ${qty} pcs           Weight: —           Total Area: ${sqft.toFixed(3)} Sqft           Glass Total: Rs. ${amtStr}`
  
  drawText(doc, text, MARGIN.l + 4, y + 5.2)
  return y + rowH
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

const getPrintDateTime = () => {
  const d = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${year} ${hours}:${minutes}`
}

const drawFooter = (doc, quoteNo, pageNum, totalPages) => {
  const y = PAGE_H - 18 // starts at 279 mm
  drawRect(doc, MARGIN.l - 1.8, y, CONTENT_W + 3.6, 7.5, C.primary)
  setFont(doc, 6.5, 'normal', [180, 190, 230])
  const printTime = getPrintDateTime()
  drawText(doc, `Ref No: ${quoteNo || ''}  |  Print: ${printTime}`, MARGIN.l + 2, y + 4.8)
  drawText(doc, `Confidential \u2022 Computer Generated Document`, PAGE_W / 2, y + 4.8, { align: 'center' })
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

// ── Build HTML for a single artwork page ─────────────────────────────────
const buildArtworkPageHTML = (group, gi, company) => {
  const sizes = group.sizes || []
  const totalQty = sizes.reduce((s, sz) => s + (sz.quantity || 1), 0)
  const totalSqft = sizes.reduce((s, sz) => s + (sz.total_sqft || 0), 0)
  const groupAmt = sizes.reduce((s, sz) => s + (sz.subtotal || 0), 0)

  const sizeRows = sizes.map((sz, si) => {
    const label = String.fromCharCode(97 + si)
    const w = sz.width_inch || 0
    const h = sz.height_inch || 0
    const chgW = sz.charged_w_inch || 0
    const chgH = sz.charged_h_inch || 0
    const qty = sz.quantity || 1
    return `<tr style="background:${si % 2 === 0 ? '#f8faff' : '#fff'}">
      <td style="padding:5px 8px;font-size:11px;">${label})</td>
      <td style="padding:5px 8px;font-size:11px;text-align:center;">${toFraction ? toFraction(w) : w}"</td>
      <td style="padding:5px 8px;font-size:11px;text-align:center;">${toFraction ? toFraction(h) : h}"</td>
      <td style="padding:5px 8px;font-size:11px;text-align:center;">${chgW}"</td>
      <td style="padding:5px 8px;font-size:11px;text-align:center;">${chgH}"</td>
      <td style="padding:5px 8px;font-size:11px;text-align:center;">${qty}</td>
      <td style="padding:5px 8px;font-size:11px;text-align:right;">${(sz.total_sqft || 0).toFixed(3)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; width: 794px; background: #fff; }
    .page { width: 794px; min-height: 1123px; display: flex; flex-direction: column; }
    .header { background: #1a237e; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
    .body { display: flex; flex: 1; }
    .left { width: 55%; padding: 20px; border-right: 2px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .right { width: 45%; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a237e; color: #fff; padding: 6px 8px; font-size: 11px; text-align: center; }
  </style>
  </head><body><div class="page">
    <!-- Header -->
    <div class="header">
      <div>
        <div style="font-size:14px;font-weight:700;">${(company.name || 'ESSAR SONS').toUpperCase()}</div>
        <div style="font-size:10px;color:#c5cae9;">${company.tagline || ''}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;font-weight:700;color:#80cbc4;">ARTWORK / DESIGN DETAIL</div>
        <div style="font-size:10px;color:#c5cae9;">Item ${gi + 1}: ${group.description || ''}</div>
      </div>
    </div>

    <!-- Body: left = artwork, right = specs -->
    <div class="body">
      <!-- LEFT: Artwork image -->
      <div class="left">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:600;margin-bottom:12px;">Design Reference</div>
        ${group.artwork_file_data
          ? `<img src="${group.artwork_file_data}" alt="artwork"
              style="max-width:100%;max-height:620px;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px;"/>`
          : `<div style="width:340px;height:400px;border:2px dashed #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px;">No Artwork</div>`
        }
        ${group.artwork_name ? `<div style="margin-top:10px;font-size:11px;color:#6366f1;font-weight:600;">${group.artwork_name}</div>` : ''}
      </div>

      <!-- RIGHT: Glass specs -->
      <div class="right">
        <div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:4px;">${group.description || `Group ${gi + 1}`}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          ${group.glass_thickness ? `<span style="background:#e3f2fd;color:#0d47a1;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${group.glass_thickness}mm</span>` : ''}
          ${group.glass_type ? `<span style="background:#e8f5e9;color:#1b5e20;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${group.glass_type}</span>` : ''}
          ${group.glass_category ? `<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${group.glass_category}</span>` : ''}
          ${group.is_toughened ? `<span style="background:#ffebee;color:#b71c1c;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">TOUGHENED</span>` : ''}
        </div>

        <!-- Summary chips -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div style="background:#f0f4ff;border-radius:6px;padding:8px 10px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;">Total Qty</div>
            <div style="font-size:18px;font-weight:700;color:#1a237e;">${totalQty} pcs</div>
          </div>
          <div style="background:#f0f4ff;border-radius:6px;padding:8px 10px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;">Total Sqft</div>
            <div style="font-size:18px;font-weight:700;color:#1a237e;">${totalSqft.toFixed(3)}</div>
          </div>
          <div style="background:#f0fff4;border-radius:6px;padding:8px 10px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;">Rate/Sqft</div>
            <div style="font-size:18px;font-weight:700;color:#065f46;">₹${group.rate || 0}</div>
          </div>
          <div style="background:#f0fff4;border-radius:6px;padding:8px 10px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;">Amount</div>
            <div style="font-size:16px;font-weight:700;color:#065f46;">Rs.${Number(groupAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <!-- Size table -->
        <table>
          <thead>
            <tr><th>Size</th><th>Act W"</th><th>Act H"</th><th>Chg W"</th><th>Chg H"</th><th>Qty</th><th>Sqft</th></tr>
          </thead>
          <tbody>${sizeRows}</tbody>
          <tfoot>
            <tr style="background:#c5cae9;font-weight:700;color:#1a237e;">
              <td colspan="5" style="padding:5px 8px;font-size:11px;">TOTAL</td>
              <td style="padding:5px 8px;font-size:11px;text-align:center;">${totalQty}</td>
              <td style="padding:5px 8px;font-size:11px;text-align:right;">${totalSqft.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Ceiling info -->
        <div style="margin-top:12px;font-size:10px;color:#6b7280;">
          Selling Ceiling: W ${group.ceiling_w_inches}" × H ${group.ceiling_h_inches}" &nbsp;|&nbsp; Rate: ₹${group.rate || 0}/sqft
          ${group.cep ? ` | CEP Polish: ${cepRateLabel(group)}` : ''}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#1a237e;color:#c5cae9;display:flex;justify-content:space-between;padding:6px 16px;font-size:9px;">
      <span>Item ${gi + 1} of quotation</span>
      <span>This is a computer generated document</span>
      <span>${group.description || ''}</span>
    </div>
  </div></body></html>`
}

export const generateQuotationPDF = async (quotation) => {
  try {
    const { hardware_items = [], labor_items = [], wastage_items = [] } = quotation
    const doc = new jsPDF('p', 'mm', 'a4')
    const company = getCompany(quotation.company_id)

    let cust = {
      name: quotation.customer_name || '',
      address: '', phone: quotation.customer_phone || '', gstin: quotation.customer_gstin || ''
    }
    if (quotation.customer_id) {
      try {
        const res = await customerApi.get(quotation.customer_id)
        const c = res.data || res
        if (c) cust = {
          name: c.name || quotation.customer_name || '',
          address: [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', '),
          phone: c.phone || c.mobile || quotation.customer_phone || '',
          gstin: c.gstin || quotation.customer_gstin || '',
        }
      } catch (err) {
        // Backend unreachable — legacy localStorage cache as fallback
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
      }
    }

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
    y = checkPageBreak(doc, y, 8 + SP_16, pageNum, quotation)
    y = drawTotalSummaryGridRow(doc, totalQty, totalSqft, grandGlass, y) + SP_16

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

    // Append artwork pages if any group has artwork
    const groupsWithArtwork = groups.filter(g => g.artwork_file_data)
    if (groupsWithArtwork.length > 0) {
      const pdfW = 210, pdfH = 297
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi]
        if (!g.artwork_file_data) continue

        const html = buildArtworkPageHTML(g, gi, company)
        const container = document.createElement('div')
        container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;'
        container.innerHTML = html
        document.body.appendChild(container)

        try {
          await new Promise(r => setTimeout(r, 250))

          const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 794,
            windowWidth: 794,
          })

          const imgData = canvas.toDataURL('image/jpeg', 0.92)
          const imgW = pdfW
          const imgH = (canvas.height * pdfW) / canvas.width

          doc.addPage()
          
          let heightLeft = imgH
          let position = 0
          doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
          heightLeft -= pdfH

          while (heightLeft > 0) {
            position = heightLeft - imgH
            doc.addPage()
            doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
            heightLeft -= pdfH
          }
        } finally {
          document.body.removeChild(container)
        }
      }
    }

    doc.save(`${quotation.quote_number || 'QT'}_Essar.pdf`)
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF failed: ' + e.message)
  }
}

// ── Draw Sales Order Items Card (Splits dynamically) ──
// ── Draw Sales Order Items Card (Splits dynamically) ──
const drawSOItemsCard = (doc, lines, hasCep, cols, startY, pageNum, so) => {
  let y = startY
  let ly = y + SP_8
  
  const bannerTitle = 'ORDER LINE ITEMS'
  const refCode = so.so_number || 'SO'
  ly = drawGroupBanner(doc, '1', refCode, bannerTitle, false, false, ly)
  ly = drawTableHeader(doc, cols, ly)
  
  let tQty = 0, tArea = 0, tRft = 0, tCep = 0, tAmt = 0
  
  lines.forEach((line, i) => {
    const w = line.width_inch || (line.width_mm ? line.width_mm / 25.4 : 0)
    const h = line.height_inch || (line.height_mm ? line.height_mm / 25.4 : 0)
    const qty = line.quantity || 1
    const area = line.total_sqft || 0
    const rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(3))
    const cep = line.cep_charges || 0
    const amt = line.subtotal || line.line_total || 0
    tQty += qty; tArea += area; tRft += rft; tCep += cep; tAmt += amt
    
    if ((PAGE_H - 18) - ly < 6.5 + 7.5 + 5.5) {
      y = checkPageBreak(doc, y, 999, pageNum, so)
      ly = y + SP_8
      ly = drawGroupBanner(doc, '1', refCode, bannerTitle + ' (Continued)', false, false, ly)
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = line.charged_w_inch || w
    const chargedH = line.charged_h_inch || h
    const rate = line.selling_rate || line.rate || 0
    
    const vals = [
      String(i + 1),
      w > 0 ? toFraction(w) : '',
      h > 0 ? toFraction(h) : '',
      chargedW > 0 ? toFraction(chargedW) : '',
      chargedH > 0 ? toFraction(chargedH) : '',
      String(qty),
      area.toFixed(3),
      ...(hasCep ? [cep > 0 ? fmtN(cep) : '-'] : []),
      fmtN(rate),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  ly = drawGroupSubtotal(doc, cols, tQty, tArea, tRft, tCep, tAmt, hasCep, ly)
  ly = drawGroupHsnRow(doc, { hsn: '7007', cs: '400' }, ly)
  
  return { endY: ly, tQty, tArea, tAmt }
}

const drawSOGroupCard = (doc, group, groupNo, hasCep, cols, startY, pageNum, so) => {
  const sizes = group.sizes || []
  const sizeProcs = sizes.flatMap(s => s.size_processes || []).filter(p => (p.amount || 0) > 0)
  const grpProcs = (group.processes || []).filter(p => (p.amount || 0) > 0)
  const allProcs = [...sizeProcs, ...grpProcs]
  
  const groupHeight = calculateGroupHeight(group, hasCep)
  const remainingSpace = (PAGE_H - 18) - startY
  const cleanPageSpace = (PAGE_H - 18) - (MARGIN.t + 18)
  
  let y = startY
  if (groupHeight <= cleanPageSpace && groupHeight > remainingSpace && remainingSpace < 50) {
    y = checkPageBreak(doc, y, 999, pageNum, so)
  }
  
  const headerHeight = 13 + 11 + 6.5 + SP_8
  if ((PAGE_H - 18) - y < headerHeight) {
    y = checkPageBreak(doc, y, 999, pageNum, so)
  }
  
  let ly = y + SP_8
  
  // 1. Group Banner
  const refCode = `${so.so_number || so.quote_number || 'SO'}-${groupNo}`
  const groupDesc = composeGroupDesc(group)
  ly = drawGroupBanner(doc, groupNo, refCode, groupDesc, group.is_toughened, group.cep, ly)
  
  // 2. Table Header
  ly = drawTableHeader(doc, cols, ly)
  
  let grpQty = 0, grpSqft = 0, grpRft = 0, grpCep = 0, grpAmt = 0
  
  // 3. Sizes list
  sizes.forEach((size, si) => {
    const w = size.width_inch || (size.width_mm ? size.width_mm / 25.4 : 0)
    const h = size.height_inch || (size.height_mm ? size.height_mm / 25.4 : 0)
    const qty = size.quantity || 1
    const sqft = size.total_sqft || 0
    const rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(3))
    const cep = size.cep_charges || size.cep_amount || 0
    const amt = size.subtotal || size.line_total || 0
    
    grpQty += qty; grpSqft += sqft; grpRft += rft; grpCep += cep; grpAmt += amt
    
    if ((PAGE_H - 18) - ly < 6.5 + 7.5 + 5.5) {
      y = checkPageBreak(doc, y, 999, pageNum, so)
      ly = y + SP_8
      ly = drawGroupBanner(doc, groupNo, refCode, groupDesc + ' (Continued)', group.is_toughened, group.cep, ly)
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = size.charged_w_inch || w
    const chargedH = size.charged_h_inch || h
    const rate = size.selling_rate || size.rate || 0
    
    const vals = [
      String(si + 1),
      w > 0 ? toFraction(w) : '',
      h > 0 ? toFraction(h) : '',
      chargedW > 0 ? toFraction(chargedW) : '',
      chargedH > 0 ? toFraction(chargedH) : '',
      String(qty),
      sqft.toFixed(3),
      ...(hasCep ? [cep > 0 ? fmtN(cep) : '-'] : []),
      fmtN(rate),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  // 4. Processes
  if (allProcs.length > 0) {
    const procsHeight = 6.5 + allProcs.length * 6.5 + SP_8 * 2
    if ((PAGE_H - 18) - ly < procsHeight + 7.5 + 5.5) {
      y = checkPageBreak(doc, y, 999, pageNum, so)
      ly = y + SP_8
      ly = drawGroupBanner(doc, groupNo, refCode, groupDesc + ' - Processes (Continued)', group.is_toughened, group.cep, ly)
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
  
  // 5. Group Subtotal & HSN row
  ly = drawGroupSubtotal(doc, cols, grpQty, grpSqft, grpRft, grpCep, grpAmt, hasCep, ly)
  ly = drawGroupHsnRow(doc, group, ly)
  
  return { endY: ly, grpQty, grpSqft, grpCep, grpAmt }
}

export const generateSOPDF = async (so) => {
  try {
    const { hardware_items = [], labor_items = [], wastage_items = [] } = so
    const doc = new jsPDF('p', 'mm', 'a4')
    const company = getCompany(so.company_id)
    
    let cust = { name: so.customer_name || '', address: '', phone: so.customer_phone || '', gstin: so.customer_gstin || '', email: '', pan: '' }
    if (so.customer_id) {
      try {
        const res = await customerApi.get(so.customer_id)
        const c = res.data || res
        if (c) {
          cust = {
            name: c.name || so.customer_name || '',
            address: [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', '),
            phone: c.phone || c.mobile || so.customer_phone || '',
            gstin: c.gstin || so.customer_gstin || '',
            email: c.email || '',
            pan: c.pan_number || c.pan || ''
          }
        }
      } catch (err) {
        console.error('Failed to fetch customer for SO PDF:', err)
        try {
          const all = JSON.parse(localStorage.getItem('customers') || '[]')
          const c = all.find(x => x.id === so.customer_id)
          if (c) {
            cust = {
              name: c.name,
              address: [c.address, c.city].filter(Boolean).join(', '),
              phone: c.phone || c.mobile || '',
              gstin: c.gstin || '',
              email: c.email || '',
              pan: c.pan_number || c.pan || ''
            }
          }
        } catch { }
      }
    }

    const groups = so.groups || []
    const hasCep = (groups.length > 0 ? groups.some(g => g.cep) : (so.lines || []).some(l => l.cep))
    const cols = buildCols(hasCep)
    let pageNum = { val: 1, total: '?' }

    drawBorder(doc)
    let y = drawHeader(doc, company, 'SALES ORDER')
    y = drawDocInfo(doc, {
      quote_number: so.so_number,
      quote_date: so.order_date,
      delivery_date: so.delivery_date || 'TBD',
      salesperson: so.salesperson,
      payment_terms: so.payment_terms,
      company_id: so.company_id
    }, y, 'SALES ORDER')
    
    y = drawCustomerCard(doc, cust, y)
    y = drawInfoStrips(doc, cust, y)

    let totalQty = 0, totalSqft = 0, totalCep = 0, grandGlass = 0

    if (groups.length > 0) {
      let groupNo = 0
      groups.forEach((group) => {
        groupNo++
        const res = drawSOGroupCard(doc, group, groupNo, hasCep, cols, y, pageNum, so)
        totalQty += res.grpQty
        totalSqft += res.grpSqft
        totalCep += res.grpCep
        grandGlass += res.grpAmt
        y = res.endY + SP_16
      })
    } else {
      const res = drawSOItemsCard(doc, so.lines || [], hasCep, cols, y, pageNum, so)
      totalQty = res.tQty
      totalSqft = res.tArea
      grandGlass = res.tAmt
      y = res.endY + SP_16
    }

    // Glass total bar
    y = checkPageBreak(doc, y, 8 + SP_16, pageNum, so)
    y = drawTotalSummaryGridRow(doc, totalQty, totalSqft, grandGlass, y) + SP_16

    // Hardware Card
    if (hardware_items.length > 0) {
      const hwHeight = calculateHardwareHeight(hardware_items)
      y = checkPageBreak(doc, y, hwHeight, pageNum, so)
      y = drawHardwareCard(doc, hardware_items, y) + SP_16
    }

    // Labor Card
    if (labor_items.length > 0) {
      const lbHeight = calculateLaborHeight(labor_items)
      y = checkPageBreak(doc, y, lbHeight, pageNum, so)
      y = drawLaborCard(doc, labor_items, y) + SP_16
    }

    // Wastage Card
    if (wastage_items.length > 0) {
      const wstHeight = calculateWastageHeight(wastage_items)
      y = checkPageBreak(doc, y, wstHeight, pageNum, so)
      y = drawWastageCard(doc, wastage_items, y) + SP_16
    }

    // Financial ladder calculations
    const t = so.totals || {}
    const subI = t.subI || grandGlass || so.subtotal || 0
    const procTot = t.procTotal || 0
    const hwTot = t.hwTotal || hardware_items.reduce((s, h) => s + (h.amount || 0), 0) || 0
    const lbTot = t.lbTotal || labor_items.reduce((s, l) => s + (l.amount || 0), 0) || 0
    const wstTot = t.wstTotal || wastage_items.reduce((s, w) => s + (w.amount || 0), 0) || 0
    const dcChg = t.dcCharges || so.dc_charges || 0
    const subII = t.subII || (subI + procTot + hwTot + lbTot + wstTot + dcChg)
    const disc = t.discountAmt || so.discount_amount || 0
    const subIII = t.subIII || Math.max(0, subII - disc)
    
    let cgst = 0, sgst = 0, igst = 0
    if (so.gst_mode === 'cgst_sgst') {
      cgst = t.cgst || (subIII * 0.09)
      sgst = t.sgst || (subIII * 0.09)
    } else if (so.gst_mode === 'igst') {
      igst = t.igst || (subIII * 0.18)
    } else {
      if (so.tax_amount) {
        cgst = so.tax_amount / 2
        sgst = so.tax_amount / 2
      } else {
        cgst = t.cgst || 0
        sgst = t.sgst || 0
        igst = t.igst || 0
      }
    }
    
    const grand = t.grandTotal || so.total_amount || (subIII + cgst + sgst + igst)
    const roundOff = parseFloat((Math.round(grand) - grand).toFixed(2))
    const adv = so.advance_received || 0
    const bal = Math.round(grand) - adv

    const totalsRows = [
      { label: 'Glass Items Subtotal', value: subI },
      procTot > 0 ? { label: 'Process Charges', value: procTot } : null,
      hwTot > 0 ? { label: 'Hardware Accessories', value: hwTot } : null,
      lbTot > 0 ? { label: 'Labor & Services', value: lbTot } : null,
      wstTot > 0 ? { label: 'Wastage Charges', value: wstTot } : null,
      dcChg > 0 ? { label: 'Delivery / Cartage', value: dcChg } : null,
      { label: 'TOTAL TAXABLE VALUE', value: subIII, sub: true },
      disc > 0 ? { label: 'Discount Applied', value: disc } : null,
      { divider: true },
      cgst > 0 ? { label: 'CGST (9.00%)', value: cgst } : null,
      sgst > 0 ? { label: 'SGST (9.00%)', value: sgst } : null,
      igst > 0 ? { label: 'IGST (18.00%)', value: igst } : null,
      Math.abs(roundOff) > 0.009 ? { label: 'Round Off', value: roundOff } : null,
      { label: 'GRAND TOTAL', value: Math.round(grand), grand: true },
      adv > 0 ? { label: 'Advance Received', value: adv } : null,
      adv > 0 ? { label: 'Balance Due', value: bal, sub: true } : null,
    ].filter(Boolean)

    const summaryHeight = calculateSummaryHeight(totalsRows)
    const hasBank = company.bank_name || company.bank_ac_no || company.bank_ifsc
    const bankHeight = hasBank ? 22 + SP_16 : 0
    
    y = checkPageBreak(doc, y, summaryHeight + bankHeight + 22 + 28, pageNum, so)
    y = drawFinalSummaryBlock(doc, totalsRows, toWords(Math.round(grand)), { payment_terms: so.payment_terms }, y) + SP_16
    
    if (hasBank) {
      y = checkPageBreak(doc, y, 22 + 22 + 28, pageNum, so)
      y = drawBankDetails(doc, company, y) + SP_16
    }

    y = checkPageBreak(doc, y, 22 + 28, pageNum, so)
    y = drawSignatureStrip(doc, company, y) + SP_16
    
    y = checkPageBreak(doc, y, 28, pageNum, so)
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
  let ly = y + SP_8
  
  const bannerTitle = 'PURCHASE ITEMS'
  const refCode = po.po_number || 'PO'
  ly = drawGroupBanner(doc, '1', refCode, bannerTitle, false, false, ly)
  ly = drawTableHeader(doc, cols, ly)
  
  let tQty = 0, tArea = 0, tRft = 0, tAmt = 0
  
  lines.forEach((line, i) => {
    const w = line.width_inch || (line.width_mm ? line.width_mm / 25.4 : 0)
    const h = line.height_inch || (line.height_mm ? line.height_mm / 25.4 : 0)
    const qty = line.quantity || 1
    const area = line.charged_sqft || line.total_sqft || 0
    const rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(3))
    const amt = line.subtotal || line.line_total || 0
    tQty += qty; tArea += area; tRft += rft; tAmt += amt
    
    if ((PAGE_H - 18) - ly < 6.5 + 7.5 + 5.5) {
      y = checkPageBreak(doc, y, 999, pageNum, po)
      ly = y + SP_8
      ly = drawGroupBanner(doc, '1', refCode, bannerTitle + ' (Continued)', false, false, ly)
      ly = drawTableHeader(doc, cols, ly)
    }
    
    const chargedW = line.charged_w_inch || w
    const chargedH = line.charged_h_inch || h
    const rate = line.rate || 0
    
    const vals = [
      String(i + 1),
      w > 0 ? toFraction(w) : '',
      h > 0 ? toFraction(h) : '',
      chargedW > 0 ? toFraction(chargedW) : '',
      chargedH > 0 ? toFraction(chargedH) : '',
      String(qty),
      area.toFixed(3),
      fmtN(rate),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  ly = drawGroupSubtotal(doc, cols, tQty, tArea, tRft, 0, tAmt, false, ly)
  ly = drawGroupHsnRow(doc, { hsn: '7007', cs: '400' }, ly)
  
  return { endY: ly, tQty, tArea, tAmt }
}

export const generatePOPDF = async (po) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const company = getCompany(po.company_id)
    let vend = { name: po.vendor_name || '', address: '', phone: '', gstin: '' }
    if (po.vendor_id) {
      try {
        const res = await vendorApi.get(po.vendor_id)
        const v = res.data || res
        if (v) vend = { name: v.name || po.vendor_name || '', address: [v.address, v.city, v.state, v.pincode].filter(Boolean).join(', '), phone: v.phone || v.mobile || '', gstin: v.gstin || '' }
      } catch (err) {
        try {
          const all = JSON.parse(localStorage.getItem('vendors') || '[]')
          const v = all.find(x => x.id === po.vendor_id)
          if (v) vend = { name: v.name, address: [v.address, v.city].filter(Boolean).join(', '), phone: v.phone || '', gstin: v.gstin || '' }
        } catch { }
      }
    }

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

    y = checkPageBreak(doc, y, 8 + SP_16, pageNum, po)
    y = drawTotalSummaryGridRow(doc, tQty, tArea, tAmt, y) + SP_16

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
