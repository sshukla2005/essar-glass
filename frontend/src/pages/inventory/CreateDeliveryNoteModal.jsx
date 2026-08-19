import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, DatePicker, Select, InputNumber, Table, Button, Space, Row, Col, Card, message, AutoComplete } from 'antd'
import { PlusOutlined, DeleteOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerApi, productApi, deliveryNoteApi } from '../../api'
import { generateDeliveryNotePDF } from '../../utils/pdfGenerator'
import dayjs from 'dayjs'

const CreateDeliveryNoteModal = ({ open, onClose, selectedMovements = [], initialCustomer = null }) => {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState([])

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dd'],
    queryFn: () => customerApi.dropdown().then(r => r.data)
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products-dd'],
    queryFn: () => productApi.dropdown().then(r => r.data)
  })

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        note_date: dayjs(),
        consignee_name: initialCustomer || 'CASH SALES',
        buyer_name: initialCustomer || 'CASH SALES',
      })

      if (selectedMovements && selectedMovements.length > 0) {
        const prefilledLines = selectedMovements.map(m => {
          const prod = products.find(p => p.id === m.product_id || String(p.id) === String(m.product_id))
          return {
            key: m.id || Math.random(),
            description: prod ? prod.name : (m.product_name || `Product #${m.product_id}`),
            hsn_sac: prod ? (prod.hsn_code || prod.hsn || '') : '',
            quantity_sqm: Math.abs(m.quantity_sqm || m.quantity || 0),
            quantity_pcs: Math.abs(m.quantity_sheets || 0),
            rate: prod ? (prod.cost_price || prod.sale_price || '') : '',
            unit: 'Sqmt'
          }
        })
        setLines(prefilledLines)
      } else {
        setLines([
          {
            key: Date.now(),
            description: '',
            hsn_sac: '',
            quantity_sqm: null,
            quantity_pcs: null,
            rate: null,
            unit: 'Sqmt'
          }
        ])
      }
    }
  }, [open, selectedMovements, initialCustomer, products])

  const handleCustomerSelect = (val, type) => {
    const cust = customers.find(c => c.name === val || String(c.id) === String(val))
    if (cust) {
      const updates = {}
      if (type === 'consignee') {
        updates.consignee_name = cust.name
        updates.consignee_address = cust.address || ''
        updates.consignee_state = cust.state || ''
        updates.consignee_state_code = cust.state_code || ''
        updates.consignee_gstin = cust.gstin || ''
        if (!form.getFieldValue('buyer_name') || form.getFieldValue('buyer_name') === 'CASH SALES') {
          updates.buyer_name = cust.name
          updates.buyer_address = cust.address || ''
          updates.buyer_state = cust.state || ''
          updates.buyer_state_code = cust.state_code || ''
          updates.buyer_gstin = cust.gstin || ''
        }
      } else {
        updates.buyer_name = cust.name
        updates.buyer_address = cust.address || ''
        updates.buyer_state = cust.state || ''
        updates.buyer_state_code = cust.state_code || ''
        updates.buyer_gstin = cust.gstin || ''
      }
      form.setFieldsValue(updates)
    }
  }

  const addLine = () => {
    setLines(prev => [
      ...prev,
      {
        key: Date.now() + Math.random(),
        description: '',
        hsn_sac: '',
        quantity_sqm: null,
        quantity_pcs: null,
        rate: null,
        unit: 'Sqmt'
      }
    ])
  }

  const removeLine = (key) => {
    setLines(prev => prev.filter(l => l.key !== key))
  }

  const updateLine = (key, field, val) => {
    setLines(prev =>
      prev.map(line => {
        if (line.key === key) {
          return { ...line, [field]: val }
        }
        return line
      })
    )
  }

  const createMutation = useMutation({
    mutationFn: (payload) => deliveryNoteApi.create(payload),
    onSuccess: async (res) => {
      message.success(`Delivery Note ${res.data.note_number} generated successfully!`)
      queryClient.invalidateQueries(['delivery-notes'])
      
      try {
        await generateDeliveryNotePDF(res.data)
      } catch (pdfErr) {
        console.error('PDF auto-download failed:', pdfErr)
        message.warning('Delivery Note created, but PDF download failed. Try re-generating from list.')
      }

      onClose()
    },
    onError: (err) => {
      message.error(err.response?.data?.detail || 'Failed to create Delivery Note')
    }
  })

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      const payload = {
        note_date: values.note_date ? values.note_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        consignee_name: values.consignee_name,
        consignee_address: values.consignee_address,
        consignee_state: values.consignee_state,
        consignee_state_code: values.consignee_state_code,
        consignee_gstin: values.consignee_gstin,

        buyer_name: values.buyer_name,
        buyer_address: values.buyer_address,
        buyer_state: values.buyer_state,
        buyer_state_code: values.buyer_state_code,
        buyer_gstin: values.buyer_gstin,

        place_of_supply: values.place_of_supply,
        eway_bill_no: values.eway_bill_no,
        payment_terms: values.payment_terms,
        reference_no: values.reference_no,
        other_references: values.other_references,
        buyers_order_no: values.buyers_order_no,
        buyers_order_date: values.buyers_order_date ? values.buyers_order_date.format('YYYY-MM-DD') : null,
        dispatch_doc_no: values.dispatch_doc_no,
        dispatched_through: values.dispatched_through,
        destination: values.destination,
        terms_of_delivery: values.terms_of_delivery,

        lines: lines.map(l => ({
          description: l.description,
          hsn_sac: l.hsn_sac,
          quantity_sqm: l.quantity_sqm !== null && l.quantity_sqm !== undefined ? parseFloat(l.quantity_sqm) : null,
          quantity_pcs: l.quantity_pcs !== null && l.quantity_pcs !== undefined ? parseFloat(l.quantity_pcs) : null,
          rate: (l.rate !== null && l.rate !== undefined && String(l.rate).trim() !== '') ? parseFloat(l.rate) : null,
          unit: l.unit || 'Sqmt'
        }))
      }

      createMutation.mutate(payload)
    } catch (err) {
      console.error('Validation failed:', err)
    }
  }

  const columns = [
    {
      title: 'Item Description',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      render: (val, record) => (
        <AutoComplete
          value={val}
          options={products.map(p => ({ value: p.name, product: p }))}
          onChange={v => updateLine(record.key, 'description', v)}
          onSelect={(v, opt) => {
            if (opt.product) {
              updateLine(record.key, 'description', opt.product.name)
              if (opt.product.hsn_code || opt.product.hsn) {
                updateLine(record.key, 'hsn_sac', opt.product.hsn_code || opt.product.hsn)
              }
              if (opt.product.cost_price || opt.product.sale_price) {
                updateLine(record.key, 'rate', opt.product.cost_price || opt.product.sale_price)
              }
            }
          }}
          placeholder="Product / Item name"
        />
      )
    },
    {
      title: 'HSN/SAC',
      dataIndex: 'hsn_sac',
      key: 'hsn_sac',
      width: 110,
      render: (val, record) => (
        <Input
          value={val}
          onChange={e => updateLine(record.key, 'hsn_sac', e.target.value)}
          placeholder="HSN"
        />
      )
    },
    {
      title: 'QTY (sqm)',
      dataIndex: 'quantity_sqm',
      key: 'quantity_sqm',
      width: 120,
      render: (val, record) => (
        <InputNumber
          min={0}
          step={0.001}
          precision={4}
          style={{ width: '100%' }}
          value={val}
          onChange={v => updateLine(record.key, 'quantity_sqm', v)}
          placeholder="Sqm"
        />
      )
    },
    {
      title: 'QTY (pcs)',
      dataIndex: 'quantity_pcs',
      key: 'quantity_pcs',
      width: 110,
      render: (val, record) => (
        <InputNumber
          min={0}
          step={1}
          style={{ width: '100%' }}
          value={val}
          onChange={v => updateLine(record.key, 'quantity_pcs', v)}
          placeholder="Sheets"
        />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: 110,
      render: (val, record) => (
        <InputNumber
          min={0}
          step={1}
          precision={2}
          style={{ width: '100%' }}
          value={val}
          onChange={v => updateLine(record.key, 'rate', v)}
          placeholder="Blank if N/A"
        />
      )
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      render: (val, record) => (
        <Select
          value={val || 'Sqmt'}
          onChange={v => updateLine(record.key, 'unit', v)}
          options={[
            { label: 'Sqmt', value: 'Sqmt' },
            { label: 'PCS', value: 'PCS' }
          ]}
        />
      )
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 110,
      align: 'right',
      render: (_, record) => {
        const rate = record.rate !== null && record.rate !== undefined && String(record.rate).trim() !== '' ? parseFloat(record.rate) : null
        if (rate === null || isNaN(rate)) return <span style={{ color: '#999' }}>—</span>
        const qty = record.quantity_sqm ? parseFloat(record.quantity_sqm) : (record.quantity_pcs ? parseFloat(record.quantity_pcs) : 0)
        return <strong>{(qty * rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      }
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.key)}
          disabled={lines.length <= 1}
        />
      )
    }
  ]

  const customerOptions = customers.map(c => ({ label: c.name, value: c.name }))

  return (
    <Modal
      title={
        <Space>
          <FilePdfOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <span>Create Delivery Note (Tally Style)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending}
      width={1100}
      okText="Generate & Print PDF"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="note_date" label="Document Date" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="payment_terms" label="Mode/Terms of Payment">
              <Input placeholder="e.g. Immediate / 30 Days" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="eway_bill_no" label="e-Way Bill No.">
              <Input placeholder="e.g. 351000..." />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="reference_no" label="Reference No. & Date">
              <Input placeholder="e.g. REF-2026" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          {/* Consignee */}
          <Col span={12}>
            <Card size="small" title="Consignee (Ship to)" style={{ marginBottom: 16 }}>
              <Form.Item name="consignee_name" label="Consignee Name" rules={[{ required: true }]}>
                <AutoComplete
                  options={customerOptions}
                  onSelect={v => handleCustomerSelect(v, 'consignee')}
                  placeholder="Select or enter consignee..."
                />
              </Form.Item>
              <Form.Item name="consignee_address" label="Address">
                <Input.TextArea rows={2} placeholder="Consignee address" />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="consignee_state" label="State">
                    <Input placeholder="State" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="consignee_state_code" label="Code">
                    <Input placeholder="State code" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="consignee_gstin" label="GSTIN">
                    <Input placeholder="GSTIN" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Buyer */}
          <Col span={12}>
            <Card size="small" title="Buyer (Bill to)" style={{ marginBottom: 16 }}>
              <Form.Item name="buyer_name" label="Buyer Name">
                <AutoComplete
                  options={customerOptions}
                  onSelect={v => handleCustomerSelect(v, 'buyer')}
                  placeholder="Select or enter buyer..."
                />
              </Form.Item>
              <Form.Item name="buyer_address" label="Address">
                <Input.TextArea rows={2} placeholder="Buyer address" />
              </Form.Item>
              <Row gutter={8}>
                <Col span={10}>
                  <Form.Item name="buyer_state" label="State">
                    <Input placeholder="State" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="buyer_state_code" label="Code">
                    <Input placeholder="Code" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="place_of_supply" label="Place of Supply">
                    <Input placeholder="Place of Supply" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="buyers_order_no" label="Buyer's Order No.">
              <Input placeholder="Order No." />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="buyers_order_date" label="Buyer's Order Date">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="dispatch_doc_no" label="Dispatch Doc No.">
              <Input placeholder="Doc No." />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="dispatched_through" label="Dispatched Through">
              <Input placeholder="Transporter / Vehicle" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="destination" label="Destination">
              <Input placeholder="Destination City / Location" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="terms_of_delivery" label="Terms of Delivery">
              <Input placeholder="e.g. Door delivery, Freight paid" />
            </Form.Item>
          </Col>
        </Row>

        {/* Item Table */}
        <Card
          size="small"
          title="Line Items"
          extra={
            <Button type="dashed" onClick={addLine} icon={<PlusOutlined />}>
              Add Item
            </Button>
          }
        >
          <Table
            dataSource={lines}
            columns={columns}
            pagination={false}
            size="small"
            rowKey="key"
          />
        </Card>
      </Form>
    </Modal>
  )
}

export default CreateDeliveryNoteModal
