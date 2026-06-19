import React, { useEffect, useMemo, useState } from 'react'
import {
  Form, Input, InputNumber, Select, Row, Col, Divider,
  DatePicker, Button, Table, Steps, Space, Tag, Switch,
  App, Typography, Modal, Radio, Tabs
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SendOutlined,
  DollarOutlined, CarOutlined, FileTextOutlined
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import {
  invoiceApi, customerApi, productApi,
  salesOrderApi, deliveryChallanApi, paymentApi
} from '../../api'
import CompanySelector from '../../components/common/CompanySelector'
import { settingsApi } from '../../api/settingsApi'

const { TextArea } = Input
const { Text } = Typography

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '15_days',   label: '15 Days' },
  { value: '30_days',   label: '30 Days' },
  { value: '45_days',   label: '45 Days' },
]

const PAYMENT_MODES = [
  { value: 'cash',   label: '💵 Cash' },
  { value: 'upi',    label: '📱 UPI' },
  { value: 'neft',   label: '🏦 NEFT/RTGS' },
  { value: 'cheque', label: '📝 Cheque' },
  { value: 'card',   label: '💳 Card' },
]

const STATUS_STEPS = ['draft', 'sent', 'paid']
const STATUS_IDX   = { draft: 0, sent: 1, paid: 2, cancelled: 0 }

const emptyLine = () => ({
  key:         Date.now() + Math.random(),
  product_id:  null,
  description: '',
  hsn_code:    '',
  quantity:    1,
  unit_price:  0,
  amount:      0,
})

const fmt = (v) =>
  '₹ ' + Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

