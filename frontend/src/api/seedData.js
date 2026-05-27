const nowStr = () => new Date().toISOString()

// Helper to create date X days ago
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString()
const dateStr = (d) => new Date(Date.now() - d * 86400000).toISOString().split('T')[0]
const futureDateStr = (d) => new Date(Date.now() + d * 86400000).toISOString().split('T')[0]

export const seedDefaults = () => {
  if (localStorage.getItem('_essar_seeded_v10')) return

  // ── Companies Master ──────────────────────────────────────────
  localStorage.setItem('companies_master', JSON.stringify([
    { id: 1, name: 'Essar Sons', short_name: 'ESSAR', color: '#1a237e', accent: '#ffd700', gstin: '27AAIFE0491M1Z4', address: 'Virar West, Vasai Virar', phone: '08047515289', website: 'www.essarsons.in', is_active: true },
    { id: 2, name: 'Excel Traders', short_name: 'EXCEL', color: '#1b5e20', accent: '#69f0ae', gstin: '27AABCE1234M1Z5', address: 'Virar East, Vasai Virar', phone: '9226205654', website: 'www.essarsons.com', is_active: true },
    { id: 3, name: 'Alfa Enterprise', short_name: 'ALFA-E', color: '#4a148c', accent: '#ea80fc', gstin: '27AABCA5678N1Z2', address: 'Virar, Vasai Virar', phone: '', website: '', is_active: true },
    { id: 4, name: 'Alfa Lifters', short_name: 'ALFA-L', color: '#bf360c', accent: '#ff6e40', gstin: '27AABCA9012P1Z3', address: 'Virar, Vasai Virar', phone: '', website: '', is_active: true },
  ]))

  // ── App Users ─────────────────────────────────────────────────
  localStorage.setItem('app_users', JSON.stringify([
    { id: 1, username: 'superadmin', password: 'super@123', name: 'Super Admin', role: 'superadmin', company_id: null, permissions: ['all'], is_active: true, created_at: nowStr() },
    { id: 2, username: 'admin', password: 'essar@123', name: 'Fakhruddin Arsiwala', role: 'admin', company_id: 1, permissions: ['all'], is_active: true, created_at: nowStr() },
    { id: 3, username: 'sales', password: 'sales@123', name: 'Rajesh Patil', role: 'sales', company_id: 1, permissions: ['crm', 'quotations', 'sales_orders'], is_active: true, created_at: nowStr() },
    { id: 4, username: 'accounts', password: 'acc@123', name: 'Priya Mehta', role: 'accounts', company_id: 1, permissions: ['invoices', 'payments'], is_active: true, created_at: nowStr() },
  ]))

  // ── Glass Calculation Settings ────────────────────────────────
  localStorage.setItem('glass_calc_settings', JSON.stringify({
    // ── Area Calculation
    mm_to_inch_factor:     0.03937,
    sqft_ceiling_inches:   6,
    sqft_divisor:          144,
    // ── Charged Size (for PO / Toughening)
    charged_ceiling_inches: 3,
    // ── Toughening Extra Size
    toughening_extra_mm:   30,
    // ── Running Feet
    rft_divisor:           12,
    // ── CEP Running Feet (for PO)
    cep_rft_multiplier:    7,
    // ── Default Tax
    default_gst_rate:      18,
    default_cgst_rate:     9,
    default_sgst_rate:     9,
    default_igst_rate:     18,
    // ── Quotation Defaults
    default_validity_days: 8,
    default_payment_terms: '50_advance_50_delivery',
    default_tolerance_mm:  2,
    // ── D/C Default Charges
    default_dc_charge:     1000,
    default_handling_charge: 500,
    // ── Margin Thresholds
    margin_good_pct:       20,
    margin_ok_pct:         10,
    // ── Sqmt Calculation
    sqmt_divisor:          1000000,
    updated_at: new Date().toISOString(),
    updated_by: 'System Default',
  }))

  // ── Company Info ──────────────────────────────────────────────
  localStorage.setItem('company_info', JSON.stringify({
    name: 'Essar Sons', legal_name: 'Essar Sons',
    owner: 'Fakhruddin Arsiwala', gstin: '27AAIFE0491M1Z4',
    address: 'Shop No.11, Unique, Rashmi Shopping Centre, Agashi Road, Virar West',
    city: 'Vasai Virar', state: 'Maharashtra', pincode: '401303',
    phone: '08047515289', website: 'www.essarsons.in',
    established: '1982', nature: 'Partnership',
  }))

  // ── Currencies ────────────────────────────────────────────────
  localStorage.setItem('currencies', JSON.stringify([
    { id:1, name:'Indian Rupee', code:'INR', symbol:'₹', rate:1.0,  decimal_places:2, is_base:true,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'US Dollar',    code:'USD', symbol:'$', rate:83.5, decimal_places:2, is_base:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── UoM Categories ────────────────────────────────────────────
  localStorage.setItem('uom_categories', JSON.stringify([
    { id:1, name:'Area',   is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Length', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Weight', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Unit',   is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── UoMs ──────────────────────────────────────────────────────
  localStorage.setItem('uoms', JSON.stringify([
    { id:1, name:'Square Feet',  symbol:'sqft', category_id:1, uom_type:'reference', ratio:1.0,    rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Square Meter', symbol:'sqm',  category_id:1, uom_type:'bigger',    ratio:10.764, rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Running Feet', symbol:'rft',  category_id:2, uom_type:'reference', ratio:1.0,    rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Piece',        symbol:'pcs',  category_id:4, uom_type:'reference', ratio:1.0,    rounding:1.0,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'Kilogram',     symbol:'kg',   category_id:3, uom_type:'reference', ratio:1.0,    rounding:0.01, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Tax Groups ────────────────────────────────────────────────
  localStorage.setItem('tax_groups', JSON.stringify([
    { id:1, name:'GST 18%', gst_rate:18, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'GST 12%', gst_rate:12, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'GST 5%',  gst_rate:5,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Taxes ─────────────────────────────────────────────────────
  localStorage.setItem('taxes', JSON.stringify([
    { id:1, name:'CGST 9%',  tax_type:'CGST', rate:9,  computation_type:'percentage', tax_group_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'SGST 9%',  tax_type:'SGST', rate:9,  computation_type:'percentage', tax_group_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'IGST 18%', tax_type:'IGST', rate:18, computation_type:'percentage', tax_group_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'CGST 6%',  tax_type:'CGST', rate:6,  computation_type:'percentage', tax_group_id:2, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'SGST 6%',  tax_type:'SGST', rate:6,  computation_type:'percentage', tax_group_id:2, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── HSN Codes ─────────────────────────────────────────────────
  localStorage.setItem('hsn_codes', JSON.stringify([
    { id:1, code:'70091000', description:'Mirrors of glass, framed',               hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, code:'70051000', description:'Float glass, surface ground or polished', hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, code:'70072100', description:'Toughened / Tempered Safety Glass',       hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, code:'70081000', description:'Multiple-walled insulating units (DGU)',  hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, code:'70031200', description:'Wired sheet and patterned glass',         hsn_type:'HSN', gst_rate:18, cgst_rate:9, sgst_rate:9, igst_rate:18, chapter_heading:'Chapter 70 - Glass', is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── CRM Stages ────────────────────────────────────────────────
  localStorage.setItem('crm_stages', JSON.stringify([
    { id:1, name:'New',         sequence:10, probability:10,  is_won:false, is_lost:false, fold:false, company_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Qualified',   sequence:20, probability:30,  is_won:false, is_lost:false, fold:false, company_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Proposition', sequence:30, probability:50,  is_won:false, is_lost:false, fold:false, company_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Won',         sequence:40, probability:100, is_won:true,  is_lost:false, fold:false, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'Lost',        sequence:50, probability:0,   is_won:false, is_lost:true,  fold:true,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Warehouses ────────────────────────────────────────────────
  localStorage.setItem('warehouses', JSON.stringify([
    { id:1, name:'Virar Main Warehouse',   code:'WH01', location:'Virar West, Vasai Virar', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Mira Road Store',        code:'WH02', location:'Mira Road East, Thane',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Products ─────────────────────────────────────────────────
  localStorage.setItem('products', JSON.stringify([
    { id:1,  name:'Toughened Safety Glass 6mm',    internal_ref:'PROD0001', product_type:'storable', company_id:1, glass_type:'Tempered Glass',   thickness_mm:6,  sale_price:115, cost_price:85,  uom_id:1, hsn_id:3, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:250, min_qty:50, max_qty:500, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2,  name:'Clear Float Glass 4mm',          internal_ref:'PROD0002', product_type:'storable', company_id:1, glass_type:'Float Glass',      thickness_mm:4,  sale_price:30,  cost_price:22,  uom_id:1, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:400, min_qty:100,max_qty:800, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3,  name:'Clear Float Glass 8mm',          internal_ref:'PROD0003', product_type:'storable', company_id:1, glass_type:'Float Glass',      thickness_mm:8,  sale_price:65,  cost_price:48,  uom_id:1, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:180, min_qty:50, max_qty:400, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4,  name:'Extra Clear Low Iron Glass 8mm', internal_ref:'PROD0004', product_type:'storable', company_id:1, glass_type:'Float Glass',      thickness_mm:8,  sale_price:180, cost_price:140, uom_id:1, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:120, min_qty:30, max_qty:300, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5,  name:'Tinted Bronze Glass 5mm',        internal_ref:'PROD0005', product_type:'storable', company_id:1, glass_type:'Tinted Glass',     thickness_mm:5,  sale_price:85,  cost_price:65,  uom_id:1, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:90,  min_qty:20, max_qty:200, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:6,  name:'Laminated Safety Glass 10mm',    internal_ref:'PROD0006', product_type:'storable', company_id:1, glass_type:'Laminated Glass',  thickness_mm:10, sale_price:280, cost_price:220, uom_id:1, hsn_id:3, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:60,  min_qty:15, max_qty:150, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:7,  name:'Frosted / Acid Etched Glass 5mm',internal_ref:'PROD0007', product_type:'storable', glass_type:'Decorative Glass', thickness_mm:5,  sale_price:160, cost_price:120, uom_id:1, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:45,  min_qty:10, max_qty:100, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:8,  name:'DGU Insulated Glass 24mm',       internal_ref:'PROD0008', product_type:'storable', company_id:1, glass_type:'Insulated Glass',  thickness_mm:24, sale_price:450, cost_price:350, uom_id:1, hsn_id:4, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:25,  min_qty:5,  max_qty:50,  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:9,  name:'Toughened Glass 10mm',           internal_ref:'PROD0009', product_type:'storable', company_id:1, glass_type:'Tempered Glass',   thickness_mm:10, sale_price:185, cost_price:145, uom_id:1, hsn_id:3, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:75,  min_qty:20, max_qty:200, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:10, name:'Mirror Glass 5mm',               internal_ref:'PROD0010', product_type:'storable', company_id:1, glass_type:'Mirror',           thickness_mm:5,  sale_price:85,  cost_price:60,  uom_id:1, hsn_id:1, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:100, min_qty:25, max_qty:250, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:11, name:'Back Painted Glass 6mm',         internal_ref:'PROD0011', product_type:'storable', company_id:1, glass_type:'Decorative Glass', thickness_mm:6,  sale_price:195, cost_price:150, uom_id:1, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:true,  on_hand_qty:35,  min_qty:10, max_qty:100, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:12, name:'Glass Drilling Charges',         internal_ref:'SRV0001',  product_type:'service', company_id:1,  glass_type:null, thickness_mm:null, sale_price:135, cost_price:0,  uom_id:4, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:false, on_hand_qty:0, min_qty:0, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:13, name:'Glass Handling & Transport',     internal_ref:'SRV0002',  product_type:'service', company_id:1,  glass_type:null, thickness_mm:null, sale_price:500, cost_price:0,  uom_id:4, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:false, on_hand_qty:0, min_qty:0, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:14, name:'Cutout Charges',                 internal_ref:'SRV0003',  product_type:'service', company_id:1,  glass_type:null, thickness_mm:null, sale_price:105, cost_price:0,  uom_id:4, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:false, on_hand_qty:0, min_qty:0, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:15, name:'Installation Service',           internal_ref:'SRV0004',  product_type:'service', company_id:1,  glass_type:null, thickness_mm:null, sale_price:250, cost_price:0,  uom_id:4, hsn_id:2, tax_id:3, can_be_sold:true, can_be_purchased:false, on_hand_qty:0, min_qty:0, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Employees / Salespersons ──────────────────────────────────
  localStorage.setItem('employees', JSON.stringify([
    { id:1, name:'Fakhruddin Arsiwala', employee_code:'EMP0001', company_id:1, designation:'Owner / Director',      department:'Management',  work_email:'fakhruddin@essarsons.in', work_phone:'9820XXXXXX', joining_date:'1982-01-01', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Rajesh Patil',        employee_code:'EMP0002', company_id:1, designation:'Sales Manager',         department:'Sales',       work_email:'rajesh@essarsons.in',     work_phone:'9876543210', joining_date:'2018-06-15', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Amit Sharma',         employee_code:'EMP0003', company_id:1, designation:'Sales Executive',       department:'Sales',       work_email:'amit@essarsons.in',       work_phone:'9876543211', joining_date:'2020-01-10', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Priya Mehta',         employee_code:'EMP0004', company_id:1, designation:'Accounts Manager',      department:'Accounts',    work_email:'priya@essarsons.in',      work_phone:'9876543212', joining_date:'2019-03-20', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'Vikram Nair',         employee_code:'EMP0005', company_id:1, designation:'Warehouse In-charge',   department:'Operations',  work_email:'vikram@essarsons.in',     work_phone:'9876543213', joining_date:'2017-11-05', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:6, name:'Suresh Gupta',        employee_code:'EMP0006', company_id:1, designation:'Delivery Coordinator',  department:'Logistics',   work_email:'suresh@essarsons.in',     work_phone:'9876543214', joining_date:'2021-07-01', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:7, name:'Kavita Joshi',        employee_code:'EMP0007', company_id:1, designation:'Office Administrator',  department:'Admin',       work_email:'kavita@essarsons.in',     work_phone:'9876543215', joining_date:'2022-02-14', employee_type:'regular', is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Vendors ───────────────────────────────────────────────────
  localStorage.setItem('vendors', JSON.stringify([
    { id:1, name:'Saint-Gobain India Pvt Ltd',    vendor_code:'VEND0001', company_id:1, gstin:'27AADCS1234M1ZK', city:'Mumbai',    state:'Maharashtra', phone:'022-40001234', email:'sales@saint-gobain.in',    payment_terms:'30_days', lead_time:7,  currency_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2, name:'Asahi India Glass Ltd (AIS)',   vendor_code:'VEND0002', company_id:1, gstin:'07AABCA5678N1Z2', city:'Gurugram',  state:'Haryana',     phone:'0124-4045678', email:'procurement@aisglass.com', payment_terms:'30_days', lead_time:10, currency_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3, name:'Gujarat Guardian Ltd',          vendor_code:'VEND0003', company_id:1, gstin:'24AABCG9012P1Z5', city:'Ankleshwar',state:'Gujarat',     phone:'02646-221234', email:'sales@gujaratguardian.com',payment_terms:'45_days', lead_time:14, currency_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4, name:'Viracon Glass Suppliers',       vendor_code:'VEND0004', company_id:1, gstin:'27AABCV3456Q1Z8', city:'Pune',      state:'Maharashtra', phone:'020-26543456', email:'orders@viracon.in',         payment_terms:'15_days', lead_time:5,  currency_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5, name:'Mumbai Glass Traders',          vendor_code:'VEND0005', company_id:1, gstin:'27AABCM7890R1Z1', city:'Mumbai',    state:'Maharashtra', phone:'022-23456789', email:'info@mumbaiglass.com',      payment_terms:'immediate',lead_time:2,  currency_id:1, is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Customers ─────────────────────────────────────────────────
  localStorage.setItem('customers', JSON.stringify([
    { id:1,  name:'Skyline Builders Pvt Ltd',      customer_code:'CUST0001', company_id:1, customer_type:'company', gstin:'27AABCS1111A1Z5', gst_treatment:'registered_regular', city:'Virar',        state:'Maharashtra', phone:'9820111111', email:'purchase@skylinebuilders.in', payment_terms:'30_days', credit_limit:500000, currency_id:1, salesperson:'Rajesh Patil', is_active:true, created_at:daysAgo(180), updated_at:nowStr() },
    { id:2,  name:'Om Interiors & Decorators',     customer_code:'CUST0002', company_id:1, customer_type:'company', gstin:'27AABCO2222B1Z4', gst_treatment:'registered_regular', city:'Vasai',         state:'Maharashtra', phone:'9820222222', email:'ominteriors@gmail.com',       payment_terms:'15_days', credit_limit:200000, currency_id:1, salesperson:'Amit Sharma',  is_active:true, created_at:daysAgo(150), updated_at:nowStr() },
    { id:3,  name:'Royal Furnishers',              customer_code:'CUST0003', company_id:1, customer_type:'company', gstin:'27AABCR3333C1Z3', gst_treatment:'registered_regular', city:'Nalasopara',    state:'Maharashtra', phone:'9820333333', email:'royalfurnishers@yahoo.com',   payment_terms:'30_days', credit_limit:300000, currency_id:1, salesperson:'Rajesh Patil', is_active:true, created_at:daysAgo(120), updated_at:nowStr() },
    { id:4,  name:'Patel Construction Co.',        customer_code:'CUST0004', company_id:1, customer_type:'company', gstin:'27AABCP4444D1Z2', gst_treatment:'registered_regular', city:'Mira Road',     state:'Maharashtra', phone:'9820444444', email:'patelconstruction@gmail.com', payment_terms:'45_days', credit_limit:800000, currency_id:1, salesperson:'Amit Sharma',  is_active:true, created_at:daysAgo(90),  updated_at:nowStr() },
    { id:5,  name:'Mehta Architecture Studio',     customer_code:'CUST0005', company_id:1, customer_type:'company', gstin:'27AABCM5555E1Z1', gst_treatment:'registered_regular', city:'Bhayandar',     state:'Maharashtra', phone:'9820555555', email:'mehta.arch@gmail.com',        payment_terms:'30_days', credit_limit:400000, currency_id:1, salesperson:'Rajesh Patil', is_active:true, created_at:daysAgo(80),  updated_at:nowStr() },
    { id:6,  name:'GlassHub Solutions',            customer_code:'CUST0006', company_id:1, customer_type:'company', gstin:'27AABCG6666F1Z0', gst_treatment:'registered_regular', city:'Thane',          state:'Maharashtra', phone:'9820666666', email:'orders@glasshub.in',          payment_terms:'immediate',credit_limit:150000, currency_id:1, salesperson:'Amit Sharma',  is_active:true, created_at:daysAgo(60),  updated_at:nowStr() },
    { id:7,  name:'Sunrise Developers',            customer_code:'CUST0007', company_id:1, customer_type:'company', gstin:'27AABCS7777G1Z9', gst_treatment:'registered_regular', city:'Virar',         state:'Maharashtra', phone:'9820777777', email:'sunrise.dev@gmail.com',       payment_terms:'30_days', credit_limit:600000, currency_id:1, salesperson:'Rajesh Patil', is_active:true, created_at:daysAgo(45),  updated_at:nowStr() },
    { id:8,  name:'Agarwal Glass Works',           customer_code:'CUST0008', company_id:1, customer_type:'company', gstin:'27AABCA8888H1Z8', gst_treatment:'registered_regular', city:'Dahisar',        state:'Maharashtra', phone:'9820888888', email:'agarwal.glass@gmail.com',     payment_terms:'15_days', credit_limit:250000, currency_id:1, salesperson:'Amit Sharma',  is_active:true, created_at:daysAgo(30),  updated_at:nowStr() },
    { id:9,  name:'Rahul Sharma',                  customer_code:'CUST0009', company_id:1, customer_type:'individual', gst_treatment:'consumer', city:'Vasai', state:'Maharashtra', phone:'9820999999', email:'rahul.sharma@gmail.com',      payment_terms:'immediate',credit_limit:50000,  currency_id:1, salesperson:'Amit Sharma',  is_active:true, created_at:daysAgo(20),  updated_at:nowStr() },
    { id:10, name:'Horizon Infra Projects',        customer_code:'CUST0010', company_id:1, customer_type:'company', gstin:'27AABCH1010I1Z7', gst_treatment:'registered_regular', city:'Borivali',      state:'Maharashtra', phone:'9821010101', email:'horizon.infra@gmail.com',     payment_terms:'60_days', credit_limit:1000000,currency_id:1, salesperson:'Rajesh Patil', is_active:true, created_at:daysAgo(10),  updated_at:nowStr() },
  ]))

  // ── CRM Leads ─────────────────────────────────────────────────
  localStorage.setItem('crm_leads', JSON.stringify([
    { id:1,  name:'Office Partition Glass - Skyline HQ',    lead_number:'OPP0001', company_id:1, stage_id:4, customer_id:1, contact_name:'Ravi Kumar',    company_name:'Skyline Builders Pvt Ltd', phone:'9820111111', email:'purchase@skylinebuilders.in', salesperson:'Rajesh Patil', expected_revenue:185000, probability:100, priority:'high',   expected_closing:dateStr(0),  lead_type:'opportunity', is_active:true, created_at:daysAgo(45), updated_at:daysAgo(5) },
    { id:2,  name:'Shower Partition - Om Interiors',        lead_number:'OPP0002', company_id:1, stage_id:4, customer_id:2, contact_name:'Om Prakash',    company_name:'Om Interiors & Decorators', phone:'9820222222', email:'ominteriors@gmail.com',       salesperson:'Amit Sharma',  expected_revenue:92000,  probability:100, priority:'normal', expected_closing:dateStr(0),  lead_type:'opportunity', is_active:true, created_at:daysAgo(40), updated_at:daysAgo(3) },
    { id:3,  name:'Toughened Glass Balcony - Royal',        lead_number:'OPP0003', company_id:1, stage_id:3, customer_id:3, contact_name:'Rakesh Patel',  company_name:'Royal Furnishers',          phone:'9820333333', email:'royalfurnishers@yahoo.com',   salesperson:'Rajesh Patil', expected_revenue:145000, probability:60,  priority:'high',   expected_closing:futureDateStr(15), lead_type:'opportunity', is_active:true, created_at:daysAgo(30), updated_at:daysAgo(2) },
    { id:4,  name:'DGU Glass for Commercial Building',      lead_number:'OPP0004', company_id:1, stage_id:3, customer_id:4, contact_name:'Sunil Patel',   company_name:'Patel Construction Co.',    phone:'9820444444', email:'patelconstruction@gmail.com', salesperson:'Amit Sharma',  expected_revenue:380000, probability:50,  priority:'urgent', expected_closing:futureDateStr(20), lead_type:'opportunity', is_active:true, created_at:daysAgo(25), updated_at:daysAgo(1) },
    { id:5,  name:'Mirror Glass for Hotel Lobby',           lead_number:'OPP0005', company_id:1, stage_id:2, customer_id:5, contact_name:'Ankit Mehta',   company_name:'Mehta Architecture Studio', phone:'9820555555', email:'mehta.arch@gmail.com',        salesperson:'Rajesh Patil', expected_revenue:75000,  probability:30,  priority:'normal', expected_closing:futureDateStr(30), lead_type:'opportunity', is_active:true, created_at:daysAgo(20), updated_at:daysAgo(1) },
    { id:6,  name:'Float Glass Supply - Monthly Order',     lead_number:'OPP0006', company_id:1, stage_id:2, customer_id:6, contact_name:'Pradeep Singh', company_name:'GlassHub Solutions',        phone:'9820666666', email:'orders@glasshub.in',          salesperson:'Amit Sharma',  expected_revenue:120000, probability:40,  priority:'normal', expected_closing:futureDateStr(25), lead_type:'opportunity', is_active:true, created_at:daysAgo(15), updated_at:nowStr() },
    { id:7,  name:'Laminated Glass Staircase Railing',      lead_number:'OPP0007', company_id:1, stage_id:1, customer_id:7, contact_name:'Deepak Sharma', company_name:'Sunrise Developers',        phone:'9820777777', email:'sunrise.dev@gmail.com',       salesperson:'Rajesh Patil', expected_revenue:95000,  probability:15,  priority:'high',   expected_closing:futureDateStr(45), lead_type:'opportunity', is_active:true, created_at:daysAgo(10), updated_at:nowStr() },
    { id:8,  name:'Back Painted Glass Kitchen - Agarwal',   lead_number:'OPP0008', company_id:1, stage_id:1, customer_id:8, contact_name:'Anil Agarwal',  company_name:'Agarwal Glass Works',       phone:'9820888888', email:'agarwal.glass@gmail.com',     salesperson:'Amit Sharma',  expected_revenue:55000,  probability:10,  priority:'normal', expected_closing:futureDateStr(35), lead_type:'opportunity', is_active:true, created_at:daysAgo(7),  updated_at:nowStr() },
    { id:9,  name:'Home Window Glass Replacement',          lead_number:'OPP0009', company_id:1, stage_id:1, customer_id:9, contact_name:'Rahul Sharma',  company_name:'',                          phone:'9820999999', email:'rahul.sharma@gmail.com',      salesperson:'Amit Sharma',  expected_revenue:18000,  probability:20,  priority:'low',    expected_closing:futureDateStr(15), lead_type:'lead',        is_active:true, created_at:daysAgo(3),  updated_at:nowStr() },
    { id:10, name:'Curtain Wall Glass - Horizon Tower',     lead_number:'OPP0010', company_id:1, stage_id:2, customer_id:10,contact_name:'Raj Mehta',    company_name:'Horizon Infra Projects',    phone:'9821010101', email:'horizon.infra@gmail.com',     salesperson:'Rajesh Patil', expected_revenue:850000, probability:35,  priority:'urgent', expected_closing:futureDateStr(60), lead_type:'opportunity', is_active:true, created_at:daysAgo(2),  updated_at:nowStr() },
  ]))

  // ── Quotations ────────────────────────────────────────────────
  const quotations = [
    { id:1,  quote_number:'QT0001', company_id:1, customer_id:1,  status:'converted', quote_date:dateStr(42), valid_until:dateStr(12), salesperson:'Rajesh Patil', payment_terms:'30_days', subtotal:157627, tax_amount:28373, total_amount:186000, discount_amount:0, crm_lead_id:1, lines:[
      { id:1, product_id:1, description:'Toughened Safety Glass 6mm', width_mm:1200, height_mm:2400, quantity:5, unit_price:115, area_sqft:15.50, pricing_method:'per_sqft', cep:true, discount_pct:0, subtotal:8913, tax_amount:1604, line_total:10517 },
      { id:2, product_id:9, description:'Toughened Glass 10mm Partition', width_mm:900,  height_mm:2100, quantity:8, unit_price:185, area_sqft:10.23, pricing_method:'per_sqft', cep:true, discount_pct:0, subtotal:15140, tax_amount:2725, line_total:17865 },
    ], created_at:daysAgo(42), updated_at:daysAgo(5), is_active:true },

    { id:2,  quote_number:'QT0002', company_id:1, customer_id:2,  status:'converted', quote_date:dateStr(38), valid_until:dateStr(8),  salesperson:'Amit Sharma',  payment_terms:'15_days', subtotal:78000,  tax_amount:14040, total_amount:92040, discount_amount:0, crm_lead_id:2, lines:[
      { id:3, product_id:1, description:'Shower Partition Toughened 8mm', width_mm:800, height_mm:2000, quantity:3, unit_price:185, area_sqft:17.22, pricing_method:'per_sqft', cep:false, discount_pct:5, subtotal:30191, tax_amount:5434, line_total:35625 },
    ], created_at:daysAgo(38), updated_at:daysAgo(3), is_active:true },

    { id:3,  quote_number:'QT0003', company_id:1, customer_id:3,  status:'confirmed',  quote_date:dateStr(28), valid_until:futureDateStr(2), salesperson:'Rajesh Patil', payment_terms:'30_days', subtotal:122881, tax_amount:22119, total_amount:145000, discount_amount:0, lines:[
      { id:5, product_id:6, description:'Laminated Glass Balcony Railing', width_mm:1000, height_mm:1200, quantity:10, unit_price:280, area_sqft:12.92, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:36176, tax_amount:6512, line_total:42688 },
    ], created_at:daysAgo(28), updated_at:daysAgo(2), is_active:true },

    { id:4,  quote_number:'QT0004', company_id:1, customer_id:4,  status:'sent',       quote_date:dateStr(20), valid_until:futureDateStr(10), salesperson:'Amit Sharma',  payment_terms:'45_days', subtotal:322034, tax_amount:57966, total_amount:380000, discount_amount:0, lines:[
      { id:7, product_id:8, description:'DGU Insulated Glass 24mm', width_mm:1500, height_mm:2500, quantity:12, unit_price:450, area_sqft:40.32, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:217728, tax_amount:39191, line_total:256919 },
    ], created_at:daysAgo(20), updated_at:daysAgo(1), is_active:true },

    { id:5,  quote_number:'QT0005', company_id:1, customer_id:5,  status:'draft',      quote_date:dateStr(15), valid_until:futureDateStr(15), salesperson:'Rajesh Patil', payment_terms:'30_days', subtotal:63559,  tax_amount:11441, total_amount:75000,  discount_amount:0, lines:[
      { id:9, product_id:10, description:'Mirror Glass 5mm',  width_mm:600, height_mm:900, quantity:8, unit_price:85, area_sqft:4.65, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:3162, tax_amount:569, line_total:3731 },
    ], created_at:daysAgo(15), updated_at:daysAgo(1), is_active:true },

    { id:6,  quote_number:'QT0006', company_id:1, customer_id:6,  status:'sent',       quote_date:dateStr(12), valid_until:futureDateStr(18), salesperson:'Amit Sharma',  payment_terms:'immediate', subtotal:101695, tax_amount:18305, total_amount:120000, discount_amount:0, lines:[
      { id:11, product_id:2, description:'Clear Float Glass 4mm Supply', width_mm:1800, height_mm:1200, quantity:20, unit_price:30, area_sqft:23.23, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:13938, tax_amount:2509, line_total:16447 },
    ], created_at:daysAgo(12), updated_at:daysAgo(1), is_active:true },

    { id:7,  quote_number:'QT0007', company_id:1, customer_id:7,  status:'draft',      quote_date:dateStr(8),  valid_until:futureDateStr(22), salesperson:'Rajesh Patil', payment_terms:'30_days', subtotal:80508,  tax_amount:14492, total_amount:95000,  discount_amount:0, lines:[
      { id:13, product_id:6, description:'Laminated Glass Staircase', width_mm:1100, height_mm:900, quantity:6, unit_price:280, area_sqft:6.45, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:10836, tax_amount:1950, line_total:12786 },
    ], created_at:daysAgo(8), updated_at:nowStr(), is_active:true },

    { id:8,  quote_number:'QT0008', company_id:1, customer_id:8,  status:'draft',      quote_date:dateStr(5),  valid_until:futureDateStr(25), salesperson:'Amit Sharma',  payment_terms:'15_days', subtotal:46610,  tax_amount:8390,  total_amount:55000,  discount_amount:0, lines:[
      { id:15, product_id:11, description:'Back Painted Glass Kitchen', width_mm:900, height_mm:600, quantity:8, unit_price:195, area_sqft:5.38, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:8391, tax_amount:1510, line_total:9901 },
    ], created_at:daysAgo(5), updated_at:nowStr(), is_active:true },

    { id:9,  quote_number:'QT0009', company_id:1, customer_id:9,  status:'draft',      quote_date:dateStr(2),  valid_until:futureDateStr(28), salesperson:'Amit Sharma',  payment_terms:'immediate', subtotal:15254,  tax_amount:2746,  total_amount:18000,  discount_amount:0, lines:[
      { id:17, product_id:3, description:'Float Glass 8mm Window', width_mm:1000, height_mm:1200, quantity:4, unit_price:65, area_sqft:5.38, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:1399, tax_amount:252, line_total:1651 },
    ], created_at:daysAgo(2), updated_at:nowStr(), is_active:true },

    { id:10, quote_number:'QT0010', company_id:1, customer_id:10, status:'draft',      quote_date:dateStr(1),  valid_until:futureDateStr(29), salesperson:'Rajesh Patil', payment_terms:'60_days', subtotal:720339, tax_amount:129661, total_amount:850000, discount_amount:0, lines:[
      { id:19, product_id:8, description:'DGU Curtain Wall Glass', width_mm:1800, height_mm:3000, quantity:25, unit_price:450, area_sqft:57.65, pricing_method:'per_sqft', cep:false, discount_pct:0, subtotal:648169, tax_amount:116670, line_total:764839 },
    ], created_at:daysAgo(1), updated_at:nowStr(), is_active:true },
  ]
  localStorage.setItem('quotations', JSON.stringify(quotations))

  // ── Sales Orders ──────────────────────────────────────────────
  localStorage.setItem('sales_orders', JSON.stringify([
    { id:1, so_number:'SO0001', company_id:1, customer_id:1, quotation_id:1, crm_lead_id:1, status:'delivered', order_date:dateStr(40), delivery_date:dateStr(10), salesperson:'Rajesh Patil', payment_terms:'30_days', warehouse_id:1, subtotal:157627, tax_amount:28373, total_amount:186000, lines:[
      { id:1, product_id:1, description:'Toughened Safety Glass 6mm', width_mm:1200, height_mm:2400, quantity:5, unit_price:115, area_sqft:15.50, line_total:10517 },
      { id:2, product_id:9, description:'Toughened Glass 10mm Partition', width_mm:900, height_mm:2100, quantity:8, unit_price:185, area_sqft:10.23, line_total:17865 },
    ], created_at:daysAgo(40), updated_at:daysAgo(10), is_active:true },

    { id:2, so_number:'SO0002', company_id:1, customer_id:2, quotation_id:2, crm_lead_id:2, status:'delivered', order_date:dateStr(35), delivery_date:dateStr(8),  salesperson:'Amit Sharma',  payment_terms:'15_days', warehouse_id:1, subtotal:78000,  tax_amount:14040, total_amount:92040, lines:[
      { id:3, product_id:1, description:'Shower Partition Toughened 8mm', width_mm:800, height_mm:2000, quantity:3, unit_price:185, area_sqft:17.22, line_total:35625 },
    ], created_at:daysAgo(35), updated_at:daysAgo(8), is_active:true },

    { id:3, so_number:'SO0003', company_id:1, customer_id:3, quotation_id:3, status:'in_production', order_date:dateStr(25), delivery_date:futureDateStr(5),  salesperson:'Rajesh Patil', payment_terms:'30_days', warehouse_id:1, subtotal:122881, tax_amount:22119, total_amount:145000, lines:[
      { id:5, product_id:6, description:'Laminated Glass Balcony', width_mm:1000, height_mm:1200, quantity:10, unit_price:280, area_sqft:12.92, line_total:42688 },
    ], created_at:daysAgo(25), updated_at:daysAgo(2), is_active:true },

    { id:4, so_number:'SO0004', company_id:1, customer_id:4, status:'confirmed',    order_date:dateStr(18), delivery_date:futureDateStr(12), salesperson:'Amit Sharma',  payment_terms:'45_days', warehouse_id:1, subtotal:322034, tax_amount:57966, total_amount:380000, lines:[
      { id:7, product_id:8, description:'DGU Insulated Glass 24mm', width_mm:1500, height_mm:2500, quantity:12, unit_price:450, area_sqft:40.32, line_total:256919 },
    ], created_at:daysAgo(18), updated_at:daysAgo(1), is_active:true },

    { id:5, so_number:'SO0005', company_id:1, customer_id:6, status:'ready',        order_date:dateStr(10), delivery_date:futureDateStr(2),  salesperson:'Amit Sharma',  payment_terms:'immediate',warehouse_id:1, subtotal:101695, tax_amount:18305, total_amount:120000, lines:[
      { id:11, product_id:2, description:'Clear Float Glass 4mm', width_mm:1800, height_mm:1200, quantity:20, unit_price:30, area_sqft:23.23, line_total:16447 },
    ], created_at:daysAgo(10), updated_at:daysAgo(1), is_active:true },
  ]))

  // ── Purchase Orders ───────────────────────────────────────────
  localStorage.setItem('purchase_orders', JSON.stringify([
    { id:1, po_number:'PO0001', company_id:1, vendor_id:1, so_id:1, status:'received', po_date:dateStr(38), expected_delivery:dateStr(28), payment_terms:'30_days', subtotal:133156, tax_amount:23968, total_amount:157124, lines:[
      { id:1, product_id:1, description:'Toughened Safety Glass 6mm', width_mm:1200, height_mm:2400, quantity:5, unit_price:85, area_sqft:15.50, subtotal:6618, line_total:7810 },
    ], created_at:daysAgo(38), updated_at:daysAgo(28), is_active:true },

    { id:2, po_number:'PO0002', company_id:1, vendor_id:2, so_id:2, status:'received', po_date:dateStr(33), expected_delivery:dateStr(20), payment_terms:'30_days', subtotal:66102, tax_amount:11898, total_amount:78000, lines:[
      { id:3, product_id:1, description:'Toughened Glass for Shower Partition', width_mm:800, height_mm:2000, quantity:3, unit_price:145, area_sqft:17.22, subtotal:30218, line_total:35657 },
    ], created_at:daysAgo(33), updated_at:daysAgo(20), is_active:true },

    { id:3, po_number:'PO0003', company_id:1, vendor_id:1, so_id:3, status:'confirmed', po_date:dateStr(23), expected_delivery:futureDateStr(7), payment_terms:'30_days', subtotal:103305, tax_amount:18595, total_amount:121900, lines:[
      { id:5, product_id:6, description:'Laminated Safety Glass 10mm', width_mm:1000, height_mm:1200, quantity:10, unit_price:220, area_sqft:12.92, subtotal:28424, line_total:33540 },
    ], created_at:daysAgo(23), updated_at:daysAgo(1), is_active:true },

    { id:4, po_number:'PO0004', company_id:1, vendor_id:3, so_id:4, status:'sent', po_date:dateStr(16), expected_delivery:futureDateStr(14), payment_terms:'45_days', subtotal:271212, tax_amount:48818, total_amount:320030, lines:[
      { id:7, product_id:8, description:'DGU Insulated Glass 24mm', width_mm:1500, height_mm:2500, quantity:12, unit_price:350, area_sqft:40.32, subtotal:169344, line_total:199826 },
    ], created_at:daysAgo(16), updated_at:daysAgo(1), is_active:true },
  ]))

  // ── Delivery Challans ─────────────────────────────────────────
  localStorage.setItem('delivery_challans', JSON.stringify([
    { id:1, dc_number:'DC0001', company_id:1, customer_id:1, so_id:1, status:'delivered', dc_date:dateStr(12), vehicle_number:'MH04-AB-1234', driver_name:'Ramesh Yadav', transporter:'Own Vehicle', lines:[
      { id:1, product_id:1, description:'Toughened Safety Glass 6mm', quantity:5, qty_dispatched:5 },
    ], created_at:daysAgo(14), updated_at:daysAgo(12), is_active:true },

    { id:2, dc_number:'DC0002', company_id:1, customer_id:2, so_id:2, status:'delivered', dc_date:dateStr(9),  vehicle_number:'MH04-CD-5678', driver_name:'Suresh Kumar',  transporter:'Third Party',  lines:[
      { id:2, product_id:1, description:'Toughened Glass Shower Partition', quantity:3, qty_dispatched:3 },
    ], created_at:daysAgo(10), updated_at:daysAgo(9), is_active:true },

    { id:3, dc_number:'DC0003', company_id:1, customer_id:6, so_id:5, status:'dispatched', dc_date:dateStr(1), vehicle_number:'MH04-EF-9012', driver_name:'Vijay Patil',   transporter:'Own Vehicle',  lines:[
      { id:3, product_id:2, description:'Clear Float Glass 4mm', quantity:20, qty_dispatched:20 },
    ], created_at:daysAgo(2), updated_at:daysAgo(1), is_active:true },
  ]))

  // ── Invoices ──────────────────────────────────────────────────
  localStorage.setItem('invoices', JSON.stringify([
    { id:1, invoice_number:'INV0001', company_id:1, customer_id:1, so_id:1, dc_id:1, status:'paid',  invoice_date:dateStr(11), due_date:dateStr(0),  payment_terms:'30_days', subtotal:157627, tax_amount:28373, total_amount:186000, advance_received:50000, created_at:daysAgo(11), updated_at:daysAgo(2), is_active:true },
    { id:2, invoice_number:'INV0002', company_id:1, customer_id:2, so_id:2, dc_id:2, status:'paid',  invoice_date:dateStr(8),  due_date:dateStr(2),  payment_terms:'15_days', subtotal:78000,  tax_amount:14040, total_amount:92040,  advance_received:30000, created_at:daysAgo(8),  updated_at:daysAgo(1), is_active:true },
    { id:3, invoice_number:'INV0003', company_id:1, customer_id:6, so_id:5, dc_id:3, status:'sent',  invoice_date:dateStr(1),  due_date:futureDateStr(7),  payment_terms:'immediate', subtotal:101695, tax_amount:18305, total_amount:120000, advance_received:0,     created_at:daysAgo(1),  updated_at:nowStr(),   is_active:true },
  ]))

  // ── Payments ──────────────────────────────────────────────────
  localStorage.setItem('payments', JSON.stringify([
    { id:1, payment_number:'PMT0001', invoice_id:1, customer_id:1, amount:50000,  payment_date:dateStr(40), payment_mode:'neft',   reference:'NEFT20240101', is_active:true, created_at:daysAgo(40), updated_at:daysAgo(40) },
    { id:2, payment_number:'PMT0002', invoice_id:1, customer_id:1, amount:136000, payment_date:dateStr(5),  payment_mode:'cheque', reference:'CHQ-0012345',  is_active:true, created_at:daysAgo(5),  updated_at:daysAgo(5)  },
    { id:3, payment_number:'PMT0003', invoice_id:2, customer_id:2, amount:30000,  payment_date:dateStr(35), payment_mode:'upi',    reference:'UPI-TX-98765', is_active:true, created_at:daysAgo(35), updated_at:daysAgo(35) },
    { id:4, payment_number:'PMT0004', invoice_id:2, customer_id:2, amount:62040,  payment_date:dateStr(3),  payment_mode:'neft',   reference:'NEFT20240203', is_active:true, created_at:daysAgo(3),  updated_at:daysAgo(3)  },
  ]))

  // ── Stock Movements ───────────────────────────────────────────
  localStorage.setItem('stock_movements', JSON.stringify([
    { id:1, move_number:'SM0001', product_id:1, movement_type:'in',          quantity:50, warehouse_id:1, reference:'PO0001', remarks:'Received from Saint-Gobain', date:daysAgo(28), is_active:true, created_at:daysAgo(28), updated_at:daysAgo(28) },
    { id:2, move_number:'SM0002', product_id:1, movement_type:'out',         quantity:5,  warehouse_id:1, reference:'DC0001', remarks:'Delivered to Skyline Builders', date:daysAgo(12), is_active:true, created_at:daysAgo(12), updated_at:daysAgo(12) },
    { id:3, move_number:'SM0003', product_id:1, movement_type:'in',          quantity:30, warehouse_id:1, reference:'PO0002', remarks:'Received from Asahi India', date:daysAgo(20), is_active:true, created_at:daysAgo(20), updated_at:daysAgo(20) },
    { id:4, move_number:'SM0004', product_id:1, movement_type:'out',         quantity:3,  warehouse_id:1, reference:'DC0002', remarks:'Delivered to Om Interiors', date:daysAgo(9), is_active:true, created_at:daysAgo(9), updated_at:daysAgo(9) },
    { id:5, move_number:'SM0005', product_id:2, movement_type:'in',          quantity:100,warehouse_id:1, reference:'PO0004', remarks:'Float Glass Stock Replenishment', date:daysAgo(15), is_active:true, created_at:daysAgo(15), updated_at:daysAgo(15) },
    { id:6, move_number:'SM0006', product_id:2, movement_type:'out',         quantity:20, warehouse_id:1, reference:'DC0003', remarks:'Delivered to GlassHub', date:daysAgo(1), is_active:true, created_at:daysAgo(1), updated_at:daysAgo(1) },
    { id:7, move_number:'SM0007', product_id:6, movement_type:'in',          quantity:25, warehouse_id:1, reference:'PO0003', remarks:'Laminated Glass Received', date:daysAgo(22), is_active:true, created_at:daysAgo(22), updated_at:daysAgo(22) },
    { id:8, move_number:'SM0008', product_id:8, movement_type:'adjustment',  quantity:5,  warehouse_id:1, reference:'ADJ001', remarks:'Physical count adjustment', date:daysAgo(7), is_active:true, created_at:daysAgo(7), updated_at:daysAgo(7) },
  ]))

  // ── Process Masters ──────────────────────────────────────────
  localStorage.setItem('process_masters', JSON.stringify([
    { id:1,  code:'PRC0001', name:'Cutting',               process_type:'cutting',     charge_type:'per_sqft',  rate:15,   unit:'sqft', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:2,  code:'PRC0002', name:'Polishing (4 sides)',   process_type:'polishing',   charge_type:'per_rft',   rate:15,   unit:'rft',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:3,  code:'PRC0003', name:'Polishing (2 sides)',   process_type:'polishing',   charge_type:'per_rft',   rate:8,    unit:'rft',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:4,  code:'PRC0004', name:'Hole Drilling',         process_type:'hole',        charge_type:'per_piece', rate:50,   unit:'hole', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:5,  code:'PRC0005', name:'Big Hole Drilling',     process_type:'hole',        charge_type:'per_piece', rate:100,  unit:'hole', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:6,  code:'PRC0006', name:'Cutout',                process_type:'cutout',      charge_type:'per_sqft',  rate:135,  unit:'sqft', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:7,  code:'PRC0007', name:'Big Cutout',            process_type:'cutout',      charge_type:'per_sqft',  rate:200,  unit:'sqft', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:8,  code:'PRC0008', name:'Fabrication',           process_type:'fabrication', charge_type:'per_sqft',  rate:50,   unit:'sqft', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:9,  code:'PRC0009', name:'Toughening (outsource)',process_type:'toughening',  charge_type:'per_sqmt',  rate:1200, unit:'sqmt', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:10, code:'PRC0010', name:'Beveling',              process_type:'beveling',    charge_type:'per_rft',   rate:80,   unit:'rft',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:11, code:'PRC0011', name:'Farma / Template',      process_type:'forma',       charge_type:'fixed',     rate:500,  unit:'job',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:12, code:'PRC0012', name:'Temporary Processing',  process_type:'temporary',   charge_type:'per_sqft',  rate:25,   unit:'sqft', is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:13, code:'PRC0013', name:'Glass Handling',        process_type:'handling',    charge_type:'fixed',     rate:500,  unit:'job',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
    { id:14, code:'PRC0014', name:'Delivery / Transport',  process_type:'delivery',    charge_type:'fixed',     rate:1000, unit:'job',  is_active:true, created_at:nowStr(), updated_at:nowStr() },
  ]))

  // ── Glass Rate Matrix ──────────────────────────────────────────
  localStorage.setItem('glass_rate_matrix', JSON.stringify({
    base_rates: {
      'Clear':      100,
      'Xtra Clear': 150,
      'Tinted':     125,
      'Reflective': 130,
      'Mirror':     175,
    },
    cost_rates: {
      'Clear':      70,
      'Xtra Clear': 105,
      'Tinted':     88,
      'Reflective': 91,
      'Mirror':     122,
    },
    thickness_rft_rates: {
      '3.5': 0,
      '4':   0,
      '5':   18,
      '8':   25,
      '10':  28,
      '12':  30,
    },
    sqmt_to_sqft: 10.764,
    cep_rft_options: [5, 7],
    cep_rft_default: 5,
    updated_at: new Date().toISOString(),
  }))

  // ── Glass Dropdown Config ──────────────────────────────────────
  localStorage.setItem('glass_dropdown_config', JSON.stringify({
    thicknesses:  [3.5, 4, 5, 6, 8, 10, 12],
    glass_types:  ['Annealed', 'Toughened', 'Laminated', 'DGU'],
    categories:   ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror'],
    updated_at: new Date().toISOString(),
  }))

  localStorage.setItem('_essar_seeded_v10', 'true')
}

export const resetAndReseed = () => {
  const keysToRemove = [
    'products','currencies','uoms','uom_categories','taxes','tax_groups',
    'hsn_codes','crm_stages','warehouses','customers','vendors','employees',
    'crm_leads','quotations','sales_orders','purchase_orders',
    'delivery_challans','invoices','payments','stock_movements',
    'glass_calc_settings','process_masters','workshop_orders','toughening_batches',
    'glass_rate_matrix','companies_master','app_users','glass_dropdown_config',
    '_essar_seeded_v3','_essar_seeded_v4','_essar_seeded_v5','_essar_seeded_v6','_essar_seeded_v7','_essar_seeded_v8','_essar_seeded_v9','_essar_seeded_v10'
  ]
  keysToRemove.forEach(k => localStorage.removeItem(k))
  seedDefaults()
}
