import React, { useState, useImperativeHandle, forwardRef } from 'react'
import { Form, Select, DatePicker, Row, Col, Space, Radio, Typography, Button, Modal, Input } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Text } = Typography

const QuotationDetailsCard = forwardRef(({
  form,
  unit,
  setUnit,
  customers = [],
  employees = [],
  paymentTerms = [],
  handleCustomerChange,
  customerApi,
  employeeApi,
  queryClient,
  message
}, ref) => {
  const lbl = (text) => (
    <span style={{ 
      fontSize: 11, 
      color: '#475569', 
      fontWeight: 600, 
      textTransform: 'uppercase', 
      letterSpacing: '0.05em' 
    }}>
      {text}
    </span>
  )

  // ── Customer quick-add modal ───────────────────────────────────
  const [custModal, setCustModal]   = useState(false)
  const [custName, setCustName]     = useState('')
  const [custPhone, setCustPhone]   = useState('')
  const [custAdding, setCustAdding] = useState(false)

  // ── Salesperson quick-add modal ───────────────────────────────
  const [empModal, setEmpModal]   = useState(false)
  const [empName, setEmpName]     = useState('')
  const [empAdding, setEmpAdding] = useState(false)

  // Expose openAddCustomer to parent (QuotationForm) via ref
  // so Excel import can trigger the same dedup modal
  useImperativeHandle(ref, () => ({
    openAddCustomer: (prefillName = '') => {
      setCustName(prefillName)
      setCustPhone('')
      setCustModal(true)
    }
  }))

  const openAddCustomer = (prefillName = '') => {
    setCustName(prefillName)
    setCustPhone('')
    setCustModal(true)
  }

  const handleAddNewCustomer = (e) => {
    e.preventDefault()
    openAddCustomer()
  }

  const handleCustModalOk = async () => {
    if (!custName.trim()) {
      message.warning('Please enter a customer name')
      return
    }
    setCustAdding(true)
    try {
      const phone = custPhone.trim()

      // Phone dedup — check existing loaded customers first
      if (phone) {
        const existing = customers.find(c =>
          c.phone === phone || c.mobile === phone
        )
        if (existing) {
          form.setFieldValue('customer_id', existing.id)
          handleCustomerChange(existing.id)
          message.info(`Existing customer matched by phone: "${existing.name}"`)
          setCustModal(false)
          setCustName(''); setCustPhone('')
          return
        }
      }

      // No duplicate found — create new
      const res = await customerApi.create({
        name: custName.trim(),
        phone: phone || undefined,
        customer_type: 'individual',
        payment_terms: 'immediate',
      })
      await queryClient.invalidateQueries({ queryKey: ['customers-dd'] })
      form.setFieldValue('customer_id', res.data.id)
      handleCustomerChange(res.data.id)
      message.success(
        phone
          ? `Customer "${custName.trim()}" created`
          : `Customer "${custName.trim()}" created — add phone in customer master to enable dedup next time`
      )
      setCustModal(false)
      setCustName(''); setCustPhone('')
    } catch {
      message.error('Failed to create customer')
    } finally {
      setCustAdding(false)
    }
  }

  const handleAddEmployee = async () => {
    if (!empName.trim()) return
    setEmpAdding(true)
    try {
      const res = await employeeApi.create({ name: empName.trim() })
      await queryClient.invalidateQueries({ queryKey: ['employees-dd'] })
      form.setFieldValue('salesperson', res.data.name)
      message.success(`Salesperson "${res.data.name}" added`)
      setEmpModal(false)
      setEmpName('')
    } catch {
      message.error('Could not add salesperson')
    } finally {
      setEmpAdding(false)
    }
  }

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 14, 
      border: '1px solid #E2E8F0', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
      marginBottom: 20,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 24px', 
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFD'
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', letterSpacing: -0.1 }}>
          Quotation Details
        </span>
        <Space>
          <Radio.Group 
            value={unit} 
            onChange={e => setUnit(e.target.value)} 
            buttonStyle="solid" 
            size="small"
            style={{ borderRadius: 6 }}
          >
            <Radio.Button value="inch" style={{ borderRadius: '6px 0 0 6px' }}>inch</Radio.Button>
            <Radio.Button value="mm" style={{ borderRadius: '0 6px 6px 0' }}>MM</Radio.Button>
          </Radio.Group>
          <Text type="secondary" style={{ fontSize: 11 }}>(Default: Inch)</Text>
        </Space>
      </div>

      {/* Form Content */}
      <div style={{ padding: '24px 24px' }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={8}>
            <Form.Item 
              name="customer_id" 
              label={lbl('Customer')} 
              rules={[{ required: true, message: 'Please select a customer' }]}
              style={{ marginBottom: 0 }}
            >
              <Select 
                showSearch 
                placeholder="Select customer" 
                options={[...customers]
                  .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))
                  .map(c => ({ value: c.id, label: c.name }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} 
                onChange={handleCustomerChange}
                size="large"
                style={{ borderRadius: 8 }}
                dropdownRender={menu => (
                  <>
                    {menu}
                    <div 
                      style={{ 
                        padding: '8px 12px', 
                        cursor: 'pointer', 
                        color: '#6366f1', 
                        fontWeight: 600, 
                        borderTop: '1px solid #f0f0f0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6 
                      }}
                      onMouseDown={handleAddNewCustomer}
                    >
                      <PlusOutlined /> Create new customer
                    </div>
                  </>
                )}
              />
            </Form.Item>

            {/* Customer add modal with phone dedup */}
            <Modal
              title="Add New Customer"
              open={custModal}
              onCancel={() => { setCustModal(false); setCustName(''); setCustPhone('') }}
              onOk={handleCustModalOk}
              okText="Add Customer"
              confirmLoading={custAdding}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Customer Name *</div>
                  <Input
                    placeholder="e.g. Modi Windows"
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    Phone Number <span style={{ color: '#94a3b8' }}>(used to detect duplicates)</span>
                  </div>
                  <Input
                    placeholder="+91 XXXXX XXXXX"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    onPressEnter={handleCustModalOk}
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    If this phone already exists, the matching customer will be selected instead of creating a duplicate.
                  </div>
                </div>
              </div>
            </Modal>
          </Col>

          <Col xs={12} md={4}>
            <Form.Item name="quote_date" label={lbl('Quote Date')} style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" size="large" />
            </Form.Item>
          </Col>

          <Col xs={12} md={4}>
            <Form.Item name="valid_until" label={lbl('Valid Until')} style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" size="large" />
            </Form.Item>
          </Col>

          <Col xs={12} md={4}>
            <Form.Item name="salesperson" label={lbl('Salesperson')} style={{ marginBottom: 0 }}>
              <Select 
                showSearch 
                allowClear 
                placeholder="Select salesperson" 
                optionFilterProp="label" 
                options={employees.map(e => ({ value: e.name, label: e.name }))} 
                size="large"
                style={{ borderRadius: 8 }}
                dropdownRender={menu => (
                  <>
                    {menu}
                    <div style={{ padding: '8px 8px 4px', borderTop: '1px solid #f0f0f0' }}>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        style={{ width: '100%' }}
                        onMouseDown={e => { e.preventDefault(); setEmpModal(true) }}
                      >
                        Add New Salesperson
                      </Button>
                    </div>
                  </>
                )}
              />
            </Form.Item>

            {/* Salesperson add modal */}
            <Modal
              title="Add New Salesperson"
              open={empModal}
              onCancel={() => { setEmpModal(false); setEmpName('') }}
              onOk={handleAddEmployee}
              okText="Add"
              confirmLoading={empAdding}
            >
              <Input
                placeholder="Enter salesperson name"
                value={empName}
                onChange={e => setEmpName(e.target.value)}
                onPressEnter={handleAddEmployee}
                autoFocus
                style={{ marginTop: 8 }}
              />
            </Modal>
          </Col>

          <Col xs={12} md={4}>
            <Form.Item name="payment_terms" label={lbl('Payment Terms')} style={{ marginBottom: 0 }}>
              <Select options={paymentTerms} size="large" style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>
      </div>
    </div>
  )
})

export default QuotationDetailsCard
