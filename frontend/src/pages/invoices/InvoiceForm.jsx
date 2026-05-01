import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, Badge, Modal, App } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, SendOutlined, DollarOutlined, CarOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { invoiceApi, customerApi, productApi, salesOrderApi, deliveryChallanApi, paymentApi } from '../../api'

const PAYMENT_TERMS = [{ value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' }, { value: '30_days', label: '30 Days' }]
const PAYMENT_MODES = [{ value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'neft', label: 'NEFT/RTGS' }, { value: 'upi', label: 'UPI' }]

const STATUS_STEPS = ['draft', 'sent', 'paid']
const STATUS_IDX = { draft: 0, sent: 1, paid: 2, cancelled: 0 }

const emptyLine = () => ({ key: Date.now() + Math.random(), product_id: null, quantity: 1, unit_price: 0, subtotal: 0, tax_amount: 0 })

const InvoiceForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const [paymentForm] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState([emptyLine()])
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  const { data: record, isLoading } = useQuery({ queryKey: ['invoices', id], queryFn: () => invoiceApi.get(id).then(r => r.data), enabled: isEdit })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: sos = [] } = useQuery({ queryKey: ['sales_orders-dd'], queryFn: () => salesOrderApi.dropdown().then(r => r.data) })
  const { data: dcs = [] } = useQuery({ queryKey: ['delivery_challans-dd'], queryFn: () => deliveryChallanApi.dropdown().then(r => r.data) })
  const { data: paymentsData } = useQuery({ queryKey: ['payments-inv', id], queryFn: () => paymentApi.list({ invoice_id: id }).then(r => r.data), enabled: isEdit })

  useEffect(() => { if (!isEdit) { form.setFieldValue('invoice_date', dayjs()); form.setFieldValue('due_date', dayjs().add(30, 'day')) } }, [])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({ ...record, invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null, due_date: record.due_date ? dayjs(record.due_date) : null })
      if (record.lines?.length) setLines(record.lines.map((l, i) => ({ ...l, key: l.id || Date.now() + i })))
    }
  }, [record, form])

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) { updated.description = prod.name; updated.unit_price = prod.sale_price || 0 }
      }
      const qty = updated.quantity || 1; const sub = qty * (updated.unit_price || 0)
      const prod = products.find(p => p.id === updated.product_id)
      const taxAmt = sub * (prod?.tax_rate || 18) / 100
      return { ...updated, subtotal: parseFloat(sub.toFixed(2)), tax_amount: parseFloat(taxAmt.toFixed(2)) }
    }))
  }

  const isIgstWatch = Form.useWatch('is_igst', form)

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.subtotal || 0), 0)
    const extraCharges = (record?.dc_charges || 0) + (record?.handling_charges || 0) + (record?.other_charges || 0)
    const finalSub = subtotal + extraCharges
    const cgst = finalSub * 0.09; const sgst = finalSub * 0.09
    const isIgst = isIgstWatch
    const tax_amount = isIgst ? cgst + sgst : cgst + sgst
    const total_amount = finalSub + tax_amount
    const amount_paid = paymentsData?.items?.reduce((s, p) => s + (p.amount || 0), 0) || 0
    const balance_due = total_amount - amount_paid
    return { subtotal: finalSub, cgst, sgst, igst: cgst + sgst, total_amount, amount_paid, balance_due, isIgst }
  }, [lines, paymentsData, record, isIgstWatch])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? invoiceApi.update(id, data) : invoiceApi.create(data),
    onSuccess: (res) => { message.success(`Invoice ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['invoices'] }); if (!isEdit && res?.data?.id) navigate(`/invoices/${res.data.id}/edit`) },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => invoiceApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', id] }),
  })

  const paymentMutation = useMutation({
    mutationFn: async (values) => {
      await paymentApi.create({ ...values, invoice_id: parseInt(id), customer_id: record?.customer_id, payment_date: values.payment_date.format('YYYY-MM-DD') })
      const newPaid = totals.amount_paid + values.amount
      const newBal = totals.total_amount - newPaid
      await invoiceApi.update(id, { amount_paid: newPaid, balance_due: newBal })
      if (newBal <= 0) await invoiceApi.changeStatus(id, 'paid')
    },
    onSuccess: () => { message.success('Payment recorded'); setPaymentModalOpen(false); queryClient.invalidateQueries({ queryKey: ['invoices', id] }); queryClient.invalidateQueries({ queryKey: ['payments-inv', id] }) }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.invoice_date) values.invoice_date = values.invoice_date.format('YYYY-MM-DD')
      if (values.due_date) values.due_date = values.due_date.format('YYYY-MM-DD')
      values.lines = lines; Object.assign(values, totals)
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setLines([emptyLine()]); navigate('/invoices/new') }
    } catch (err) {}
  }

  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const lineColumns = [
    { title: 'Product', width: 200, dataIndex: 'product_id', render: (v, row) => <Select size="small" value={v} style={{ width: '100%' }} showSearch options={products} onChange={val => updateLine(row.key, 'product_id', val)} /> },
    { title: 'Description', width: 200, dataIndex: 'description', render: (v, row) => <Input size="small" value={v} onChange={e => updateLine(row.key, 'description', e.target.value)} /> },
    { title: 'Qty', width: 80, dataIndex: 'quantity', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'quantity', val)} /> },
    { title: 'Unit Price', width: 120, dataIndex: 'unit_price', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'unit_price', val)} /> },
    { title: 'Subtotal', width: 120, dataIndex: 'subtotal', render: v => <b>{fmt(v)}</b> },
    { title: '', width: 40, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter(l => l.key !== row.key))} /> },
  ]

  return (
    <MasterForm title="Invoice" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Sales' }, { label: 'Invoices', path: '/invoices' }, { label: isEdit ? record?.invoice_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/invoices')}>

      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          {record?.so_id && <Button icon={<FileTextOutlined />} onClick={() => navigate(`/sales-orders/${record.so_id}/edit`)}>Sales Order</Button>}
          {record?.dc_id && <Button icon={<CarOutlined />} onClick={() => navigate(`/delivery-challans/${record.dc_id}/edit`)}>Delivery</Button>}
          <Badge count={paymentsData?.total || 0}><Button icon={<DollarOutlined />}>Payments</Button></Badge>
        </div>
      )}

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Steps size="small" current={STATUS_IDX[status] || 0} style={{ maxWidth: 400 }} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        <Space>
          {status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={() => statusMutation.mutate('sent')} style={{ background: '#3b82f6' }}>Send / Print</Button>}
          {['draft', 'sent'].includes(status) && isEdit && <Button type="primary" icon={<DollarOutlined />} onClick={() => { paymentForm.setFieldsValue({ amount: totals.balance_due, payment_date: dayjs(), payment_mode: 'neft' }); setPaymentModalOpen(true) }} style={{ background: '#10b981' }}>Record Payment</Button>}
          {status === 'paid' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ PAID</Tag>}
        </Space>
      </div>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft', is_igst: false }}>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}><Select showSearch options={customers} /></Form.Item></Col>
          <Col span={4}><Form.Item name="invoice_date" label="Invoice Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="due_date" label="Due Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="payment_terms" label="Terms"><Select options={PAYMENT_TERMS} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="so_id" label="SO Ref"><Select options={sos} allowClear /></Form.Item></Col>
          <Col span={6}><Form.Item name="dc_id" label="DC Ref"><Select options={dcs} allowClear /></Form.Item></Col>
          <Col span={6}><Form.Item name="is_igst" label="Use IGST (Inter-state)" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#3b82f6' }}>Invoice Lines</Divider>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false} scroll={{ x: 800 }} style={{ marginBottom: 8 }} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setLines([...lines, emptyLine()])} style={{ marginBottom: 16 }}>Add Line</Button>

        <Row justify="end">
          <Col span={10}>
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Subtotal (Taxable)</Col><Col>{fmt(totals.subtotal)}</Col></Row>
              {!totals.isIgst ? (
                <>
                  <Row justify="space-between" style={{ marginBottom: 4 }}><Col>CGST 9%</Col><Col>{fmt(totals.cgst)}</Col></Row>
                  <Row justify="space-between" style={{ marginBottom: 8 }}><Col>SGST 9%</Col><Col>{fmt(totals.sgst)}</Col></Row>
                </>
              ) : (
                <Row justify="space-between" style={{ marginBottom: 8 }}><Col>IGST 18%</Col><Col>{fmt(totals.igst)}</Col></Row>
              )}
              
              <Divider style={{ margin: '12px 0' }} />
              <Row justify="space-between" style={{ marginBottom: 16 }}><Col><b style={{ fontSize: 18, color: '#0f172a' }}>Grand Total</b></Col><Col><b style={{ fontSize: 18, color: '#0f172a' }}>{fmt(totals.total_amount)}</b></Col></Row>
              
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col style={{ color: '#16a34a' }}>Amount Paid</Col><Col style={{ color: '#16a34a' }}>{fmt(totals.amount_paid)}</Col></Row>
              <Row justify="space-between" style={{ marginTop: 8 }}><Col><b style={{ fontSize: 16 }}>Balance Due</b></Col><Col><b style={{ fontSize: 16, color: totals.balance_due > 0 ? '#dc2626' : '#16a34a' }}>{fmt(totals.balance_due)}</b></Col></Row>
            </div>
          </Col>
        </Row>
      </Form>

      <Modal title="Record Payment" open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} onOk={() => paymentForm.submit()} confirmLoading={paymentMutation.isPending}>
        <Form form={paymentForm} layout="vertical" onFinish={paymentMutation.mutate}>
          <Form.Item name="amount" label="Amount Received" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} prefix="₹" /></Form.Item>
          <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="payment_mode" label="Payment Mode" rules={[{ required: true }]}><Select options={PAYMENT_MODES} /></Form.Item>
          <Form.Item name="reference" label="Reference (Cheque No / UTR)"><Input /></Form.Item>
        </Form>
      </Modal>
    </MasterForm>
  )
}

export default InvoiceForm
