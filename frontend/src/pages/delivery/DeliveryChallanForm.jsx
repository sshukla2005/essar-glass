import React, { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, DatePicker, Button, Table, Steps, Space, Tag, App } from 'antd'
import { PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined, CarOutlined, DollarOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { deliveryChallanApi, customerApi, productApi, stockMovementApi, salesOrderApi } from '../../api'
import CompanySelector from '../../components/common/CompanySelector'

const STATUS_STEPS = ['draft', 'dispatched', 'delivered']
const STATUS_IDX = { draft: 0, dispatched: 1, delivered: 2, returned: 0 }

const emptyLine = () => ({ key: Date.now() + Math.random(), product_id: null, quantity: 1, qty_dispatched: 1, remarks: '' })

const DeliveryChallanForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState([emptyLine()])

  const { data: record, isLoading } = useQuery({ queryKey: ['delivery_challans', id], queryFn: () => deliveryChallanApi.get(id).then(r => r.data), enabled: isEdit })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: sos = [] } = useQuery({ queryKey: ['sales_orders-dd'], queryFn: () => salesOrderApi.dropdown().then(r => r.data) })

  useEffect(() => { if (!isEdit) form.setFieldValue('dc_date', dayjs()) }, [])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({ ...record, dc_date: record.dc_date ? dayjs(record.dc_date) : null })
      if (record.lines?.length) setLines(record.lines.map((l, i) => ({ ...l, key: l.id || Date.now() + i })))
    }
  }, [record, form])

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) updated.description = prod.name
      }
      return updated
    }))
  }

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? deliveryChallanApi.update(id, data) : deliveryChallanApi.create(data),
    onSuccess: (res) => { message.success(`DC ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['delivery_challans'] }); if (!isEdit && res?.data?.id) navigate(`/delivery-challans/${res.data.id}/edit`) },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => deliveryChallanApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delivery_challans', id] }),
  })

  const deliverMutation = useMutation({
    mutationFn: async () => {
      for (const line of lines) {
        if (line.product_id) {
          await stockMovementApi.create({
            product_id: line.product_id, quantity: line.qty_dispatched || line.quantity, movement_type: 'out',
            dc_id: parseInt(id), reference: record?.dc_number, date: new Date().toISOString()
          })
        }
      }
      await deliveryChallanApi.changeStatus(id, 'delivered')
    },
    onSuccess: () => { message.success('Stock deducted successfully'); queryClient.invalidateQueries({ queryKey: ['delivery_challans', id] }) }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.dc_date) values.dc_date = values.dc_date.format('YYYY-MM-DD')
      values.lines = lines
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setLines([emptyLine()]); navigate('/delivery-challans/new') }
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
    { title: 'Description', width: 160, dataIndex: 'description', render: (v, row) => <Input size="small" value={v} onChange={e => updateLine(row.key, 'description', e.target.value)} /> },
    { title: 'W(mm)', width: 80, dataIndex: 'width_mm', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'width_mm', val)} /> },
    { title: 'H(mm)', width: 80, dataIndex: 'height_mm', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'height_mm', val)} /> },
    { title: 'Ordered', width: 80, dataIndex: 'quantity', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'quantity', val)} /> },
    { title: 'Dispatched', width: 100, dataIndex: 'qty_dispatched', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'qty_dispatched', val)} /> },
    { title: 'Remarks', width: 150, dataIndex: 'remarks', render: (v, row) => <Input size="small" value={v} onChange={e => updateLine(row.key, 'remarks', e.target.value)} /> },
    { title: '', width: 40, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter(l => l.key !== row.key))} /> },
  ]

  return (
    <MasterForm title="Delivery Challan" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Inventory' }, { label: 'Deliveries', path: '/delivery-challans' }, { label: isEdit ? record?.dc_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/delivery-challans')}>

      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          {record?.so_id && <Button icon={<CarOutlined />} onClick={() => navigate(`/sales-orders/${record.so_id}/edit`)}>Sales Order</Button>}
          <Button icon={<DollarOutlined />} onClick={() => navigate(`/invoices?dc_id=${id}`)}>Invoices</Button>
        </div>
      )}

      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            {status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={() => statusMutation.mutate('dispatched')} style={{ background: '#3b82f6' }}>Dispatch</Button>}
            {status === 'dispatched' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => deliverMutation.mutate()} style={{ background: '#10b981' }}>Mark Delivered</Button>}
            {status === 'delivered' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ DELIVERED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <CompanySelector form={form} />
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select 
                showSearch 
                options={customers.map(c => ({ value: c.id, label: c.name }))} 
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="dc_date" label="Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={6}><Form.Item name="so_id" label="Sales Order Ref"><Select options={sos.map(s => ({ value: s.id, label: s.so_number }))} allowClear /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="vehicle_number" label="Vehicle Number"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="driver_name" label="Driver Name"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="transporter" label="Transporter"><Input /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="delivery_address" label="Delivery Address"><Input.TextArea rows={2} /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#10b981' }}>Items Dispatched</Divider>
        <Table dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false} scroll={{ x: 1000 }} style={{ marginBottom: 8 }} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setLines([...lines, emptyLine()])} style={{ marginBottom: 16 }}>Add Line</Button>
      </Form>
    </MasterForm>
  )
}

export default DeliveryChallanForm
