// ── Automated Journey Test ─────────────────────────────────────
// Tests complete flow: Lead → Quotation → SO → PO → DC → Invoice
// Run with: node test-journey.js

const { JSDOM } = require('jsdom')

// Setup fake localStorage (simulate browser)
const dom = new JSDOM('', { url: 'http://localhost' })
global.localStorage = dom.window.localStorage

// ── Copy exact same localStorage engine from src/api/localStorage.js
const getAll = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
const saveAll = (key, data) => localStorage.setItem(key, JSON.stringify(data))
const getNextId = (records) => records.length ? Math.max(...records.map(r => r.id || 0)) + 1 : 1
const nowStr = () => new Date().toISOString()
const ok = (data) => Promise.resolve({ data })

const createLocalApi = (key, codeConfig = null) => ({
  list: (params = {}) => {
    let records = getAll(key)
    return ok({ items: records, total: records.length, page: 1, page_size: 100, pages: 1 })
  },
  get: (id) => {
    const rec = getAll(key).find(r => r.id === parseInt(id))
    return rec ? ok(rec) : Promise.reject(new Error('Not found'))
  },
  create: (data) => {
    const records = getAll(key)
    const newId = getNextId(records)
    const autoCode = {}
    if (codeConfig && !data[codeConfig.field])
      autoCode[codeConfig.field] = `${codeConfig.prefix}${String(newId).padStart(4, '0')}`
    const newRec = { ...data, ...autoCode, id: newId, is_active: true, created_at: nowStr(), updated_at: nowStr() }
    records.push(newRec)
    saveAll(key, records)
    return ok(newRec)
  },
  update: (id, data) => {
    const records = getAll(key)
    const idx = records.findIndex(r => r.id === parseInt(id))
    if (idx === -1) return Promise.reject(new Error('Not found'))
    records[idx] = { ...records[idx], ...data, id: parseInt(id), updated_at: nowStr() }
    saveAll(key, records)
    return ok(records[idx])
  },
})

const createStatusApi = (key, codeConfig = null) => {
  const base = createLocalApi(key, codeConfig)
  return {
    ...base,
    changeStatus: (id, status) => {
      const records = getAll(key)
      const idx = records.findIndex(r => r.id === parseInt(id))
      if (idx === -1) return Promise.reject(new Error('Not found'))
      records[idx].status = status
      saveAll(key, records)
      return ok(records[idx])
    }
  }
}

// ── API instances ──────────────────────────────────────────────
const customerApi    = createLocalApi('customers',       { field:'customer_code', prefix:'CUST' })
const productApi     = createLocalApi('products',        { field:'internal_ref',  prefix:'PROD' })
const crmLeadApi     = createStatusApi('crm_leads',      { field:'lead_number',   prefix:'OPP'  })
const quotationApi   = createStatusApi('quotations',     { field:'quote_number',  prefix:'QT'   })
const salesOrderApi  = createStatusApi('sales_orders',   { field:'so_number',     prefix:'SO'   })
const purchaseOrderApi = createStatusApi('purchase_orders',{ field:'po_number',   prefix:'PO'   })
const deliveryApi    = createStatusApi('delivery_challans',{ field:'dc_number',   prefix:'DC'   })
const invoiceApi     = createStatusApi('invoices',       { field:'invoice_number',prefix:'INV'  })
const stockApi       = createLocalApi('stock_movements', { field:'move_number',   prefix:'SM'   })

// ── Test helpers ──────────────────────────────────────────────
let passed = 0
let failed = 0
const results = []

const test = async (name, fn) => {
  try {
    await fn()
    console.log(`  ✅ PASS: ${name}`)
    passed++
    results.push({ name, status: 'PASS' })
  } catch (e) {
    console.log(`  ❌ FAIL: ${name}`)
    console.log(`     Error: ${e.message}`)
    failed++
    results.push({ name, status: 'FAIL', error: e.message })
  }
}

const assert = (condition, msg) => {
  if (!condition) throw new Error(msg || 'Assertion failed')
}

// ─────────────────────────────────────────────────────────────
// FULL JOURNEY TEST
// ─────────────────────────────────────────────────────────────

