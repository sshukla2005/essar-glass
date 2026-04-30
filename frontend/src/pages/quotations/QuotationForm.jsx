import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { quotationApi, customerApi, productApi, currencyApi, crmLeadApi } from '../../api'

const { TextArea } = Input

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' }, { value: '45_days', label: '45 Days' },
  { value: '60_days', label: '60 Days' }, { value: '90_days', label: '90 Days' },
]
const STATUS_STEPS = ['draft', 'sent', 'confirmed']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, cancelled: 0 }

const emptyLine = () => ({
  key: Date.now() + Math.random(),
  sequence: 10, product_id: null, description: '', width_mm: null, height_mm: null,
  area_sqft: null, quantity: 1, uom_id: null, unit_price: 0, discount_pct: 0,
  tax_id: null, subtotal: 0, tax_amount: 0, line_total: 0,
})

const QuotationForm = () => {
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
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies-dd'], queryFn: () => currencyApi.dropdown().then(r => r.data) })

  // Pre-fill from lead if coming from CRM
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
        currency_id: record.currency?.id || record.currency_id,
        crm_lead_id: record.crm_lead?.id || record.crm_lead_id,
        quote_date: record.quote_date ? dayjs(record.quote_date) : null,
        valid_until: record.valid_until ? dayjs(record.valid_until) : null,
      })
      if (record.lines?.length) {
        setLines(record.lines.map((l, i) => ({
          ...l, key: l.id || Date.now() + i,
          product_id: l.product?.id || l.product_id,
          uom_id: l.uom?.id || l.uom_id,
          tax_id: l.tax?.id || l.tax_id,
        })))
      }
    }
  }, [record])

  // Recalc line
  const recalcLine = (line, allProducts) => {
    const w = line.width_mm || 0, h = line.height_mm || 0
    const area = w > 0 && h > 0 ? (w * h) / 92903 : 0
    const effectiveQty = area > 0 ? area : (line.quantity || 1)
    const sub = effectiveQty * (line.unit_price || 0) * (1 - (line.discount_pct || 0) / 100)
    const prod = allProducts.find(p => p.id === line.tax_id)
    const taxRate = line._taxRate || 0
    const taxAmt = sub * taxRate / 100
    return { ...line, area_sqft: area > 0 ? parseFloat(area.toFixed(4)) : null, subtotal: parseFloat(sub.toFixed(2)), tax_amount: parseFloat(taxAmt.toFixed(2)), line_total: parseFloat((sub + taxAmt).toFixed(2)) }
  }

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.description = prod.name
          updated.unit_price = prod.sale_price || 0
          updated.uom_id = prod.uom_id || null
          updated.tax_id = prod.tax_id || null
        }
      }
      return recalcLine(updated, products)
    }))
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (key) => setLines(prev => prev.filter(l => l.key !== key))

  // Totals
  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + (l.subtotal || 0), 0)
    const tax = lines.reduce((s, l) => s + (l.tax_amount || 0), 0)
    const disc = lines.reduce((s, l) => {
      const effectiveQty = (l.area_sqft && l.area_sqft > 0) ? l.area_sqft : (l.quantity || 1)
      return s + effectiveQty * (l.unit_price || 0) * (l.discount_pct || 0) / 100
    }, 0)
    return { subtotal: sub, tax_amount: tax, discount_amount: disc, total_amount: sub + tax }
  }, [lines])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? quotationApi.update(id, data) : quotationApi.create(data),
    onSuccess: (res) => {
      message.success(`Quotation ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      // On create, redirect to the newly created quotation edit page
      if (!isEdit && res?.data?.id) {
        navigate(`/quotations/${res.data.id}/edit`)
      }
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => quotationApi.confirm(id),
    onSuccess: () => { message.success('Quotation confirmed'); queryClient.invalidateQueries({ queryKey: ['quotations', id] }) },
  })

  const cancelMutation = useMutation({
    mutationFn: () => quotationApi.cancel(id),
    onSuccess: () => { message.success('Quotation cancelled'); queryClient.invalidateQueries({ queryKey: ['quotations', id] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()

      // Convert dates
      if (values.quote_date) values.quote_date = values.quote_date.format('YYYY-MM-DD')
      if (values.valid_until) values.valid_until = values.valid_until.format('YYYY-MM-DD')

      // Attach lines and totals
      values.lines = lines.map(({ key, _taxRate, ...rest }) => rest)
      values.subtotal = totals.subtotal
      values.tax_amount = totals.tax_amount
      values.discount_amount = totals.discount_amount
      values.total_amount = totals.total_amount

      await saveMutation.mutateAsync(values)

      if (andNew) {
        form.resetFields()
        setLines([emptyLine()])
        navigate('/quotations/new')
      } else if (isEdit) {
        // stay on page — data refreshed by query invalidation
      }
      // if create (not andNew), onSuccess handles navigation to edit page
    } catch (err) {
      console.error('Save error:', err)
    }
  }

  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const lineColumns = [
    { title: '#', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Product', width: 200, dataIndex: 'product_id', render: (v, row) => (
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
    { title: 'Area(sqft)', width: 90, dataIndex: 'area_sqft', render: v => v ? v.toFixed(2) : '—' },
    { title: 'Qty', width: 70, dataIndex: 'quantity', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'quantity', val)} />
    )},
    { title: 'Price', width: 100, dataIndex: 'unit_price', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'unit_price', val)} />
    )},
    { title: 'Disc%', width: 70, dataIndex: 'discount_pct', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} max={100} style={{ width: '100%' }} onChange={val => updateLine(row.key, 'discount_pct', val)} />
    )},
    { title: 'Subtotal', width: 110, dataIndex: 'subtotal', render: v => fmt(v) },
    { title: '', width: 40, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(row.key)} /> },
  ]

  return (
    <MasterForm title="Quotation" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Quotations', path: '/quotations' }, { label: isEdit ? record?.quote_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/quotations')}>

      {/* Status bar */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Steps size="small" current={STATUS_IDX[status] || 0} style={{ maxWidth: 400 }}
          items={STATUS_STEPS.map(s => ({ title: s.charAt(0).toUpperCase() + s.slice(1) }))} />
        <Space>
          {status === 'draft' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => confirmMutation.mutate()}
            loading={confirmMutation.isPending} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Confirm</Button>}
          {status === 'confirmed' && <Popconfirm title="Cancel this quotation?" onConfirm={() => cancelMutation.mutate()}>
            <Button danger icon={<CloseCircleOutlined />} loading={cancelMutation.isPending}>Cancel</Button></Popconfirm>}
          {status === 'cancelled' && <Tag color="red">CANCELLED</Tag>}
        </Space>
      </div>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <Form.Item name="crm_lead_id" hidden><Input /></Form.Item>

        {/* Header */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                onChange={(val) => {
                  const c = customers.find(x => x.id === val)
                  if (c?.payment_terms) form.setFieldValue('payment_terms', c.payment_terms)
                }} />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="quote_date" label="Quote Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="valid_until" label="Valid Until"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="salesperson" label="Salesperson"><Input /></Form.Item></Col>
          <Col span={4}><Form.Item name="payment_terms" label="Payment Terms"><Select options={PAYMENT_TERMS} placeholder="Terms" /></Form.Item></Col>
        </Row>

        {/* Line items table */}
        <Divider orientation="left">Order Lines</Divider>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false}
          scroll={{ x: 1100 }} style={{ marginBottom: 8 }} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginBottom: 16 }}>Add Line</Button>

        {/* Totals */}
        <Row justify="end">
          <Col span={8}>
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
              <Row justify="space-between"><Col>Subtotal</Col><Col>{fmt(totals.subtotal)}</Col></Row>
              <Row justify="space-between"><Col>Discount</Col><Col>{fmt(totals.discount_amount)}</Col></Row>
              <Row justify="space-between"><Col>Tax</Col><Col>{fmt(totals.tax_amount)}</Col></Row>
              <Divider style={{ margin: '8px 0' }} />
              <Row justify="space-between"><Col><b style={{ fontSize: 16 }}>Total</b></Col><Col><b style={{ fontSize: 16 }}>{fmt(totals.total_amount)}</b></Col></Row>
            </div>
          </Col>
        </Row>

        <Divider />
        <Tabs size="large" items={[
          { key: 'cn', label: 'Customer Notes', children: <Form.Item name="customer_note"><TextArea rows={4} placeholder="Notes visible to customer..." /></Form.Item> },
          { key: 'in', label: 'Internal Notes', children: <Form.Item name="internal_notes"><TextArea rows={4} placeholder="Internal notes..." /></Form.Item> },
        ]} />
      </Form>
    </MasterForm>
  )
}

export default QuotationForm
