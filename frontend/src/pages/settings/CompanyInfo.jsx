// ─── CompanyInfo.jsx ─────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { Card, Typography, Descriptions, Button, Form, Input, Row, Col, Space, Breadcrumb, Divider, Avatar, App } from 'antd'
import {
  EditOutlined, SaveOutlined, CloseOutlined, BankOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

const getStoredCompany = () => {
  try {
    const data = localStorage.getItem('company_info')
    if (data) return JSON.parse(data)
  } catch (e) {}
  return {
    name:    'ESSAR Glass Manufacturing',
    gstin:   '27AAAAA0000A1Z5',
    pan:     'AAAAA0000A',
    address: 'Plot No. 123, Industrial Area, MIDC, Pune',
    phone:   '+91 20 1234 5678',
    email:   'info@essarglass.com',
  }
}

const defaultCompany = getStoredCompany()

const CompanyInfo = () => {
  const { message } = App.useApp()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()

  const handleSave = async () => {
    try {
      await form.validateFields()
      message.info('Settings module coming soon')
      setEditing(false)
    } catch (_) {}
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/">Home</Link> },
          { title: 'Settings' },
          { title: 'Company' },
        ]}
      />

      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space>
            <Avatar size={40} style={{ background: '#1677ff' }} icon={<BankOutlined />} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Company Information</Title>
              <Text type="secondary">Manage your company details</Text>
            </div>
          </Space>
        </Col>
        <Col>
          {!editing ? (
            <Button type="primary" icon={<EditOutlined />} onClick={() => {
              form.setFieldsValue(defaultCompany)
              setEditing(true)
            }}>
              Edit
            </Button>
          ) : (
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
            </Space>
          )}
        </Col>
      </Row>

      {!editing ? (
        <Card>
          <Descriptions
            bordered
            column={2}
            size="middle"
            labelStyle={{ fontWeight: 600, background: '#fafafa', width: 180 }}
          >
            <Descriptions.Item label="Company Name" span={2}>
              <Text strong style={{ fontSize: 16 }}>{defaultCompany.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="GSTIN">
              <Text code>{defaultCompany.gstin}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="PAN">
              <Text code>{defaultCompany.pan}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Address" span={2}>
              {defaultCompany.address}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              {defaultCompany.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <a href={`mailto:${defaultCompany.email}`}>{defaultCompany.email}</a>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : (
        <Card>
          <Form form={form} layout="vertical" initialValues={defaultCompany}>
            <Divider orientation="left">Company Details</Divider>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                  <Input placeholder="Company name" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="gstin" label="GSTIN">
                  <Input placeholder="27AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="pan" label="PAN">
                  <Input placeholder="AAAAA0000A" maxLength={10} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="address" label="Address">
                  <Input.TextArea rows={2} placeholder="Full address" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="phone" label="Phone">
                  <Input placeholder="+91 XX XXXX XXXX" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email">
                  <Input placeholder="info@company.com" type="email" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}
    </div>
  )
}

export default CompanyInfo
