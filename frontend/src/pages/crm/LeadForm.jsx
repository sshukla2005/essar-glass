import React, { useEffect, useMemo } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Radio, Tabs, DatePicker, Steps, Slider, Button, Tag, Badge, Space, App } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { crmLeadApi, crmStageApi, customerApi, quotationApi } from '../../api'

const { TextArea } = Input

const LeadForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    queryFn: () => quotationApi.list({ crm_lead_id: id, page_size: 1 }).then(r => r.data),
    enabled: isEdit,
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

  const tabItems = [
    { key: 'lead', label: 'Lead Info', children: (
      <>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer">
              <Select showSearch allowClear placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                onChange={(val) => { const c = customers.find(x => x.id === val); if (c) form.setFieldsValue({ company_name: c.name, phone: c.phone, email: c.email }) }}
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
    </MasterForm>
  )
}

export default LeadForm
