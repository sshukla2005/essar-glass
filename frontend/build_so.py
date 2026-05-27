import re
import os

with open('src/pages/quotations/QuotationForm.jsx', 'r') as f:
    q_content = f.read()

with open('src/pages/sales/SalesOrderForm.jsx', 'r') as f:
    s_content = f.read()

# 1. Extract helpers from QuotationForm.jsx
# from `const emptySize` up to `const QuotationForm = () => {`
start_idx = q_content.find('const emptySize = () => ({')
end_idx = q_content.find('const QuotationForm = () => {')
helpers_block = q_content[start_idx:end_idx]
helpers_block = helpers_block.replace("const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'converted']\nconst STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, converted: 3, cancelled: 0 }\n", "")

# 2. Extract methods from QuotationForm inside the component
def get_function(q_content, func_name):
    # finds `const func_name = ` and balances braces
    match = re.search(r'  const ' + func_name + r' = .*?\{', q_content, re.DOTALL)
    if not match: return ""
    start = match.start()
    brace_count = 0
    in_str = False
    str_char = ''
    i = q_content.find('{', start)
    if i == -1: return ""
    
    while i < len(q_content):
        c = q_content[i]
        if in_str:
            if c == str_char and q_content[i-1] != '\\':
                in_str = False
        else:
            if c in ["'", '"', '`']:
                in_str = True
                str_char = c
            elif c == '{':
                brace_count += 1
            elif c == '}':
                brace_count -= 1
                if brace_count == 0:
                    return q_content[start:i+1]
        i += 1
    return ""

def get_variable(q_content, var_name):
    match = re.search(r'  const ' + var_name + r' = .*?;', q_content, re.DOTALL)
    if match: return match.group(0)
    match = re.search(r'  const ' + var_name + r' = .*?\n', q_content)
    if match: return match.group(0)
    return ""
    
methods = [
    'reconstructGroups',
    'getPolishingRate',
    'calcGroupSize',
    'autoSuggestProcesses',
    'updateGroup',
    'updateSize',
    'addSize',
    'removeSize',
    'addGroup',
    'removeGroup',
    'addGroupProcess',
    'removeGroupProcess',
    'updateGroupProcess',
    'getFlatLines'
]

methods_code = []
for m in methods:
    methods_code.append(get_function(q_content, m))

methods_block = "\n\n".join(methods_code)

# 3. Extract the totals useMemo
totals_block = get_function(q_content, 'totals')

# 4. Extract the JSX groups map
jsx_start = q_content.find('{groups.map(group => (')
jsx_end = q_content.find('{/* ── Row 1: Glass Attribute Selectors ── */}') - 100
# let's just find the end of the groups map... it ends with `))} \n\n        <Row gutter={8}`
jsx_end_match = re.search(r'          </Card>\n        \)\)}\n\n        <Row gutter=\{8\}', q_content)
if jsx_end_match:
    jsx_end = jsx_end_match.start() + len('          </Card>\n        ))}')
else:
    print("Could not find JSX groups end!")
    
jsx_groups_and_buttons = q_content[jsx_start: q_content.find('<Col span={12}>', jsx_end)]
jsx_groups_and_buttons = jsx_groups_and_buttons.replace('<Col span={12}>', '')

# We also need the full totals panel JSX!
totals_panel_start = q_content.find('<Col span={12}>\n            <div style={{ background: \'#f8fafc\'')
totals_panel_end = q_content.find('</Row>\n      </Form>')
totals_panel_jsx = q_content[totals_panel_start:totals_panel_end]

# We need the CompWizard Modal
modal_start = q_content.find('<Modal\n        title={')
modal_end = q_content.find('</MasterForm>')
modal_jsx = q_content[modal_start:modal_end]

# 5. Build the new SalesOrderForm.jsx
new_s_content = """import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, Badge, App, Radio, Tooltip, Card, Modal, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, FileTextOutlined, CarOutlined, DollarOutlined, ToolOutlined, GiftOutlined, DownloadOutlined, AimOutlined, LineChartOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { salesOrderApi, customerApi, productApi, quotationApi, purchaseOrderApi, deliveryChallanApi, invoiceApi, warehouseApi, workshopOrderApi, processMasterApi } from '../../api'
import { generateSOPDF } from '../../utils/pdfGenerator'
import CompanySelector from '../../components/common/CompanySelector'

const { TextArea } = Input
const { Text } = Typography

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' }, { value: '45_days', label: '45 Days' },
]

const STATUS_STEPS = ['draft', 'confirmed', 'in_production', 'ready', 'delivered']
const STATUS_IDX = { draft: 0, confirmed: 1, in_production: 2, ready: 3, delivered: 4, cancelled: 0 }

"""

