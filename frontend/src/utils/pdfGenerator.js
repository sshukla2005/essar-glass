import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import dayjs from 'dayjs'
import { customerApi, vendorApi, companyApi } from '../api'
import { computeLineWeightKg } from './glassCalc'

// ── Brand logo assets (Vite-bundled, fingerprinted) ──────
import asahiPng      from '../assets/brands/asahi.png'
import goldPlusPng   from '../assets/brands/gold_plus.png'
import guardianPng   from '../assets/brands/guardian.png'
import saintGobainPng from '../assets/brands/saint_gobain.png'

const BRAND_LOGOS = [
  { src: asahiPng,      label: 'Asahi',       alias: 'brand_asahi' },
  { src: goldPlusPng,   label: 'Gold Plus',   alias: 'brand_gold_plus' },
  { src: guardianPng,   label: 'Guardian',    alias: 'brand_guardian' },
  { src: saintGobainPng, label: 'Saint-Gobain', alias: 'brand_saint_gobain' },
]

// Cache: src → { dataUrl, w, h, alias, format }
const _brandCache = {}

const loadBrandLogo = (entry) => {
  if (_brandCache[entry.src]) return Promise.resolve(_brandCache[entry.src])
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || 300
        const origH = img.naturalHeight || img.height || 300
        const MAX = 300
        const scale = Math.min(1, MAX / Math.max(origW, origH))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(origW * scale)
        canvas.height = Math.round(origH * scale)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const result = {
          dataUrl,
          w: canvas.width,
          h: canvas.height,
          alias: entry.alias,
          format: 'JPEG'
        }
        _brandCache[entry.src] = result
        resolve(result)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = entry.src
  })
}

export const preloadBrandLogos = () =>
  Promise.all(BRAND_LOGOS.map(loadBrandLogo))

export const makePdfFilename = (docNumber, name, fallback = 'Customer') => {
  const num = docNumber || 'DOC'
  const safeName = String(name || fallback)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || fallback
  return `${num}_${safeName}.pdf`
}

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

export const fmtDim = (inchVal, unitMode = 'inch') =>
  !inchVal ? '' :
  unitMode === 'mm' ? String(Math.round(inchVal * 25.4)) : toFraction(inchVal)


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

// Process rows sometimes carry only process_id (no name) — resolve the
// display name from the process_masters cache instead of printing "-"
const resolveProcName = (p) => {
  if (p.process_name || p.name) return p.process_name || p.name
  try {
    const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
    const m = pm.find(x => x.id === (p.process_id ?? p.id))
    if (m?.name) return m.name
  } catch { }
  return 'Process'
}

