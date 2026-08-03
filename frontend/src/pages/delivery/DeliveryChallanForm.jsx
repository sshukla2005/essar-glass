import React, { useEffect, useState } from 'react'
import {
  Form, Input, InputNumber, Select, Row, Col, DatePicker,
  Button, Table, Steps, Space, Tag, App, Typography, Collapse, Divider
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined,
  CarOutlined, DollarOutlined, ShoppingCartOutlined, DownloadOutlined
} from '@ant-design/icons'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { deliveryChallanApi, customerApi, productApi, stockMovementApi, salesOrderApi } from '../../api'
import CompanySelector from '../../components/common/CompanySelector'
import FractionInput from '../quotations/components/FractionInput'
import { generateDeliveryChallanPDF } from '../../utils/pdfGenerator'

const { Text } = Typography

const STATUS_STEPS = ['draft', 'dispatched', 'delivered']
const STATUS_IDX = { draft: 0, dispatched: 1, delivered: 2, returned: 0 }

// ── helpers ──────────────────────────────────────────────────────────────────

const emptyGlassSize = () => ({
  key: Date.now() + Math.random(),
  width_inch: null,
  height_inch: null,
  width_mm: null,
  height_mm: null,
  quantity: 1,       // ordered
  qty_dispatched: 1,
  remarks: '',
  item_type: 'glass',
})

const emptyGlassGroup = (description = '') => ({
  key: Date.now() + Math.random(),
  description,
  product_id: null,
  sizes: [emptyGlassSize()],
})

const emptyHardware = () => ({
  key: Date.now() + Math.random(),
  description: '',
  product_id: null,
  quantity: 1,
  qty_dispatched: 1,
  remarks: '',
  item_type: 'hardware',
})

/**
 * Converts a flat lines array (from the backend or wizard) into
 * { glassGroups, hardwareItems }.
 */
const groupFlatLines = (lines) => {
  if (!lines || lines.length === 0) {
    return { glassGroups: [emptyGlassGroup()], hardwareItems: [] }
  }

  const groupsMap = new Map()
  const hwItems = []

  lines.forEach((l, idx) => {
    if (l.item_type === 'hardware') {
      hwItems.push({
        key: l.id || l.key || (Date.now() + idx + Math.random()),
        description: l.description || '',
        product_id: l.product_id || null,
        quantity: l.quantity ?? l.ordered_qty ?? 1,
        qty_dispatched: l.qty_dispatched ?? l.dispatch_qty ?? l.quantity ?? 1,
        remarks: l.remarks || '',
        item_type: 'hardware',
      })
      return
    }

    // glass (or unlabelled — treat as glass)
    const descKey = (l.description || '').trim()
    if (!groupsMap.has(descKey)) {
      groupsMap.set(descKey, {
        key: Date.now() + idx + Math.random(),
        description: l.description || '',
        product_id: l.product_id || null,
        sizes: [],
      })
    }
    const grp = groupsMap.get(descKey)
    if (!grp.product_id && l.product_id) grp.product_id = l.product_id
    const wIn = l.width_inch ?? (l.width_mm ? parseFloat((l.width_mm / 25.4).toFixed(4)) : null)
    const hIn = l.height_inch ?? (l.height_mm ? parseFloat((l.height_mm / 25.4).toFixed(4)) : null)
    grp.sizes.push({
      key: l.id || l.key || (Date.now() + idx + Math.random()),
      width_inch: wIn,
      height_inch: hIn,
      width_mm: l.width_mm ?? (wIn ? Math.round(wIn * 25.4) : null),
      height_mm: l.height_mm ?? (hIn ? Math.round(hIn * 25.4) : null),
      quantity: l.quantity ?? l.ordered_qty ?? 1,
      qty_dispatched: l.qty_dispatched ?? l.dispatch_qty ?? l.quantity ?? 1,
      remarks: l.remarks || '',
      item_type: 'glass',
    })
  })

  const glassGroups = groupsMap.size > 0
    ? Array.from(groupsMap.values())
    : [emptyGlassGroup()]

  return { glassGroups, hardwareItems: hwItems }
}

