import { jsPDF } from 'jspdf'

const COMPANY = {
  name: 'ESSAR SONS',
  tagline: "AN ESSAR GROUP COMPANY",
  address: 'Shop No.11, Rashmi Shopping Centre, Agashi Road, Virar West',
  city: 'Vasai Virar - 401303, Palghar, Maharashtra',
  gst: '27AAIFE0491M1Z4',
  phone: '08047515289',
  website: 'www.essarsons.in',
  email: 'sales@essarsons.in',
}

const addHeader = (doc, title, accentColor = [255, 215, 0]) => {
  const pw = doc.internal.pageSize.getWidth()
  // Deep blue header
  doc.setFillColor(26, 35, 126)
  doc.rect(0, 0, pw, 38, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(COMPANY.name, 14, 14)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(COMPANY.tagline, 14, 21)
  doc.text(COMPANY.address, 14, 27)
  doc.text(`GST: ${COMPANY.gst} | Ph: ${COMPANY.phone} | ${COMPANY.website}`, 14, 33)
  // Accent bar
  doc.setFillColor(...accentColor)
  doc.rect(0, 38, pw, 10, 'F')
  doc.setTextColor(26, 35, 126)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(title, pw / 2, 45, { align: 'center' })
  doc.setTextColor(0, 0, 0)
}

const addLineTable = (doc, lines, startY) => {
  const pw = doc.internal.pageSize.getWidth()
  let y = startY
  // Table header
  doc.setFillColor(240, 245, 255)
  doc.rect(10, y - 5, pw - 20, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('#', 12, y)
  doc.text('Description', 22, y)
  doc.text('W×H mm', 88, y)
  doc.text('Qty', 118, y)
  doc.text('Sqft', 130, y)
  doc.text('Rate', 148, y)
  doc.text('Amount', pw - 14, y, { align: 'right' })
  y += 3
  doc.setDrawColor(200, 200, 220)
  doc.line(10, y, pw - 10, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  ;(lines || []).forEach((line, i) => {
    if (y > 265) { doc.addPage(); addHeader(doc, ''); y = 20 }
    doc.text(String(i + 1), 12, y)
    const desc = (line.description || line.name || '').substring(0, 38)
    doc.text(desc, 22, y)
    if (line.width_mm || line.height_mm)
      doc.text(`${line.width_mm || 0}×${line.height_mm || 0}`, 88, y)
    doc.text(String(line.quantity || 1), 118, y)
    if (line.area_sqft) doc.text(Number(line.area_sqft).toFixed(2), 130, y)
    doc.text(`₹${Number(line.unit_price || 0).toLocaleString('en-IN')}`, 148, y)
    doc.text(`₹${Number(line.line_total || line.subtotal || 0).toLocaleString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 7
    doc.setDrawColor(230, 230, 240)
    doc.line(10, y - 3, pw - 10, y - 3)
  })
  return y
}

const addTotals = (doc, data, y) => {
  const pw = doc.internal.pageSize.getWidth()
  const x = pw - 85
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (data.subtotal) {
    doc.text('Subtotal:', x, y)
    doc.text(`₹ ${Number(data.subtotal).toLocaleString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 7
  }
  if (data.discount_amount > 0) {
    doc.text('Discount:', x, y)
    doc.text(`- ₹ ${Number(data.discount_amount).toLocaleString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 7
  }
  if (data.tax_amount > 0) {
    doc.text('GST (18%):', x, y)
    doc.text(`₹ ${Number(data.tax_amount).toLocaleString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 5
  }
  doc.setFillColor(26, 35, 126)
  doc.rect(x - 5, y, pw - x - 5, 11, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  y += 8
  doc.text('TOTAL:', x, y)
  doc.text(`₹ ${Number(data.total_amount || 0).toLocaleString('en-IN')}`, pw - 14, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  return y + 15
}

const addFooter = (doc) => {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150, 150, 150)
  doc.text(`Thank you for your business! | ${COMPANY.website} | ${COMPANY.email}`, pw / 2, ph - 10, { align: 'center' })
  doc.text('This is a computer generated document.', pw / 2, ph - 5, { align: 'center' })
}

export const generateQuotationPDF = (quotation) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    addHeader(doc, 'QUOTATION')
    let y = 55
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Quote No: ${quotation.quote_number || 'N/A'}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${quotation.quote_date || new Date().toLocaleDateString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 7
    doc.text(`Customer: ${quotation.customer_name || ''}`, 14, y)
    doc.text(`Valid Until: ${quotation.valid_until || ''}`, pw - 14, y, { align: 'right' })
    y += 7
    if (quotation.salesperson) doc.text(`Salesperson: ${quotation.salesperson}`, 14, y)
    y += 10
    y = addLineTable(doc, quotation.lines, y)
    y += 5
    y = addTotals(doc, quotation, y)
    if (quotation.advance_received > 0) {
      doc.setFontSize(10)
      doc.text(`Advance Received: ₹ ${Number(quotation.advance_received).toLocaleString('en-IN')}`, 14, y)
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.text(`Balance Due: ₹ ${Number((quotation.total_amount || 0) - (quotation.advance_received || 0)).toLocaleString('en-IN')}`, 14, y)
    }
    addFooter(doc)
    doc.save(`${quotation.quote_number || 'Quotation'}_Essar.pdf`)
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF generation failed. Please try again.')
  }
}

export const generateSOPDF = (so) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    addHeader(doc, 'SALES ORDER', [100, 200, 255])
    let y = 55
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`SO Number: ${so.so_number || 'N/A'}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${so.order_date || new Date().toLocaleDateString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 7
    doc.text(`Customer: ${so.customer_name || ''}`, 14, y)
    doc.text(`Delivery Date: ${so.delivery_date || 'TBD'}`, pw - 14, y, { align: 'right' })
    y += 10
    y = addLineTable(doc, so.lines, y)
    y += 5
    addTotals(doc, so, y)
    addFooter(doc)
    doc.save(`${so.so_number || 'SalesOrder'}_Essar.pdf`)
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF generation failed. Please try again.')
  }
}

export const generatePOPDF = (po) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    addHeader(doc, 'PURCHASE ORDER', [255, 180, 80])
    let y = 55
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`PO Number: ${po.po_number || 'N/A'}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${po.po_date || new Date().toLocaleDateString('en-IN')}`, pw - 14, y, { align: 'right' })
    y += 7
    doc.text(`Vendor: ${po.vendor_name || ''}`, 14, y)
    doc.text(`Expected: ${po.expected_delivery || 'TBD'}`, pw - 14, y, { align: 'right' })
    y += 7
    if (po.so_id) { doc.text(`Ref SO: ${po.so_id}`, 14, y); y += 7 }
    y += 3
    y = addLineTable(doc, po.lines, y)
    y += 5
    addTotals(doc, po, y)
    addFooter(doc)
    doc.save(`${po.po_number || 'PurchaseOrder'}_Essar.pdf`)
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF generation failed. Please try again.')
  }
}