const aggregateProcesses = (allProcs) => {
  const procAgg = []
  const procIndex = new Map()
  allProcs.forEach(p => {
    const name = resolveProcName(p)
    const rate = p.rate || 0
    const qty = (p.qty_area ?? p.qty) || 0
    const amt = p.amount ?? 0
    const key = name + '|' + rate
    if (!procIndex.has(key)) {
      procIndex.set(key, procAgg.length)
      procAgg.push({ name, rate, qty, amount: amt })
    } else {
      const g = procAgg[procIndex.get(key)]
      g.qty += qty
      g.amount += amt
    }
  })
  return procAgg
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

const cleanVal = (val) => {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  if (s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return ''
  return s
}

const getStateStr = (gstin, state) => {
  let code = ''
  let name = cleanVal(state)
  const cleanGstin = cleanVal(gstin)
  if (cleanGstin && cleanGstin.length >= 2) {
    code = cleanGstin.substring(0, 2)
    if (!name && STATE_CODES[code]) {
      name = STATE_CODES[code]
    }
  }
  if (code && name) return `${code}-${name.toUpperCase()}`
  if (code) return code
  if (name) return name.toUpperCase()
  return ''
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

const preloadImage = (src) => {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const processImageToJpeg = (img) => {
  if (!img) return null
  try {
    const origW = img.naturalWidth || img.width || 300
    const origH = img.naturalHeight || img.height || 300
    const MAX = 300
    const scale = Math.min(1, MAX / Math.max(origW, origH))
    const w = Math.round(origW * scale)
    const h = Math.round(origH * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.8),
      w,
      h,
      format: 'JPEG'
    }
  } catch {
    return null
  }
}

const preloadCompanyLogos = async (company) => {
  if (!company) return company
  const logoImg = await preloadImage(company.logo)
  const secLogoImg = await preloadImage(company.secondary_logo)
  const logoProcessed = processImageToJpeg(logoImg)
  const secLogoProcessed = processImageToJpeg(secLogoImg)
  return {
    ...company,
    _logoImg: logoImg,
    _secLogoImg: secLogoImg,
    _logoProcessed: logoProcessed,
    _secLogoProcessed: secLogoProcessed
  }
}

// ── Master Data Resolvers ──────
const getCompany = (id) => {
  try {
    const all = JSON.parse(localStorage.getItem('companies_master') || '[]')
    if (id) {
      const c = all.find(x => x.id === id)
      if (c) return c
    }
    const active = all.find(x => x.is_active) || all[0]
    if (active) return active
  } catch { }
  return null
}

const fetchCompany = async (id) => {
  if (id) {
    try {
      const res = await companyApi.get(id)
      const c = res?.data || res
      if (c && c.name) return c
    } catch (err) {
      console.warn(`[fetchCompany] API fetch failed for company ID ${id}:`, err?.message)
    }
  }

  const cached = getCompany(id)
  if (cached && cached.name) return cached

  try {
    const res = await companyApi.list()
    const items = res?.data?.items || res?.data || (Array.isArray(res) ? res : [])
    const c = (id ? items.find(x => x.id === id) : null) || items.find(x => x.is_active) || items[0]
    if (c && c.name) return c
  } catch (err) {
    console.warn('[fetchCompany] Company list API call failed:', err?.message)
  }

  console.error('Failed to resolve company for PDF generation. Company ID:', id)
  throw new Error('Company details load nahi ho paayi. Page refresh karke dobara try karein.')
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

const drawBorder = (doc, pageW = PAGE_W, pageH = PAGE_H) => {
  const contentW = pageW - MARGIN.l - MARGIN.r
  // Main page bounding box border
  drawRect(doc, MARGIN.l - 2, MARGIN.t - 2, contentW + 4, pageH - MARGIN.t - 7, null, C.primary, 0.4)
}

// ── Header & Customer Cards ──────
const drawHeader = (doc, company, docTitle, pageW = PAGE_W) => {
  const yStart = MARGIN.t // 10mm
  const contentW = pageW - MARGIN.l - MARGIN.r
  const centreX = pageW / 2

  const fitImage = (imgW, imgH, maxW, maxH) => {
    const ratio = imgW / imgH
    let w = maxW
    let h = maxW / ratio
    if (h > maxH) {
      h = maxH
      w = maxH * ratio
    }
    return { w, h }
  }

  const getFormat = (dataUrl) => {
    if (dataUrl.includes('image/png')) return 'PNG'
    if (dataUrl.includes('image/webp')) return 'WEBP'
    return 'JPEG'
  }

  // 1. Company Name
  const nameText = (company.name || 'ESSAR GLASS').toUpperCase()
  let nameFontSize = 16
  const maxCenterTextW = contentW - 86
  setFont(doc, nameFontSize, 'bold', C.primary)
  while (doc.getTextWidth(nameText) > maxCenterTextW && nameFontSize > 10) {
    nameFontSize -= 0.5
    setFont(doc, nameFontSize, 'bold', C.primary)
  }
  const nameLineH = nameFontSize * 0.45

  // 2. Address Line
  const rawAddrText = [
    cleanVal(company.address),
    cleanVal(company.address_line2),
    cleanVal(company.city),
    cleanVal(company.state_name || company.state),
    cleanVal(company.pincode)
  ].filter(Boolean).join(', ')
  const combinedAddrText = rawAddrText ? ("Add: " + rawAddrText) : ""
  setFont(doc, 8.5, 'normal', C.text)
  const addressLines = combinedAddrText ? doc.splitTextToSize(combinedAddrText, maxCenterTextW).slice(0, 2) : []
  const addrLineH = 3.6
  const addrTotalH = addressLines.length * addrLineH

  // 3. Contact Line
  const segments = []
  if (cleanVal(company.phone)) {
    const pVal = cleanVal(company.phone2) ? `${cleanVal(company.phone)}, ${cleanVal(company.phone2)}` : cleanVal(company.phone)
    segments.push({ label: 'Phone: ', value: pVal })
  }
  if (cleanVal(company.whatsapp)) {
    segments.push({ label: 'Whatsapp: ', value: cleanVal(company.whatsapp) })
  }
  if (cleanVal(company.email)) {
    segments.push({ label: 'E-mail: ', value: cleanVal(company.email) })
  }
  const contactLineH = segments.length > 0 ? 3.5 : 0

  // 4. Statutory Line
  const panVal = cleanVal(company.pan || company.pan_number)
  const cinVal = cleanVal(company.cin)
  const gstinVal = cleanVal(company.gstin || company.gst)
  const stateStr = (cleanVal(company.state_code) && cleanVal(company.state_name))
    ? `${cleanVal(company.state_code)}-${cleanVal(company.state_name).toUpperCase()}`
    : cleanVal(company.state_code || company.state_name)

  const statutoryParts = []
  if (panVal) statutoryParts.push(`PAN No : ${panVal}`)
  if (cinVal) statutoryParts.push(`CIN No : ${cinVal}`)
  if (gstinVal) statutoryParts.push(`GSTIN : ${gstinVal}`)
  if (stateStr) statutoryParts.push(`Code / State : ${stateStr}`)

  const statutoryLine = statutoryParts.join('   ')
  setFont(doc, 8, 'bold', C.text)
  const statutoryLines = statutoryLine ? doc.splitTextToSize(statutoryLine, maxCenterTextW).slice(0, 2) : []
  const statLineH = 3.5
  const statTotalH = statutoryLines.length * statLineH

  // Gaps & Heights calculation
  const gapNameAddr = combinedAddrText ? 2 : 0
  const gapAddrContact = (combinedAddrText && segments.length > 0) ? 1.5 : 0
  const gapContactStat = (segments.length > 0 && statutoryLines.length > 0) ? 1.5 : 0
  const gapAddrStat = (!segments.length && combinedAddrText && statutoryLines.length > 0) ? 1.5 : 0

  const centerTextH = nameLineH + gapNameAddr + addrTotalH + gapAddrContact + contactLineH + (gapContactStat || gapAddrStat) + statTotalH
  const padTop = 3.5
  const padBot = 3.5
  const boxH = Math.max(28, centerTextH + padTop + padBot)

  // 5. Draw Outer Header Box & Separators
  drawRect(doc, MARGIN.l, yStart, contentW, boxH, null, [120, 130, 140], 0.3)
  // Subtle vertical column separators
  drawLine(doc, MARGIN.l + 40, yStart, MARGIN.l + 40, yStart + boxH, [120, 130, 140], 0.3)
  drawLine(doc, MARGIN.l + contentW - 40, yStart, MARGIN.l + contentW - 40, yStart + boxH, [120, 130, 140], 0.3)

  // 6. Draw Left Column logo / monogram (x=MARGIN.l to MARGIN.l+40, width=40mm)
  const maxLogoW = 34
  const maxLogoH = boxH - 4
  let primaryDrawSuccess = false
  let logoObj = company._logoProcessed
  if (!logoObj && company._logoImg) {
    logoObj = processImageToJpeg(company._logoImg)
    company._logoProcessed = logoObj
  }

  if (logoObj) {
    try {
      const dims = fitImage(logoObj.w, logoObj.h, maxLogoW, maxLogoH)
      const xImg = MARGIN.l + (40 - dims.w) / 2
      const yImg = yStart + (boxH - dims.h) / 2
      const alias = company.id ? `company_logo_${company.id}` : 'company_logo'
      doc.addImage(logoObj.dataUrl, 'JPEG', xImg, yImg, dims.w, dims.h, alias)
      primaryDrawSuccess = true
    } catch (err) {
      console.error('Failed to draw processed primary logo:', err)
    }
  } else if (company.logo) {
    try {
      let imgW = 150
      let imgH = 150
      if (company._logoImg) {
        imgW = company._logoImg.naturalWidth || company._logoImg.width || 150
        imgH = company._logoImg.naturalHeight || company._logoImg.height || 150
      }
      const dims = fitImage(imgW, imgH, maxLogoW, maxLogoH)
      const xImg = MARGIN.l + (40 - dims.w) / 2
      const yImg = yStart + (boxH - dims.h) / 2
      const format = getFormat(company.logo)
      const alias = company.id ? `company_logo_${company.id}` : 'company_logo'
      doc.addImage(company.logo, format, xImg, yImg, dims.w, dims.h, alias)
      primaryDrawSuccess = true
    } catch (err) {
      console.error('Failed to draw primary logo:', err)
    }
  }

  if (!primaryDrawSuccess) {
    const initials = (company.name || 'E').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    const xBox = MARGIN.l + (40 - 18) / 2
    const yBox = yStart + (boxH - 18) / 2
    drawCard(doc, xBox, yBox, 18, 18, C.primaryLight, C.primary, 1.0)
    setFont(doc, 10, 'bold', C.primary)
    drawText(doc, initials, xBox + 9, yBox + 10.5, { align: 'center' })
  }

  // 7. Draw Right Column — 2×2 brand logo grid (x=MARGIN.l+contentW-40 to MARGIN.l+contentW, width=40mm)
  ;(() => {
    const colX   = MARGIN.l + contentW - 40
    const colW   = 40
    const padH   = 1.5
    const padSide = 1.5

    const captionH = 4.5
    const captionGap = 0.5

    const gridTop = yStart + padH + captionH + captionGap
    const gridH   = boxH - padH * 2 - captionH - captionGap - 0.5
    const cellW   = (colW - padSide * 2) / 2
    const cellH   = gridH / 2

    setFont(doc, 5.5, 'normal', [140, 150, 165])
    drawText(doc, 'AUTHORIZED DEALER', colX + colW / 2, yStart + padH + 3.2, { align: 'center' })

    drawLine(doc, colX + padSide, yStart + padH + captionH, colX + colW - padSide, yStart + padH + captionH, [200, 210, 220], 0.2)

    const cached = BRAND_LOGOS.map(b => _brandCache[b.src] || null)

    cached.forEach((logo, idx) => {
      if (!logo) return
      const row = Math.floor(idx / 2)
      const col = idx % 2

      const cellX = colX + padSide + col * cellW
      const cellY = gridTop + row * cellH

      const innerPad = 1.5
      const availW = cellW - innerPad * 2
      const availH = cellH - innerPad * 2

      try {
        const dims = fitImage(logo.w, logo.h, availW, availH)
        const xImg = cellX + innerPad + (availW - dims.w) / 2
        const yImg = cellY + innerPad + (availH - dims.h) / 2
        const alias = logo.alias || `brand_logo_${idx}`
        doc.addImage(logo.dataUrl, logo.format || 'JPEG', xImg, yImg, dims.w, dims.h, alias)
      } catch (err) {
        console.error('Failed to draw brand logo', idx, err)
      }
    })
  })()

  // 8. Draw Center Column text
  const textTopY = yStart + (boxH - centerTextH) / 2
  let ly = textTopY + nameLineH * 0.75

  // Line 1: Company Name
  setFont(doc, nameFontSize, 'bold', C.primary)
  drawText(doc, nameText, centreX, ly, { align: 'center' })

  // Line 2: Address
  if (addressLines.length > 0) {
    ly += gapNameAddr
    addressLines.forEach((line, idx) => {
      ly += addrLineH
      if (idx === 0 && line.startsWith("Add: ")) {
        const rest = line.substring(5)
        setFont(doc, 8.5, 'bold', C.text)
        const addW = doc.getTextWidth("Add: ")
        setFont(doc, 8.5, 'normal', C.text)
        const restW = doc.getTextWidth(rest)
        const startX = centreX - (addW + restW) / 2

        setFont(doc, 8.5, 'bold', C.text)
        drawText(doc, "Add: ", startX, ly)
        setFont(doc, 8.5, 'normal', C.text)
        drawText(doc, rest, startX + addW, ly)
      } else {
        setFont(doc, 8.5, 'normal', C.text)
        drawText(doc, line, centreX, ly, { align: 'center' })
      }
    })
  }

  // Line 3: Contact details
  if (segments.length > 0) {
    ly += gapAddrContact || (combinedAddrText ? 1.5 : gapNameAddr)
    ly += contactLineH
    let totalW = 0
    const segmentSpacing = 4
    segments.forEach((seg, idx) => {
      if (idx > 0) totalW += segmentSpacing
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      const lw = doc.getTextWidth(seg.label)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const vw = doc.getTextWidth(seg.value)
      seg.lw = lw
      seg.vw = vw
      totalW += lw + vw
    })

    let currentX = centreX - totalW / 2
    segments.forEach((seg, idx) => {
      if (idx > 0) currentX += segmentSpacing
      setFont(doc, 8, 'bold', C.text)
      drawText(doc, seg.label, currentX, ly)
      currentX += seg.lw
      setFont(doc, 8, 'normal', C.text)
      drawText(doc, seg.value, currentX, ly)
      currentX += seg.vw
    })
  }

  // Line 4: Statutory details
  if (statutoryLines.length > 0) {
    ly += gapContactStat || gapAddrStat || gapNameAddr
    statutoryLines.forEach((l) => {
      ly += statLineH
      setFont(doc, 8, 'bold', C.text)
      drawText(doc, l, centreX, ly, { align: 'center' })
    })
  }

  // 9. Document Title Band
  const titleY = yStart + boxH + 2
  drawRect(doc, MARGIN.l - 2, titleY, contentW + 4, 10, C.accent)
  setFont(doc, 10, 'bold', C.white)
  drawText(doc, docTitle || 'PROFORMA INVOICE', centreX, titleY + 6.5, { align: 'center' })

  return titleY + 10 + 4
}

const drawDocInfo = (doc, quotation, y, docTitle, items = null, pageW = PAGE_W) => {
  const contentW = pageW - MARGIN.l - MARGIN.r
  const boxH = 11
  drawCard(doc, MARGIN.l, y, contentW, boxH, C.summaryBg, C.border, 1.5)
  const itemList = items || [
    { label: 'Document Type', value: docTitle },
    { label: 'Quote / Ref No', value: quotation.quote_number || quotation.so_number || quotation.po_number || 'QT-NEW' },
    { label: 'Date', value: formatDate(quotation.quote_date || quotation.order_date || quotation.po_date || '') },
    quotation.valid_until ? { label: 'Valid Until', value: formatDate(quotation.valid_until) } : null,
    { label: 'Salesperson', value: quotation.salesperson || 'Admin' },
    { label: 'Payment Terms', value: quotation.payment_terms || 'Immediate' },
  ].filter(Boolean)
  const cellW = contentW / itemList.length
  itemList.forEach((item, i) => {
    const x = MARGIN.l + i * cellW
    if (i > 0) drawLine(doc, x, y, x, y + boxH, C.border, 0.2)
    setFont(doc, 6.5, 'normal', C.textLight)
    drawText(doc, item.label, x + 3, y + 4)
    let valStr = String(item.value || '')
    let valFontSize = 7.5
    setFont(doc, valFontSize, 'bold', C.text)
    const maxValW = cellW - 5
    while (doc.getTextWidth(valStr) > maxValW && valFontSize > 5.5) {
      valFontSize -= 0.5
      setFont(doc, valFontSize, 'bold', C.text)
    }
    if (doc.getTextWidth(valStr) > maxValW) {
      valStr = valStr.substring(0, 18) + '…'
    }
    drawText(doc, valStr, x + 3, y + 8)
  })
  return y + boxH + SP_16
}

const drawCustomerCard = (doc, cust, y, shipCust = null, pageW = PAGE_W) => {
  const contentW = pageW - MARGIN.l - MARGIN.r
  const cardH = 40
  const mid = pageW / 2
  const cardW = contentW / 2 - 2
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
    drawText(doc, cleanVal(data.name).substring(0, 50), startX + 4, ly)
    ly += 4.5
    setFont(doc, 7.5, 'normal', C.textMid)
    
    // Address up to 3 wrapped lines
    const addr = cleanVal(data.address)
    const lines = doc.splitTextToSize(addr, cardW - 8)
    const addrLines = lines.slice(0, 3)
    for (let k = 0; k < 3; k++) {
      drawText(doc, cleanVal(addrLines[k]) || '', startX + 4, ly)
      ly += 3.5
    }
    
    // Tel / Email
    const tel = cleanVal(data.phone || data.mobile)
    const email = cleanVal(data.email)
    drawText(doc, `Tel : ${tel}    E-Mail : ${email}`, startX + 4, ly)
    ly += 3.5
    
    // PAN
    const pan = cleanVal(data.pan || data.pan_number)
    drawText(doc, `PAN No: ${pan}`, startX + 4, ly)
    ly += 3.5
    
    // GSTIN
    const gstin = cleanVal(data.gstin)
    drawText(doc, `GSTIN: ${gstin}`, startX + 4, ly)
    ly += 3.5
    
    // Code / State
    const stateStr = cleanVal(getStateStr(gstin, cleanVal(data.state)))
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
  drawText(doc, cleanVal(vend.name).substring(0, 60), MARGIN.l + 4, ly)
  ly += 5
  setFont(doc, 7.5, 'normal', C.textMid)
  const addr = cleanVal(vend.address)
  if (addr) {
    const lines = doc.splitTextToSize(addr, CONTENT_W - 8)
    lines.slice(0, 2).forEach(l => {
      drawText(doc, cleanVal(l), MARGIN.l + 4, ly)
      ly += 4
    })
  }
  const phone = cleanVal(vend.phone)
  if (phone) {
    drawText(doc, `Ph: ${phone}`, MARGIN.l + 4, ly)
    ly += 4
  }
  const gstin = cleanVal(vend.gstin)
  if (gstin) {
    setFont(doc, 7, 'bold', C.textLight)
    drawText(doc, `GSTIN: ${gstin}`, MARGIN.l + 4, ly)
  }
  return y + cardH + SP_16
}

// ── Table Column Definitions ──────
const getColsConfig = (hasCep, unitMode = 'inch') => {
  const unitLabel = unitMode === 'mm' ? 'mm' : 'Inch'
  if (hasCep) {
    return [
      { id: 'sr', h: 'Sr\nNo', w: 8 },
      { id: 'act_w', h: 'WIDTH', w: 17, parent: `Actual Size-${unitLabel}` },
      { id: 'act_h', h: 'HEIGHT', w: 17, parent: `Actual Size-${unitLabel}` },
      { id: 'chg_w', h: 'WIDTH', w: 17, parent: `Charge Size-${unitLabel}` },
      { id: 'chg_h', h: 'HEIGHT', w: 17, parent: `Charge Size-${unitLabel}` },
      { id: 'qty', h: 'Qty', w: 10, a: 'c' },
      { id: 'sqft', h: 'Sqft', w: 20, a: 'r' },
      { id: 'rate', h: 'Rate', w: 22, a: 'r' },
      { id: 'cep', h: 'CEP Rs.', w: 18, a: 'r' },
      { id: 'amount', h: 'Amount Rs.', w: 44, a: 'r' },
    ]
  } else {
    return [
      { id: 'sr', h: 'Sr\nNo', w: 8 },
      { id: 'act_w', h: 'WIDTH', w: 17, parent: `Actual Size-${unitLabel}` },
      { id: 'act_h', h: 'HEIGHT', w: 17, parent: `Actual Size-${unitLabel}` },
      { id: 'chg_w', h: 'WIDTH', w: 17, parent: `Charge Size-${unitLabel}` },
      { id: 'chg_h', h: 'HEIGHT', w: 17, parent: `Charge Size-${unitLabel}` },
      { id: 'qty', h: 'Qty', w: 10, a: 'c' },
      { id: 'sqft', h: 'Sqft', w: 24, a: 'r' },
      { id: 'rate', h: 'Rate', w: 24, a: 'r' },
      { id: 'amount', h: 'Amount Rs.', w: 56, a: 'r' },
    ]
  }
}

const buildCols = (hasCep, unitMode = 'inch') => {
  const base = getColsConfig(hasCep, unitMode)
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
  h += 7.5 // subtotal row
  h += 5.5 // HSN row
  h += SP_8
  return h
}

// ── Draw Glass Card (Splits Dynamically across pages) ──
const drawGroupCard = (doc, group, groupNo, hasCep, cols, startY, pageNum, quotation, unitMode = 'inch') => {
  const sizes = group.sizes || []
  
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
    const rate = size.selling_rate || size.rate || group.rate || 0
    
    const vals = [
      String(si + 1),
      w > 0 ? fmtDim(w, unitMode) : '',
      h > 0 ? fmtDim(h, unitMode) : '',
      chargedW > 0 ? fmtDim(chargedW, unitMode) : '',
      chargedH > 0 ? fmtDim(chargedH, unitMode) : '',
      String(qty),
      sqft.toFixed(3),
      fmtN(rate),
      ...(hasCep ? [cep > 0 ? fmtN(cep) : '-'] : []),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  // 4. Group Subtotal & HSN row
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

// ── Process Charges Card Drawing ──
const calculateProcessCardHeight = (items) => {
  if (!items?.length) return 0
  return SP_8 + 7 + items.length * 6.5 + 7.5 + SP_8 + SP_16
}

const drawProcessCard = (doc, items, y) => {
  const h = calculateProcessCardHeight(items)
  drawCard(doc, MARGIN.l, y, CONTENT_W, h - SP_16, C.white, C.border, 2.0)
  
  let ly = y + SP_8
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7, C.procHeaderBg)
  setFont(doc, 8, 'bold', C.procHeader)
  drawText(doc, 'PROCESS CHARGES', MARGIN.l + 4, ly + 5)
  ly += 7
  
  items.forEach((item, i) => {
    if (i % 2 === 1) {
      drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 6.5, C.rowAlt)
    }
    setFont(doc, 7.5, 'normal', C.text)
    drawText(doc, item.name.substring(0, 48), MARGIN.l + 4, ly + 4.5)
    
    setFont(doc, 7.5, 'bold', C.text)
    drawText(doc, `${item.qty} x ${fmtR(item.rate)} = ${fmtR(item.amount)}`, MARGIN.l + CONTENT_W - 5.0, ly + 4.5, { align: 'right' })
    drawLine(doc, MARGIN.l + 0.3, ly + 6.5, MARGIN.l + CONTENT_W - 0.3, ly + 6.5, C.borderLight, 0.15)
    ly += 6.5
  })
  
  const tot = items.reduce((s, item) => s + (item.amount || 0), 0)
  drawRect(doc, MARGIN.l + 0.3, ly, CONTENT_W - 0.6, 7.5, C.procHeaderBg)
  drawLine(doc, MARGIN.l + 0.3, ly, MARGIN.l + CONTENT_W - 0.3, ly, C.border, 0.3)
  setFont(doc, 7.5, 'bold', C.procHeader)
  drawText(doc, 'Process Charges Total', MARGIN.l + 4, ly + 5.5)
  drawText(doc, fmtR(tot), MARGIN.l + CONTENT_W - 5.0, ly + 5.5, { align: 'right' })
  
  return y + h
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
const calculateDocumentFooterHeight = (company) => {
  let bankLinesCount = 0
  if (company) {
    const fields = [
      company.bank_ac_name,
      company.bank_ac_no,
      company.bank_name,
      company.bank_branch,
      company.bank_ifsc,
      company.bank_micr,
      company.bank_swift
    ]
    bankLinesCount = fields.filter(f => cleanVal(f)).length
  }
  const bankH = bankLinesCount > 0 ? (4.5 + bankLinesCount * 3.2 + 2.0) : 0
  const rightH = bankH + 25.0
  const leftH = 46.0
  const maxTwoColH = Math.max(leftH, rightH)
  return maxTwoColH + 4.5 + 12.0
}

const drawDocumentFooterSection = (doc, company, y, pageNum, docData) => {
  const footerH = calculateDocumentFooterHeight(company)
  
  // Page break check so footer is never cut off
  y = checkPageBreak(doc, y, footerH, pageNum, docData)

  const startY = y
  const leftX = MARGIN.l // 10mm
  const colGap = 4
  const leftW = 94
  const rightX = leftX + leftW + colGap // 108mm
  const rightW = CONTENT_W - leftW - colGap // 92mm

  // ---------------------------------------------------------
  // LEFT COLUMN: Terms of Sale/Payment/Delivery:
  // ---------------------------------------------------------
  let ly = startY
  setFont(doc, 8, 'bold', C.primary)
  drawText(doc, 'Terms of Sale/Payment/Delivery:', leftX, ly)
  const headingW = doc.getTextWidth('Terms of Sale/Payment/Delivery:')
  drawLine(doc, leftX, ly + 0.8, leftX + headingW, ly + 0.8, C.primary, 0.3)
  
  ly += 4.5

  const bullets = [
    '• Validity of Document is 8 Days from the date of issue.',
    '• Goods sold cannot be Exchanged or Returned.',
    '• Accepted Tolerance limits will be +/- 1mm in dimentions & =/- .01mm in thickness',
    '• Delivery is effected solely on buyer\'s risk n costs',
    '• All disputes subject to Palghar jurisdiction'
  ]

  setFont(doc, 6.5, 'normal', C.text)
  bullets.forEach(b => {
    const wrapped = doc.splitTextToSize(b, leftW)
    wrapped.forEach(wline => {
      drawText(doc, wline, leftX, ly)
      ly += 3.2
    })
  })

  ly += 1.5

  // Red Italic Disclaimer
  const companyShort = (cleanVal(company.short_name) || cleanVal(company.name) || 'EXCEL').toUpperCase()
  const disclaimerText = `At ${companyShort} we value the time of our clients very highly, but due to the brittle nature of our product, many a times we are unable to meet our commitments and the deadlines of our esteemed clients due to reasons beyond our control.`
  
  setFont(doc, 6.5, 'italic', [220, 38, 38])
  const disclaimerLines = doc.splitTextToSize(disclaimerText, leftW)
  disclaimerLines.forEach(dline => {
    drawText(doc, dline, leftX, ly)
    ly += 3.0
  })

  ly += 2.0

  // Emphasized Payment terms
  setFont(doc, 7.5, 'bold', C.text)
  drawText(doc, '50% Advance', leftX, ly)
  ly += 3.5
  drawText(doc, 'Bal before delivery', leftX, ly)
  ly += 4.0

  const leftEndY = ly

  // ---------------------------------------------------------
  // RIGHT COLUMN: BANK DETAILS & SIGNATORY BOX
  // ---------------------------------------------------------
  let ry = startY

  const bankFields = [
    cleanVal(company.bank_ac_name) ? { label: 'A/c Name:', val: cleanVal(company.bank_ac_name) } : null,
    cleanVal(company.bank_ac_no) ? { label: 'A/c Number:', val: cleanVal(company.bank_ac_no) } : null,
    cleanVal(company.bank_name) ? { label: 'Bank Name:', val: cleanVal(company.bank_name) } : null,
    cleanVal(company.bank_branch) ? { label: 'Branch:', val: cleanVal(company.bank_branch) } : null,
    cleanVal(company.bank_ifsc) ? { label: 'IFC/RTGS Code:', val: cleanVal(company.bank_ifsc) } : null,
    cleanVal(company.bank_micr) ? { label: 'MICR Code:', val: cleanVal(company.bank_micr) } : null,
    cleanVal(company.bank_swift) ? { label: 'Swift Code:', val: cleanVal(company.bank_swift) } : null,
  ].filter(Boolean)

  if (bankFields.length > 0) {
    setFont(doc, 8, 'bold', C.primary)
    drawText(doc, 'BANK DETAILS:', rightX, ry)
    const bankHeadingW = doc.getTextWidth('BANK DETAILS:')
    drawLine(doc, rightX, ry + 0.8, rightX + bankHeadingW, ry + 0.8, C.primary, 0.3)
    ry += 4.5

    bankFields.forEach(b => {
      setFont(doc, 6.5, 'bold', C.textMid)
      drawText(doc, b.label, rightX, ry)
      setFont(doc, 6.5, 'normal', C.text)
      drawText(doc, b.val, rightX + 24, ry)
      ry += 3.2
    })
    ry += 2.0
  }

  // Signatory Box
  const sigBoxH = 22
  drawCard(doc, rightX, ry, rightW, sigBoxH, C.white, C.border, 1.5)
  
  setFont(doc, 7.5, 'bold', C.primary)
  drawText(doc, `For:  ${(cleanVal(company.name) || 'ESSAR GLASS').toUpperCase()}`, rightX + 4, ry + 5)
  
  setFont(doc, 6.5, 'bold', C.textLight)
  drawText(doc, 'authorized Signatory', rightX + rightW - 4, ry + sigBoxH - 4, { align: 'right' })

  ry += sigBoxH + 3.0

  const rightEndY = ry
  const maxTwoColY = Math.max(leftEndY, rightEndY)

  // ---------------------------------------------------------
  // CENTERED COMPUTERIZED DOCUMENT NOTE
  // ---------------------------------------------------------
  let noteY = maxTwoColY + 1.0
  setFont(doc, 6.5, 'italic', C.textLight)
  drawText(
    doc,
    'This is a computerized generated document hence it does not require a signature.',
    PAGE_W / 2,
    noteY,
    { align: 'center' }
  )

  noteY += 3.5

  // ---------------------------------------------------------
  // BOTTOM ADDRESS BOX (Full Width Bordered Box)
  // ---------------------------------------------------------
  const cityStr = cleanVal(company.city)
  const pinStr = cleanVal(company.pincode)
  let cityPinComp = cityStr
  if (pinStr && !cityStr.includes(pinStr)) {
    cityPinComp = cityStr ? `${cityStr} ${pinStr}` : pinStr
  }

  const addrComp = [
    cleanVal(company.address),
    cleanVal(company.address_line2),
    cityPinComp,
    cleanVal(company.state_name) && !cityStr.includes(cleanVal(company.state_name)) ? cleanVal(company.state_name) : ''
  ].filter(Boolean)

  const fullAddrStr = addrComp.join(', ')
  const emailStr = cleanVal(company.email)
  const websiteStr = cleanVal(company.website)
  const mapsStr = cleanVal(company.google_maps || company.map_link)

  const addrBoxLines = []
  if (fullAddrStr) {
    addrBoxLines.push(`Factory outlet & Reg. Sales Off: ${fullAddrStr}`)
  }
  
  const contactParts = []
  if (emailStr) contactParts.push(`email: ${emailStr}`)
  if (websiteStr) contactParts.push(`website: ${websiteStr}`)
  if (mapsStr) contactParts.push(`google maps: ${mapsStr}`)
  if (contactParts.length > 0) {
    addrBoxLines.push(contactParts.join('   |   '))
  }

  const lineCount = addrBoxLines.length || 1
  const addrBoxH = 3.5 + lineCount * 3.5

  drawCard(doc, MARGIN.l, noteY, CONTENT_W, addrBoxH, C.summaryBg, C.border, 1.5)

  let aby = noteY + 3.8
  setFont(doc, 6.5, 'bold', C.textMid)
  addrBoxLines.forEach(aline => {
    drawText(doc, aline, MARGIN.l + 4, aby)
    aby += 3.5
  })

  return noteY + addrBoxH
}

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
const checkPageBreak = (doc, y, heightNeeded, pageNum, quotation, company) => {
  const usablePageHeight = PAGE_H - 20
  if (y + heightNeeded > usablePageHeight) {
    doc.addPage()
    pageNum.val++
    drawBorder(doc)
    
    let ny = MARGIN.t + SP_8
    setFont(doc, 9, 'bold', C.primary)
    drawText(doc, company?.name || quotation?.company_name || 'COMPANY', MARGIN.l + 2, ny + 4)
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
      <div style="display:flex;align-items:center;gap:12px;">
        ${company.logo ? `<img src="${company.logo}" style="height:40px;object-fit:contain;background:#fff;border-radius:4px;padding:2px;"/>` : ''}
        <div>
          <div style="font-size:14px;font-weight:700;">${(company.name || 'ESSAR SONS').toUpperCase()}</div>
          <div style="font-size:10px;color:#c5cae9;">${company.tagline || ''}</div>
        </div>
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
    const [company] = await Promise.all([
      preloadCompanyLogos(await fetchCompany(quotation.company_id)),
      preloadBrandLogos(),
    ])

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
    const unitMode = quotation.unit_mode || 'inch'
    const cols = buildCols(hasCep, unitMode)
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
      const res = drawGroupCard(doc, group, groupNo, hasCep, cols, y, pageNum, quotation, unitMode)
      totalQty += res.grpQty
      totalSqft += res.grpSqft
      totalCep += res.grpCep
      grandGlass += res.grpAmt
      y = res.endY + SP_16
    })

    // Glass total bar
    y = checkPageBreak(doc, y, 8 + SP_16, pageNum, quotation)
    y = drawTotalSummaryGridRow(doc, totalQty, totalSqft, grandGlass, y) + SP_16

    // Process Charges Card
    const isRealProc = (p) => (p.process_id != null || p.process_name || p.name) &&
      (((p.qty_area ?? p.qty) || 0) > 0 || (p.rate || 0) > 0 || (p.amount || 0) > 0)
    const allDocProcs = [
      ...(groups || []).flatMap(g => [
        ...(g.processes || []).filter(isRealProc),
        ...(g.sizes || []).flatMap(s => (s.size_processes || []).filter(isRealProc))
      ])
    ]
    const aggProcs = aggregateProcesses(allDocProcs)
    if (aggProcs.length > 0) {
      const procHeight = calculateProcessCardHeight(aggProcs)
      y = checkPageBreak(doc, y, procHeight, pageNum, quotation)
      y = drawProcessCard(doc, aggProcs, y) + SP_16
    }

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
    const procTot = t.procTotal || aggProcs.reduce((s, p) => s + (p.amount || 0), 0) || 0
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
    const footerSectionH = calculateDocumentFooterHeight(company)
    
    // Check page break for summary block + footer section
    y = checkPageBreak(doc, y, summaryHeight + footerSectionH, pageNum, quotation)
    
    y = drawFinalSummaryBlock(doc, totalsRows, toWords(Math.round(grand)), quotation, y) + SP_16

    drawDocumentFooterSection(doc, company, y, pageNum, quotation)

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

          const imgData = canvas.toDataURL('image/jpeg', 0.85)
          const imgW = pdfW
          const imgH = (canvas.height * pdfW) / canvas.width

          doc.addPage()
          
          let heightLeft = imgH
          let position = 0
          const artworkAlias = `artwork_group_${gi}`
          doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH, artworkAlias)
          heightLeft -= pdfH

          while (heightLeft > 0) {
            position = heightLeft - imgH
            doc.addPage()
            doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH, artworkAlias)

            heightLeft -= pdfH
          }
        } finally {
          document.body.removeChild(container)
        }
      }
    }

    doc.save(makePdfFilename(quotation.quote_number || 'QT', cust.name, 'Customer'))
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF failed: ' + e.message)
  }
}