new_s_content += helpers_block + "\n\n"

new_s_content += """const SalesOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [unit, setSoUnit] = useState('inch')
  const [groups, setGroups] = useState([emptyGroup()])
  const [dropdownConfig] = useState(getDropdownConfig())
  const [hardwareItems, setHardwareItems] = useState([])
  const [laborItems, setLaborItems] = useState([])
  const [gstMode, setGstMode] = useState('cgst_sgst')
  const [compWizard, setCompWizard] = useState(null)
  const [wizardCostPrice, setWizardCostPrice] = useState(null)

  const { data: record, isLoading } = useQuery({
    queryKey: ['sales_orders', id], queryFn: () => salesOrderApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: productsData } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: processMastersData } = useQuery({ queryKey: ['process-masters'], queryFn: () => processMasterApi.dropdown().then(r => r.data) })
  const { data: quotations = [] } = useQuery({ queryKey: ['quotations-dd'], queryFn: () => quotationApi.dropdown().then(r => r.data) })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-dd'], queryFn: () => warehouseApi.dropdown().then(r => r.data) })

  const { data: posData } = useQuery({ queryKey: ['pos-so', id], queryFn: () => purchaseOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: dcsData } = useQuery({ queryKey: ['dcs-so', id], queryFn: () => deliveryChallanApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: invData } = useQuery({ queryKey: ['inv-so', id], queryFn: () => invoiceApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: woData } = useQuery({ queryKey: ['wo-so', id], queryFn: () => workshopOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })

  const customerList = Array.isArray(customers) ? customers : (customers?.items || [])
  const products = Array.isArray(productsData) ? productsData : (productsData?.items || [])
  const processMasters = Array.isArray(processMastersData) ? processMastersData : (processMastersData?.items || [])
  const quotationList = Array.isArray(quotations) ? quotations : (quotations?.items || [])
  const warehouseList = Array.isArray(warehouses) ? warehouses : (warehouses?.items || [])
"""

new_s_content += methods_block + "\n\n"

new_s_content += """
  useEffect(() => {
    if (!isEdit) {
      form.setFieldValue('order_date', dayjs())
    }
  }, [])

  useEffect(() => {
    if (record) {
      const sanitize = (obj) => Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v])
      )
      form.setFieldsValue({
        ...sanitize(record),
        customer_id: record.customer_id,
        order_date: record.order_date ? dayjs(record.order_date) : null,
        delivery_date: record.delivery_date ? dayjs(record.delivery_date) : null,
      })
      
      if (record.groups?.length) {
        setGroups(record.groups.map(g => ({
          ...emptyGroup(),
          ...g,
          group_key: Date.now() + Math.random(),
          sizes: (g.sizes || []).map(s => ({
            ...emptySize(),
            ...s,
            size_key: Date.now() + Math.random(),
          })),
          processes: (g.processes || []).map(p => ({
            ...emptyGroupProcess(),
            ...p,
            proc_key: Date.now() + Math.random(),
          }))
        })))
      } else if (record.lines?.length) {
        setGroups(reconstructGroups(record.lines))
      }
      
      if (record.hardware_items) setHardwareItems(record.hardware_items)
      if (record.labor_items) setLaborItems(record.labor_items)
      setGstMode(record.gst_mode || (record.is_inter_state ? 'igst' : 'cgst_sgst'))
    }
  }, [record, form])

  const dcCharges = Form.useWatch('dc_charges', form) || 0
  const discountAmt = Form.useWatch('discount_amount', form) || 0
  const advanceRec = Form.useWatch('advance_received', form) || 0
  const handlingCharges = Form.useWatch('handling_charges', form) || 0
  const otherCharges = Form.useWatch('other_charges', form) || 0
"""

new_s_content += "\n" + totals_block + "\n\n"

# The comp wizard method
comp_wizard_method = get_function(q_content, 'openComparisonWizard')
new_s_content += comp_wizard_method + "\n\n"

# Status changes, save mutation, and document creation mutations
# we can copy these from the existing SalesOrderForm.jsx
status_mutation_start = s_content.find('  const saveMutation =')
status_mutation_end = s_content.find('  const status = record?.status')
if status_mutation_start != -1 and status_mutation_end != -1:
    save_and_mutations = s_content[status_mutation_start:status_mutation_end]
else:
    print("Could not find mutations in SalesOrderForm!")
    save_and_mutations = ""

