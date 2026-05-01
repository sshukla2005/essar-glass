import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, App } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, DownloadOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { quotationApi, customerApi, productApi, currencyApi, crmLeadApi, salesOrderApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'

const { TextArea } = Input

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' }, { value: '45_days', label: '45 Days' },
  { value: '60_days', label: '60 Days' }, { value: '90_days', label: '90 Days' },
]

const PRICING_METHODS = [
  { value: 'per_sqft', label: 'Per Sqft' },
  { value: 'per_running_ft', label: 'Per Running Ft' },
  { value: 'per_piece', label: 'Per Piece' },
]

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'converted']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, converted: 3, cancelled: 0 }

const emptyLine = () => ({
  key: Date.now() + Math.random(),
  sequence: 10, product_id: null, description: '', width_mm: null, height_mm: null,
  cep: false, pricing_method: 'per_sqft', quantity: 1, uom_id: null, unit_price: 0, discount_pct: 0,
  tax_id: null, area_sqft: null, charged_sqft: null, running_ft: null,
  subtotal: 0, tax_amount: 0, line_total: 0,
})

const QuotationForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState([emptyLine()])

  const { data: record, isLoading } = useQuery({
    queryKey: ['quotations', id], queryFn: () => quotationApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })

  // Pre-fill from lead
  useEffect(() => {
    if (!isEdit) {
      const leadId = searchParams.get('lead_id')
      const customerId = searchParams.get('customer_id')
      if (leadId) form.setFieldValue('crm_lead_id', parseInt(leadId))
      if (customerId) form.setFieldValue('customer_id', parseInt(customerId))
      form.setFieldValue('quote_date', dayjs())
      form.setFieldValue('valid_until', dayjs().add(30, 'day'))
    }
  }, [])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        customer_id: record.customer?.id || record.customer_id,
        crm_lead_id: record.crm_lead?.id || record.crm_lead_id,
        quote_date: record.quote_date ? dayjs(record.quote_date) : null,
        valid_until: record.valid_until ? dayjs(record.valid_until) : null,
      })
      if (record.lines?.length) {
        setLines(record.lines.map((l, i) => ({ ...l, key: l.id || Date.now() + i })))
      }
    }
  }, [record, form])

  // Recalc line with glass logic
  const recalcLine = (line, allProducts) => {
    const w = line.width_mm || 0
    const h = line.height_mm || 0
    const qty = line.quantity || 1
    const cep = Boolean(line.cep)
    const method = line.pricing_method || 'per_sqft'

    // Real area
    const area_sqft = (w * h) / 92903

    // Charged size (for CEP/toughened)
    const charged_w = cep ? Math.ceil(w / 3) * 3 + 30 : Math.ceil(w / 3) * 3
    const charged_h = cep ? Math.ceil(h / 3) * 3 + 30 : Math.ceil(h / 3) * 3
    const charged_sqft = (charged_w * charged_h * qty) / 92903

    // Running feet
    const running_ft = ((w + h + w + h) / 25.4 / 12) * qty

    // Effective Quantity based on method
    let effective_qty = qty
    if (method === 'per_sqft') effective_qty = charged_sqft || area_sqft || qty
    if (method === 'per_running_ft') effective_qty = running_ft
    if (method === 'per_piece') effective_qty = qty

    const sub = effective_qty * (line.unit_price || 0) * (1 - (line.discount_pct || 0) / 100)
    
    // Tax calc
    const prod = allProducts.find(p => p.id === line.product_id)
    const taxRate = prod?.tax_rate || line._taxRate || 18 // fallback
    const taxAmt = sub * taxRate / 100

    return {
      ...line,
      area_sqft: area_sqft > 0 ? parseFloat(area_sqft.toFixed(4)) : null,
      charged_sqft: charged_sqft > 0 ? parseFloat(charged_sqft.toFixed(4)) : null,
      running_ft: running_ft > 0 ? parseFloat(running_ft.toFixed(4)) : null,
      effective_qty: effective_qty > 0 ? parseFloat(effective_qty.toFixed(4)) : null,
      subtotal: parseFloat(sub.toFixed(2)),
      tax_amount: parseFloat(taxAmt.toFixed(2)),
      line_total: parseFloat((sub + taxAmt).toFixed(2))
    }
  }

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.description = `${prod.name} ${prod.glass_type ? prod.glass_type : ''} ${prod.thickness_mm ? prod.thickness_mm + 'mm' : ''}`.trim()
          updated.unit_price = prod.sale_price || 0
          updated.uom_id = prod.uom_id || null
          updated.tax_id = prod.tax_id || null
          // auto select pricing method based on UoM if needed
          if (prod.uom_id === 3) updated.pricing_method = 'per_running_ft'
          else if (prod.uom_id === 4) updated.pricing_method = 'per_piece'
          else updated.pricing_method = 'per_sqft'
        }
      }
      return recalcLine(updated, products)
    }))
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (key) => setLines(prev => prev.filter(l => l.key !== key))

  // Watch extra charges
  const extraDC = Form.useWatch('dc_charges', form) || 0
  const extraHandling = Form.useWatch('handling_charges', form) || 0
  const extraOther = Form.useWatch('other_charges', form) || 0
  const advanceReceived = Form.useWatch('advance_received', form) || 0

  // Totals
  const totals = useMemo(() => {
    const linesSub = lines.reduce((s, l) => s + (l.subtotal || 0), 0)
    const linesTax = lines.reduce((s, l) => s + (l.tax_amount || 0), 0)
    
    // extra charges are taxed at 18% standard for simplicity, or just added to subtotal
    const extraTotal = extraDC + extraHandling + extraOther
    const extraTax = extraTotal * 0.18

    const finalSub = linesSub + extraTotal
    const finalTax = linesTax + extraTax
    const finalTotal = finalSub + finalTax
    const balanceDue = finalTotal - advanceReceived

    return { subtotal: finalSub, tax_amount: finalTax, total_amount: finalTotal, balance_due: balanceDue }
  }, [lines, extraDC, extraHandling, extraOther, advanceReceived])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? quotationApi.update(id, data) : quotationApi.create(data),
    onSuccess: (res) => {
      message.success(`Quotation ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      if (!isEdit && res?.data?.id) navigate(`/quotations/${res.data.id}/edit`)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => quotationApi.confirm(id),
    onSuccess: () => { message.success('✅ Confirmed'); queryClient.invalidateQueries({ queryKey: ['quotations', id] }) },
  })

  const cancelMutation = useMutation({
    mutationFn: () => quotationApi.cancel(id),
    onSuccess: () => { message.success('❌ Cancelled'); queryClient.invalidateQueries({ queryKey: ['quotations', id] }) },
  })

  const convertMutation = useMutation({
    mutationFn: async () => {
      // Create SO
      const soData = {
        ...form.getFieldsValue(),
        lines: lines.map(({ key, ...rest }) => rest),
        quotation_id: parseInt(id),
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount,
        status: 'draft',
      }
      const res = await salesOrderApi.create(soData)
      await quotationApi.changeStatus(id, 'converted')
      return res.data
    },
    onSuccess: (data) => {
      message.success('Converted to Sales Order!')
      navigate(`/sales-orders/${data.id}/edit`)
    }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.quote_date) values.quote_date = values.quote_date.format('YYYY-MM-DD')
      if (values.valid_until) values.valid_until = values.valid_until.format('YYYY-MM-DD')

      values.lines = lines.map(({ key, ...rest }) => rest)
      values.subtotal = totals.subtotal
      values.tax_amount = totals.tax_amount
      values.total_amount = totals.total_amount
      values.balance_due = totals.balance_due

      await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        setLines([emptyLine()])
        navigate('/quotations/new')
      }
    } catch (err) {}
  }

  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const lineColumns = [
    { title: 'Product', width: 180, dataIndex: 'product_id', render: (v, row) => (
      <Select size="small" value={v} style={{ width: '100%' }} showSearch allowClear placeholder="Product"
        options={products.map(p => ({ value: p.id, label: p.name }))}
        filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
        onChange={(val) => updateLine(row.key, 'product_id', val)} />
    )},
    { title: 'Description', width: 160, dataIndex: 'description', render: (v, row) => (
      <Input size="small" value={v} onChange={e => updateLine(row.key, 'description', e.target.value)} />
    )},
    { title: 'W(mm)', width: 80, dataIndex: 'width_mm', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'width_mm', val)} />
    )},
    { title: 'H(mm)', width: 80, dataIndex: 'height_mm', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'height_mm', val)} />
    )},
    { title: 'CEP (Toughen)', width: 100, dataIndex: 'cep', align: 'center', render: (v, row) => (
      <Switch size="small" checked={v} onChange={val => updateLine(row.key, 'cep', val)} />
    )},
    { title: 'Qty', width: 70, dataIndex: 'quantity', render: (v, row) => (
      <InputNumber size="small" value={v} min={1} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'quantity', val)} />
    )},
    { title: 'Pricing Method', width: 120, dataIndex: 'pricing_method', render: (v, row) => (
      <Select size="small" value={v} options={PRICING_METHODS} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'pricing_method', val)} />
    )},
    { title: 'Eff. Qty', width: 80, dataIndex: 'effective_qty', render: v => v ? v.toFixed(2) : '—' },
    { title: 'Price', width: 100, dataIndex: 'unit_price', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'unit_price', val)} />
    )},
    { title: 'Subtotal', width: 110, dataIndex: 'subtotal', render: v => <span style={{ fontWeight: 600 }}>{fmt(v)}</span> },
    { title: '', width: 40, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(row.key)} /> },
  ]

  // Interlinking: Customer auto-fill
  const handleCustomerChange = (val) => {
    const c = customers.find(x => x.id === val)
    if (c) {
      form.setFieldsValue({
        payment_terms: c.payment_terms || 'immediate',
        delivery_address: c.address || '',
        salesperson: c.salesperson || ''
      })
    }
  }

  return (
    <MasterForm title="Quotation" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Sales' }, { label: 'Quotations', path: '/quotations' }, { label: isEdit ? record?.quote_number || 'Edit' : 'New' }]}
      onSave={status === 'converted' ? null : () => handleSave(false)} 
      onSaveNew={status === 'converted' ? null : () => handleSave(true)} 
      onDiscard={() => navigate('/quotations')}>

      {status === 'converted' && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#065f46', fontWeight: 500, fontSize: 16 }}>✅ This Quotation has been converted to Sales Order</span>
          <Button type="primary" onClick={() => navigate('/sales-orders')} style={{ background: '#10b981', borderColor: '#10b981' }}>View Sales Order →</Button>
        </div>
      )}

      {/* Top action row */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Steps size="small" current={STATUS_IDX[status] || 0} style={{ maxWidth: 500 }}
          items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        
        <Space>
          {isEdit && (
            <Button 
              icon={<DownloadOutlined />}
              onClick={() => {
                const recordData = form.getFieldsValue()
                recordData.lines = lines
                recordData.quote_number = record?.quote_number
                recordData.subtotal = totals.subtotal
                recordData.tax_amount = totals.tax_amount
                recordData.total_amount = totals.total_amount
                generateQuotationPDF(recordData)
              }}
            >
              Download PDF
            </Button>
          )}
          {status === 'draft' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => confirmMutation.mutate()}
            loading={confirmMutation.isPending} style={{ background: '#10b981', borderColor: '#10b981' }}>Confirm</Button>}
          {status === 'confirmed' && (
            <>
              <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => convertMutation.mutate()} loading={convertMutation.isPending} style={{ background: '#6366f1' }}>
                Convert to Sales Order
              </Button>
              <Popconfirm title="Cancel this quotation?" onConfirm={() => cancelMutation.mutate()}>
                <Button danger icon={<CloseCircleOutlined />} loading={cancelMutation.isPending}>Cancel</Button>
              </Popconfirm>
            </>
          )}
          {status === 'cancelled' && <Tag color="red" style={{ padding: '6px 12px', fontSize: 14 }}>❌ CANCELLED</Tag>}
        </Space>
      </div>

      <Form form={form} layout="vertical" disabled={status === 'converted'} initialValues={{ status: 'draft', dc_charges: 0, handling_charges: 0, other_charges: 0, advance_received: 0 }}>
        <Form.Item name="crm_lead_id" hidden><Input /></Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                onChange={handleCustomerChange} />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="quote_date" label="Quote Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="valid_until" label="Valid Until"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="salesperson" label="Salesperson"><Input /></Form.Item></Col>
          <Col span={4}><Form.Item name="payment_terms" label="Payment Terms"><Select options={PAYMENT_TERMS} placeholder="Terms" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="delivery_address" label="Delivery Address"><Input.TextArea rows={2} /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#6366f1' }}>Order Lines (Glass Calcs)</Divider>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false}
          scroll={{ x: 1200 }} style={{ marginBottom: 8 }} 
          rowClassName={() => 'hover-highlight'} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginBottom: 16 }}>Add Line</Button>

        <Row gutter={24}>
          <Col span={12}>
            <Tabs size="small" items={[
              { key: 'cn', label: 'Customer Notes', children: <Form.Item name="customer_note"><TextArea rows={4} placeholder="Notes visible to customer..." /></Form.Item> },
              { key: 'in', label: 'Internal Notes', children: <Form.Item name="internal_notes"><TextArea rows={4} placeholder="Internal notes..." /></Form.Item> },
            ]} />
          </Col>
          
          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Form.Item name="dc_charges" label="Delivery/Cutting Charges (D/C)" style={{ marginBottom: 8 }} labelCol={{ span: 14 }} wrapperCol={{ span: 10 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              <Form.Item name="handling_charges" label="Glass Handling Charges" style={{ marginBottom: 8 }} labelCol={{ span: 14 }} wrapperCol={{ span: 10 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              <Form.Item name="other_charges" label="Other Charges" style={{ marginBottom: 8 }} labelCol={{ span: 14 }} wrapperCol={{ span: 10 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Subtotal</Col><Col>{fmt(totals.subtotal)}</Col></Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Tax (18% Est.)</Col><Col>{fmt(totals.tax_amount)}</Col></Row>
              
              <Divider style={{ margin: '12px 0' }} />
              <Row justify="space-between" style={{ marginBottom: 16 }}><Col><b style={{ fontSize: 18, color: '#0f172a' }}>Grand Total</b></Col><Col><b style={{ fontSize: 18, color: '#16a34a' }}>{fmt(totals.total_amount)}</b></Col></Row>
              
              <Form.Item name="advance_received" label="Advance Received" style={{ marginBottom: 8 }} labelCol={{ span: 14 }} wrapperCol={{ span: 10 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              
              <Row justify="space-between" style={{ marginTop: 8 }}><Col><b style={{ fontSize: 16 }}>Balance Due</b></Col><Col><b style={{ fontSize: 16, color: totals.balance_due > 0 ? '#dc2626' : '#16a34a' }}>{fmt(totals.balance_due)}</b></Col></Row>
            </div>
          </Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default QuotationForm