// ── Draw Sales Order Items Card (Splits dynamically) ──
// ── Draw Sales Order Items Card (Splits dynamically) ──
const drawSOItemsCard = (doc, lines, hasCep, cols, startY, pageNum, so, unitMode = 'inch') => {
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
      w > 0 ? fmtDim(w, unitMode) : '',
      h > 0 ? fmtDim(h, unitMode) : '',
      chargedW > 0 ? fmtDim(chargedW, unitMode) : '',
      chargedH > 0 ? fmtDim(chargedH, unitMode) : '',
      String(qty),
      area.toFixed(3),
      fmtN(rate),
      ...(hasCep ? [cep > 0 ? fmtN(cep) : '-'] : []),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  ly = drawGroupSubtotal(doc, cols, tQty, tArea, tRft, tCep, tAmt, hasCep, ly)
  ly = drawGroupHsnRow(doc, { hsn: '7007', cs: '400' }, ly)
  
  return { endY: ly, tQty, tArea, tAmt }
}

const drawSOGroupCard = (doc, group, groupNo, hasCep, cols, startY, pageNum, so, unitMode = 'inch') => {
  const sizes = group.sizes || []
  
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
    const rate = size.selling_rate || size.rate || group.rate || 0
    
    const vals = [
      String(si + 1),
      w > 0 ? fmtDim(w, unitMode) : '',
      h > 0 ? fmtDim(h, unitMode) : '',
      chargedW > 0 ? fmtDim(chargedW, unitMode) : '',
      chargedH > 0 ? fmtDim(chargedH, unitMode) : '',
      String(qty),
      sqft.toFixed(3),
      fmtN(rate),
      ...(hasCep ? [cep > 0 ? fmtN(cep) : '-'] : []),
      fmtN(amt)
    ]
    
    ly = drawDataRow(doc, cols, vals, false, ly)
  })
  
  // 4. Group Subtotal & HSN row
  ly = drawGroupSubtotal(doc, cols, grpQty, grpSqft, grpRft, grpCep, grpAmt, hasCep, ly)
  ly = drawGroupHsnRow(doc, group, ly)
  
  return { endY: ly, grpQty, grpSqft, grpCep, grpAmt }
}


