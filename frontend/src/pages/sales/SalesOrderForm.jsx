import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, Badge, App } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, FileTextOutlined, CarOutlined, DollarOutlined, ToolOutlined, GiftOutlined, DownloadOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { salesOrderApi, customerApi, productApi, quotationApi, purchaseOrderApi, deliveryChallanApi, invoiceApi, warehouseApi } from '../../api'
import { generateSOPDF } from '../../utils/pdfGenerator'

const { TextArea } = Input

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' }, { value: '45_days', label: '45 Days' },
]

const PRICING_METHODS = [
  { value: 'per_sqft', label: 'Per Sqft' }, { value: 'per_running_ft', label: 'Per Running Ft' }, { value: 'per_piece', label: 'Per Piece' },
]

const STATUS_STEPS = ['draft', 'confirmed', 'in_production', 'ready', 'delivered']
const STATUS_IDX = { draft: 0, confirmed: 1, in_production: 2, ready: 3, delivered: 4, cancelled: 0 }

const emptyLine = () => ({
  key: Date.now() + Math.random(),
  product_id: null, description: '', width_mm: null, height_mm: null,
  cep: false, pricing_method: 'per_sqft', quantity: 1, uom_id: null, unit_price: 0, discount_pct: 0,
  tax_id: null, subtotal: 0, tax_amount: 0, line_total: 0,
})

const SalesOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState([emptyLine()])

  const { data: record, isLoading } = useQuery({
    queryKey: ['sales_orders', id], queryFn: () => salesOrderApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: quotations = [] } = useQuery({ queryKey: ['quotations-dd'], queryFn: () => quotationApi.dropdown().then(r => r.data) })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-dd'], queryFn: () => warehouseApi.dropdown().then(r => r.data) })

  // Smart Button counts
  const { data: posData } = useQuery({ queryKey: ['pos-so', id], queryFn: () => purchaseOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: dcsData } = useQuery({ queryKey: ['dcs-so', id], queryFn: () => deliveryChallanApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: invData } = useQuery({ queryKey: ['inv-so', id], queryFn: () => invoiceApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })

  useEffect(() => {
    if (!isEdit) {
      form.setFieldValue('order_date', dayjs())
    }
  }, [])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        order_date: record.order_date ? dayjs(record.order_date) : null,
        delivery_date: record.delivery_date ? dayjs(record.delivery_date) : null,
      })
      if (record.lines?.length) {
        setLines(record.lines.map((l, i) => ({ ...l, key: l.id || Date.now() + i })))
      }
    }
  }, [record, form])

  const recalcLine = (line, allProducts) => {
    const w = line.width_mm || 0; const h = line.height_mm || 0; const qty = line.quantity || 1
    const cep = Boolean(line.cep); const method = line.pricing_method || 'per_sqft'
    const area_sqft = (w * h) / 92903
    const charged_w = cep ? Math.ceil(w / 3) * 3 + 30 : Math.ceil(w / 3) * 3
    const charged_h = cep ? Math.ceil(h / 3) * 3 + 30 : Math.ceil(h / 3) * 3
    const charged_sqft = (charged_w * charged_h * qty) / 92903
    const running_ft = ((w + h + w + h) / 25.4 / 12) * qty

    let effective_qty = qty
    if (method === 'per_sqft') effective_qty = charged_sqft || area_sqft || qty
    if (method === 'per_running_ft') effective_qty = running_ft

    const sub = effective_qty * (line.unit_price || 0) * (1 - (line.discount_pct || 0) / 100)
    const prod = allProducts.find(p => p.id === line.product_id)
    const taxAmt = sub * (prod?.tax_rate || 18) / 100

    return { ...line, subtotal: parseFloat(sub.toFixed(2)), tax_amount: parseFloat(taxAmt.toFixed(2)), line_total: parseFloat((sub + taxAmt).toFixed(2)) }
  }

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.description = prod.name; updated.unit_price = prod.sale_price || 0
          updated.pricing_method = prod.uom_id === 3 ? 'per_running_ft' : prod.uom_id === 4 ? 'per_piece' : 'per_sqft'
        }
      }
      return recalcLine(updated, products)
    }))
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (key) => setLines(prev => prev.filter(l => l.key !== key))

  const dcCharges = Form.useWatch('dc_charges', form)
  const handlingCharges = Form.useWatch('handling_charges', form)
  const otherCharges = Form.useWatch('other_charges', form)

  const totals = useMemo(() => {
    const linesSub = lines.reduce((s, l) => s + (l.subtotal || 0), 0)
    const linesTax = lines.reduce((s, l) => s + (l.tax_amount || 0), 0)
    const extraTotal = (dcCharges || 0) + (handlingCharges || 0) + (otherCharges || 0)
    const extraTax = extraTotal * 0.18
    return { subtotal: linesSub + extraTotal, tax_amount: linesTax + extraTax, total_amount: linesSub + extraTotal + linesTax + extraTax }
  }, [lines, dcCharges, handlingCharges, otherCharges])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? salesOrderApi.update(id, data) : salesOrderApi.create(data),
    onSuccess: (res) => { message.success(`SO ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['sales_orders'] }); if (!isEdit && res?.data?.id) navigate(`/sales-orders/${res.data.id}/edit`) },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => salesOrderApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales_orders', id] }),
  })

  // Document creation actions
  const createPOMutation = useMutation({
    mutationFn: async () => {
      const poData = { so_id: parseInt(id), vendor_reference: record?.so_number, lines: lines.map(l => ({ ...l, unit_price: 0 })) }
      const res = await purchaseOrderApi.create(poData)
      return res.data
    },
    onSuccess: (data) => { message.success('PO Created'); navigate(`/purchase-orders/${data.id}/edit`) }
  })

  const createDCMutation = useMutation({
    mutationFn: async () => {
      const dcData = { so_id: parseInt(id), customer_id: record?.customer_id, lines: lines.map(l => ({ ...l, qty_dispatched: l.quantity })) }
      const res = await deliveryChallanApi.create(dcData)
      return res.data
    },
    onSuccess: (data) => { message.success('Delivery Challan Created'); navigate(`/delivery-challans/${data.id}/edit`) }
  })

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const invData = { so_id: parseInt(id), customer_id: record?.customer_id, lines, ...totals }
      const res = await invoiceApi.create(invData)
      return res.data
    },
    onSuccess: (data) => { message.success('Invoice Created'); navigate(`/invoices/${data.id}/edit`) }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.order_date) values.order_date = values.order_date.format('YYYY-MM-DD')
      if (values.delivery_date) values.delivery_date = values.delivery_date.format('YYYY-MM-DD')
      values.lines = lines; Object.assign(values, totals)
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setLines([emptyLine()]); navigate('/sales-orders/new') }
    } catch (err) {}
  }

  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const lineColumns = [
    { title: 'Product', width: 180, dataIndex: 'product_id', render: (v, row) => (
      <Select 
        size="small" 
        value={v} 
        style={{ width: '100%' }} 
        showSearch 
        options={products.map(p => ({ value: p.id, label: p.name }))} 
        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        onChange={val => updateLine(row.key, 'product_id', val)} 
      />
    )},
    { title: 'W(mm)', width: 80, dataIndex: 'width_mm', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'width_mm', val)} /> },
    { title: 'H(mm)', width: 80, dataIndex: 'height_mm', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'height_mm', val)} /> },
    { title: 'CEP', width: 60, dataIndex: 'cep', render: (v, row) => <Switch size="small" checked={v} onChange={val => updateLine(row.key, 'cep', val)} /> },
    { title: 'Qty', width: 70, dataIndex: 'quantity', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'quantity', val)} /> },
    { title: 'Price', width: 100, dataIndex: 'unit_price', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'unit_price', val)} /> },
    { title: 'Subtotal', width: 110, dataIndex: 'subtotal', render: v => <span style={{ fontWeight: 600 }}>{fmt(v)}</span> },
    { title: '', width: 40, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(row.key)} /> },
  ]

  return (
    <MasterForm title="Sales Order" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Orders', path: '/sales-orders' }, { label: isEdit ? record?.so_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/sales-orders')}>

      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          {record?.quotation_id && (
            <Button icon={<FileTextOutlined />} onClick={() => navigate(`/quotations/${record.quotation_id}/edit`)}>Quotation</Button>
          )}
          <Badge count={posData?.total || 0}><Button icon={<ShoppingCartOutlined />} onClick={() => navigate(`/purchase-orders?so_id=${id}`)}>Purchase Orders</Button></Badge>
          <Badge count={dcsData?.total || 0}><Button icon={<CarOutlined />} onClick={() => navigate(`/delivery-challans?so_id=${id}`)}>Deliveries</Button></Badge>
          <Badge count={invData?.total || 0}><Button icon={<DollarOutlined />} onClick={() => navigate(`/invoices?so_id=${id}`)}>Invoices</Button></Badge>
        </div>
      )}

      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.replace('_', ' ').toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={10} style={{ textAlign: 'right' }}>
          <Space wrap>
            {isEdit && (
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => {
                  const recordData = form.getFieldsValue()
                  recordData.lines = lines
                  recordData.so_number = record?.so_number
                  recordData.subtotal = totals.subtotal
                  recordData.tax_amount = totals.tax_amount
                  recordData.total_amount = totals.total_amount
                  generateSOPDF(recordData)
                }}
              >
                PDF
              </Button>
            )}
            {status === 'draft' && <>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => statusMutation.mutate('confirmed')} style={{ background: '#3b82f6' }}>Confirm Order</Button>
              <Button icon={<ShoppingCartOutlined />} onClick={() => createPOMutation.mutate()} style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>Create PO</Button>
            </>}
            {status === 'confirmed' && <Button type="primary" icon={<ToolOutlined />} onClick={() => statusMutation.mutate('in_production')} style={{ background: '#f59e0b' }}>Production</Button>}
            {status === 'in_production' && <Button type="primary" icon={<GiftOutlined />} onClick={() => statusMutation.mutate('ready')} style={{ background: '#a855f7' }}>Ready</Button>}
            {status === 'ready' && <>
              <Button type="primary" icon={<CarOutlined />} onClick={() => createDCMutation.mutate()} style={{ background: '#10b981' }}>Delivery</Button>
              <Button type="primary" icon={<DollarOutlined />} onClick={() => createInvoiceMutation.mutate()} style={{ background: '#3b82f6' }}>Invoice</Button>
            </>}
            {status === 'delivered' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ COMPLETED</Tag>}
            {status === 'cancelled' && <Tag color="red" style={{ padding: '6px 12px', fontSize: 14 }}>❌ CANCELLED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select 
                showSearch 
                placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))} 
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                onChange={(val) => {
                  const c = customers.find(x => x.id === val); if (c) form.setFieldsValue({ payment_terms: c.payment_terms })
                }} 
              />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="order_date" label="Order Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="delivery_date" label="Delivery Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="warehouse_id" label="Warehouse"><Select options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Form.Item></Col>
          <Col span={4}><Form.Item name="quotation_id" label="Quotation Ref"><Select options={quotations.map(q => ({ value: q.id, label: q.quote_number }))} allowClear /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#3b82f6' }}>Order Lines</Divider>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false} scroll={{ x: 1000 }} style={{ marginBottom: 8 }} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginBottom: 16 }}>Add Line</Button>

        <Row justify="end">
          <Col span={8}>
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Subtotal</Col><Col>{fmt(totals.subtotal)}</Col></Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Tax</Col><Col>{fmt(totals.tax_amount)}</Col></Row>
              <Divider style={{ margin: '12px 0' }} />
              <Row justify="space-between"><Col><b style={{ fontSize: 18 }}>Total</b></Col><Col><b style={{ fontSize: 18, color: '#16a34a' }}>{fmt(totals.total_amount)}</b></Col></Row>
            </div>
          </Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default SalesOrderForm
