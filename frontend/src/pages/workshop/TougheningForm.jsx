import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, DatePicker, Button, Table, Steps, Space, Tag, Card, Modal, Checkbox, App, Typography } from 'antd'
import { SendOutlined, CheckCircleOutlined, PlusOutlined, InboxOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { tougheningBatchApi, workshopOrderApi, vendorApi, stockMovementApi } from '../../api'
import { getSettings } from '../../utils/glassCalc'

const { TextArea } = Input
const { Text } = Typography

const STATUS_STEPS = ['draft', 'sent', 'received']
const STATUS_IDX = { draft: 0, sent: 1, received: 2 }
const ITEM_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'received', label: 'Received' },
  { value: 'rejected', label: 'Rejected' },
]

const TougheningForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [items, setItems] = useState([])
  const [woModalOpen, setWoModalOpen] = useState(false)
  const [selectedWoItems, setSelectedWoItems] = useState([])

  const { data: record, isLoading } = useQuery({
    queryKey: ['toughening_batches', id], queryFn: () => tougheningBatchApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors-dd'], queryFn: () => vendorApi.dropdown().then(r => r.data) })
  const { data: workshopOrders = [] } = useQuery({ queryKey: ['wo-dd'], queryFn: () => workshopOrderApi.dropdown().then(r => r.data) })

  useEffect(() => {
    if (!isEdit) {
      form.setFieldValue('sent_date', dayjs())
      const woId = searchParams.get('wo_id')
      if (woId) loadFromWO(parseInt(woId))
    }
  }, [])

  useEffect(() => {
    if (record) {
      // Try to resolve vendor_id from vendor_name if vendor_id missing
      let resolvedVendorId = record.vendor_id
      if (!resolvedVendorId && record.vendor_name) {
        const matched = (Array.isArray(vendors) ? vendors : (vendors?.items || []))
          .find(v =>
            v.name?.toLowerCase() === record.vendor_name?.toLowerCase()
          )
        resolvedVendorId = matched?.id || null
      }

      form.setFieldsValue({
        ...record,
        vendor_id: resolvedVendorId,
        sent_date: record.sent_date ? dayjs(record.sent_date) : null,
        expected_return: record.expected_return ? dayjs(record.expected_return) : null,
      })
      const rawItems = record.items?.length ? record.items : (record.lines || [])
      if (rawItems.length) {
        setItems(rawItems.map((it, i) => calcTghLine({
          ...it,
          key: it.id || Date.now() + i,
          // normalize field names — WO lines use act_w_mm/act_h_mm
          width_mm: it.width_mm || it.act_w_mm || 0,
          height_mm: it.height_mm || it.act_h_mm || 0,
          quantity: it.qty || it.quantity || 1,
          tgh_rate: it.tgh_rate || 1200,
          item_status: it.item_status || 'pending',
          wo_number: it.wo_number || it.source_wo || record.wo_number || '',
          so_number: it.so_number || it.source_so || record.so_number || '',
        })))
      }
    }
  }, [record, form, vendors])

  const loadFromWO = async (woId) => {
    try {
      const wo = (await workshopOrderApi.get(woId)).data
      form.setFieldsValue({ wo_id: woId, wo_number: wo.wo_number })
      const cepLines = (wo.lines || []).filter(l =>
        l.is_toughened ||
        l.glass_type === 'Toughened' ||
        (Array.isArray(l.processes) && l.processes.some(p =>
          p.process_type === 'toughening' ||
          (p.process_name || '').toLowerCase().includes('toughen')
        )) ||
        (Array.isArray(l.size_processes) && l.size_processes.some(p =>
          p.process_type === 'toughening' ||
          (p.process_name || '').toLowerCase().includes('toughen')
        ))
      )
      if (cepLines.length) {
        setItems(cepLines.map((l, i) => calcTghLine({
          ...l,
          key: Date.now() + i,
          width_mm: l.width_mm || l.act_w_mm || 0,
          height_mm: l.height_mm || l.act_h_mm || 0,
          quantity: l.qty || l.quantity || 1,
          wo_number: wo.wo_number,
          so_number: wo.so_number,
          item_status: 'pending',
          tgh_rate: l.tgh_rate || 1200,
        })))
      }
    } catch (e) { message.error('Failed to load WO') }
  }

  // Toughening calc using settings
  const calcTghLine = (line) => {
    const s = getSettings()
    const tgh_extra = s.toughening_extra_mm || 30
    const sqmt_div = s.sqmt_divisor || 1000000
    const w_mm = (line.width_mm || 0) + tgh_extra
    const h_mm = (line.height_mm || 0) + tgh_extra
    const qty = line.quantity || 1
    const rate = line.tgh_rate || 1200
    const charged_sqmt = parseFloat(((w_mm * h_mm * qty) / sqmt_div).toFixed(6))
    const amount = parseFloat((charged_sqmt * rate).toFixed(2))
    return { ...line, charged_w_mm: w_mm, charged_h_mm: h_mm, charged_sqmt, tgh_amount: amount }
  }

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.key !== key) return it
      const updated = { ...it, [field]: value }
      return calcTghLine(updated)
    }))
  }

  const totals = useMemo(() => {
    const total_sqmt = items.reduce((s, it) => s + (it.charged_sqmt || 0), 0)
    const total_amount = items.reduce((s, it) => s + (it.tgh_amount || 0), 0)
    const total_qty = items.reduce((s, it) => s + (it.quantity || 0), 0)
    return { total_sqmt: parseFloat(total_sqmt.toFixed(6)), total_amount: parseFloat(total_amount.toFixed(2)), total_qty }
  }, [items])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? tougheningBatchApi.update(id, data) : tougheningBatchApi.create(data),
    onSuccess: (res) => {
      message.success(`Toughening Batch ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['toughening_batches'] })
      if (!isEdit && res?.data?.id) navigate(`/workshop/toughening/${res.data.id}/edit`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => tougheningBatchApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['toughening_batches', id] }),
  })

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const received = items.filter(it => it.item_status !== 'rejected')
      for (const it of received) {
        if (it.product_id) {
          await stockMovementApi.create({
            product_id: it.product_id, quantity: it.quantity, movement_type: 'in',
            reference: record?.tb_number, remarks: `Toughened glass received: ${it.description}`, date: new Date().toISOString()
          })
        }
      }
      await tougheningBatchApi.changeStatus(id, 'received')
    },
    onSuccess: () => {
      message.success(`${items.length} items received from toughening`)
      queryClient.invalidateQueries({ queryKey: ['toughening_batches', id] })
    }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.sent_date) values.sent_date = values.sent_date.format('YYYY-MM-DD')
      if (values.expected_return) values.expected_return = values.expected_return.format('YYYY-MM-DD')
      const vendorList = Array.isArray(vendors) ? vendors : (vendors?.items || [])
      const vendor = vendorList.find(v => v.id === values.vendor_id)
      if (String(values.vendor_id || '').startsWith('__custom__')) {
        values.vendor_name = String(values.vendor_id).replace('__custom__', '')
        values.vendor_id = null
      } else {
        values.vendor_name = vendor?.name || record?.vendor_name || ''
      }
      // Model column is `lines`, not `items` — sending `items` gets silently
      // stripped by the backend's valid_columns filter, losing all line data.
      values.lines = items.map(({ key, ...rest }) => rest)
      values.total_sqmt = totals.total_sqmt
      values.total_amount = totals.total_amount
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setItems([]); navigate('/workshop/toughening/new') }
    } catch (err) {}
  }

  // Add from WO modal
  const handleAddFromWO = () => {
    const woWithCep = workshopOrders.filter(wo =>
      wo.lines?.some(l =>
        l.is_toughened ||
        l.glass_type === 'Toughened' ||
        (Array.isArray(l.processes) && l.processes.some(p =>
          p.process_type === 'toughening' ||
          (p.process_name || '').toLowerCase().includes('toughen')
        ))
      )
    )
    setSelectedWoItems(woWithCep)
    setWoModalOpen(true)
  }

  const handleSelectWO = (wo) => {
    const cepLines = (wo.lines || []).filter(l =>
      l.is_toughened ||
      l.glass_type === 'Toughened' ||
      (Array.isArray(l.processes) && l.processes.some(p =>
        p.process_type === 'toughening' ||
        (p.process_name || '').toLowerCase().includes('toughen')
      ))
    )
    const newItems = cepLines.map((l, i) => calcTghLine({
      ...l,
      key: Date.now() + i + items.length,
      width_mm: l.width_mm || l.act_w_mm || 0,
      height_mm: l.height_mm || l.act_h_mm || 0,
      quantity: l.qty || l.quantity || 1,
      wo_number: wo.wo_number,
      so_number: wo.so_number,
      item_status: 'pending',
      tgh_rate: l.tgh_rate || 1200,
    }))
    setItems(prev => [...prev, ...newItems])
    form.setFieldsValue({ wo_id: wo.id, wo_number: wo.wo_number })
    setWoModalOpen(false)
    message.success(`Added ${newItems.length} items from ${wo.wo_number}`)
  }

  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const itemColumns = [
    { title: '#', width: 40, render: (_, __, i) => i + 1 },
    { title: 'WO#', width: 80, dataIndex: 'wo_number', render: v => <Tag color="purple" style={{ fontSize: 10 }}>{v || '—'}</Tag> },
    { title: 'SO#', width: 80, dataIndex: 'so_number', render: v => <Tag color="blue" style={{ fontSize: 10 }}>{v || '—'}</Tag> },
    { title: 'Description', width: 200, dataIndex: 'description', render: v => <Text strong style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'W(mm)', width: 70, dataIndex: 'width_mm', align: 'center' },
    { title: 'H(mm)', width: 70, dataIndex: 'height_mm', align: 'center' },
    { title: 'Qty', width: 50, dataIndex: 'quantity', align: 'center' },
    { title: 'Chg W(mm)', width: 90, dataIndex: 'charged_w_mm', align: 'center', render: v => <Text type="secondary">{v}</Text> },
    { title: 'Chg H(mm)', width: 90, dataIndex: 'charged_h_mm', align: 'center', render: v => <Text type="secondary">{v}</Text> },
    { title: 'Sqmt', width: 100, dataIndex: 'charged_sqmt', align: 'right', render: v => <Text strong>{v?.toFixed(4) || '—'}</Text> },
    { title: 'Rate/Sqmt', width: 100, dataIndex: 'tgh_rate', render: (v, row) => (
      <InputNumber size="small" value={v} min={0} style={{ width: '100%' }} onChange={val => updateItem(row.key, 'tgh_rate', val)} />
    )},
    { title: 'Amount', width: 110, dataIndex: 'tgh_amount', align: 'right', render: v => <Text strong style={{ color: '#059669' }}>{fmt(v)}</Text> },
    { title: 'Status', width: 110, dataIndex: 'item_status', render: (v, row) => (
      <Select size="small" value={v || 'pending'} options={ITEM_STATUSES} style={{ width: '100%' }}
        onChange={val => updateItem(row.key, 'item_status', val)} />
    )},
  ]

  return (
    <MasterForm title="Toughening Batch" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Workshop' }, { label: 'Toughening', path: '/workshop/toughening' }, { label: isEdit ? record?.tb_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/workshop/toughening')}>

      {/* Status Bar */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            {status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={() => statusMutation.mutate('sent')} style={{ background: '#3b82f6' }}>Send to Vendor</Button>}
            {status === 'sent' && <Button type="primary" icon={<InboxOutlined />} onClick={() => receiveMutation.mutate()} loading={receiveMutation.isPending} style={{ background: '#10b981' }}>Mark as Received</Button>}
            {status === 'received' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ RECEIVED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="vendor_id"
              label="Toughening Vendor"
              rules={[{ required: false }]}
            >
              <Select
                showSearch
                allowClear
                placeholder="Select vendor"
                options={[
                  // Include custom vendor_name from record as an option if not in vendorApi list
                  ...(record?.vendor_name && !(Array.isArray(vendors) ? vendors : (vendors?.items || [])).find(v => v.name === record.vendor_name)
                    ? [{ value: `__custom__${record.vendor_name}`, label: `${record.vendor_name} (from WO)` }]
                    : []
                  ),
                  ...(Array.isArray(vendors) ? vendors : (vendors?.items || [])).map(v => ({ value: v.id, label: v.name }))
                ]}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            {/* Show vendor_name from WO if no vendor_id matched */}
            {record?.vendor_name && !form.getFieldValue('vendor_id') && (
              <div style={{
                marginTop: -16, marginBottom: 8,
                fontSize: 12, color: '#f59e0b',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                <span>⚠️</span>
                <span>Vendor from WO: <b>{record.vendor_name}</b> (not in vendor master)</span>
              </div>
            )}
          </Col>
          <Col span={3}><Form.Item name="sent_date" label="Sent Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={3}><Form.Item name="expected_return" label="Expected Return"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="vehicle_number" label="Vehicle Number"><Input placeholder="MH04-XX-1234" /></Form.Item></Col>
          <Col span={4}><Form.Item name="wo_number" label="WO Ref"><Input disabled /></Form.Item></Col>
          <Col span={4}><Form.Item name="tb_number" label="Batch #"><Input disabled placeholder="Auto" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#dc2626' }}>🔥 Items for Toughening</Divider>

        <div style={{ marginBottom: 12 }}>
          <Button icon={<PlusOutlined />} onClick={handleAddFromWO}>Add from Workshop Orders</Button>
        </div>

        <Table dataSource={items} columns={itemColumns} rowKey="key" size="small" pagination={false} scroll={{ x: 1400 }} style={{ marginBottom: 16 }} />

        {/* Totals */}
        <Row justify="end">
          <Col span={8}>
            <Card size="small" style={{ background: '#fef2f2', borderColor: '#fca5a5', borderRadius: 10 }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Items Count</Col><Col><Text strong>{totals.total_qty}</Text></Col></Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Total Sqmt</Col><Col><Text strong>{totals.total_sqmt.toFixed(4)}</Text></Col></Row>
              <Divider style={{ margin: '8px 0' }} />
              <Row justify="space-between"><Col><b style={{ fontSize: 16 }}>Total Amount</b></Col><Col><b style={{ fontSize: 16, color: '#dc2626' }}>{fmt(totals.total_amount)}</b></Col></Row>
            </Card>
          </Col>
        </Row>
      </Form>

      {/* Add from WO Modal */}
      <Modal title="Select Workshop Order" open={woModalOpen} onCancel={() => setWoModalOpen(false)} footer={null} width={600}>
        {selectedWoItems.length === 0 ? <Text type="secondary">No workshop orders with CEP items found.</Text> : (
          <div>
            {selectedWoItems.map(wo => (
              <Card key={wo.id} size="small" hoverable style={{ marginBottom: 8 }} onClick={() => handleSelectWO(wo)}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong>{wo.wo_number}</Text> — <Text type="secondary">SO: {wo.so_number}</Text>
                    <br /><Text type="secondary" style={{ fontSize: 11 }}>{wo.customer_name} | {wo.lines?.filter(l => l.is_toughened || l.glass_type === 'Toughened' || l.cep || (Array.isArray(l.processes) && l.processes.some(p => p.process_type === 'toughening' || (p.process_name || '').toLowerCase().includes('toughen')))).length} CEP items</Text>
                  </Col>
                  <Col><Tag color={wo.status === 'in_progress' ? 'processing' : 'default'}>{wo.status}</Tag></Col>
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </MasterForm>
  )
}

export default TougheningForm
