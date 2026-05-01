import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, DatePicker, Button, Table, Steps, Space, Tag, App } from 'antd'
import { PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined, InboxOutlined, DownloadOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { purchaseOrderApi, vendorApi, productApi, stockMovementApi } from '../../api'
import { generatePOPDF } from '../../utils/pdfGenerator'

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'received']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, received: 3, cancelled: 0 }

const emptyLine = () => ({ key: Date.now() + Math.random(), product_id: null, quantity: 1, unit_price: 0, subtotal: 0, tax_amount: 0 })

const PurchaseOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState([emptyLine()])

  const { data: record, isLoading } = useQuery({
    queryKey: ['purchase_orders', id], queryFn: () => purchaseOrderApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors-dd'], queryFn: () => vendorApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })

  useEffect(() => {
    if (!isEdit) form.setFieldValue('po_date', dayjs())
  }, [])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        po_date: record.po_date ? dayjs(record.po_date) : null,
        expected_delivery: record.expected_delivery ? dayjs(record.expected_delivery) : null,
      })
      if (record.lines?.length) setLines(record.lines.map((l, i) => ({ ...l, key: l.id || Date.now() + i })))
    }
  }, [record, form])

  const recalcLine = (line, allProducts) => {
    const qty = line.quantity || 1
    const sub = qty * (line.unit_price || 0)
    const prod = allProducts.find(p => p.id === line.product_id)
    const taxAmt = sub * (prod?.tax_rate || 18) / 100
    return { ...line, subtotal: parseFloat(sub.toFixed(2)), tax_amount: parseFloat(taxAmt.toFixed(2)) }
  }

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) { updated.description = prod.name; updated.unit_price = prod.cost_price || 0 }
      }
      return recalcLine(updated, products)
    }))
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.subtotal || 0), 0)
    const tax_amount = lines.reduce((s, l) => s + (l.tax_amount || 0), 0)
    return { subtotal, tax_amount, total_amount: subtotal + tax_amount }
  }, [lines])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? purchaseOrderApi.update(id, data) : purchaseOrderApi.create(data),
    onSuccess: (res) => { message.success(`PO ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['purchase_orders'] }); if (!isEdit && res?.data?.id) navigate(`/purchase-orders/${res.data.id}/edit`) },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => purchaseOrderApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase_orders', id] }),
  })

  const receiveMutation = useMutation({
    mutationFn: async () => {
      // Create stock movements for each line
      for (const line of lines) {
        if (line.product_id) {
          await stockMovementApi.create({
            product_id: line.product_id, quantity: line.quantity, movement_type: 'in',
            po_id: parseInt(id), reference: record?.po_number, date: new Date().toISOString()
          })
          // LocalStorage API doesn't auto-update product qty, we would need to manually do it,
          // but we can just assume the stock_movements list will be used to calc on_hand.
        }
      }
      await purchaseOrderApi.changeStatus(id, 'received')
    },
    onSuccess: () => { message.success('Stock updated for all products'); queryClient.invalidateQueries({ queryKey: ['purchase_orders', id] }) }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.po_date) values.po_date = values.po_date.format('YYYY-MM-DD')
      if (values.expected_delivery) values.expected_delivery = values.expected_delivery.format('YYYY-MM-DD')
      values.lines = lines; Object.assign(values, totals)
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setLines([emptyLine()]); navigate('/purchase-orders/new') }
    } catch (err) {}
  }

  const status = record?.status || 'draft'

  const lineColumns = [
    { title: 'Product', width: 200, dataIndex: 'product_id', render: (v, row) => (
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
    { title: 'Description', width: 200, dataIndex: 'description', render: (v, row) => <Input size="small" value={v} onChange={e => updateLine(row.key, 'description', e.target.value)} /> },
    { title: 'Qty', width: 100, dataIndex: 'quantity', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'quantity', val)} /> },
    { title: 'Unit Cost', width: 120, dataIndex: 'unit_price', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'unit_price', val)} /> },
    { title: 'Subtotal', width: 120, dataIndex: 'subtotal', render: v => <b>₹ {Number(v||0).toLocaleString()}</b> },
    { title: '', width: 40, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter(l => l.key !== row.key))} /> },
  ]

  return (
    <MasterForm title="Purchase Order" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Orders', path: '/purchase-orders' }, { label: isEdit ? record?.po_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/purchase-orders')}>

      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            {isEdit && (
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => {
                  const recordData = form.getFieldsValue()
                  recordData.lines = lines
                  recordData.po_number = record?.po_number
                  recordData.subtotal = totals.subtotal
                  recordData.tax_amount = totals.tax_amount
                  recordData.total_amount = totals.total_amount
                  generatePOPDF(recordData)
                }}
              >
                PDF
              </Button>
            )}
            {status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={() => statusMutation.mutate('sent')} style={{ background: '#3b82f6' }}>Send to Vendor</Button>}
            {status === 'sent' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => statusMutation.mutate('confirmed')} style={{ background: '#f59e0b' }}>Confirm Receipt</Button>}
            {status === 'confirmed' && <Button type="primary" icon={<InboxOutlined />} onClick={() => receiveMutation.mutate()} style={{ background: '#10b981' }}>Mark Received</Button>}
            {status === 'received' && <Tag color="green">✅ RECEIVED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true }]}>
              <Select 
                showSearch 
                options={vendors.map(v => ({ value: v.id, label: v.name }))} 
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="po_date" label="Order Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="expected_delivery" label="Expected Delivery"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="vendor_reference" label="Vendor Ref / SO #"><Input /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#f59e0b' }}>Order Lines</Divider>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false} scroll={{ x: 800 }} style={{ marginBottom: 8 }} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setLines([...lines, emptyLine()])} style={{ marginBottom: 16 }}>Add Line</Button>

        <Row justify="end">
          <Col span={8}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 8 }}>
              <Row justify="space-between"><span>Subtotal</span><span>₹ {totals.subtotal.toLocaleString()}</span></Row>
              <Row justify="space-between"><span>Tax</span><span>₹ {totals.tax_amount.toLocaleString()}</span></Row>
              <Divider style={{ margin: '8px 0' }} />
              <Row justify="space-between"><b style={{ fontSize: 18 }}>Total</b><b style={{ fontSize: 18, color: '#16a34a' }}>₹ {totals.total_amount.toLocaleString()}</b></Row>
            </div>
          </Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default PurchaseOrderForm