export const generateSOPDF = async (so) => {
  try {
    const { hardware_items = [], labor_items = [], wastage_items = [] } = so
    const doc = new jsPDF('p', 'mm', 'a4')
    const [company] = await Promise.all([
      preloadCompanyLogos(await fetchCompany(so.company_id)),
      preloadBrandLogos(),
    ])
    
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
    const unitMode = so.unit_mode || 'inch'
    const cols = buildCols(hasCep, unitMode)
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
        const res = drawSOGroupCard(doc, group, groupNo, hasCep, cols, y, pageNum, so, unitMode)
        totalQty += res.grpQty
        totalSqft += res.grpSqft
        totalCep += res.grpCep
        grandGlass += res.grpAmt
        y = res.endY + SP_16
      })
    } else {
      const res = drawSOItemsCard(doc, so.lines || [], hasCep, cols, y, pageNum, so, unitMode)
      totalQty = res.tQty
      totalSqft = res.tArea
      grandGlass = res.tAmt
      y = res.endY + SP_16
    }

    // Glass total bar
    y = checkPageBreak(doc, y, 8 + SP_16, pageNum, so)
    y = drawTotalSummaryGridRow(doc, totalQty, totalSqft, grandGlass, y) + SP_16

    // Process Charges Card
    const isRealProc = (p) => (p.process_id != null || p.process_name || p.name) &&
      (((p.qty_area ?? p.qty) || 0) > 0 || (p.rate || 0) > 0 || (p.amount || 0) > 0)
    const allDocProcs = [
      ...(groups || []).flatMap(g => [
        ...(g.processes || []).filter(isRealProc),
        ...(g.sizes || []).flatMap(s => (s.size_processes || []).filter(isRealProc))
      ]),
      ...(so.lines || []).flatMap(l => (l.line_processes || l.processes || []).filter(isRealProc))
    ]
    const aggProcs = aggregateProcesses(allDocProcs)
    if (aggProcs.length > 0) {
      const procHeight = calculateProcessCardHeight(aggProcs)
      y = checkPageBreak(doc, y, procHeight, pageNum, so)
      y = drawProcessCard(doc, aggProcs, y) + SP_16
    }

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
    const procTot = t.procTotal || aggProcs.reduce((s, p) => s + (p.amount || 0), 0) || 0
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
    const footerSectionH = calculateDocumentFooterHeight(company)
    
    y = checkPageBreak(doc, y, summaryHeight + footerSectionH, pageNum, so)
    y = drawFinalSummaryBlock(doc, totalsRows, toWords(Math.round(grand)), { payment_terms: so.payment_terms }, y) + SP_16
    
    drawDocumentFooterSection(doc, company, y, pageNum, so)

    addFootersAndPageNumbers(doc, so.so_number || 'SO')
    doc.save(makePdfFilename(so.so_number || 'SO', cust.name, 'Customer'))
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
    const area = line.sqft ?? line.charged_sqft ?? line.total_sqft ?? 0
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
    const rate = line.unit_price ?? line.rate ?? 0
    
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
    const [company] = await Promise.all([
      preloadCompanyLogos(await fetchCompany(po.company_id)),
      preloadBrandLogos(),
    ])
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
    doc.save(makePdfFilename(po.po_number || 'PO', vend.name, 'Vendor'))
  } catch (e) {
    console.error('PO PDF:', e)
    alert('PO PDF failed: ' + e.message)
  }
}

