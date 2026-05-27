import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Radio, Tabs, DatePicker, Steps, Slider, Button, Tag, Badge, Space, App, Modal } from 'antd'
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { crmLeadApi, crmStageApi, customerApi, quotationApi } from '../../api'
import CompanySelector from '../../components/common/CompanySelector'

const { TextArea } = Input

const LeadForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [customerSearch, setCustomerSearch]       = useState('')
  const [createCustModal, setCreateCustModal]     = useState(false)
  const [newCustName, setNewCustName]             = useState('')
  const [createCustForm]                          = Form.useForm()

  const { data: record, isLoading } = useQuery({
    queryKey: ['crm-leads', id], queryFn: () => crmLeadApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: stagesData } = useQuery({
    queryKey: ['crm-stages-all'], queryFn: () => crmStageApi.list({ is_active: true, page_size: 100 }).then(r => r.data),
  })
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dropdown'], queryFn: () => customerApi.dropdown().then(r => r.data),
  })

  // ── Linked quotations count (smart button) ─────────────────────────────────
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations-for-lead', id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const allQuotes = JSON.parse(localStorage.getItem('quotations') || '[]')
        const linked = allQuotes.filter(q =>
          q.is_active !== false &&
          (String(q.crm_lead_id) === String(id) || q.crm_lead_id === parseInt(id))
        )
        return { total: linked.length, items: linked }
      } catch {
        return { total: 0, items: [] }
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
  const quotationCount = quotationsData?.total || 0

  const stages = useMemo(() => [...(stagesData?.items || [])].sort((a, b) => a.sequence - b.sequence), [stagesData])
  const currentStageIdx = useMemo(() => stages.findIndex(s => s.id === (record?.stage_id || form.getFieldValue('stage_id'))), [record, stages])
  const currentStage = useMemo(() => stages.find(s => s.id === (record?.stage_id || form.getFieldValue('stage_id'))), [record, stages])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({ ...record, customer_id: record.customer?.id || record.customer_id,
        stage_id: record.stage?.id || record.stage_id,
        expected_closing: record.expected_closing ? dayjs(record.expected_closing) : null })
    }
  }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? crmLeadApi.update(id, data) : crmLeadApi.create(data),
    onSuccess: () => { message.success(`Lead ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['crm-leads'] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.expected_closing) values.expected_closing = values.expected_closing.format('YYYY-MM-DD')
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/crm/leads/new') } else navigate('/crm/leads')
    } catch (_) {}
  }

  const handleStageClick = (idx) => {
    const stage = stages[idx]
    if (stage) form.setFieldValue('stage_id', stage.id)
  }

  // ── Inline customer creation ───────────────────────────────────────────────
  const handleCreateCustomerInline = async (values) => {
    try {
      const allCustomers = JSON.parse(
        localStorage.getItem('customers') || '[]'
      )
      const newId   = allCustomers.length
        ? Math.max(...allCustomers.map(r => r.id || 0)) + 1
        : 1
      const newCode = `CUST${String(newId).padStart(4, '0')}`

      let company_id = 1
      try {
        const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
        company_id = u.company_id || 1
      } catch {}

      const newCustomer = {
        id:            newId,
        name:          values.name.trim(),
        customer_code: newCode,
        customer_type: values.customer_type || 'company',
        phone:         values.phone   || null,
        mobile:        values.mobile  || null,
        email:         values.email   || null,
        city:          values.city    || null,
        state:         values.state   || null,
        gstin:         values.gstin   || null,
        payment_terms: values.payment_terms || null,
        company_id,
        is_active:  true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      allCustomers.push(newCustomer)
      localStorage.setItem('customers', JSON.stringify(allCustomers))

      // Link this new customer to the form
      form.setFieldsValue({
        customer_id: newId,
        company_name: newCustomer.name,
        phone:  newCustomer.phone  || form.getFieldValue('phone'),
        email:  newCustomer.email  || form.getFieldValue('email'),
        mobile: newCustomer.mobile || form.getFieldValue('mobile'),
      })

      // Refresh customers dropdown
      queryClient.invalidateQueries({ queryKey: ['customers-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })

      message.success(
        `✅ Customer "${newCustomer.name}" (${newCode}) created and linked!`
      )
      setCreateCustModal(false)
      createCustForm.resetFields()
      setCustomerSearch('')
    } catch (e) {
      message.error('Failed to create customer')
    }
  }

  const tabItems = [
    { key: 'lead', label: 'Lead Info', children: (
      <>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer">
              <Select
                showSearch
                allowClear
                placeholder="Search or create customer..."
                filterOption={false}
                onSearch={val => setCustomerSearch(val)}
                onChange={(val) => {
                  if (val) {
                    const allCusts = JSON.parse(localStorage.getItem('customers') || '[]')
                    const cust = allCusts.find(c => c.id === val)
                    if (cust) {
                      form.setFieldsValue({
                        company_name: cust.name,
                        phone:   cust.phone  || form.getFieldValue('phone'),
                        email:   cust.email  || form.getFieldValue('email'),
                        mobile:  cust.mobile || form.getFieldValue('mobile'),
                      })
                    }
                  }
                }}
                notFoundContent={
                  customerSearch.trim() ? (
                    <div
                      style={{
                        padding: '8px 12px', cursor: 'pointer', color: '#6366f1',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 6, background: '#f5f3ff', margin: 4,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setNewCustName(customerSearch.trim())
                        createCustForm.setFieldsValue({ name: customerSearch.trim() })
                        setCreateCustModal(true)
                      }}
                    >
                      <PlusOutlined />
                      Create "{customerSearch}" as new customer
                    </div>
                  ) : (
                    <div style={{ padding: 8, color: '#94a3b8', textAlign: 'center' }}>
                      Type to search customers
                    </div>
                  )
                }
                options={customers
                  .filter(c => {
                    if (!customerSearch.trim()) return true
                    return c.name?.toLowerCase().includes(customerSearch.toLowerCase())
                  })
                  .map(c => ({
                    value: c.id,
                    label: (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.name}</span>
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>{c.customer_code}</span>
                      </div>
                    ),
                  }))
                }
              />
            </Form.Item>
          </Col>
          <Col span={8}><Form.Item name="contact_name" label="Contact Name"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="company_name" label="Company Name"><Input /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="email" label="Email"><Input type="email" /></Form.Item></Col>
          <Col span={6}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="mobile" label="Mobile"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="lead_type" label="Type"><Radio.Group><Radio.Button value="lead">Lead</Radio.Button><Radio.Button value="opportunity">Opportunity</Radio.Button></Radio.Group></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="salesperson" label="Salesperson"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="sales_team" label="Sales Team"><Input /></Form.Item></Col>
        </Row>
      </>
    )},
    { key: 'extra', label: 'Extra Info', children: (
      <>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="expected_revenue" label="Expected Revenue (₹)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="probability" label="Probability (%)"><Slider min={0} max={100} /></Form.Item></Col>
          <Col span={8}><Form.Item name="expected_closing" label="Expected Closing"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        {currentStage?.is_lost && <Form.Item name="lost_reason" label="Lost Reason"><TextArea rows={3} /></Form.Item>}
        <Divider orientation="left">Description</Divider>
        <Form.Item name="description"><TextArea rows={4} placeholder="Describe this opportunity..." /></Form.Item>
      </>
    )},
    { key: 'notes', label: 'Internal Notes', children: <Form.Item name="internal_notes"><TextArea rows={8} /></Form.Item> },
  ]

  return (
    <MasterForm title="Lead" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'CRM' }, { label: 'Leads', path: '/crm/leads' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/crm/leads')}>
      {/* ── Smart Buttons (Odoo-style) ─────────────────────────────── */}
      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Badge count={quotationCount} showZero style={{ backgroundColor: quotationCount > 0 ? '#1677ff' : '#d9d9d9' }}>
            <Button icon={<FileTextOutlined />}
              onClick={() => navigate(`/quotations?lead_id=${id}`)}
              style={{ fontWeight: 500 }}
            >
              Quotations
            </Button>
          </Badge>
        </div>
      )}

      <Form form={form} layout="vertical" initialValues={{ lead_type: 'opportunity', priority: 'normal', probability: 10, expected_revenue: 0, stage_id: stages[0]?.id }}>
        <CompanySelector form={form} />
        <Row gutter={16} align="middle">
          <Col span={14}><Form.Item name="name" label="Opportunity Title" rules={[{ required: true }]}><Input style={{ fontSize: 16, fontWeight: 500 }} /></Form.Item></Col>
          <Col span={10}><Form.Item name="priority" label="Priority"><Radio.Group>
            <Radio.Button value="low">Low</Radio.Button><Radio.Button value="normal">Normal</Radio.Button>
            <Radio.Button value="high">High</Radio.Button><Radio.Button value="urgent">Urgent</Radio.Button>
          </Radio.Group></Form.Item></Col>
        </Row>
        <Form.Item name="stage_id" hidden><Input /></Form.Item>
        {stages.length > 0 && <div style={{ marginBottom: 24 }}><Steps current={currentStageIdx >= 0 ? currentStageIdx : 0} size="small"
          items={stages.map((s, i) => ({ title: s.name, style: { cursor: 'pointer' } }))} onChange={handleStageClick} /></div>}
        <Divider />
        <Tabs items={tabItems} size="large" />
        {isEdit && <div style={{ marginTop: 16 }}><Button icon={<FileTextOutlined />}
          onClick={() => navigate(`/quotations/new?lead_id=${id}&customer_id=${form.getFieldValue('customer_id') || ''}`)}>Create Quotation</Button></div>}
      </Form>

      {/* ── Create Customer Modal ──────────────────────────────────── */}
      <Modal
        title={<Space><PlusOutlined style={{ color: '#6366f1' }} /><span>Create New Customer</span></Space>}
        open={createCustModal}
        onCancel={() => { setCreateCustModal(false); createCustForm.resetFields() }}
        footer={null}
        width={520}
      >
        <div style={{
          background: '#f5f3ff', border: '1px solid #e0d9ff', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#6366f1',
        }}>
          💡 This customer will be saved to Masters → Customers automatically
        </div>

        <Form form={createCustForm} layout="vertical" onFinish={handleCreateCustomerInline}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="Customer Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="Full company or person name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="customer_type" label="Type" initialValue="company">
                <Select options={[
                  { value: 'company',    label: 'Company' },
                  { value: 'individual', label: 'Individual' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone"><Input placeholder="+91 XXXXX XXXXX" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email"><Input placeholder="email@company.com" type="email" /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gstin" label="GSTIN (optional)">
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="City"><Input placeholder="Mumbai" /></Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setCreateCustModal(false); createCustForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#6366f1', borderColor: '#6366f1' }}>Create & Link Customer</Button>
          </div>
        </Form>
      </Modal>
    </MasterForm>
  )
}

export default LeadForm