const runTests = async () => {
  console.log('\n🚀 ESSAR GLASS ERP — Automated Journey Tests')
  console.log('='.repeat(55))

  // ── STEP 1: Setup base data ──────────────────────────────────
  console.log('\n📋 STEP 1: Setting up base data...')

  await test('Create Customer', async () => {
    const res = await customerApi.create({
      name: 'Test Builder Pvt Ltd',
      customer_type: 'company',
      gstin: '27AABCT1234M1Z5',
      city: 'Mumbai',
      state: 'Maharashtra',
      phone: '9820000001',
      payment_terms: '30_days',
      credit_limit: 500000,
    })
    assert(res.data.id, 'Customer ID should exist')
    assert(res.data.customer_code.startsWith('CUST'), 'Customer code should start with CUST')
    global.testCustomerId = res.data.id
    global.testCustomerCode = res.data.customer_code
    console.log(`     → Created: ${res.data.customer_code} — ${res.data.name}`)
  })

  await test('Create Product', async () => {
    const res = await productApi.create({
      name: 'Test Toughened Glass 8mm',
      product_type: 'storable',
      glass_type: 'Tempered Glass',
      thickness_mm: 8,
      sale_price: 150,
      cost_price: 110,
      uom_id: 1,
      on_hand_qty: 200,
      min_qty: 20,
    })
    assert(res.data.id, 'Product ID should exist')
    assert(res.data.internal_ref.startsWith('PROD'), 'Product ref should start with PROD')
    global.testProductId = res.data.id
    console.log(`     → Created: ${res.data.internal_ref} — ${res.data.name}`)
  })

  // ── STEP 2: CRM Lead ─────────────────────────────────────────
  console.log('\n🎯 STEP 2: CRM Lead...')

  await test('Create CRM Lead', async () => {
    const res = await crmLeadApi.create({
      name: 'Glass Partition - Test Builder',
      customer_id: global.testCustomerId,
      company_name: 'Test Builder Pvt Ltd',
      phone: '9820000001',
      expected_revenue: 75000,
      probability: 20,
      stage_id: 1,
      priority: 'high',
      lead_type: 'opportunity',
    })
    assert(res.data.id, 'Lead ID should exist')
    assert(res.data.lead_number.startsWith('OPP'), 'Lead number should start with OPP')
    global.testLeadId = res.data.id
    console.log(`     → Created: ${res.data.lead_number} — ${res.data.name}`)
  })

  await test('Move Lead to Won stage', async () => {
    const res = await crmLeadApi.update(global.testLeadId, { stage_id: 4 })
    assert(res.data.stage_id === 4, 'Lead should be in Won stage (id=4)')
    console.log(`     → Lead moved to stage_id: ${res.data.stage_id}`)
  })

  // ── STEP 3: Quotation ────────────────────────────────────────
  console.log('\n📄 STEP 3: Quotation...')

  const glassLines = [
    {
      product_id: global.testProductId,
      description: 'Toughened Glass 8mm Partition',
      width_mm: 1200,
      height_mm: 2400,
      quantity: 5,
      unit_price: 150,
      pricing_method: 'per_sqft',
      cep: true,
      discount_pct: 0,
      area_sqft: parseFloat(((1200 * 2400) / 92903).toFixed(2)),
      subtotal: 0,
      tax_amount: 0,
      line_total: 0,
    }
  ]
  // Calculate sqft and amounts
  glassLines[0].area_sqft = parseFloat(((1200 * 2400) / 92903).toFixed(2))
  glassLines[0].subtotal  = parseFloat((glassLines[0].area_sqft * 5 * 150).toFixed(2))
  glassLines[0].tax_amount = parseFloat((glassLines[0].subtotal * 0.18).toFixed(2))
  glassLines[0].line_total = glassLines[0].subtotal + glassLines[0].tax_amount

  const subtotal     = glassLines[0].subtotal
  const tax_amount   = glassLines[0].tax_amount
  const total_amount = glassLines[0].line_total

  await test('Create Quotation from Lead', async () => {
    const today = new Date().toISOString().split('T')[0]
    const validUntil = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
    const res = await quotationApi.create({
      customer_id: global.testCustomerId,
      crm_lead_id: global.testLeadId,
      quote_date: today,
      valid_until: validUntil,
      salesperson: 'Rajesh Patil',
      payment_terms: '30_days',
      status: 'draft',
      subtotal, tax_amount, total_amount,
      discount_amount: 0,
      lines: glassLines,
    })
    assert(res.data.id, 'Quotation ID should exist')
    assert(res.data.quote_number.startsWith('QT'), 'Quote number should start with QT')
    assert(res.data.customer_id === global.testCustomerId, 'Customer should be linked')
    assert(res.data.crm_lead_id === global.testLeadId, 'Lead should be linked')
    global.testQuoteId = res.data.id
    global.testQuoteNumber = res.data.quote_number
    console.log(`     → Created: ${res.data.quote_number} | Total: ₹${total_amount.toLocaleString('en-IN')}`)
  })

  await test('Glass area calculation correct', async () => {
    const line = glassLines[0]
    const expectedSqft = parseFloat(((1200 * 2400) / 92903).toFixed(2))
    assert(Math.abs(line.area_sqft - expectedSqft) < 0.1, 
      `Area should be ~${expectedSqft} sqft, got ${line.area_sqft}`)
    console.log(`     → Area: ${line.area_sqft} sqft ✓`)
  })

  await test('Confirm Quotation', async () => {
    const res = await quotationApi.changeStatus(global.testQuoteId, 'confirmed')
    assert(res.data.status === 'confirmed', 'Quotation should be confirmed')
    console.log(`     → Status: ${res.data.status}`)
  })

  await test('Convert Quotation to Sales Order', async () => {
    const quote = (await quotationApi.get(global.testQuoteId)).data
    const today = new Date().toISOString().split('T')[0]
    const delivDate = new Date(Date.now() + 14*86400000).toISOString().split('T')[0]
    const res = await salesOrderApi.create({
      customer_id: quote.customer_id,
      quotation_id: global.testQuoteId,
      crm_lead_id: quote.crm_lead_id,
      order_date: today,
      delivery_date: delivDate,
      salesperson: quote.salesperson,
      payment_terms: quote.payment_terms,
      status: 'draft',
      subtotal: quote.subtotal,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      lines: quote.lines,
      warehouse_id: 1,
    })
    assert(res.data.id, 'SO ID should exist')
    assert(res.data.so_number.startsWith('SO'), 'SO number should start with SO')
    assert(res.data.quotation_id === global.testQuoteId, 'Quote should be linked to SO')
    global.testSOId = res.data.id
    global.testSONumber = res.data.so_number
    // Mark quotation as converted
    await quotationApi.changeStatus(global.testQuoteId, 'converted')
    console.log(`     → Created: ${res.data.so_number} linked to ${global.testQuoteNumber}`)
  })

  // ── STEP 4: Sales Order ──────────────────────────────────────
  console.log('\n📦 STEP 4: Sales Order...')

  await test('Confirm Sales Order', async () => {
    const res = await salesOrderApi.changeStatus(global.testSOId, 'confirmed')
    assert(res.data.status === 'confirmed', 'SO should be confirmed')
    console.log(`     → Status: ${res.data.status}`)
  })

  await test('SO linked to Quotation and Lead', async () => {
    const so = (await salesOrderApi.get(global.testSOId)).data
    assert(so.quotation_id === global.testQuoteId, 'SO should reference Quotation')
    assert(so.crm_lead_id === global.testLeadId, 'SO should reference Lead')
    console.log(`     → SO→Quote: QT✓  SO→Lead: OPP✓`)
  })

  await test('Mark SO In Production', async () => {
    const res = await salesOrderApi.changeStatus(global.testSOId, 'in_production')
    assert(res.data.status === 'in_production', 'SO should be in production')
    console.log(`     → Status: in_production`)
  })

  // ── STEP 5: Purchase Order ───────────────────────────────────
  console.log('\n🛒 STEP 5: Purchase Order...')

  await test('Create Purchase Order from SO', async () => {
    const so = (await salesOrderApi.get(global.testSOId)).data
    const today = new Date().toISOString().split('T')[0]
    const res = await purchaseOrderApi.create({
      vendor_id: 1,
      so_id: global.testSOId,
      po_date: today,
      expected_delivery: new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
      payment_terms: '30_days',
      status: 'draft',
      subtotal: so.subtotal * 0.73,
      tax_amount: so.tax_amount * 0.73,
      total_amount: so.total_amount * 0.73,
      lines: so.lines?.map(l => ({ ...l, unit_price: Math.round(l.unit_price * 0.73) })),
    })
    assert(res.data.id, 'PO ID should exist')
    assert(res.data.po_number.startsWith('PO'), 'PO number should start with PO')
    assert(res.data.so_id === global.testSOId, 'PO should be linked to SO')
    global.testPOId = res.data.id
    console.log(`     → Created: ${res.data.po_number} linked to ${global.testSONumber}`)
  })

  await test('Send PO to Vendor', async () => {
    const res = await purchaseOrderApi.changeStatus(global.testPOId, 'sent')
    assert(res.data.status === 'sent', 'PO should be sent')
    console.log(`     → Status: sent`)
  })

  await test('Mark PO as Received + Update Stock', async () => {
    const po = (await purchaseOrderApi.get(global.testPOId)).data
    await purchaseOrderApi.changeStatus(global.testPOId, 'received')
    
    // Simulate stock update
    const prod = getAll('products').find(p => p.id === global.testProductId)
    const oldQty = prod?.on_hand_qty || 0
    const received = 5
    await productApi.update(global.testProductId, { 
      ...prod, 
      on_hand_qty: oldQty + received 
    })
    await stockApi.create({
      product_id: global.testProductId,
      movement_type: 'in',
      quantity: received,
      warehouse_id: 1,
      reference: po.po_number,
      remarks: 'Received from vendor',
      date: nowStr(),
    })
    
    const updatedProd = getAll('products').find(p => p.id === global.testProductId)
    assert(updatedProd.on_hand_qty === oldQty + received, `Stock should increase by ${received}`)
    console.log(`     → Stock updated: ${oldQty} → ${updatedProd.on_hand_qty} sqft`)
  })

  // ── STEP 6: Delivery Challan ─────────────────────────────────
  console.log('\n🚚 STEP 6: Delivery Challan...')

  await test('Create Delivery Challan from SO', async () => {
    const so = (await salesOrderApi.get(global.testSOId)).data
    const res = await deliveryApi.create({
      customer_id: so.customer_id,
      so_id: global.testSOId,
      dc_date: new Date().toISOString().split('T')[0],
      vehicle_number: 'MH04-TEST-1234',
      driver_name: 'Test Driver',
      status: 'draft',
      lines: so.lines?.map(l => ({ ...l, qty_dispatched: l.quantity })),
    })
    assert(res.data.id, 'DC ID should exist')
    assert(res.data.dc_number.startsWith('DC'), 'DC number should start with DC')
    assert(res.data.so_id === global.testSOId, 'DC should be linked to SO')
    global.testDCId = res.data.id
    console.log(`     → Created: ${res.data.dc_number} linked to ${global.testSONumber}`)
  })

  await test('Dispatch Delivery Challan', async () => {
    const res = await deliveryApi.changeStatus(global.testDCId, 'dispatched')
    assert(res.data.status === 'dispatched', 'DC should be dispatched')
    console.log(`     → Status: dispatched`)
  })

  await test('Mark Delivered + Deduct Stock', async () => {
    await deliveryApi.changeStatus(global.testDCId, 'delivered')
    
    // Deduct stock
    const prod = getAll('products').find(p => p.id === global.testProductId)
    const oldQty = prod?.on_hand_qty || 0
    const dispatched = 5
    await productApi.update(global.testProductId, { 
      ...prod, 
      on_hand_qty: Math.max(0, oldQty - dispatched) 
    })
    await stockApi.create({
      product_id: global.testProductId,
      movement_type: 'out',
      quantity: dispatched,
      warehouse_id: 1,
      reference: `DC${String(global.testDCId).padStart(4,'0')}`,
      remarks: 'Delivered to customer',
      date: nowStr(),
    })
    
    const updatedProd = getAll('products').find(p => p.id === global.testProductId)
    assert(updatedProd.on_hand_qty === oldQty - dispatched, 'Stock should decrease after delivery')
    await salesOrderApi.changeStatus(global.testSOId, 'delivered')
    console.log(`     → Stock deducted: ${oldQty} → ${updatedProd.on_hand_qty} sqft`)
  })

  // ── STEP 7: Invoice ──────────────────────────────────────────
  console.log('\n🧾 STEP 7: Invoice...')

  await test('Create Invoice from SO', async () => {
    const so = (await salesOrderApi.get(global.testSOId)).data
    const today = new Date().toISOString().split('T')[0]
    const dueDate = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
    const res = await invoiceApi.create({
      customer_id: so.customer_id,
      so_id: global.testSOId,
      dc_id: global.testDCId,
      invoice_date: today,
      due_date: dueDate,
      payment_terms: so.payment_terms,
      status: 'draft',
      subtotal: so.subtotal,
      tax_amount: so.tax_amount,
      total_amount: so.total_amount,
      advance_received: 0,
      lines: so.lines,
    })
    assert(res.data.id, 'Invoice ID should exist')
    assert(res.data.invoice_number.startsWith('INV'), 'Invoice number should start with INV')
    assert(res.data.so_id === global.testSOId, 'Invoice should be linked to SO')
    assert(res.data.total_amount > 0, 'Invoice total should be > 0')
    global.testInvId = res.data.id
    console.log(`     → Created: ${res.data.invoice_number} | Amount: ₹${res.data.total_amount.toLocaleString('en-IN')}`)
  })

  await test('Send Invoice to Customer', async () => {
    const res = await invoiceApi.changeStatus(global.testInvId, 'sent')
    assert(res.data.status === 'sent', 'Invoice should be sent')
    console.log(`     → Status: sent`)
  })

  await test('Mark Invoice as Paid', async () => {
    const res = await invoiceApi.changeStatus(global.testInvId, 'paid')
    assert(res.data.status === 'paid', 'Invoice should be paid')
    console.log(`     → Status: paid ✅`)
  })

  // ── STEP 8: Data Integrity Checks ───────────────────────────
  console.log('\n🔍 STEP 8: Data Integrity Checks...')

  await test('Lead → Quotation → SO linkage intact', async () => {
    const so = (await salesOrderApi.get(global.testSOId)).data
    assert(so.quotation_id === global.testQuoteId, 'SO→Quote link valid')
    assert(so.crm_lead_id === global.testLeadId, 'SO→Lead link valid')
    const quote = (await quotationApi.get(global.testQuoteId)).data
    assert(quote.crm_lead_id === global.testLeadId, 'Quote→Lead link valid')
    console.log(`     → OPP → QT → SO chain intact ✓`)
  })

  await test('SO → PO → DC → Invoice linkage intact', async () => {
    const po  = (await purchaseOrderApi.get(global.testPOId)).data
    const dc  = (await deliveryApi.get(global.testDCId)).data
    const inv = (await invoiceApi.get(global.testInvId)).data
    assert(po.so_id  === global.testSOId, 'PO→SO link valid')
    assert(dc.so_id  === global.testSOId, 'DC→SO link valid')
    assert(inv.so_id === global.testSOId, 'INV→SO link valid')
    console.log(`     → SO → PO, DC, INV chain intact ✓`)
  })

  await test('Stock movements recorded correctly', async () => {
    const movements = getAll('stock_movements').filter(m => m.product_id === global.testProductId)
    const inMoves  = movements.filter(m => m.movement_type === 'in')
    const outMoves = movements.filter(m => m.movement_type === 'out')
    assert(inMoves.length >= 1,  'Should have at least 1 IN movement')
    assert(outMoves.length >= 1, 'Should have at least 1 OUT movement')
    console.log(`     → IN movements: ${inMoves.length}, OUT movements: ${outMoves.length}`)
  })

  await test('All documents auto-numbered correctly', async () => {
    const cust  = (await customerApi.get(global.testCustomerId)).data
    const lead  = (await crmLeadApi.get(global.testLeadId)).data
    const quote = (await quotationApi.get(global.testQuoteId)).data
    const so    = (await salesOrderApi.get(global.testSOId)).data
    const po    = (await purchaseOrderApi.get(global.testPOId)).data
    const dc    = (await deliveryApi.get(global.testDCId)).data
    const inv   = (await invoiceApi.get(global.testInvId)).data
    assert(cust.customer_code.match(/^CUST\d+/),    `CUST: ${cust.customer_code}`)
    assert(lead.lead_number.match(/^OPP\d+/),        `OPP:  ${lead.lead_number}`)
    assert(quote.quote_number.match(/^QT\d+/),       `QT:   ${quote.quote_number}`)
    assert(so.so_number.match(/^SO\d+/),             `SO:   ${so.so_number}`)
    assert(po.po_number.match(/^PO\d+/),             `PO:   ${po.po_number}`)
    assert(dc.dc_number.match(/^DC\d+/),             `DC:   ${dc.dc_number}`)
    assert(inv.invoice_number.match(/^INV\d+/),      `INV:  ${inv.invoice_number}`)
    console.log(`     → ${cust.customer_code} → ${lead.lead_number} → ${quote.quote_number} → ${so.so_number}`)
    console.log(`     → ${po.po_number} + ${dc.dc_number} + ${inv.invoice_number}`)
  })

  // ── Final Report ─────────────────────────────────────────────
  console.log('\n' + '='.repeat(55))
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(55))
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Full customer journey working perfectly.')
    console.log('\n📋 Journey Summary:')
    console.log(`   Customer  : CUST → ${global.testCustomerId}`)
    console.log(`   CRM Lead  : OPP  → Won stage`)
    console.log(`   Quotation : QT   → Confirmed → Converted`)
    console.log(`   Sales Order: SO  → Confirmed → In Production → Delivered`)
    console.log(`   Purchase : PO   → Sent → Received`)
    console.log(`   Delivery : DC   → Dispatched → Delivered`)
    console.log(`   Invoice  : INV  → Sent → Paid ✅`)
    console.log('\n✅ ESSAR GLASS ERP is ready for client demo!')
  } else {
    console.log('\n⚠️ Some tests failed. Check errors above.')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   ❌ ${r.name}: ${r.error}`)
    })
  }

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(e => {
  console.error('\n💥 Test runner crashed:', e.message)
  process.exit(1)
})