// ── Toughening Job Work Challan PDF Generator ──────────────────────
export const generateTougheningChallanPDF = async (batch) => {
  if (!batch) return

  const [company] = await Promise.all([
    preloadCompanyLogos(await fetchCompany(batch.company_id)),
    preloadBrandLogos(),
  ])

  // Resolve vendor name
  let vendorName = cleanVal(batch.vendor_name)
  if (!vendorName && batch.vendor_id) {
    try {
      const allVendors = JSON.parse(localStorage.getItem('vendors_master') || '[]')
      const match = allVendors.find(v => v.id === batch.vendor_id || v.value === batch.vendor_id)
      if (match?.name || match?.label) vendorName = cleanVal(match.name || match.label)
    } catch {}
    if (!vendorName) {
      try {
        const vRes = await vendorApi.get(batch.vendor_id)
        if (vRes?.data?.name) vendorName = cleanVal(vRes.data.name)
      } catch {}
    }
  }

  // Resolve items / lines
  const rawItems = batch.lines?.length ? batch.lines : (batch.items?.length ? batch.items : [])

  // Group items by description while preserving original order
  const groupedMap = new Map()
  rawItems.forEach(item => {
    const descKey = (item.description || 'Unspecified').trim()
    if (!groupedMap.has(descKey)) {
      groupedMap.set(descKey, [])
    }
    groupedMap.get(descKey).push(item)
  })

  // Helper to parse thickness (MM) anywhere in description
  const parseThickness = (descRaw) => {
    const desc = String(descRaw || '').trim()
    // 1) explicit "<n>mm" anywhere (start, middle or end)
    let m = desc.match(/(\d+(?:\.\d+)?)\s*mm\b/i)
    if (m) {
      return {
        mm: m[1],
        rest: desc.replace(m[0], ' ').replace(/\s{2,}/g, ' ').trim(),
      }
    }
    // 2) bare leading number, e.g. "12 Extra Clear Tough"
    m = desc.match(/^(\d+(?:\.\d+)?)\s+/)
    if (m) {
      return { mm: m[1], rest: desc.slice(m[0].length).trim() }
    }
    return { mm: '', rest: desc }
  }

  // Helper to extract process name(s) for a line item
  const getItemProcessStr = (item) => {
    if (!item) return ''
    if (item.process_label) return String(item.process_label).trim()
    if (item.process_name) return String(item.process_name).trim()

    const procs = [
      ...(item.processes || []),
      ...(item.size_processes || []),
      ...(item.group_processes || []),
      ...(item.line_processes || []),
    ]
    if (procs.length > 0) {
      const names = procs
        .map(p => {
          if (typeof p === 'string') return p
          if (p.process_name || p.name || p.label) return p.process_name || p.name || p.label
          try {
            const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
            const m = pm.find(x => x.id === (p.process_id ?? p.id))
            if (m?.name) return m.name
          } catch {}
          return p.process_id ? `Process ${p.process_id}` : ''
        })
        .filter(Boolean)
      if (names.length > 0) {
        return [...new Set(names)].join(', ')
      }
    }
    if (typeof item.process === 'string' && item.process.trim()) return item.process.trim()
    return ''
  }

  const doc = new jsPDF('p', 'mm', 'a4')

  // R2 — Standard Header & Border
  drawBorder(doc)
  let y = drawHeader(doc, company, 'JOB WORK CHALLAN')

  // R3 — Doc Info Strip
  const docInfoItems = [
    { label: 'Document Type', value: 'JOB WORK CHALLAN' },
    { label: 'Challan No', value: batch.tb_number || 'TB-DRAFT' },
    { label: 'Date', value: formatDate(batch.sent_date || batch.batch_date) || '—' },
    { label: 'Vendor', value: vendorName || '—' },
    { label: 'Expected Return', value: batch.expected_return ? formatDate(batch.expected_return) : '—' },
    { label: 'Vehicle No', value: batch.vehicle_number || '—' },
  ]
  y = drawDocInfo(doc, batch, y, 'JOB WORK CHALLAN', docInfoItems)

  // R4 — Vendor Banner
  const vendorBannerText = vendorName
    ? `MATERIAL BEING SENT TO TOUGHNED , ${vendorName.toUpperCase()} FOR JOBWORK`
    : `MATERIAL BEING SENT TO TOUGHNED FOR JOBWORK`

  drawRect(doc, MARGIN.l, y, CONTENT_W, 7, C.glassHeaderBg, C.glassHeader, 0.2)
  let bannerFontSize = 8.5
  setFont(doc, bannerFontSize, 'bold', C.glassHeader)
  while (doc.getTextWidth(vendorBannerText) > CONTENT_W - 10 && bannerFontSize > 6.5) {
    bannerFontSize -= 0.5
    setFont(doc, bannerFontSize, 'bold', C.glassHeader)
  }
  drawText(doc, vendorBannerText, 105, y + 4.8, { align: 'center' })
  y += 7 + SP_8

  // R5 — Data Table
  const tableBodyRows = []
  const groupFirstRowIndices = new Set()

  groupedMap.forEach((itemsInGroup, groupDesc) => {
    const parsed = parseThickness(groupDesc)
    itemsInGroup.forEach((item, idx) => {
      const w_mm = item.width_mm || item.act_w_mm || 0
      const h_mm = item.height_mm || item.act_h_mm || 0
      const qty = item.quantity || item.qty || 1
      const procStr = getItemProcessStr(item)

      const lengthStr = w_mm ? `${Math.round(w_mm)}` : '—'
      const widthStr = h_mm ? `${Math.round(h_mm)}` : '—'

      if (idx === 0) {
        groupFirstRowIndices.add(tableBodyRows.length)
        tableBodyRows.push([
          parsed.mm,
          String(parsed.rest || '').toUpperCase(),
          lengthStr,
          widthStr,
          String(qty),
          procStr
        ])
      } else {
        tableBodyRows.push([
          '',
          '',
          lengthStr,
          widthStr,
          String(qty),
          procStr
        ])
      }
    })
    // Spacer row after group
    tableBodyRows.push(['', '', '', '', '', ''])
  })

  // R6 — Target Filler Rows (12 rows target)
  const targetRowsPerPage = 12
  if (tableBodyRows.length < targetRowsPerPage) {
    const fillerNeeded = targetRowsPerPage - tableBodyRows.length
    for (let i = 0; i < fillerNeeded; i++) {
      tableBodyRows.push(['', '', '', '', '', ''])
    }
  }

  autoTable(doc, {
    theme: 'grid',
    startY: y,
    head: [['MM', 'DESCRIPTION', 'LENGTH', 'WIDTH', 'QTY', 'PROCESS']],
    body: tableBodyRows,
    margin: { left: 10, right: 10 },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
      lineWidth: 0.15,
      lineColor: [148, 163, 184],
      textColor: C.text,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: C.glassHeader,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8.5,
      lineWidth: 0.15,
      lineColor: C.glassHeader,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 75, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 35, halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && groupFirstRowIndices.has(data.row.index)) {
        if (data.column.index === 0 || data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })

  // Signatory Section
  let sigY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : 220
  if (sigY + 32 > 275) {
    doc.addPage()
    sigY = 15
  }

  const boxX = 10
  const boxW = 190
  const boxH = 30

  drawCard(doc, boxX, sigY, boxW, boxH, C.white, C.border, 1.5)

  // Receiver acknowledgement (left side)
  setFont(doc, 8, 'bold', C.text)
  drawText(doc, "Receiver's Signature / Stamp:", boxX + 6, sigY + 6)
  drawLine(doc, boxX + 6, sigY + 20, boxX + 65, sigY + 20, C.border, 0.25)
  setFont(doc, 7, 'normal', C.textLight)
  drawText(doc, "Received In Good Condition", boxX + 6, sigY + 24)

  // Signatory block (right side)
  const compNameUpper = (company.name || 'ESSAR GLASS').toUpperCase()
  setFont(doc, 8.5, 'bold', C.text)
  drawText(doc, `FOR, ${compNameUpper}`, boxX + boxW - 6, sigY + 6, { align: 'right' })

  const sigLineW = 60
  const sigLineX2 = boxX + boxW - 6
  const sigLineX1 = sigLineX2 - sigLineW
  const sigLineY = sigY + 20
  drawLine(doc, sigLineX1, sigLineY, sigLineX2, sigLineY, C.border, 0.25)

  setFont(doc, 7.5, 'normal', C.textMid)
  drawText(doc, "Authorised Signatory", sigLineX1 + sigLineW / 2, sigLineY + 4.5, { align: 'center' })

  // R7 — Footer Standardize
  addFootersAndPageNumbers(doc, batch.tb_number || 'TB')

  const fileName = makePdfFilename(batch.tb_number || 'TB', vendorName, 'Vendor')
  doc.save(fileName)
  return doc
}

// ── Delivery Challan PDF Generator ─────────────────────────────────────────────
export const generateDeliveryChallanPDF = async (dc) => {
  if (!dc) return
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const [company] = await Promise.all([
      preloadCompanyLogos(await fetchCompany(dc.company_id)),
      preloadBrandLogos(),
    ])

    // 1. Resolve Customer details (Bill To / Ship To)
    let cust = {
      name: dc.customer_name || '',
      address: '', phone: dc.customer_phone || '', gstin: dc.customer_gstin || ''
    }
    if (dc.customer_id) {
      try {
        const res = await customerApi.get(dc.customer_id)
        const c = res.data || res
        if (c) cust = {
          name: c.name || dc.customer_name || '',
          address: [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', '),
          phone: c.phone || c.mobile || dc.customer_phone || '',
          gstin: c.gstin || dc.customer_gstin || '',
        }
      } catch (err) {
        try {
          const all = JSON.parse(localStorage.getItem('customers') || '[]')
          const c = all.find(x => x.id === dc.customer_id)
          if (c) cust = {
            name: c.name,
            address: [c.address, c.city].filter(Boolean).join(', '),
            phone: c.phone || c.mobile || '',
            gstin: c.gstin || '',
          }
        } catch { }
      }
    }

    let shipCust = { ...cust }
    if (dc.delivery_address && dc.delivery_address.trim()) {
      shipCust.address = dc.delivery_address.trim()
    }

    // 2. Resolve Sales Order Ref if missing
    let soNum = cleanVal(dc.so_number || dc.sales_order_number)
    if (!soNum && dc.so_id) {
      try {
        const allSos = JSON.parse(localStorage.getItem('sales_orders') || '[]')
        const match = allSos.find(s => s.id === dc.so_id)
        if (match?.so_number) soNum = match.so_number
      } catch { }
    }

    let pageNum = { val: 1, total: '?' }

    // 3. Page 1 Setup: Header & Title Band
    drawBorder(doc)
    let y = drawHeader(doc, company, 'DELIVERY CHALLAN')

    // 4. Doc Info Strip
    const dcInfoItems = [
      { label: 'Document Type', value: 'DELIVERY CHALLAN' },
      { label: 'DC No', value: dc.dc_number || 'DC-DRAFT' },
      { label: 'Date', value: formatDate(dc.dc_date || new Date()) },
      { label: 'Sales Order Ref', value: soNum || '—' },
      { label: 'Vehicle No', value: dc.vehicle_number || '—' },
      { label: 'Driver', value: dc.driver_name || '—' },
      { label: 'Transporter', value: dc.transporter || '—' },
    ]

    const infoBoxH = 11
    drawCard(doc, MARGIN.l, y, CONTENT_W, infoBoxH, C.summaryBg, C.border, 1.5)
    const cellW = CONTENT_W / dcInfoItems.length
    dcInfoItems.forEach((item, i) => {
      const x = MARGIN.l + i * cellW
      if (i > 0) drawLine(doc, x, y, x, y + infoBoxH, C.border, 0.2)
      setFont(doc, 6, 'normal', C.textLight)
      drawText(doc, item.label, x + 2.5, y + 4)
      setFont(doc, 7, 'bold', C.text)
      drawText(doc, String(item.value || '').substring(0, 16), x + 2.5, y + 8)
    })
    y += infoBoxH + SP_16

    // 5. Party Blocks (BILL TO / SHIP TO)
    y = drawCustomerCard(doc, cust, y, shipCust)

    // 6. Extract lines
    const rawLines = dc.lines?.length ? dc.lines : (dc.items?.length ? dc.items : [])
    const glassLines = rawLines.filter(l => l.item_type !== 'hardware')
    const hardwareLines = rawLines.filter(l => l.item_type === 'hardware')

    const groupsMap = new Map()
    glassLines.forEach((l) => {
      const descKey = (l.description || 'GLASS ITEM').trim().toUpperCase()
      if (!groupsMap.has(descKey)) {
        groupsMap.set(descKey, [])
      }
      groupsMap.get(descKey).push(l)
    })

    if (groupsMap.size === 0 && dc.glassGroups?.length) {
      dc.glassGroups.forEach(g => {
        const descKey = (g.description || 'GLASS ITEM').trim().toUpperCase()
        if (!groupsMap.has(descKey)) {
          groupsMap.set(descKey, [])
        }
        (g.sizes || []).forEach(s => {
          groupsMap.get(descKey).push({ ...s, description: descKey, item_type: 'glass' })
        })
      })
    }
    if (hardwareLines.length === 0 && dc.hardwareItems?.length) {
      dc.hardwareItems.forEach(h => {
        hardwareLines.push({ ...h, item_type: 'hardware' })
      })
    }

    // Helper for page break check in DC
    const checkPageBreakDC = (heightNeeded) => {
      const usablePageHeight = PAGE_H - 24
      if (y + heightNeeded > usablePageHeight) {
        doc.addPage()
        pageNum.val++
        drawBorder(doc)

        let ny = MARGIN.t + SP_8
        setFont(doc, 9, 'bold', C.primary)
        drawText(doc, company.name || 'ESSAR GLASS', MARGIN.l + 2, ny + 4)
        setFont(doc, 7, 'normal', C.textLight)
        drawText(doc, `DC No: ${dc.dc_number || 'DC-DRAFT'}`, PAGE_W - MARGIN.r - 2, ny + 4, { align: 'right' })
        drawLine(doc, MARGIN.l, ny + 7, MARGIN.l + CONTENT_W, ny + 7, C.border, 0.3)

        y = ny + 10
      }
    }

    // 7. Glass Groups rendering
    let groupNo = 0
    groupsMap.forEach((sizes, groupDesc) => {
      groupNo++
      checkPageBreakDC(25)

      // Group Banner
      drawRect(doc, MARGIN.l, y, CONTENT_W, 7, C.glassHeaderBg)
      drawLine(doc, MARGIN.l, y, MARGIN.l + CONTENT_W, y, C.border, 0.25)
      drawLine(doc, MARGIN.l, y + 7, MARGIN.l + CONTENT_W, y + 7, C.border, 0.25)
      setFont(doc, 8, 'bold', C.glassHeader)
      drawText(doc, `GLASS ITEM ${groupNo}: ${groupDesc}`, MARGIN.l + 4, y + 4.8)

      y += 7

      const bodyRows = sizes.map((s, idx) => {
        const w_in = s.width_inch ?? (s.width_mm ? parseFloat((s.width_mm / 25.4).toFixed(4)) : null)
        const h_in = s.height_inch ?? (s.height_mm ? parseFloat((s.height_mm / 25.4).toFixed(4)) : null)
        const inchStr = (w_in && h_in) ? `${toFraction(w_in)}" × ${toFraction(h_in)}"` : (w_in ? `${toFraction(w_in)}"` : '—')

        const w_mm = s.width_mm ?? (w_in ? Math.round(w_in * 25.4) : null)
        const h_mm = s.height_mm ?? (h_in ? Math.round(h_in * 25.4) : null)
        const mmStr = (w_mm && h_mm) ? `${w_mm} × ${h_mm}` : '—'

        const ordQty = s.quantity ?? s.ordered_qty ?? 1
        const dispQty = s.qty_dispatched ?? s.dispatch_qty ?? ordQty
        const remarks = s.remarks || '—'

        return [
          String(idx + 1),
          inchStr,
          mmStr,
          String(ordQty),
          String(dispQty),
          remarks
        ]
      })

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: MARGIN.l, right: MARGIN.r },
        head: [[
          'Sr No', 'Actual Size (Inch)', 'Size (mm)', 'Ordered Qty', 'Dispatched Qty', 'Remarks'
        ]],
        body: bodyRows,
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          lineWidth: 0.2,
          lineColor: C.border,
          textColor: C.text,
          halign: 'center',
          valign: 'middle',
        },
        headStyles: {
          fillColor: C.glassHeader,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 50, halign: 'left' },
        },
        didDrawPage: () => {
          drawBorder(doc)
        }
      })

      y = doc.lastAutoTable.finalY + SP_16
    })

    // 8. Hardware Items rendering
    if (hardwareLines.length > 0) {
      checkPageBreakDC(25)

      drawRect(doc, MARGIN.l, y, CONTENT_W, 7, C.hwHeaderBg)
      drawLine(doc, MARGIN.l, y, MARGIN.l + CONTENT_W, y, C.border, 0.25)
      drawLine(doc, MARGIN.l, y + 7, MARGIN.l + CONTENT_W, y + 7, C.border, 0.25)
      setFont(doc, 8, 'bold', C.hwHeader)
      drawText(doc, 'HARDWARE ACCESSORIES', MARGIN.l + 4, y + 4.8)

      y += 7

      const hwBodyRows = hardwareLines.map((h, idx) => [
        String(idx + 1),
        (h.description || 'Hardware Item').toUpperCase(),
        String(h.quantity ?? h.ordered_qty ?? 1),
        String(h.qty_dispatched ?? h.dispatch_qty ?? h.quantity ?? 1),
        h.remarks || '—'
      ])

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: MARGIN.l, right: MARGIN.r },
        head: [['Sr No', 'Description', 'Ordered Qty', 'Dispatched Qty', 'Remarks']],
        body: hwBodyRows,
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          lineWidth: 0.2,
          lineColor: C.border,
          textColor: C.text,
          halign: 'center',
          valign: 'middle',
        },
        headStyles: {
          fillColor: C.hwHeader,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 75, halign: 'left' },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 50, halign: 'left' },
        },
        didDrawPage: () => {
          drawBorder(doc)
        }
      })

      y = doc.lastAutoTable.finalY + SP_16
    }

    // 9. Signature Block
    checkPageBreakDC(28)

    const cardW = (CONTENT_W - SP_8) / 2
    const cardH = 22

      // Right card: Authorised Signatory for Company
    const x2 = MARGIN.l + cardW + SP_8
    const compNameUpper = (company.name || 'ESSAR GLASS').toUpperCase()
    drawCard(doc, x2, y, cardW, cardH, C.white, C.border, 1.5)
    setFont(doc, 7.5, 'bold', C.primaryMid)
    drawText(doc, `For ${compNameUpper}`, x2 + 4, y + 4.5)
    setFont(doc, 6.5, 'normal', C.textLight)
    drawText(doc, "Office Seal & Dispatch Desk", x2 + 4, y + 8.5)
    drawLine(doc, x2 + 4, y + 15.5, x2 + cardW - 4, y + 15.5, C.border, 0.25)
    setFont(doc, 6.5, 'normal', C.textLight)
    drawText(doc, "Authorised Signatory", x2 + cardW / 2, y + 19.5, { align: 'center' })

    // 10. Page footers pass
    addFootersAndPageNumbers(doc, dc.dc_number || 'DC')

    const fileName = makePdfFilename(dc.dc_number || 'DC', cust.name, 'Customer')
    doc.save(fileName)
    return doc
  } catch (err) {
    console.error('Failed to generate Delivery Challan PDF:', err)
    throw err
  }
}

