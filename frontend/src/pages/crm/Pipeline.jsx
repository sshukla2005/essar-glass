import React, { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Tag, Modal, Form, Input, Select, Avatar, Tooltip, Dropdown, InputNumber, Badge, Typography, Space, Empty, App } from 'antd'
import { 
  PlusOutlined, UserOutlined, PhoneOutlined,
  MoreOutlined, EditOutlined, TrophyOutlined,
  CloseCircleOutlined, CopyOutlined, EllipsisOutlined,
  DollarOutlined, CalendarOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { crmLeadApi, crmStageApi, customerApi } from '../../api'

const { Text, Title } = Typography

const Pipeline = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [quickAddModal, setQuickAddModal] = useState(null)
  const [lostModal, setLostModal] = useState(null)
  const [quickForm] = Form.useForm()

  // Fetch stages sorted by sequence
  const { data: stagesData } = useQuery({
    queryKey: ['crm_stages'],
    queryFn: () => crmStageApi.list({ page_size: 100 }).then(r => r.data),
  })

  const { data: leadsData } = useQuery({
    queryKey: ['crm_leads'],
    queryFn: () => crmLeadApi.list({ page_size: 500 }).then(r => r.data),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: () => customerApi.dropdown().then(r => r.data),
  })

  const stages = useMemo(() => {
    return (stagesData?.items || []).sort((a, b) => a.sequence - b.sequence)
  }, [stagesData])

  const leads = leadsData?.items || []

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped = {}
    stages.forEach(s => { grouped[s.id] = [] })
    leads.forEach(lead => {
      if (lead.is_active !== false) {
        const sid = lead.stage_id || stages[0]?.id
        if (grouped[sid]) grouped[sid].push(lead)
        else grouped[sid] = [lead]
      }
    })
    return grouped
  }, [leads, stages])

  // Drag end handler
  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && 
        destination.index === source.index) return
    
    const newStageId = parseInt(destination.droppableId)
    const leadId = parseInt(draggableId)
    const targetStage = stages.find(s => s.id === newStageId)

    if (targetStage?.is_lost) {
      setLostModal({ leadId, stageId: newStageId })
      return
    }

    await crmLeadApi.update(leadId, { stage_id: newStageId })
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    message.success(`Moved to ${targetStage?.name}`)
  }

  // Quick add lead to stage
  const handleQuickAdd = async (values) => {
    const data = {
      ...values,
      stage_id: quickAddModal,
      lead_number: null,
      is_active: true,
    }
    await crmLeadApi.create(data)
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    message.success('Lead added!')
    quickForm.resetFields()
    setQuickAddModal(null)
  }

  // Stage column colors
  const stageColors = {
    won:  { bg: '#f0fdf4', border: '#86efac', header: '#16a34a' },
    lost: { bg: '#fff1f2', border: '#fca5a5', header: '#dc2626' },
    normal: { bg: '#f8faff', border: '#e2e8f0', header: '#3b82f6' },
  }

  const getStageStyle = (stage) => {
    if (stage.is_won)  return stageColors.won
    if (stage.is_lost) return stageColors.lost
    return stageColors.normal
  }

  // Priority colors
  const priorityColors = { low: 'default', normal: 'blue', high: 'orange', urgent: 'red' }

  // Card menu items
  const getCardMenu = (lead) => [
    { key: 'edit',  icon: <EditOutlined />,        label: 'Edit',         onClick: () => navigate(`/crm/leads/${lead.id}/edit`) },
    { key: 'won',   icon: <TrophyOutlined />,       label: 'Mark as Won',  onClick: () => markWon(lead), disabled: lead.stage?.is_won },
    { key: 'lost',  icon: <CloseCircleOutlined />,   label: 'Mark as Lost', onClick: () => setLostModal({ leadId: lead.id, stageId: stages.find(s=>s.is_lost)?.id }), disabled: lead.stage?.is_lost },
    { key: 'clone', icon: <CopyOutlined />,          label: 'Duplicate',    onClick: () => cloneLead(lead.id) },
    { type: 'divider' },
    { key: 'archive', label: 'Archive', danger: true, onClick: () => archiveLead(lead.id) },
  ]

  const markWon = async (lead) => {
    const wonStage = stages.find(s => s.is_won)
    if (!wonStage) return
    await crmLeadApi.update(lead.id, { stage_id: wonStage.id })
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    message.success('🏆 Marked as Won!')
  }

  const cloneLead = async (id) => {
    await crmLeadApi.clone(id)
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    message.success('Lead duplicated')
  }

  const archiveLead = async (id) => {
    await crmLeadApi.archive(id, false)
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    message.success('Lead archived')
  }

  const handleLostConfirm = async (values) => {
    await crmLeadApi.update(lostModal.leadId, { 
      stage_id: lostModal.stageId,
      lost_reason: values.lost_reason 
    })
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    message.info('Lead marked as lost')
    setLostModal(null)
  }

  // Revenue total per stage
  const stageRevenue = (stageId) => {
    const total = (leadsByStage[stageId] || [])
      .reduce((sum, l) => sum + (l.expected_revenue || 0), 0)
    return total.toLocaleString('en-IN')
  }

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Pipeline</Title>
          <Text type="secondary">{leads.filter(l => l.is_active !== false).length} opportunities</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/crm/leads/new')} size="large">
          New Opportunity
        </Button>
      </div>

      {/* Kanban Board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 24px' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 600 }}>
            {stages.map(stage => {
              const colors = getStageStyle(stage)
              const stageLeads = leadsByStage[stage.id] || []
              return (
                <div key={stage.id} style={{ 
                  width: 280, minWidth: 280, display: 'flex', flexDirection: 'column',
                  background: colors.bg, borderRadius: 12, border: `1px solid ${colors.border}`,
                  overflow: 'hidden'
                }}>
                  {/* Column Header */}
                  <div style={{ 
                    padding: '12px 16px', borderBottom: `2px solid ${colors.border}`,
                    background: '#fff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ color: colors.header, fontSize: 14 }}>
                        {stage.name}
                      </Text>
                      <Badge count={stageLeads.length} style={{ backgroundColor: colors.header }} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ₹ {stageRevenue(stage.id)}
                    </Text>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={String(stage.id)}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ 
                          flex: 1, overflowY: 'auto', padding: '8px',
                          background: snapshot.isDraggingOver ? 'rgba(99,102,241,0.05)' : 'transparent',
                          transition: 'background 0.2s',
                          minHeight: 200
                        }}
                      >
                        {stageLeads.length === 0 && (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leads" style={{ margin: '40px 0' }} />
                        )}
                        {stageLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={String(lead.id)} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  marginBottom: 8,
                                }}
                              >
                                <Card
                                  size="small"
                                  style={{
                                    borderRadius: 8,
                                    border: snapshot.isDragging ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                    boxShadow: snapshot.isDragging ? '0 8px 24px rgba(99,102,241,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
                                    cursor: 'grab',
                                    transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                                    transition: 'box-shadow 0.2s',
                                  }}
                                  bodyStyle={{ padding: '10px 12px' }}
                                >
                                  {/* Card Header: Avatar + Name + Menu */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Avatar size={32} style={{ background: '#6366f1', fontSize: 13, flexShrink: 0 }}>
                                        {lead.name?.charAt(0)?.toUpperCase()}
                                      </Avatar>
                                      <Text 
                                        strong 
                                        style={{ fontSize: 13, cursor: 'pointer', color: '#1e293b' }}
                                        onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}
                                      >
                                        {lead.name}
                                      </Text>
                                    </div>
                                    <Dropdown menu={{ items: getCardMenu(lead) }} trigger={['click']}>
                                      <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: '0 4px', minWidth: 24 }} />
                                    </Dropdown>
                                  </div>

                                  {/* Customer name */}
                                  {lead.company_name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                      <UserOutlined style={{ color: '#94a3b8', fontSize: 11 }} />
                                      <Text type="secondary" style={{ fontSize: 12 }}>{lead.company_name}</Text>
                                    </div>
                                  )}

                                  {/* Phone */}
                                  {lead.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                      <PhoneOutlined style={{ color: '#94a3b8', fontSize: 11 }} />
                                      <Text type="secondary" style={{ fontSize: 12 }}>{lead.phone}</Text>
                                    </div>
                                  )}

                                  {/* Revenue + Priority */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                    {lead.expected_revenue > 0 && (
                                      <Text style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>
                                        ₹ {(lead.expected_revenue || 0).toLocaleString('en-IN')}
                                      </Text>
                                    )}
                                    <Tag color={priorityColors[lead.priority] || 'blue'} style={{ margin: 0, fontSize: 11 }}>
                                      {lead.priority || 'normal'}
                                    </Tag>
                                  </div>

                                  {/* Closing date */}
                                  {lead.expected_closing && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                      <CalendarOutlined style={{ color: '#94a3b8', fontSize: 11 }} />
                                      <Text type="secondary" style={{ fontSize: 11 }}>{lead.expected_closing}</Text>
                                    </div>
                                  )}
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Add Button */}
                  <div style={{ padding: '8px', borderTop: `1px solid ${colors.border}`, background: '#fff' }}>
                    <Button 
                      type="dashed" 
                      block 
                      icon={<PlusOutlined />}
                      onClick={() => { setQuickAddModal(stage.id); quickForm.resetFields() }}
                      style={{ borderColor: colors.header, color: colors.header }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Quick Add Modal */}
      <Modal
        title="Quick Add Lead"
        open={quickAddModal !== null}
        onCancel={() => setQuickAddModal(null)}
        footer={null}
      >
        <Form form={quickForm} layout="vertical" onFinish={handleQuickAdd}>
          <Form.Item name="name" label="Opportunity Title" rules={[{ required: true }]}>
            <Input placeholder="e.g., Glass partition for office" />
          </Form.Item>
          <Form.Item name="company_name" label="Company / Customer Name">
            <Input placeholder="Customer company" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="+91 XXXXX XXXXX" />
          </Form.Item>
          <Form.Item name="expected_revenue" label="Expected Revenue (₹)">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setQuickAddModal(null)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Add Lead</Button>
          </div>
        </Form>
      </Modal>

      {/* Lost Reason Modal */}
      <Modal
        title="💔 Mark as Lost"
        open={lostModal !== null}
        onCancel={() => setLostModal(null)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleLostConfirm}>
          <Form.Item name="lost_reason" label="Reason for losing" rules={[{ required: true, message: 'Please enter reason' }]}>
            <Input.TextArea rows={3} placeholder="e.g., Budget constraints, competitor pricing..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setLostModal(null)}>Cancel</Button>
            <Button danger htmlType="submit">Mark as Lost</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default Pipeline