// ─────────────────────────────────────────────────────────────
const InvoiceForm = () => {
  const { message } = App.useApp()
  const { id }      = useParams()
  const [searchParams] = useSearchParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const [payForm]   = Form.useForm()
  const navigate    = useNavigate()
  const qc          = useQueryClient()

  const [lines,          setLines]          = useState([emptyLine()])
  const [gstMode,        setGstMode]        = useState('cgst_sgst')
  const [payModal,       setPayModal]       = useState(false)
  const [payAccounts,    setPayAccounts]    = useState([])
  const [payMode,        setPayMode]        = useState('cash')
  const [soLoaded,       setSoLoaded]       = useState(false)
  const [discountAmt,    setDiscountAmt]    = useState(0)
  const [dcCharges,      setDcCharges]      = useState(0)
  const [advanceReceived, setAdvanceReceived] = useState(0)
  const [customerNotes,  setCustomerNotes]  = useState('')

  // ── Queries ────────────────────────────────────────────────
  const { data: record, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn:  () => invoiceApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  const { data: customersRaw } = useQuery({
    queryKey: ['customers-dd'],
    queryFn:  () => customerApi.dropdown().then(r => r.data),
  })
  const customers = Array.isArray(customersRaw)
    ? customersRaw : (customersRaw?.items || [])

  const { data: productsRaw } = useQuery({
    queryKey: ['products-dd'],
    queryFn:  () => productApi.dropdown().then(r => r.data),
  })
  const products = Array.isArray(productsRaw)
    ? productsRaw : (productsRaw?.items || [])

  const { data: sosRaw } = useQuery({
    queryKey: ['sales_orders-list-inv'],
    queryFn:  () => salesOrderApi.list({ page: 1, page_size: 500 }).then(r => r.data),
  })
  const sosList = sosRaw?.items || []

  const { data: dcsRaw } = useQuery({
    queryKey: ['dcs-dd'],
    queryFn:  () => deliveryChallanApi.dropdown().then(r => r.data),
  })
  const dcsList = Array.isArray(dcsRaw) ? dcsRaw : (dcsRaw?.items || [])

  const { data: paymentsRaw, refetch: refetchPayments } = useQuery({
    queryKey: ['payments-inv', id],
    queryFn:  () => paymentApi.list({ customer_id: record?.customer_id, page: 1, page_size: 200 }).then(r => r.data),
    enabled:  isEdit && Boolean(record?.customer_id),
  })
  const payments = paymentsRaw?.items || []

  // Load payment accounts from settings
  useEffect(() => {
    settingsApi.get('payment_accounts').then(data => {
      if (data && Array.isArray(data)) setPayAccounts(data)
    }).catch(() => {})
  }, [])

  // ── Defaults for new invoice ───────────────────────────────
  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({
        invoice_date: dayjs(),
        due_date:     dayjs().add(30, 'day'),
      })
    }
  }, [])

  // ── Load SO from query param ───────────────────────────────
  useEffect(() => {
    if (isEdit || soLoaded) return
    const soIdParam = searchParams.get('so_id')
    if (!soIdParam || !sosList.length) return
    setSoLoaded(true)
    loadFromSO(parseInt(soIdParam))
  }, [searchParams, sosList, isEdit, soLoaded])

  // ── Load existing record ───────────────────────────────────
  useEffect(() => {
    if (!record) return
    form.setFieldsValue({
      ...record,
      invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null,
      due_date:     record.due_date     ? dayjs(record.due_date)     : null,
    })
    if (record.lines?.length) {
      setLines(record.lines.map((l, i) => ({
        ...emptyLine(),
        ...l,
        key: l.id || Date.now() + i,
      })))
    }
    setGstMode(record.gst_mode || (record.is_inter_state ? 'igst' : 'cgst_sgst'))
    setDiscountAmt(record.discount_amount || 0)
    setDcCharges(record.dc_charges || 0)
    setAdvanceReceived(record.advance_received || 0)
    setCustomerNotes(record.customer_notes || '')
  }, [record, form])

  // ── Load from SO ───────────────────────────────────────────
  const loadFromSO = async (soId) => {
    try {
      const res = await salesOrderApi.get(soId)
      const so  = res.data

      form.setFieldsValue({
        customer_id:   so.customer_id,
        so_id:         soId,
        payment_terms: so.payment_terms,
        gst_mode:      so.gst_mode || 'cgst_sgst',
      })
      setGstMode(so.gst_mode || 'cgst_sgst')

      const newLines = []

      // ── Glass groups → one line per group ──────────────────
      if (so.groups?.length) {
        so.groups.forEach(group => {
          const totalQty    = (group.sizes || []).reduce((s, sz) => s + (sz.quantity || 1), 0)
          const totalAmount = (group.sizes || []).reduce((s, sz) => s + (sz.subtotal  || 0), 0)
          const totalSqft   = (group.sizes || []).reduce((s, sz) => s + (sz.total_sqft || 0), 0)

          // Get HSN from product master
          const prod   = products.find(p => p.id === group.product_id)
          const hsn    = prod?.hsn_code || '7007'

          newLines.push({
            key:         Date.now() + Math.random(),
            product_id:  group.product_id || null,
            description: group.description || '',
            hsn_code:    hsn,
            quantity:    parseFloat(totalSqft.toFixed(3)),
            unit:        'sqft',
            unit_price:  group.rate || 0,
            amount:      parseFloat(totalAmount.toFixed(2)),
          })
        })
      } else if (so.lines?.length) {
        // Fallback: flat lines grouped by description
        const grouped = new Map()
        so.lines.forEach(line => {
          const key = line.description || line.product_id || 'misc'
          if (!grouped.has(key)) {
            grouped.set(key, {
              product_id:  line.product_id,
              description: line.description || '',
              hsn_code:    products.find(p => p.id === line.product_id)?.hsn_code || '7007',
              quantity:    0,
              unit_price:  line.rate || line.unit_price || 0,
              amount:      0,
            })
          }
          const g = grouped.get(key)
          g.quantity += line.total_sqft || line.quantity || 1
          g.amount   += line.subtotal || 0
        })
        grouped.forEach(g => {
          newLines.push({
            key:      Date.now() + Math.random(),
            ...g,
            quantity: parseFloat((g.quantity || 0).toFixed(3)),
            amount:   parseFloat((g.amount   || 0).toFixed(2)),
          })
        })
      }

      // ── Hardware items ──────────────────────────────────────
      if (so.hardware_items?.length) {
        so.hardware_items.forEach(hw => {
          if (!hw.amount && !hw.description) return
          newLines.push({
            key:         Date.now() + Math.random(),
            product_id:  null,
            description: hw.description || 'Hardware',
            hsn_code:    '',
            quantity:    hw.qty || 1,
            unit:        hw.uom || 'pcs',
            unit_price:  hw.rate || 0,
            amount:      parseFloat((hw.amount || 0).toFixed(2)),
          })
        })
      }

      // ── Labor items ─────────────────────────────────────────
      if (so.labor_items?.length) {
        so.labor_items.forEach(lb => {
          if (!lb.amount && !lb.description) return
          newLines.push({
            key:         Date.now() + Math.random(),
            product_id:  null,
            description: lb.description || 'Labour',
            hsn_code:    '9987',
            quantity:    lb.qty || 1,
            unit:        lb.uom || 'job',
            unit_price:  lb.rate || 0,
            amount:      parseFloat((lb.amount || 0).toFixed(2)),
          })
        })
      }

      // ── Process charges ─────────────────────────────────────
      const allProcesses = [
        ...(so.groups || []).flatMap(g => g.processes || []),
        ...(so.groups || []).flatMap(g =>
          (g.sizes || []).flatMap(s => s.size_processes || [])
        ),
      ]
      if (allProcesses.length) {
        const procTotal = allProcesses.reduce((s, p) => s + (p.amount || 0), 0)
        if (procTotal > 0) {
          newLines.push({
            key:         Date.now() + Math.random(),
            product_id:  null,
            description: 'Process Charges (Cutting / Holes / Farma etc.)',
            hsn_code:    '7007',
            quantity:    1,
            unit:        'job',
            unit_price:  parseFloat(procTotal.toFixed(2)),
            amount:      parseFloat(procTotal.toFixed(2)),
          })
        }
      }

      // ── DC charges ──────────────────────────────────────────
      const dcAmt = so.dc_charges || so.totals?.dcCharges || 0
      if (dcAmt > 0) {
        newLines.push({
          key:         Date.now() + Math.random(),
          product_id:  null,
          description: 'Delivery / Transport Charges',
          hsn_code:    '9965',
          quantity:    1,
          unit:        'job',
          unit_price:  dcAmt,
          amount:      dcAmt,
        })
      }

      if (newLines.length > 0) setLines(newLines)

    } catch (e) {
      console.error('Failed to load SO:', e)
      message.error('Failed to load Sales Order data')
    }
  }

  // ── Totals ─────────────────────────────────────────────────
  const totals = useMemo(() => {
    const taxable = lines.reduce((s, l) => s + (l.amount || 0), 0)
    const afterDiscount = Math.max(0, taxable - (discountAmt || 0))
    const afterDc = afterDiscount + (dcCharges || 0)

    let cgst = 0, sgst = 0, igst = 0
    if (gstMode === 'cgst_sgst') {
      cgst = parseFloat((afterDc * 0.09).toFixed(2))
      sgst = parseFloat((afterDc * 0.09).toFixed(2))
    } else if (gstMode === 'igst') {
      igst = parseFloat((afterDc * 0.18).toFixed(2))
    }

    const grandTotal   = parseFloat((afterDc + cgst + sgst + igst).toFixed(2))
    const amountPaid   = payments
      .filter(p => p.is_active !== false)
      .reduce((s, p) => s + (p.amount || 0), 0)
    const balanceDue   = parseFloat((grandTotal - amountPaid).toFixed(2))

    return {
      taxable: parseFloat(taxable.toFixed(2)),
      discount: discountAmt || 0,
      afterDiscount: parseFloat(afterDiscount.toFixed(2)),
      dcCharges: dcCharges || 0,
      afterDc: parseFloat(afterDc.toFixed(2)),
      cgst, sgst, igst,
      grandTotal,
      amountPaid: parseFloat(amountPaid.toFixed(2)),
      balanceDue,
    }
  }, [lines, gstMode, discountAmt, dcCharges, payments])

  // ── Update line ────────────────────────────────────────────
  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }

      // Product selected → pull description + HSN + price
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.description = prod.name  || updated.description
          updated.hsn_code    = prod.hsn_code || ''
          updated.unit_price  = prod.sale_price || 0
          updated.amount      = parseFloat(((updated.quantity || 1) * (prod.sale_price || 0)).toFixed(2))
        }
      }

      // Qty or price changed → recalc amount
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = parseFloat(
          ((updated.quantity || 0) * (updated.unit_price || 0)).toFixed(2)
        )
      }

      // Amount directly edited → keep as-is (manual override)

      return updated
    }))
  }

  // ── Save ───────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? invoiceApi.update(id, data)
      : invoiceApi.create(data),
    onSuccess: (res) => {
      message.success(`Invoice ${isEdit ? 'updated' : 'created'}`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      if (!isEdit && res?.data?.id) navigate(`/invoices/${res.data.id}/edit`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (s) => invoiceApi.changeStatus(id, s),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['invoices', id] }),
  })

  // ── Payment save ───────────────────────────────────────────
  const paymentMutation = useMutation({
    mutationFn: async (values) => {
      // Build payment_account string
      let payAccount = null
      if (values.payment_mode === 'upi'  && values.upi_account)  payAccount = values.upi_account
      if (values.payment_mode === 'neft' && values.neft_account) payAccount = values.neft_account

      await paymentApi.create({
        customer_id:       record?.customer_id,
        so_id:             form.getFieldValue('so_id') || null,
        amount:            values.amount,
        payment_mode:      values.payment_mode,
        payment_account:   payAccount,
        payment_reference: values.reference || null,
        payment_date:      values.payment_date
          ? values.payment_date.format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        notes:             values.notes || null,
        company_id:        record?.company_id,
      })
    },
    onSuccess: () => {
      message.success('✅ Payment recorded!')
      setPayModal(false)
      payForm.resetFields()
      setPayMode('cash')
      qc.invalidateQueries({ queryKey: ['payments-inv', id] })
      qc.invalidateQueries({ queryKey: ['receivables-summary'] })
      qc.invalidateQueries({ queryKey: ['receivables-customers'] })
      qc.invalidateQueries({ queryKey: ['customer-ledger', String(record?.customer_id)] })
      refetchPayments()
    },
    onError: () => message.error('Failed to record payment'),
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.invoice_date) values.invoice_date = values.invoice_date.format('YYYY-MM-DD')
      if (values.due_date)     values.due_date     = values.due_date.format('YYYY-MM-DD')

      values.lines           = lines
      values.gst_mode        = gstMode
      values.is_inter_state  = gstMode === 'igst'
      values.discount_amount = discountAmt
      values.dc_charges      = dcCharges
      values.advance_received = advanceReceived
      values.customer_notes  = customerNotes
      values.subtotal        = totals.taxable
      values.cgst            = totals.cgst
      values.sgst            = totals.sgst
      values.igst            = totals.igst
      values.tax_amount      = totals.cgst + totals.sgst + totals.igst
      values.total_amount    = totals.grandTotal
      values.amount_paid     = totals.amountPaid
      values.balance_due     = totals.balanceDue

      await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        setLines([emptyLine()])
        setDiscountAmt(0)
        setDcCharges(0)
        navigate('/invoices/new')
      }
    } catch (_) {}
  }

  const status  = record?.status || 'draft'
  const upiAccs  = payAccounts.filter(a => a.type === 'upi')
  const neftAccs = payAccounts.filter(a => a.type === 'neft')

  // ── Line columns ───────────────────────────────────────────
  const lineColumns = [
    {
      title: '#', width: 40,
      render: (_, __, i) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>
      ),
    },
    {
      title: 'Description', dataIndex: 'description',
      render: (v, row) => (
        <div>
          <Select
            size="small"
            value={row.product_id || undefined}
            placeholder="Product (optional)"
            showSearch
            allowClear
            style={{ width: '100%', marginBottom: 4 }}
            options={products.map(p => ({ value: p.id, label: p.name }))}
            filterOption={(input, opt) =>
              (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={val => updateLine(row.key, 'product_id', val)}
          />
          <Input
            size="small"
            value={v}
            placeholder="Description"
            onChange={e => updateLine(row.key, 'description', e.target.value)}
          />
        </div>
      ),
    },
    {
      title: 'HSN/SAC', dataIndex: 'hsn_code', width: 100,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="7007"
          style={{ width: '100%' }}
          onChange={e => updateLine(row.key, 'hsn_code', e.target.value)}
        />
      ),
    },
    {
      title: 'Qty', dataIndex: 'quantity', width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          style={{ width: '100%' }}
          onChange={val => updateLine(row.key, 'quantity', val)}
        />
      ),
    },
    {
      title: 'Unit', dataIndex: 'unit', width: 80,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="sqft"
          style={{ width: '100%' }}
          onChange={e => updateLine(row.key, 'unit', e.target.value)}
        />
      ),
    },
    {
      title: 'Rate (₹)', dataIndex: 'unit_price', width: 110,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%' }}
          onChange={val => updateLine(row.key, 'unit_price', val)}
        />
      ),
    },
    {
      title: 'Amount (₹)', dataIndex: 'amount', width: 120, align: 'right',
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%', fontWeight: 600 }}
          onChange={val => updateLine(row.key, 'amount', val)}
        />
      ),
    },
    {
      title: '', width: 40,
      render: (_, row) => (
        <Button
          size="small" type="text" danger
          icon={<DeleteOutlined />}
          onClick={() => setLines(lines.filter(l => l.key !== row.key))}
        />
      ),
    },
  ]

  // ── Payment history columns ────────────────────────────────
  const payColumns = [
    {
      title: 'Date', dataIndex: 'payment_date', width: 100,
      render: v => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Ref', dataIndex: 'payment_number', width: 100,
      render: v => <Text strong style={{ color: '#16a34a', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Mode', dataIndex: 'payment_mode', width: 80,
      render: v => <Tag color="blue">{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Account', dataIndex: 'payment_account',
      render: v => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Amount', dataIndex: 'amount', width: 120, align: 'right',
      render: v => (
        <Text strong style={{ color: '#16a34a' }}>{fmt(v)}</Text>
      ),
    },
  ]

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <MasterForm
      title="Invoice"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[
        { label: 'Sales' },
        { label: 'Invoices', path: '/invoices' },
        { label: isEdit ? record?.invoice_number || 'Edit' : 'New' },
      ]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/invoices')}
    >

      {/* Smart buttons */}
      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {record?.so_id && (
            <Button
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/sales-orders/${record.so_id}/edit`)}
            >
              Sales Order
            </Button>
          )}
          {record?.dc_id && (
            <Button
              icon={<CarOutlined />}
              onClick={() => navigate(`/delivery-challans/${record.dc_id}/edit`)}
            >
              Delivery
            </Button>
          )}
          {record?.customer_id && (
            <Button
              icon={<DollarOutlined />}
              style={{ borderColor: '#6366f1', color: '#6366f1' }}
              onClick={() => navigate(`/invoices/customer/${record.customer_id}`)}
            >
              View Ledger
            </Button>
          )}
        </div>
      )}

      {/* Status stepper + actions */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps
            size="small"
            current={STATUS_IDX[status] || 0}
            items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))}
          />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            {status === 'draft' && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                style={{ background: '#3b82f6' }}
                onClick={() => statusMutation.mutate('sent')}
                loading={statusMutation.isPending}
              >
                Send / Print
              </Button>
            )}
            {['draft', 'sent'].includes(status) && isEdit && (
              <Button
                type="primary"
                icon={<DollarOutlined />}
                style={{ background: '#10b981', borderColor: '#10b981' }}
                onClick={() => {
                  payForm.setFieldsValue({
                    amount:       totals.balanceDue > 0 ? totals.balanceDue : 0,
                    payment_date: dayjs(),
                    payment_mode: 'cash',
                  })
                  setPayMode('cash')
                  setPayModal(true)
                }}
              >
                Record Payment
              </Button>
            )}
            {status === 'paid' && (
              <Tag color="green" style={{ padding: '6px 16px', fontSize: 14 }}>
                ✅ PAID
              </Tag>
            )}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <CompanySelector form={form} />

        {/* Header fields */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                filterOption={(i, o) =>
                  (o?.label ?? '').toLowerCase().includes(i.toLowerCase())
                }
                onChange={val => {
                  const c = customers.find(x => x.id === val)
                  if (c?.payment_terms) form.setFieldValue('payment_terms', c.payment_terms)
                }}
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="invoice_date" label="Invoice Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="due_date" label="Due Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="payment_terms" label="Terms">
              <Select options={PAYMENT_TERMS} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="so_id" label="SO Ref">
              <Select
                showSearch
                allowClear
                placeholder="Select Sales Order"
                optionFilterProp="label"
                options={sosList.map(s => ({
                  value: s.id,
                  label: s.so_number,
                }))}
                onChange={async (val) => {
                  if (!val) return
                  await loadFromSO(val)
                }}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="dc_id" label="DC Ref">
              <Select
                showSearch
                allowClear
                placeholder="Select Delivery Challan"
                optionFilterProp="label"
                options={dcsList.map(d => ({
                  value: d.id,
                  label: d.dc_number,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="GST Type">
              <Radio.Group
                value={gstMode}
                onChange={e => setGstMode(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="cgst_sgst">CGST/SGST</Radio.Button>
                <Radio.Button value="igst">IGST</Radio.Button>
                <Radio.Button value="off">No GST</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        {/* Invoice Lines */}
        <Divider orientation="left" style={{ color: '#3b82f6', fontWeight: 600 }}>
          Invoice Lines
        </Divider>

        <Table
          dataSource={lines}
          columns={lineColumns}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          style={{ marginBottom: 8 }}
          bordered
        />

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setLines([...lines, emptyLine()])}
          style={{ marginBottom: 24 }}
        >
          Add Line
        </Button>

        {/* Bottom section */}
        <Row gutter={24}>
          {/* Left — notes + payment history */}
          <Col span={12}>
            <Tabs
              size="small"
              items={[
                {
                  key: 'notes',
                  label: 'Customer Notes',
                  children: (
                    <TextArea
                      rows={4}
                      value={customerNotes}
                      onChange={e => setCustomerNotes(e.target.value)}
                      placeholder="Notes visible to customer on invoice..."
                    />
                  ),
                },
                ...(isEdit ? [{
                  key: 'payments',
                  label: (
                    <span>
                      Payment History
                      {payments.length > 0 && (
                        <Tag color="green" style={{ marginLeft: 6, fontSize: 10 }}>
                          {payments.length}
                        </Tag>
                      )}
                    </span>
                  ),
                  children: payments.length > 0 ? (
                    <Table
                      dataSource={payments}
                      columns={payColumns}
                      rowKey="id"
                      size="small"
                      pagination={false}
                    />
                  ) : (
                    <Text type="secondary">No payments recorded yet.</Text>
                  ),
                }] : []),
              ]}
            />
          </Col>

          {/* Right — totals */}
          <Col span={12}>
            <div style={{
              background: '#f8fafc',
              padding: '20px 24px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <Col><Text>Taxable Amount</Text></Col>
                <Col><Text strong>{fmt(totals.taxable)}</Text></Col>
              </Row>

              {/* Discount */}
              <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col><Text>Discount</Text></Col>
                <Col>
                  <InputNumber
                    size="small"
                    value={discountAmt}
                    min={0}
                    prefix="₹"
                    style={{ width: 130 }}
                    onChange={val => setDiscountAmt(val || 0)}
                  />
                </Col>
              </Row>

              {/* DC Charges */}
              <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col><Text>D/C Charges</Text></Col>
                <Col>
                  <InputNumber
                    size="small"
                    value={dcCharges}
                    min={0}
                    prefix="₹"
                    style={{ width: 130 }}
                    onChange={val => setDcCharges(val || 0)}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: '10px 0' }} />

              {/* GST */}
              {gstMode === 'cgst_sgst' && (
                <>
                  <Row justify="space-between" style={{ marginBottom: 6 }}>
                    <Col><Text type="secondary">CGST 9%</Text></Col>
                    <Col><Text>{fmt(totals.cgst)}</Text></Col>
                  </Row>
                  <Row justify="space-between" style={{ marginBottom: 6 }}>
                    <Col><Text type="secondary">SGST 9%</Text></Col>
                    <Col><Text>{fmt(totals.sgst)}</Text></Col>
                  </Row>
                </>
              )}
              {gstMode === 'igst' && (
                <Row justify="space-between" style={{ marginBottom: 6 }}>
                  <Col><Text type="secondary">IGST 18%</Text></Col>
                  <Col><Text>{fmt(totals.igst)}</Text></Col>
                </Row>
              )}
              {gstMode === 'off' && (
                <Row justify="space-between" style={{ marginBottom: 6 }}>
                  <Col><Text type="secondary">No GST</Text></Col>
                  <Col><Text type="secondary">—</Text></Col>
                </Row>
              )}

              <Divider style={{ margin: '10px 0' }} />

              {/* Grand Total */}
              <Row justify="space-between" style={{ marginBottom: 12 }}>
                <Col>
                  <Text strong style={{ fontSize: 18, color: '#0f172a' }}>
                    Grand Total
                  </Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 18, color: '#0f172a' }}>
                    {fmt(totals.grandTotal)}
                  </Text>
                </Col>
              </Row>

              {/* Amount Paid */}
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <Col>
                  <Text style={{ color: '#16a34a', fontWeight: 600 }}>
                    Amount Paid
                  </Text>
                </Col>
                <Col>
                  <Text style={{ color: '#16a34a', fontWeight: 600 }}>
                    {fmt(totals.amountPaid)}
                  </Text>
                </Col>
              </Row>

              {/* Balance Due */}
              <Row justify="space-between">
                <Col>
                  <Text strong style={{ fontSize: 16 }}>Balance Due</Text>
                </Col>
                <Col>
                  <Text
                    strong
                    style={{
                      fontSize: 16,
                      color: totals.balanceDue > 0
                        ? '#dc2626'
                        : '#16a34a',
                    }}
                  >
                    {fmt(totals.balanceDue)}
                  </Text>
                </Col>
              </Row>

              {/* Record Payment shortcut */}
              {isEdit && totals.balanceDue > 0 && (
                <Button
                  type="primary"
                  block
                  icon={<DollarOutlined />}
                  style={{
                    marginTop: 16,
                    background: '#10b981',
                    borderColor: '#10b981',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    payForm.setFieldsValue({
                      amount:       totals.balanceDue,
                      payment_date: dayjs(),
                      payment_mode: 'cash',
                    })
                    setPayMode('cash')
                    setPayModal(true)
                  }}
                >
                  + Record Payment (₹{Number(totals.balanceDue).toLocaleString('en-IN')})
                </Button>
              )}

              {isEdit && totals.balanceDue <= 0 && totals.grandTotal > 0 && (
                <div style={{
                  marginTop: 16,
                  textAlign: 'center',
                  padding: '10px',
                  background: '#f0fdf4',
                  borderRadius: 8,
                  border: '1px solid #86efac',
                }}>
                  <Text strong style={{ color: '#16a34a', fontSize: 15 }}>
                    ✅ Fully Paid
                  </Text>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Form>

      {/* ── Record Payment Modal ─────────────────────────────── */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#10b981' }} />
            <span>Record Payment</span>
            {record?.customer_id && (
              <Tag color="blue">
                {customers.find(c => c.id === record.customer_id)?.name || ''}
              </Tag>
            )}
          </Space>
        }
        open={payModal}
        onCancel={() => { setPayModal(false); payForm.resetFields(); setPayMode('cash') }}
        onOk={() => payForm.submit()}
        okText="Save Payment"
        okButtonProps={{
          loading: paymentMutation.isPending,
          style:   { background: '#10b981', borderColor: '#10b981' },
        }}
        width={520}
      >
        <Form
          form={payForm}
          layout="vertical"
          onFinish={paymentMutation.mutate}
        >
          {/* Amount */}
          <Form.Item
            name="amount"
            label="Amount Received (₹)"
            rules={[{ required: true, message: 'Enter amount' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              prefix="₹"
              size="large"
              placeholder="0.00"
            />
          </Form.Item>

          {/* Payment Mode */}
          <Form.Item
            name="payment_mode"
            label="Payment Mode"
            initialValue="cash"
            rules={[{ required: true }]}
          >
            <Radio.Group
              onChange={e => {
                setPayMode(e.target.value)
                payForm.setFieldValue('upi_account', undefined)
                payForm.setFieldValue('neft_account', undefined)
              }}
            >
              <Space wrap>
                {PAYMENT_MODES.map(m => (
                  <Radio.Button
                    key={m.value}
                    value={m.value}
                    style={{ borderRadius: 8 }}
                  >
                    {m.label}
                  </Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* UPI account selector */}
          {payMode === 'upi' && (
            <Form.Item
              name="upi_account"
              label="UPI Account"
              rules={[{ required: true, message: 'Select UPI account' }]}
            >
              <Select
                placeholder="Select UPI account"
                options={
                  upiAccs.length > 0
                    ? upiAccs.map(a => ({
                        value: `${a.name} — ${a.detail}`,
                        label: `📱 ${a.name} — ${a.detail}`,
                      }))
                    : [{ value: 'default', label: '⚠️ No UPI accounts — add in Settings' }]
                }
              />
            </Form.Item>
          )}

          {/* NEFT account selector */}
          {payMode === 'neft' && (
            <Form.Item
              name="neft_account"
              label="Bank Account (NEFT/RTGS)"
              rules={[{ required: true, message: 'Select bank account' }]}
            >
              <Select
                placeholder="Select bank account"
                options={
                  neftAccs.length > 0
                    ? neftAccs.map(a => ({
                        value: `${a.name} — ${a.detail}`,
                        label: `🏦 ${a.name} — ${a.detail}`,
                      }))
                    : [{ value: 'default', label: '⚠️ No bank accounts — add in Settings' }]
                }
              />
            </Form.Item>
          )}

          {/* Reference */}
          {['upi', 'neft', 'cheque'].includes(payMode) && (
            <Form.Item name="reference" label="Reference No. (UTR / Cheque No.)">
              <Input placeholder="Enter UTR or cheque number" />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_date" label="Payment Date">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Notes">
                <Input placeholder="Optional remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

    </MasterForm>
  )
}

export default InvoiceForm