// ── Workshop Order PDF Generator ─────────────────────────────────────────────
export const generateWorkshopOrderPDF = async (wo) => {
  if (!wo) return
  try {
    const doc = new jsPDF('l', 'mm', 'a4')
    const company = await preloadCompanyLogos(await fetchCompany(wo.company_id))

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 10

    drawBorder(doc, pageW, pageH)
    let y = drawHeader(doc, company, 'WORKSHOP ORDER', pageW)

    // Document Meta Info
    const woDocInfoItems = [
      { label: 'Document Type', value: 'WORKSHOP ORDER' },
      { label: 'WO No', value: wo.wo_number || 'WO-DRAFT' },
      { label: 'Date', value: formatDate(wo.order_date) },
      { label: 'SO Ref', value: wo.so_number || (wo.so_id ? `SO #${wo.so_id}` : '—') },
      { label: 'Required By', value: wo.required_by ? formatDate(wo.required_by) : '—' },
      { label: 'Priority', value: (wo.priority || 'Normal').toUpperCase() },
    ]
    y = drawDocInfo(doc, wo, y, 'WORKSHOP ORDER', woDocInfoItems, pageW)

    // Customer Card
    let cust = {
      name: wo.customer_name || wo.customer?.name || '',
      address: '', phone: '', gstin: ''
    }
    if (wo.customer_id) {
      try {
        const res = await customerApi.get(wo.customer_id)
        const c = res.data || res
        if (c) cust = {
          name: c.name || wo.customer_name || '',
          address: [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', '),
          phone: c.phone || c.mobile || '',
          gstin: c.gstin || ''
        }
      } catch { }
    }
    y = drawCustomerCard(doc, cust, y, null, pageW)

    // Job Cards Table
    const lines = wo.lines || []
    const groupedRows = []
    const seen = new Map()
    let totalWeightKg = 0
    let rowNo = 1

    lines.forEach((line) => {
      const lineWeight = computeLineWeightKg(line)
      totalWeightKg += lineWeight
      const key = (line.description || 'Unspecified').trim()
      if (!seen.has(key)) {
        seen.set(key, true)
        groupedRows.push([{
          content: key.toUpperCase(),
          colSpan: 13,
          styles: {
            fillColor: [227, 242, 253],
            textColor: [10, 40, 120],
            fontStyle: 'bold',
            fontSize: 9.5,
            halign: 'left',
          },
        }])
      }
      groupedRows.push([
        rowNo++,
        line.description || '—',
        line.serial_no || '—',
        line.act_w_in ? `${toFraction(line.act_w_in)}"` : '—',
        line.act_h_in ? `${toFraction(line.act_h_in)}"` : '—',
        line.act_w_mm ? `${line.act_w_mm}mm` : '—',
        line.act_h_mm ? `${line.act_h_mm}mm` : '—',
        line.qty || line.quantity || 1,
        line.cep ? 'YES' : 'NO',
        line.process_label || line.process_name || '—',
        (line.is_toughened || line.toughened) ? 'YES' : '—',
        lineWeight > 0 ? `${lineWeight}` : '—',
        line.remark || '—',
      ])
    })

    autoTable(doc, {
      theme: 'grid',
      startY: y + 4,
      head: [['#', 'Description', 'Serial No', 'W (in)', 'H (in)', 'W (mm)', 'H (mm)', 'Qty', 'CEP', 'Process', 'Tgh', 'Wt (kg)', 'Remark']],
      body: groupedRows,
      styles: { fontSize: 8, cellPadding: 2.5, lineWidth: 0.15, lineColor: [148, 163, 184], overflow: 'linebreak' },
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        lineWidth: 0.15,
        lineColor: [99, 102, 241],
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0:  { cellWidth: 10,  halign: 'center' },  // #
        1:  { cellWidth: 50 },                     // Description
        2:  { cellWidth: 24,  halign: 'center' },  // Serial No
        3:  { cellWidth: 18,  halign: 'center' },  // W (in)
        4:  { cellWidth: 18,  halign: 'center' },  // H (in)
        5:  { cellWidth: 18,  halign: 'center' },  // W (mm)
        6:  { cellWidth: 18,  halign: 'center' },  // H (mm)
        7:  { cellWidth: 12,  halign: 'center' },  // Qty
        8:  { cellWidth: 12,  halign: 'center' },  // CEP
        9:  { cellWidth: 38 },                     // Process
        10: { cellWidth: 12,  halign: 'center' },  // Tgh
        11: { cellWidth: 20,  halign: 'right'  },  // Wt (kg)
        12: { cellWidth: 'auto' },                 // Remark
      },
      didParseCell: (data) => {
        if (data.row.raw.length === 1) return
        if (data.section === 'body' && (data.column.index === 8 || data.column.index === 10)) {
          const v = data.cell.raw
          if (v === 'YES') {
            data.cell.text = ['4']
            data.cell.styles.font = 'zapfdingbats'
            data.cell.styles.textColor = [22, 163, 74]
            data.cell.styles.fontSize = 8.5
          } else if (v === 'NO') {
            data.cell.text = ['8']
            data.cell.styles.font = 'zapfdingbats'
            data.cell.styles.textColor = [203, 213, 225]
            data.cell.styles.fontSize = 8.5
          }
        }
        if (data.section === 'body' && data.column.index === 11 && data.cell.raw !== '—') {
          data.cell.styles.textColor = [15, 118, 110]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 10, right: 10 },
    })

    const afterTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 5 : y + 20
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 118, 110)
    doc.text(
      `Total Weight: ${parseFloat(totalWeightKg.toFixed(2))} kg`,
      pageW - 10,
      afterTableY,
      { align: 'right' }
    )

    let currentExtraY = afterTableY + 4
    if (wo.instructions && wo.instructions.trim()) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(15, 23, 42)
      doc.text('Special Instructions:', margin, currentExtraY)
      doc.setFont('helvetica', 'normal')
      const textW = pageW - margin * 2 - 35
      const splitInstr = doc.splitTextToSize(wo.instructions.trim(), textW)
      doc.text(splitInstr, margin + 32, currentExtraY)
    }

    // Panel Maps & Line Artwork Sheets
    const PANEL_COLORS = [
      '#6366f1', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
    ]
    const contentW = pageW - margin * 2

    const drawSheetHeader = (title, subtitle) => {
      doc.setFillColor(company.primary_color ? parseInt(company.primary_color.slice(1), 16) : 124, 58, 237)
      doc.rect(0, 0, pageW, 16, 'F')
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
      doc.text(title, margin, 10)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text(subtitle, pageW - margin, 10, { align: 'right' })
    }

    const fitDims = (iw, ih, maxW, maxH) => {
      const s = Math.min(maxW / iw, maxH / ih)
      return { w: iw * s, h: ih * s }
    }

    // 1) PANEL MAP SHEETS
    const artworkMaps = wo.artworkMaps || wo.artwork_maps || []
    const validMaps = (artworkMaps || []).filter(m => m.image && (m.panels || []).length > 0)
    for (let mi = 0; mi < validMaps.length; mi++) {
      const map = validMaps[mi]
      try {
        const oImg = new Image()
        await new Promise((resolve, reject) => {
          oImg.onload = resolve
          oImg.onerror = reject
          oImg.src = map.image
        })

        const oCanvas = document.createElement('canvas')
        const UPSCALE_TARGET = 1400
        const up = Math.max(1, Math.min(3, UPSCALE_TARGET / Math.max(oImg.width, 1)))
        oCanvas.width = Math.round(oImg.width * up)
        oCanvas.height = Math.round(oImg.height * up)
        const oCtx = oCanvas.getContext('2d')
        oCtx.imageSmoothingEnabled = true
        oCtx.imageSmoothingQuality = 'high'
        oCtx.drawImage(oImg, 0, 0, oCanvas.width, oCanvas.height)

        const k = Math.max(oCanvas.width, oCanvas.height) / 800

        map.panels.forEach((p, i) => {
          const color = PANEL_COLORS[i % PANEL_COLORS.length]
          const line = (p.lineIndex != null) ? lines[p.lineIndex] : null
          const px = (p.nx != null) ? p.nx * oCanvas.width : p.x * up
          const py = (p.ny != null) ? p.ny * oCanvas.height : p.y * up
          const pw = (p.nw != null) ? p.nw * oCanvas.width : p.w * up
          const ph = (p.nh != null) ? p.nh * oCanvas.height : p.h * up
          oCtx.strokeStyle = color
          oCtx.lineWidth = 1.5 * k
          oCtx.strokeRect(px, py, pw, ph)
          oCtx.fillStyle = color + '14'
          oCtx.fillRect(px, py, pw, ph)
          const bs = 34 * k
          oCtx.fillStyle = color
          oCtx.fillRect(px + 3 * k, py + 3 * k, bs, bs)
          oCtx.fillStyle = '#ffffff'
          oCtx.font = `bold ${22 * k}px sans-serif`
          oCtx.fillText(String(i + 1), px + 12 * k, py + 27 * k)
          if (line) {
            const label = `${line.description || 'Line ' + (p.lineIndex + 1)}  ${line.act_w_in ? toFraction(line.act_w_in) : '?'}"x${line.act_h_in ? toFraction(line.act_h_in) : '?'}" x${line.qty || 1}`
            oCtx.font = `bold ${18 * k}px sans-serif`
            const tw = oCtx.measureText(label).width + 14 * k
            oCtx.fillStyle = 'rgba(255,255,255,0.96)'
            oCtx.fillRect(px + 3 * k, py + ph - 26 * k, Math.min(tw, Math.max(pw - 6 * k, 40 * k)), 23 * k)
            oCtx.fillStyle = '#111111'
            oCtx.fillText(label, px + 8 * k, py + ph - 8 * k)
          }
        })

        doc.addPage()
        drawSheetHeader(
          `PANEL MAP ${validMaps.length > 1 ? `${mi + 1}/${validMaps.length} — ` : '— '}${String(map.name || 'ARTWORK').toUpperCase().substring(0, 30)}`,
          `${wo.wo_number || 'WO'}${cust.name ? ' | ' + cust.name : ''}`
        )

        const legendH = 12 + map.panels.length * 7
        const maxImgH = pageH - 16 - 12 - legendH - 14
        const dims = fitDims(oCanvas.width, oCanvas.height, contentW, Math.max(90, maxImgH))
        const imgData = oCanvas.toDataURL('image/png')
        doc.addImage(imgData, 'PNG', (pageW - dims.w) / 2, 20, dims.w, dims.h)

        const pmTableRows = map.panels.map((p, i) => {
          const line = (p.lineIndex != null) ? lines[p.lineIndex] : null
          return [
            String(i + 1),
            line ? (line.description || `Line ${p.lineIndex + 1}`) : 'NOT ASSIGNED',
            line ? `${line.act_w_in ? toFraction(line.act_w_in) : '?'}" × ${line.act_h_in ? toFraction(line.act_h_in) : '?'}"` : '—',
            line ? String(line.qty || line.quantity || 1) : '—',
            (line?.toughened || line?.is_toughened) ? 'YES' : '—',
            p.note || '—',
          ]
        })

        autoTable(doc, {
          theme: 'grid',
          startY: 20 + dims.h + 6,
          head: [['Panel', 'Glass Line', 'Size', 'Qty', 'Tgh', 'Note']],
          body: pmTableRows,
          styles: { fontSize: 8.5, cellPadding: 2.5, lineWidth: 0.15, lineColor: [148, 163, 184] },
          headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold', lineWidth: 0.15, lineColor: [99, 102, 241] },
          alternateRowStyles: { fillColor: [245, 243, 255] },
          columnStyles: {
            0: { cellWidth: 14, halign: 'center' },
            1: { cellWidth: 70, fontStyle: 'bold' },
            2: { cellWidth: 35 },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 'auto' },
          },
          margin: { left: margin, right: margin },
          didParseCell: (data) => {
            if (data.row.raw.length === 1) return
            if (data.section === 'body' && data.column.index === 0) {
              const c = PANEL_COLORS[data.row.index % PANEL_COLORS.length]
              data.cell.styles.fillColor = [
                parseInt(c.slice(1, 3), 16),
                parseInt(c.slice(3, 5), 16),
                parseInt(c.slice(5, 7), 16),
              ]
              data.cell.styles.textColor = 255
              data.cell.styles.fontStyle = 'bold'
            }
            if (data.section === 'body' && data.column.index === 1) {
              data.cell.styles.fontStyle = 'bold'
            }
          },
        })
      } catch (imgErr) {
        console.error('Panel map sheet failed:', imgErr)
      }
    }

    // 2) LINE ARTWORK SHEETS
    const processLines = lines.filter(l => l.has_process && l.artwork_file_data)
    const artworkMap = new Map()
    processLines.forEach(l => {
      const key = l.artwork_master_id || l.key || l.id
      if (!artworkMap.has(key)) {
        artworkMap.set(key, {
          name: l.artwork_name || l.artwork_file_name || 'Artwork',
          data: l.artwork_file_data,
          rows: []
        })
      }
      artworkMap.get(key).rows.push(l)
    })

    const artEntries = [...artworkMap.values()].filter(
      a => !validMaps.some(m => m.image === a.data)
    )
    const imageArts = artEntries.filter(a => a.data?.startsWith('data:image/'))
    const pdfArts   = artEntries.filter(a => a.data?.startsWith('data:application/pdf'))

    for (let i = 0; i < imageArts.length; i += 3) {
      const batch = imageArts.slice(i, i + 3)
      doc.addPage()
      drawSheetHeader(
        `ARTWORK SHEETS (${i + 1}–${Math.min(i + 3, imageArts.length)} of ${imageArts.length})`,
        `${wo.wo_number || 'WO'}`
      )

      for (let c = 0; c < batch.length; c++) {
        const art = batch[c]
        const COL_W    = 89
        const GUTTER   = 5
        const HEADER_H = 20
        const colX     = margin + c * (COL_W + GUTTER)
        const IMG_MAX_H = 130

        if (c > 0) {
          doc.setDrawColor(226, 232, 240)
          doc.setLineWidth(0.3)
          doc.line(colX - GUTTER / 2, HEADER_H, colX - GUTTER / 2, pageH - 12)
        }

        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 41, 59)
        const artTitle = String(art.name || 'Artwork').toUpperCase().substring(0, 28)
        doc.text(`ARTWORK: ${artTitle}`, colX, HEADER_H + 4)

        let imgH = 0
        if (art.data) {
          try {
            const im = new Image()
            await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = art.data })
            const dims = fitDims(im.width, im.height, COL_W, IMG_MAX_H)
            imgH = dims.h
            const fmt = art.data.includes('data:image/png') ? 'PNG' : 'JPEG'
            doc.addImage(art.data, fmt, colX + (COL_W - dims.w) / 2, HEADER_H + 8, dims.w, dims.h)
          } catch (e) {
            console.error('Artwork image render failed:', e)
          }
        }

        let bodyRows = art.rows.map((l, idx) => [
          String(idx + 1),
          l.description || '—',
          `${l.act_w_in ? toFraction(l.act_w_in) : '?'}" × ${l.act_h_in ? toFraction(l.act_h_in) : '?'}"`,
          String(l.qty || l.quantity || 1),
        ])

        if (bodyRows.length > 6) {
          const overflowCount = bodyRows.length - 5
          bodyRows = bodyRows.slice(0, 5)
          bodyRows.push(['', `+${overflowCount} more`, '', ''])
        }

        autoTable(doc, {
          theme: 'grid',
          startY: HEADER_H + 8 + imgH + 4,
          head: [['#', 'Glass Line', 'Size', 'Qty']],
          body: bodyRows,
          styles: { fontSize: 6.5, cellPadding: 1.2, lineWidth: 0.15, lineColor: [148, 163, 184] },
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', lineWidth: 0.15, lineColor: [99, 102, 241] },
          alternateRowStyles: { fillColor: [238, 242, 255] },
          margin: { left: colX, right: pageW - colX - COL_W },
          tableWidth: COL_W,
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 32, halign: 'center' },
            3: { cellWidth: 10, halign: 'center' },
          },
        })
      }
    }

    for (const art of pdfArts) {
      doc.addPage()
      drawSheetHeader(
        `ARTWORK: ${String(art.name).toUpperCase().substring(0, 40)}`,
        `${wo.wo_number || 'WO'}`
      )
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
      doc.text(`PDF artwork attached: "${art.name}" — print/open the PDF file separately.`, margin, 30)
    }

    // Footers and Page Numbers
    const pageCount = doc.internal.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      const footerY = doc.internal.pageSize.getHeight() - 8
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Generated: ${dayjs().format('DD/MM/YYYY HH:mm')} | ${company.name || 'ESSAR GLASS'} Workshop Order`,
        margin, footerY
      )
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin, footerY, { align: 'right' })
    }

    doc.save(makePdfFilename(wo.wo_number || 'WO', cust.name || 'Customer', 'Customer'))
    return doc
  } catch (err) {
    console.error('Workshop Order PDF generation failed:', err)
    throw err
  }
}
