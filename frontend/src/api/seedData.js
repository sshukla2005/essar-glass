const nowStr = () => new Date().toISOString()

export const seedDefaults = () => {
  if (localStorage.getItem('_essar_seeded_v3')) return

  localStorage.setItem('currencies', JSON.stringify([
    { id:1, name:'Indian Rupee', code:'INR', symbol:'₹', rate:1.0, decimal_places:2, is_base:true,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'US Dollar',    code:'USD', symbol:'$', rate:83.5, decimal_places:2, is_base:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('uom_categories', JSON.stringify([
    { id:1, name:'Area',   is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Length', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Weight', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Unit',   is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('uoms', JSON.stringify([
    { id:1, name:'Square Feet',  symbol:'sqft', category_id:1, uom_type:'reference', ratio:1.0,    rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Square Meter', symbol:'sqm',  category_id:1, uom_type:'bigger',    ratio:10.764, rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Running Feet', symbol:'rft',  category_id:2, uom_type:'reference', ratio:1.0,    rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Piece',        symbol:'pcs',  category_id:4, uom_type:'reference', ratio:1.0,    rounding:1.0,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'Kilogram',     symbol:'kg',   category_id:3, uom_type:'reference', ratio:1.0,    rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('tax_groups', JSON.stringify([
    { id:1, name:'GST 18%', gst_rate:18, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'GST 12%', gst_rate:12, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'GST 5%',  gst_rate:5,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('taxes', JSON.stringify([
    { id:1, name:'CGST 9%',  tax_type:'CGST', rate:9,  computation_type:'percentage', tax_group_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'SGST 9%',  tax_type:'SGST', rate:9,  computation_type:'percentage', tax_group_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'IGST 18%', tax_type:'IGST', rate:18, computation_type:'percentage', tax_group_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'CGST 6%',  tax_type:'CGST', rate:6,  computation_type:'percentage', tax_group_id:2, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'SGST 6%',  tax_type:'SGST', rate:6,  computation_type:'percentage', tax_group_id:2, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('hsn_codes', JSON.stringify([
    { id:1, code:'70091000', description:'Mirrors of glass, framed',               hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, code:'70051000', description:'Float glass, surface ground or polished', hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, code:'70072100', description:'Toughened/Tempered Safety Glass',         hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, code:'70081000', description:'Multiple-walled insulating units',        hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, code:'70031200', description:'Wired sheet glass and wired patterned',   hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('crm_stages', JSON.stringify([
    { id:1, name:'New',         sequence:10, probability:10,  is_won:false, is_lost:false, fold:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Qualified',   sequence:20, probability:30,  is_won:false, is_lost:false, fold:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Proposition', sequence:30, probability:50,  is_won:false, is_lost:false, fold:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Won',         sequence:40, probability:100, is_won:true,  is_lost:false, fold:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'Lost',        sequence:50, probability:0,   is_won:false, is_lost:true,  fold:true,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('warehouses', JSON.stringify([
    { id:1, name:'Main Warehouse', code:'WH01', location:'Mumbai', is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('company_info', JSON.stringify({
    name: 'Essar Sons',
    legal_name: 'Essar Sons',
    owner: 'Fakhruddin Arsiwala',
    gstin: '27AAIFE0491M1Z4',
    address: 'Shop No.11, Unique, Rashmi Shopping Centre, Agashi Road, Virar West',
    city: 'Vasai Virar',
    state: 'Maharashtra',
    pincode: '401303',
    phone: '08047515289',
    website: 'www.essarsons.in',
    established: '1982',
    nature: 'Partnership',
  }))

  localStorage.setItem('products', JSON.stringify([
    { id:1,  name:'Toughened Safety Glass',           internal_ref:'PROD0001', product_type:'storable', glass_type:'Tempered Glass',    thickness_mm:6,  sale_price:115,  cost_price:85,  uom_id:1, hsn_id:3, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:10, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2,  name:'Clear Float Glass',                internal_ref:'PROD0002', product_type:'storable', glass_type:'Float Glass',       thickness_mm:5,  sale_price:60,   cost_price:45,  uom_id:1, hsn_id:2, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:50, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3,  name:'Extra Clear Glass',                internal_ref:'PROD0003', product_type:'storable', glass_type:'Float Glass',       thickness_mm:8,  sale_price:180,  cost_price:140, uom_id:1, hsn_id:2, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:20, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4,  name:'Tinted Glass (Bronze/Grey)',       internal_ref:'PROD0004', product_type:'storable', glass_type:'Tinted Glass',      thickness_mm:5,  sale_price:85,   cost_price:65,  uom_id:1, hsn_id:2, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:20, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5,  name:'Laminated Safety Glass (5+5mm)',   internal_ref:'PROD0005', product_type:'storable', glass_type:'Laminated Glass',   thickness_mm:10, sale_price:280,  cost_price:220, uom_id:1, hsn_id:3, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:10, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:6,  name:'Frosted / Acid Etched Glass',      internal_ref:'PROD0006', product_type:'storable', glass_type:'Decorative Glass',  thickness_mm:8,  sale_price:160,  cost_price:120, uom_id:1, hsn_id:2, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:15, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:7,  name:'Fluted / Ribbed Glass',            internal_ref:'PROD0007', product_type:'storable', glass_type:'Patterned Glass',   thickness_mm:6,  sale_price:220,  cost_price:170, uom_id:1, hsn_id:5, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:10, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:8,  name:'Double Glazed Unit (DGU)',         internal_ref:'PROD0008', product_type:'storable', glass_type:'Insulated Glass',   thickness_mm:24, sale_price:450,  cost_price:350, uom_id:1, hsn_id:4, can_be_sold:true, can_be_purchased:true, on_hand_qty:100, min_qty:5,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:9,  name:'Installation Service',             internal_ref:'SRV0001',  product_type:'service',  glass_type:null,                thickness_mm:null,sale_price:50,   cost_price:0,   uom_id:1, hsn_id:null,can_be_sold:true, can_be_purchased:false,on_hand_qty:0,   min_qty:0,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  localStorage.setItem('_essar_seeded_v4', 'true')
}

export const resetAndReseed = () => {
  // Clear all master data keys
  localStorage.removeItem('products')
  localStorage.removeItem('currencies')
  localStorage.removeItem('uoms')
  localStorage.removeItem('uom_categories')
  localStorage.removeItem('taxes')
  localStorage.removeItem('tax_groups')
  localStorage.removeItem('hsn_codes')
  localStorage.removeItem('crm_stages')
  localStorage.removeItem('warehouses')
  localStorage.removeItem('_essar_seeded_v3')
  localStorage.removeItem('_essar_seeded_v4')
  seedDefaults()
}