// ── component ─────────────────────────────────────────────────────────────────

const DeliveryChallanForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { state: locationState } = useLocation()
  const queryClient = useQueryClient()

  const [glassGroups, setGlassGroups] = useState([emptyGlassGroup()])
  const [hardwareItems, setHardwareItems] = useState([])
  const [pdfLoading, setPdfLoading] = useState(false)

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: record, isLoading } = useQuery({
    queryKey: ['delivery_challans', id],
    queryFn: () => deliveryChallanApi.get(id).then(r => r.data),
    enabled: isEdit,
  })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: sos = [] } = useQuery({ queryKey: ['sales_orders-dd'], queryFn: () => salesOrderApi.dropdown().then(r => r.data) })

  // ── init effects ─────────────────────────────────────────────────────────

  // Set today as default date on new DC
  useEffect(() => { if (!isEdit) form.setFieldValue('dc_date', dayjs()) }, []) // eslint-disable-line

  // Pre-fill from SO dispatch wizard (navigate state)
  useEffect(() => {
    if (isEdit) return
    const { dcItems, customer_id } = locationState || {}
    const soIdFromUrl = new URLSearchParams(window.location.search).get('so_id')
    if (soIdFromUrl) form.setFieldValue('so_id', parseInt(soIdFromUrl))
    if (customer_id) form.setFieldValue('customer_id', customer_id)
    if (dcItems?.length) {
      const { glassGroups: gg, hardwareItems: hw } = groupFlatLines(dcItems)
      setGlassGroups(gg)
      setHardwareItems(hw)
    }
  }, [isEdit]) // eslint-disable-line

  // Hydrate from saved record
  useEffect(() => {
    if (record) {
      form.setFieldsValue({ ...record, dc_date: record.dc_date ? dayjs(record.dc_date) : null })
      if (record.lines?.length) {
        const { glassGroups: gg, hardwareItems: hw } = groupFlatLines(record.lines)
        setGlassGroups(gg)
        setHardwareItems(hw)
      }
    }
  }, [record, form])

  // ── flatten for save / stock ──────────────────────────────────────────────

  const getFlatLines = () => {
    const glassLines = glassGroups.flatMap(g =>
      (g.sizes || []).map(s => ({
        description: g.description || '',
        product_id: g.product_id || null,
        width_mm: s.width_mm ?? null,
        height_mm: s.height_mm ?? null,
        quantity: s.quantity ?? 1,
        qty_dispatched: s.qty_dispatched ?? s.quantity ?? 1,
        remarks: s.remarks || '',
        item_type: 'glass',
      }))
    )
    const hwLines = hardwareItems.map(h => ({
      description: h.description || '',
      product_id: h.product_id || null,
      width_mm: null,
      height_mm: null,
      quantity: h.quantity ?? 1,
      qty_dispatched: h.qty_dispatched ?? h.quantity ?? 1,
      remarks: h.remarks || '',
      item_type: 'hardware',
    }))
    return [...glassLines, ...hwLines]
  }

  // ── mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? deliveryChallanApi.update(id, data) : deliveryChallanApi.create(data),
    onSuccess: (res) => {
      message.success(`DC ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['delivery_challans'] })
      if (!isEdit && res?.data?.id) navigate(`/delivery-challans/${res.data.id}/edit`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => deliveryChallanApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delivery_challans', id] }),
  })

  const deliverMutation = useMutation({
    mutationFn: async () => {
      const lines = getFlatLines()
      for (const line of lines) {
        if (line.product_id) {
          await stockMovementApi.create({
            product_id: line.product_id, quantity: line.qty_dispatched || line.quantity,
            movement_type: 'out', dc_id: parseInt(id),
            reference: record?.dc_number, date: new Date().toISOString()
          })
        }
      }
      await deliveryChallanApi.changeStatus(id, 'delivered')
    },
    onSuccess: () => {
      message.success('Stock deducted successfully')
      queryClient.invalidateQueries({ queryKey: ['delivery_challans', id] })
    }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.dc_date) values.dc_date = values.dc_date.format('YYYY-MM-DD')
      values.lines = getFlatLines()
      await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        setGlassGroups([emptyGlassGroup()])
        setHardwareItems([])
        navigate('/delivery-challans/new')
      }
    } catch (err) {}
  }

  // ── glass group handlers ──────────────────────────────────────────────────

  const addGlassGroup = () => setGlassGroups(prev => [...prev, emptyGlassGroup()])

  const removeGlassGroup = (gKey) =>
    setGlassGroups(prev => {
      const r = prev.filter(g => g.key !== gKey)
      return r.length > 0 ? r : [emptyGlassGroup()]
    })

  const updateGlassGroup = (gKey, field, value) =>
    setGlassGroups(prev => prev.map(g => g.key !== gKey ? g : { ...g, [field]: value }))

  const addGlassSize = (gKey) =>
    setGlassGroups(prev => prev.map(g => g.key !== gKey ? g : { ...g, sizes: [...g.sizes, emptyGlassSize()] }))

  const removeGlassSize = (gKey, sKey) =>
    setGlassGroups(prev => prev.map(g => {
      if (g.key !== gKey) return g
      const r = g.sizes.filter(s => s.key !== sKey)
      return { ...g, sizes: r.length > 0 ? r : [emptyGlassSize()] }
    }))

  const updateGlassSize = (gKey, sKey, field, value) =>
    setGlassGroups(prev => prev.map(g => {
      if (g.key !== gKey) return g
      return {
        ...g, sizes: g.sizes.map(s => {
          if (s.key !== sKey) return s
          const updated = { ...s, [field]: value }
          // Keep mm in sync when inch is edited
          if (field === 'width_inch') updated.width_mm = value != null ? Math.round(value * 25.4) : null
          if (field === 'height_inch') updated.height_mm = value != null ? Math.round(value * 25.4) : null
          return updated
        })
      }
    }))

  // ── hardware handlers ─────────────────────────────────────────────────────

  const addHardware = () => setHardwareItems(prev => [...prev, emptyHardware()])

  const removeHardware = (key) => setHardwareItems(prev => prev.filter(h => h.key !== key))

  const updateHardware = (key, field, value) =>
    setHardwareItems(prev => prev.map(h => h.key !== key ? h : { ...h, [field]: value }))

  // ── column definitions ────────────────────────────────────────────────────

  const glassSizeColumns = (group) => [
    {
      title: '#', width: 36, align: 'center',
      render: (_, __, i) => <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>{String.fromCharCode(97 + i)}</Text>
    },
    {
      title: 'W (in)', width: 100, dataIndex: 'width_inch',
      render: (v, row) => (
        <FractionInput
          value={v}
          placeholder="W"
          onChange={val => updateGlassSize(group.key, row.key, 'width_inch', val)}
        />
      )
    },
    {
      title: 'H (in)', width: 100, dataIndex: 'height_inch',
      render: (v, row) => (
        <FractionInput
          value={v}
          placeholder="H"
          onChange={val => updateGlassSize(group.key, row.key, 'height_inch', val)}
        />
      )
    },
    {
      title: 'W (mm)', width: 72, dataIndex: 'width_mm',
      render: (v) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v ?? '—'}</Text>
      )
    },
    {
      title: 'H (mm)', width: 72, dataIndex: 'height_mm',
      render: (v) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v ?? '—'}</Text>
      )
    },
    {
      title: 'Ordered', width: 80, dataIndex: 'quantity',
      render: (v, row) => (
        <InputNumber size="small" value={v} min={0} style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateGlassSize(group.key, row.key, 'quantity', val)} />
      )
    },
    {
      title: 'Dispatched', width: 90, dataIndex: 'qty_dispatched',
      render: (v, row) => (
        <InputNumber size="small" value={v} min={0} style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateGlassSize(group.key, row.key, 'qty_dispatched', val)} />
      )
    },
    {
      title: 'Remarks', width: 150, dataIndex: 'remarks',
      render: (v, row) => (
        <Input size="small" value={v} placeholder="Remarks" style={{ borderRadius: 6 }}
          onChange={e => updateGlassSize(group.key, row.key, 'remarks', e.target.value)} />
      )
    },
    {
      title: '', width: 40, align: 'center',
      render: (_, row) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => removeGlassSize(group.key, row.key)} />
      )
    },
  ]

  const hardwareColumns = [
    {
      title: 'Description', dataIndex: 'description', width: 320,
      render: (v, row) => (
        <Input size="small" value={v} placeholder="Hardware description" style={{ borderRadius: 6 }}
          onChange={e => updateHardware(row.key, 'description', e.target.value)} />
      )
    },
    {
      title: 'Ordered', dataIndex: 'quantity', width: 85,
      render: (v, row) => (
        <InputNumber size="small" value={v} min={0} style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateHardware(row.key, 'quantity', val)} />
      )
    },
    {
      title: 'Dispatched', dataIndex: 'qty_dispatched', width: 95,
      render: (v, row) => (
        <InputNumber size="small" value={v} min={0} style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateHardware(row.key, 'qty_dispatched', val)} />
      )
    },
    {
      title: 'Remarks', dataIndex: 'remarks',
      render: (v, row) => (
        <Input size="small" value={v} placeholder="Remarks" style={{ borderRadius: 6 }}
          onChange={e => updateHardware(row.key, 'remarks', e.target.value)} />
      )
    },
    {
      title: '', width: 40, align: 'center',
      render: (_, row) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => removeHardware(row.key)} />
      )
    },
  ]

  // ── derived display values ────────────────────────────────────────────────

  const status = record?.status || 'draft'

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <MasterForm title="Delivery Challan" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Inventory' }, { label: 'Deliveries', path: '/delivery-challans' }, { label: isEdit ? record?.dc_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/delivery-challans')}>

      {/* Linked-record navigation links */}
      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          {record?.so_id && <Button icon={<CarOutlined />} onClick={() => navigate(`/sales-orders/${record.so_id}/edit`)}>Sales Order</Button>}
          <Button icon={<DollarOutlined />} onClick={() => navigate(`/invoices?dc_id=${id}`)}>Invoices</Button>
        </div>
      )}

      {/* Status stepper + action buttons */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              disabled={!isEdit}
              loading={pdfLoading}
              onClick={async () => {
                if (!isEdit) return
                const hide = message.loading('Generating Delivery Challan PDF...', 0)
                setPdfLoading(true)
                try {
                  const values = form.getFieldsValue()
                  const customerObj = customers.find(c => c.id === values.customer_id)
                  const soObj = sos.find(s => s.id === values.so_id)
                  const fullDC = {
                    ...record,
                    ...values,
                    customer_name: customerObj?.name || record?.customer_name,
                    customer_phone: customerObj?.phone || customerObj?.mobile || record?.customer_phone,
                    customer_gstin: customerObj?.gstin || record?.customer_gstin,
                    so_number: soObj?.so_number || record?.so_number,
                    lines: getFlatLines(),
                    glassGroups,
                    hardwareItems,
                  }
                  await generateDeliveryChallanPDF(fullDC)
                } catch (err) {
                  message.error('Failed to generate PDF: ' + (err?.message || 'Unknown error'))
                } finally {
                  setPdfLoading(false)
                  hide()
                }
              }}
              style={{ borderColor: '#6366f1', color: '#6366f1' }}
            >
              Download PDF
            </Button>
            {status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={() => statusMutation.mutate('dispatched')} style={{ background: '#3b82f6' }}>Dispatch</Button>}
            {status === 'dispatched' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => deliverMutation.mutate()} style={{ background: '#10b981' }}>Mark Delivered</Button>}
            {status === 'delivered' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ DELIVERED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>

        {/* ── Header Details Card ── */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
          marginBottom: 20, padding: 24,
        }}>
          <CompanySelector form={form} />
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="customer_id" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Customer</span>} rules={[{ required: true }]}>
                <Select showSearch placeholder="Select Customer"
                  options={customers.map(c => ({ value: c.id, label: c.name }))}
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="dc_date" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Date</span>}>
                <DatePicker style={{ width: '100%', borderRadius: 6 }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={6}>
              <Form.Item name="so_id" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Sales Order Ref</span>}>
                <Select options={sos.map(s => ({ value: s.id, label: s.so_number }))} allowClear
                  showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={6} md={6}>
              <Form.Item name="vehicle_number" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Vehicle Number</span>}>
                <Input style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={6}>
              <Form.Item name="driver_name" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Driver Name</span>}>
                <Input style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={6}>
              <Form.Item name="transporter" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Transporter</span>}>
                <Input style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="delivery_address" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Delivery Address</span>}>
                <Input.TextArea rows={2} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* ── Glass Items Section ── */}
        <Divider orientation="left" style={{ color: '#3b82f6', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Glass Items
        </Divider>

        {glassGroups.map((group, gi) => {
          const totalOrdered = (group.sizes || []).reduce((s, sz) => s + (sz.quantity || 0), 0)
          const totalDispatched = (group.sizes || []).reduce((s, sz) => s + (sz.qty_dispatched || 0), 0)

          return (
            <Collapse
              key={group.key}
              defaultActiveKey={['1']}
              style={{
                marginBottom: 16, borderRadius: 14, border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
                overflow: 'hidden', background: '#fff',
              }}
            >
              <Collapse.Panel
                key="1"
                style={{ border: 'none' }}
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexWrap: 'wrap', paddingRight: 8 }} onClick={e => e.stopPropagation()}>
                    <span style={{
                      background: '#EEF2FF', color: '#4338CA', fontWeight: 700, fontSize: 12,
                      padding: '3px 9px', borderRadius: 6, minWidth: 28, textAlign: 'center',
                    }}>
                      {gi + 1}
                    </span>

                    <Input
                      size="small"
                      placeholder="Glass Spec / Description"
                      value={group.description}
                      style={{ width: 260, fontWeight: 600, borderRadius: 6 }}
                      onChange={e => updateGlassGroup(group.key, 'description', e.target.value)}
                    />

                    <Tag color="blue" style={{ margin: 0, fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
                      Ordered: {totalOrdered}
                    </Tag>
                    <Tag color="green" style={{ margin: 0, fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
                      Dispatched: {totalDispatched}
                    </Tag>

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button
                        size="small" danger
                        icon={<DeleteOutlined />}
                        style={{ borderRadius: 6, height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={e => { e.stopPropagation(); removeGlassGroup(group.key) }}
                      />
                    </div>
                  </div>
                }
              >
                <div style={{ padding: '8px 4px' }}>
                  <Table
                    dataSource={group.sizes}
                    rowKey="key"
                    size="small"
                    pagination={false}
                    columns={glassSizeColumns(group)}
                    scroll={{ x: 780 }}
                    footer={() => (
                      <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 6 }}
                        onClick={() => addGlassSize(group.key)}>
                        Add Size
                      </Button>
                    )}
                    style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}
                  />
                </div>
              </Collapse.Panel>
            </Collapse>
          )
        })}

        <Button
          type="dashed" icon={<PlusOutlined />} onClick={addGlassGroup}
          style={{ width: '100%', borderRadius: 8, height: 38, marginBottom: 24 }}
        >
          Add Glass Group
        </Button>

        {/* ── Hardware Items Card ── */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
          marginBottom: 20, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD',
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCartOutlined style={{ color: '#d97706' }} /> Hardware Items
            </span>
            <Tag color="warning" style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #fde047' }}>
              {hardwareItems.length} item{hardwareItems.length !== 1 ? 's' : ''}
            </Tag>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {hardwareItems.length > 0 && (
              <Table
                dataSource={hardwareItems}
                rowKey="key"
                size="small"
                pagination={false}
                columns={hardwareColumns}
                style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}
              />
            )}
            <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 6 }}
              onClick={addHardware}>
              Add Hardware Item
            </Button>
          </div>
        </div>

      </Form>
    </MasterForm>
  )
}

export default DeliveryChallanForm
