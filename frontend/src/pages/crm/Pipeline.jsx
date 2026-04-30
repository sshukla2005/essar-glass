// ─── Pipeline.jsx — CRM Kanban Board ────────────────────────────────────────
import React, { useMemo, useState } from 'react'
import {
  Card, Tag, Typography, Button, Space, Badge, Dropdown, Modal, Input, Select,
  InputNumber, Row, Col, Form, message, Spin, Empty
} from 'antd'
import {
  PlusOutlined, MoreOutlined, EditOutlined, CopyOutlined,
  TrophyOutlined, CloseCircleOutlined, StopOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmLeadApi, crmStageApi, customerApi } from '../../api'

const { Title, Text } = Typography

const PRIORITY_COLORS = { low: 'default', normal: 'blue', high: 'orange', urgent: 'red' }

const Pipeline = () => {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [quickForm] = Form.useForm()
  const [lostForm]  = Form.useForm()
  const [quickModal, setQuickModal]       = useState({ open: false, stageId: null })
  const [lostModal, setLostModal]         = useState({ open: false, leadId: null })

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['crm-stages-pipeline'],
    queryFn:  () => crmStageApi.list({ is_active: true, page_size: 100 }).then(r => r.data),
  })

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['crm-leads-pipeline'],
    queryFn:  () => crmLeadApi.list({ page_size: 200 }).then(r => r.data),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn:  () => customerApi.dropdown().then(r => r.data),
  })

  const stages = useMemo(() => {
    const items = stagesData?.items || []
    return [...items].sort((a, b) => a.sequence - b.sequence)
  }, [stagesData])

  const leadsByStage = useMemo(() => {
    const leads = leadsData?.items || []
    const map = {}
    stages.forEach(s => { map[s.id] = [] })
    leads.forEach(l => {
      const sid = l.stage_id || (stages[0]?.id)
      if (map[sid]) map[sid].push(l)
      else if (stages[0]) map[stages[0].id]?.push(l)
    })
    return map
  }, [leadsData, stages])

  // ── Mutations ───────────────────────────────────────────────────────────────
  const moveMutation = useMutation({
    mutationFn: ({ id, data }) => crmLeadApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads-pipeline'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => crmLeadApi.create(data),
    onSuccess: () => {
      message.success('Lead created')
      queryClient.invalidateQueries({ queryKey: ['crm-leads-pipeline'] })
      setQuickModal({ open: false, stageId: null })
      quickForm.resetFields()
    },
  })

  const cloneMutation = useMutation({
    mutationFn: (id) => crmLeadApi.clone(id),
    onSuccess: () => {
      message.success('Lead cloned')
      queryClient.invalidateQueries({ queryKey: ['crm-leads-pipeline'] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, active }) => crmLeadApi.archive(id, active),
    onSuccess: () => {
      message.success('Lead updated')
      queryClient.invalidateQueries({ queryKey: ['crm-leads-pipeline'] })
    },
  })

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleMoveStage = (leadId, stageId) => {
    moveMutation.mutate({ id: leadId, data: { stage_id: stageId } })
  }

  const handleWon = (leadId) => {
    const wonStage = stages.find(s => s.is_won)
    if (wonStage) handleMoveStage(leadId, wonStage.id)
  }

  const handleLost = (leadId) => {
    setLostModal({ open: true, leadId })
    lostForm.resetFields()
  }

  const handleLostConfirm = async () => {
    const values = await lostForm.validateFields()
    const lostStage = stages.find(s => s.is_lost)
    if (lostStage) {
      moveMutation.mutate({
        id: lostModal.leadId,
        data: { stage_id: lostStage.id, lost_reason: values.lost_reason },
      })
    }
    setLostModal({ open: false, leadId: null })
  }

  const handleQuickCreate = async () => {
    const values = await quickForm.validateFields()
    values.stage_id = quickModal.stageId
    createMutation.mutate(values)
  }

  const getCardMenuItems = (lead) => [
    { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => navigate(`/crm/leads/${lead.id}/edit`) },
    { type: 'divider' },
    ...stages.filter(s => s.id !== lead.stage_id).map(s => ({
      key: `move-${s.id}`, label: `Move to ${s.name}`,
      onClick: () => handleMoveStage(lead.id, s.id),
    })),
    { type: 'divider' },
    { key: 'won', icon: <TrophyOutlined />, label: 'Mark as Won', onClick: () => handleWon(lead.id) },
    { key: 'lost', icon: <CloseCircleOutlined />, label: 'Mark as Lost', danger: true, onClick: () => handleLost(lead.id) },
    { type: 'divider' },
    { key: 'clone', icon: <CopyOutlined />, label: 'Duplicate', onClick: () => cloneMutation.mutate(lead.id) },
    { key: 'archive', icon: <StopOutlined />, label: lead.is_active ? 'Archive' : 'Unarchive',
      danger: lead.is_active, onClick: () => archiveMutation.mutate({ id: lead.id, active: !lead.is_active }) },
  ]

  const getColumnBg = (stage) => {
    if (stage.is_won)  return '#f6ffed'
    if (stage.is_lost) return '#fff1f0'
    return '#f0f5ff'
  }

  const formatCurrency = (v) => v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—'

  if (stagesLoading || leadsLoading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Pipeline</Title>
          <Text type="secondary">{leadsData?.total || 0} opportunities</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/crm/leads/new')}>
            New Opportunity
          </Button>
        </Col>
      </Row>

      {/* ── Kanban Board ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16,
        minHeight: 400,
      }}>
        {stages.map(stage => {
          const leads = leadsByStage[stage.id] || []
          const totalRevenue = leads.reduce((sum, l) => sum + (l.expected_revenue || 0), 0)
          return (
            <div key={stage.id} style={{
              minWidth: 300, maxWidth: 300, flexShrink: 0,
              background: getColumnBg(stage),
              borderRadius: 8, padding: 12,
            }}>
              {/* Column Header */}
              <div style={{ marginBottom: 12, padding: '8px 4px', borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
                <Space>
                  <Text strong style={{ fontSize: 14 }}>{stage.name}</Text>
                  <Badge count={leads.length} style={{ background: '#1677ff' }} />
                </Space>
                <div><Text type="secondary" style={{ fontSize: 12 }}>{formatCurrency(totalRevenue)}</Text></div>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                {leads.length === 0 && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leads" style={{ margin: '40px 0' }} />
                )}
                {leads.map(lead => (
                  <Card
                    key={lead.id}
                    size="small"
                    style={{
                      borderRadius: 8, cursor: 'pointer',
                      transition: 'box-shadow 0.2s',
                    }}
                    hoverable
                    styles={{ body: { padding: '10px 12px' } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <a
                        onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}
                        style={{ color: '#1677ff', fontWeight: 500, fontSize: 13, flex: 1 }}
                      >
                        {lead.name}
                      </a>
                      <Dropdown menu={{ items: getCardMenuItems(lead) }} trigger={['click']}>
                        <Button size="small" type="text" icon={<MoreOutlined />} style={{ marginLeft: 4 }} />
                      </Dropdown>
                    </div>
                    {lead.customer?.name && (
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{lead.customer.name}</Text></div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{formatCurrency(lead.expected_revenue)}</Text>
                      <Tag color={PRIORITY_COLORS[lead.priority] || 'default'} style={{ margin: 0 }}>
                        {lead.priority}
                      </Tag>
                    </div>
                    {lead.expected_closing && (
                      <div><Text type="secondary" style={{ fontSize: 11 }}>Close: {lead.expected_closing}</Text></div>
                    )}
                    {lead.salesperson && (
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{lead.salesperson}</Text></div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Add Button */}
              <Button
                type="dashed" block icon={<PlusOutlined />}
                style={{ marginTop: 8 }}
                onClick={() => { setQuickModal({ open: true, stageId: stage.id }); quickForm.resetFields() }}
              >
                Add
              </Button>
            </div>
          )
        })}
      </div>

      {/* ── Quick Create Modal ────────────────────────────────────────── */}
      <Modal
        title="Quick Create Opportunity"
        open={quickModal.open}
        onOk={handleQuickCreate}
        onCancel={() => setQuickModal({ open: false, stageId: null })}
        confirmLoading={createMutation.isPending}
      >
        <Form form={quickForm} layout="vertical">
          <Form.Item name="name" label="Opportunity Title" rules={[{ required: true }]}>
            <Input placeholder="e.g., Glass supply for new project" />
          </Form.Item>
          <Form.Item name="customer_id" label="Customer">
            <Select showSearch allowClear placeholder="Select customer"
              options={customers.map(c => ({ value: c.id, label: c.name }))}
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="expected_revenue" label="Expected Revenue (₹)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Lost Reason Modal ─────────────────────────────────────────── */}
      <Modal
        title="Mark as Lost"
        open={lostModal.open}
        onOk={handleLostConfirm}
        onCancel={() => setLostModal({ open: false, leadId: null })}
        confirmLoading={moveMutation.isPending}
      >
        <Form form={lostForm} layout="vertical">
          <Form.Item name="lost_reason" label="Lost Reason" rules={[{ required: true, message: 'Please provide a reason' }]}>
            <Input.TextArea rows={3} placeholder="Why was this opportunity lost?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Pipeline