# Wait, handleSave needs to be modified for groups!
# Let's replace the handleSave inside save_and_mutations
handle_save_match = re.search(r'  const handleSave = async \(andNew = false\) => \{.*?\n  \}', save_and_mutations, re.DOTALL)
if handle_save_match:
    new_handle_save = """  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.order_date) values.order_date = values.order_date.format('YYYY-MM-DD')
      if (values.delivery_date) values.delivery_date = values.delivery_date.format('YYYY-MM-DD')
      
      values.lines = getFlatLines()
      values.groups = groups
      values.hardware_items = hardwareItems
      values.labor_items = laborItems
      values.subtotal = totals.subIII
      values.tax_amount = totals.cgst + totals.sgst + totals.igst
      values.total_amount = totals.grandTotal
      
      // Preserve crm_lead_id from existing record or URL
      if (!values.crm_lead_id && record?.crm_lead_id) {
        values.crm_lead_id = record.crm_lead_id
      }
      const soLeadId = new URLSearchParams(window.location.search).get('lead_id')
      if (!values.crm_lead_id && soLeadId) {
        values.crm_lead_id = parseInt(soLeadId)
      }

      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setGroups([emptyGroup()]); navigate('/sales-orders/new') }
    } catch (err) {}
  }"""
    save_and_mutations = save_and_mutations[:handle_save_match.start()] + new_handle_save + save_and_mutations[handle_save_match.end():]

# In createPOMutation, createDCMutation, createInvoiceMutation, we need to pass `getFlatLines()` instead of `lines`
save_and_mutations = save_and_mutations.replace('lines: lines.', 'lines: getFlatLines().')
save_and_mutations = save_and_mutations.replace('lines,', 'lines: getFlatLines(),')
save_and_mutations = save_and_mutations.replace('lines: lines.map(l => {', 'lines: getFlatLines().map(l => {')

new_s_content += save_and_mutations + "\n\n"

# The counts derivation and MasterForm opening
counts_derivation = """  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const soId = id ? parseInt(id) : null

  // Derive counts AND first linked record id from existing query data
  const poItems = Array.isArray(posData) ? posData : (posData?.items || [])
  const dcItems = Array.isArray(dcsData) ? dcsData : (dcsData?.items || [])
  const invItems = Array.isArray(invData) ? invData : (invData?.items || [])
  const woItems = Array.isArray(woData) ? woData : (woData?.items || [])

  const linkedPo  = poItems.find(p => p.so_id === soId)
  const linkedDc  = dcItems.find(d => d.so_id === soId)
  const linkedInv = invItems.find(i => i.so_id === soId)
  const linkedWo  = woItems.find(w => w.so_id === soId)

  const poCount       = poItems.filter(p => p.so_id === soId).length
  const deliveryCount = dcItems.filter(d => d.so_id === soId).length
  const invoiceCount  = invItems.filter(i => i.so_id === soId).length
  const woCount       = woItems.filter(w => w.so_id === soId).length
"""
new_s_content += counts_derivation + "\n\n"

# MasterForm opening from SalesOrderForm
masterform_start = s_content.find('  return (\n    <MasterForm')
masterform_end = s_content.find('        <Divider orientation="left" style={{ color: \'#3b82f6\' }}>Order Lines</Divider>')
if masterform_start != -1 and masterform_end != -1:
    mf_opening = s_content[masterform_start:masterform_end]
    # We need to change `lines` inside create workshop order button
    mf_opening = mf_opening.replace('lines.map(l => {', 'getFlatLines().map(l => {')
    mf_opening = mf_opening.replace('recordData.lines = lines', 'recordData.lines = getFlatLines()')
    new_s_content += mf_opening
else:
    print("Could not find MasterForm opening!")

# Now add the JSX for groups
new_s_content += """        <Divider orientation="left" style={{ color: '#3b82f6' }}>Order Lines</Divider>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Radio.Group value={unit} onChange={e => setSoUnit(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="inch">inch</Radio.Button>
              <Radio.Button value="mm">MM</Radio.Button>
            </Radio.Group>
            <Text type="secondary" style={{ fontSize: 11 }}>(Default: Inch)</Text>
          </Space>
        </div>\n"""

# Need to rename `unit` to `soUnit` inside jsx_groups_and_buttons
jsx_groups_and_buttons = jsx_groups_and_buttons.replace('unit ===', 'soUnit ===')

new_s_content += jsx_groups_and_buttons + "\n"

# Then the totals panel
new_s_content += """          <Col span={12}>
""" + totals_panel_jsx + "\n\n"

# Then the modal
new_s_content += modal_jsx + "\n\n"

# Finally close it
new_s_content += "}\n\nexport default SalesOrderForm\n"

with open('src/pages/sales/SalesOrderForm.jsx', 'w') as f:
    f.write(new_s_content)

print("SalesOrderForm updated!")
