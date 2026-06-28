import React from 'react'
import { Form, Select, DatePicker, Row, Col, Space, Radio, Typography, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Text } = Typography

const QuotationDetailsCard = ({
  form,
  unit,
  setUnit,
  customers = [],
  employees = [],
  paymentTerms = [],
  handleCustomerChange,
  customerApi,
  queryClient,
  message
}) => {
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

  const handleAddNewCustomer = async (e) => {
    e.preventDefault()
    const name = prompt('Enter customer name:')
    if (!name?.trim()) return
    try {
      const res = await customerApi.create({
        name: name.trim(),
        customer_type: 'individual',
        payment_terms: 'immediate'
      })
      queryClient.invalidateQueries({ queryKey: ['customers-dd'] })
      form.setFieldValue('customer_id', res.data.id)
      message.success(`Customer "${name}" created!`)
    } catch {
      message.error('Failed to create customer')
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
                options={customers.map(c => ({ value: c.id, label: c.name }))}
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
              />
            </Form.Item>
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
}

export default QuotationDetailsCard
