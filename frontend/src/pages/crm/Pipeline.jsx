import React, { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Modal, Form, Input, Select, Avatar,
  Dropdown, InputNumber, Badge, Typography,
  Space, Empty, App, Table, Tag, Tooltip, Row, Col
} from 'antd'
import {
  PlusOutlined, UserOutlined, PhoneOutlined,
  EditOutlined, TrophyOutlined, CloseCircleOutlined,
  CopyOutlined, AppstoreOutlined, UnorderedListOutlined,
  SearchOutlined, CalendarOutlined, DollarOutlined,
  MoreOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { crmLeadApi, crmStageApi, customerApi } from '../../api'

const { Text, Title } = Typography

// ── Priority config ─────────────────────────────────────────────
const PRIORITY = {
  low:    { color: '#94a3b8', bg: '#f1f5f9', label: 'Low' },
  normal: { color: '#3b82f6', bg: '#eff6ff', label: 'Normal' },
  high:   { color: '#f59e0b', bg: '#fffbeb', label: 'High' },
  urgent: { color: '#ef4444', bg: '#fef2f2', label: 'Urgent' },
}

const Pipeline = () => {
  const { message } = App.useApp()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [view,          setView]          = useState('kanban')
  const [search,        setSearch]        = useState('')
  const [quickAddModal, setQuickAddModal] = useState(null)
  const [lostModal,     setLostModal]     = useState(null)
  const [quickForm]                       = Form.useForm()

  // ── Data fetching ─────────────────────────────────────────────
  const { data: stagesData } = useQuery({
    queryKey: ['crm_stages'],
    queryFn: () => crmStageApi.list({
      page_size: 100,
      is_active: true
    }).then(r => r.data),
  })

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['crm_leads'],
    queryFn: () => crmLeadApi.list({ page_size: 500 }).then(r => r.data),
  })

  const stages = useMemo(() =>
    (stagesData?.items || [])
      .filter(s => s.is_active !== false)
      .sort((a, b) => a.sequence - b.sequence),
    [stagesData]
  )

  const allLeads = useMemo(() =>
    (leadsData?.items || []).filter(l => l.is_active !== false),
    [leadsData]
  )

  // ── Search filter ─────────────────────────────────────────────
  const leads = useMemo(() => {
    if (!search.trim()) return allLeads
    const q = search.toLowerCase()
    return allLeads.filter(l =>
      (l.name         || '').toLowerCase().includes(q) ||
      (l.company_name || '').toLowerCase().includes(q) ||
      (l.phone        || '').toLowerCase().includes(q) ||
      (l.lead_number  || '').toLowerCase().includes(q)
    )
  }, [allLeads, search])

  // ── Group by stage ────────────────────────────────────────────
  const leadsByStage = useMemo(() => {
    const grouped = {}
    stages.forEach(s => { grouped[s.id] = [] })
    leads.forEach(lead => {
      const sid = lead.stage_id || stages[0]?.id
      if (grouped[sid]) grouped[sid].push(lead)
      else if (sid) grouped[sid] = [lead]
    })
    return grouped
  }, [leads, stages])

  // ── Actions ───────────────────────────────────────────────────
  const moveToStage = async (leadId, stageId, lostReason) => {
    const updates = { stage_id: stageId }
    if (lostReason) updates.lost_reason = lostReason
    await crmLeadApi.update(leadId, updates)
    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
  }

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId &&
        destination.index === source.index) return
    const newStageId   = parseInt(destination.droppableId)
    const leadId       = parseInt(draggableId)
    const targetStage  = stages.find(s => s.id === newStageId)
    if (targetStage?.is_lost) {
      setLostModal({ leadId, stageId: newStageId })
      return
    }
    await moveToStage(leadId, newStageId)
    message.success(`Moved to ${targetStage?.name}`)
  }

  const markWon = async (lead) => {
    const wonStage = stages.find(s => s.is_won)
    if (!wonStage) return message.warning('No Won stage configured')
    await moveToStage(lead.id, wonStage.id)
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
    await moveToStage(lostModal.leadId, lostModal.stageId, values.lost_reason)
    message.info('Lead marked as lost')
    setLostModal(null)
  }

  const handleQuickAdd = async (values) => {
    let customer_id = null

    // If company_name was entered, try to find or create customer
    if (values.company_name?.trim()) {
      try {
        const allCustomers = JSON.parse(
          localStorage.getItem('customers') || '[]'
        )

        // Case-insensitive match on name
        const existing = allCustomers.find(c =>
          c.name?.toLowerCase() === values.company_name.trim().toLowerCase()
        )

        if (existing) {
          customer_id = existing.id
          message.info(`Linked to existing customer: ${existing.name}`)
        } else {
          const newId = allCustomers.length
            ? Math.max(...allCustomers.map(r => r.id || 0)) + 1
            : 1
          const newCode = `CUST${String(newId).padStart(4, '0')}`

          let company_id_val = 1
          try {
            const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
            company_id_val = u.company_id || 1
          } catch {}

          const newCustomer = {
            id:            newId,
            name:          values.company_name.trim(),
            customer_code: newCode,
            customer_type: 'company',
            phone:         values.phone || null,
            mobile:        values.phone || null,
            company_id:    company_id_val,
            is_active:     true,
            created_at:    new Date().toISOString(),
            updated_at:    new Date().toISOString(),
          }
          allCustomers.push(newCustomer)
          localStorage.setItem('customers', JSON.stringify(allCustomers))
          customer_id = newId

          message.success(
            `✅ New customer "${newCustomer.name}" (${newCode}) created in Masters!`
          )
        }
      } catch (e) {
        console.warn('Customer auto-create failed:', e)
      }
    }

    // Create the lead with customer_id linked
    await crmLeadApi.create({
      name:             values.name,
      company_name:     values.company_name || null,
      phone:            values.phone || null,
      expected_revenue: values.expected_revenue || null,
      customer_id,
      stage_id:         quickAddModal,
      is_active:        true,
    })

    queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    queryClient.invalidateQueries({ queryKey: ['customers-dropdown'] })
    message.success('Lead added!')
    quickForm.resetFields()
    setQuickAddModal(null)
  }

  // ── Card menu with "Move to Stage" submenu ────────────────────
  const getCardMenu = (lead) => {
    const moveItems = stages
      .filter(s => s.id !== lead.stage_id)
      .map(s => ({
        key: `move_${s.id}`,
        label: s.name,
        onClick: () => {
          if (s.is_lost) setLostModal({ leadId: lead.id, stageId: s.id })
          else moveToStage(lead.id, s.id).then(() => {
            queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
            message.success(`Moved to ${s.name}`)
          })
        }
      }))

    return [
      { key: 'edit', icon: <EditOutlined />, label: 'Edit Lead', onClick: () => navigate(`/crm/leads/${lead.id}/edit`) },
      { type: 'divider' },
      { key: 'move', label: 'Move to Stage', icon: <AppstoreOutlined />, children: moveItems },
      { type: 'divider' },
      { key: 'won', icon: <TrophyOutlined />, label: 'Mark as Won', onClick: () => markWon(lead), disabled: stages.find(s => s.id === lead.stage_id)?.is_won },
      { key: 'lost', icon: <CloseCircleOutlined />, label: 'Mark as Lost', onClick: () => { const lostStage = stages.find(s => s.is_lost); if (lostStage) setLostModal({ leadId: lead.id, stageId: lostStage.id }) }, disabled: stages.find(s => s.id === lead.stage_id)?.is_lost },
      { type: 'divider' },
      { key: 'clone', icon: <CopyOutlined />, label: 'Duplicate', onClick: () => cloneLead(lead.id) },
      { key: 'archive', label: 'Archive', danger: true, onClick: () => archiveLead(lead.id) },
    ]
  }

  // ── Stage colors ─────────────────────────────────────────────
  const getStageColor = (stage) => {
    if (stage.is_won)  return { header: '#16a34a', border: '#bbf7d0', bg: '#f0fdf4', badge: '#16a34a' }
    if (stage.is_lost) return { header: '#dc2626', border: '#fecaca', bg: '#fff1f2', badge: '#dc2626' }
    const palette = [
      { header: '#6366f1', border: '#c7d2fe', bg: '#eef2ff', badge: '#6366f1' },
      { header: '#f59e0b', border: '#fde68a', bg: '#fffbeb', badge: '#f59e0b' },
      { header: '#0ea5e9', border: '#bae6fd', bg: '#f0f9ff', badge: '#0ea5e9' },
      { header: '#8b5cf6', border: '#ddd6fe', bg: '#f5f3ff', badge: '#8b5cf6' },
    ]
    return palette[stages.indexOf(stage) % palette.length]
  }

  const stageRevTotal = (stageId) =>
    (leadsByStage[stageId] || []).reduce((s, l) => s + (l.expected_revenue || 0), 0).toLocaleString('en-IN')

  // ── TABLE VIEW COLUMNS ────────────────────────────────────────
  const tableColumns = [
    { title: 'Lead', dataIndex: 'name', key: 'name', width: 220, render: (v, r) => (
      <Space>
        <Avatar size={32} style={{ background: '#6366f1', fontSize: 13, flexShrink: 0 }}>{v?.charAt(0)?.toUpperCase()}</Avatar>
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b', cursor: 'pointer', fontSize: 13 }} onClick={() => navigate(`/crm/leads/${r.id}/edit`)}>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.lead_number}</Text>
        </div>
      </Space>
    )},
    { title: 'Contact', key: 'contact', width: 180, render: (_, r) => (
      <div>
        {r.company_name && <div style={{ fontSize: 12, fontWeight: 500 }}><UserOutlined style={{ marginRight: 4, color: '#94a3b8' }} />{r.company_name}</div>}
        {r.phone && <div style={{ fontSize: 12, color: '#64748b' }}><PhoneOutlined style={{ marginRight: 4, color: '#94a3b8' }} />{r.phone}</div>}
      </div>
    )},
    { title: 'Stage', dataIndex: 'stage_id', key: 'stage', width: 140, render: (v, record) => (
      <Select size="small" value={v} style={{ width: '100%' }} variant="borderless" dropdownStyle={{ minWidth: 160 }}
        onChange={async (newStageId) => {
          const targetStage = stages.find(s => s.id === newStageId)
          if (targetStage?.is_lost) { setLostModal({ leadId: record.id, stageId: newStageId }) }
          else { await moveToStage(record.id, newStageId); queryClient.invalidateQueries({ queryKey: ['crm_leads'] }); message.success(`Moved to ${targetStage?.name}`) }
        }}
        options={stages.map(s => ({ value: s.id, label: s.name }))}
      />
    )},
    { title: 'Revenue', dataIndex: 'expected_revenue', key: 'revenue', width: 130, align: 'right', render: v => v ? <Text style={{ color: '#16a34a', fontWeight: 600 }}>₹{Number(v).toLocaleString('en-IN')}</Text> : '—' },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', width: 100, render: v => { const p = PRIORITY[v] || PRIORITY.normal; return <Tag style={{ color: p.color, background: p.bg, border: `1px solid ${p.color}30`, borderRadius: 12, fontSize: 11 }}>{p.label}</Tag> }},
    { title: 'Closing', dataIndex: 'expected_closing', key: 'closing', width: 110, render: v => v ? <Text style={{ fontSize: 12 }}><CalendarOutlined style={{ marginRight: 4, color: '#94a3b8' }} />{v}</Text> : '—' },
    { title: 'Salesperson', dataIndex: 'salesperson', key: 'salesperson', width: 130, render: v => v || '—' },
    { title: '', key: 'actions', width: 60, fixed: 'right', render: (_, r) => <Dropdown menu={{ items: getCardMenu(r) }} trigger={['click']}><Button type="text" size="small" icon={<MoreOutlined />} /></Dropdown> }
  ]

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

      {/* ── Top Header ─────────────────────────────────────────── */}
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>Pipeline</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{leads.length} opportunities{search && ` (filtered from ${allLeads.length})`}</Text>
        </div>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <Input placeholder="Search leads, company, phone..." prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} value={search} onChange={e => setSearch(e.target.value)} allowClear style={{ borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }} />
        </div>
        <Space>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('kanban')} style={{ padding: '6px 14px', border: 'none', background: view === 'kanban' ? '#6366f1' : '#fff', color: view === 'kanban' ? '#fff' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}>
              <AppstoreOutlined /> Kanban
            </button>
            <button onClick={() => setView('table')} style={{ padding: '6px 14px', border: 'none', borderLeft: '1px solid #e2e8f0', background: view === 'table' ? '#6366f1' : '#fff', color: view === 'table' ? '#fff' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}>
              <UnorderedListOutlined /> Table
            </button>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/crm/leads/new')} style={{ borderRadius: 8, fontWeight: 600 }}>New Opportunity</Button>
        </Space>
      </div>

      {/* ── TABLE VIEW ─────────────────────────────────────────── */}
      {view === 'table' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <Table dataSource={leads} columns={tableColumns} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 20, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }}
              locale={{ emptyText: 'No leads found' }} size="middle" rowClassName={() => 'crm-table-row'} />
          </div>
          <style>{`
            .crm-table-row:hover > td { background: #f8faff !important; }
            .ant-table-thead > tr > th { background: #f8fafc !important; font-weight: 600 !important; color: #64748b !important; font-size: 12px !important; text-transform: uppercase; letter-spacing: 0.5px; }
          `}</style>
        </div>
      )}

      {/* ── KANBAN VIEW ────────────────────────────────────────── */}
      {view === 'kanban' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 24px' }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 500 }}>
              {stages.map(stage => {
                const colors     = getStageColor(stage)
                const stageLeads = leadsByStage[stage.id] || []
                return (
                  <div key={stage.id} style={{ width: 272, minWidth: 272, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                    {/* Column header */}
                    <div style={{ padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text strong style={{ color: colors.header, fontSize: 13 }}>{stage.name}</Text>
                        <span style={{ background: colors.header, color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{stageLeads.length}</span>
                      </div>
                      <Text style={{ color: colors.header, opacity: 0.7, fontSize: 11 }}>₹ {stageRevTotal(stage.id)}</Text>
                    </div>

                    {/* Cards area */}
                    <Droppable droppableId={String(stage.id)}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1, overflowY: 'auto', padding: '8px', background: snapshot.isDraggingOver ? colors.bg : 'transparent', minHeight: 160, transition: 'background 0.15s' }}>
                          {stageLeads.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: '#cbd5e1', fontSize: 12 }}>No leads</div>}
                          {stageLeads.map((lead, index) => {
                            const prio = PRIORITY[lead.priority] || PRIORITY.normal
                            return (
                              <Draggable key={lead.id} draggableId={String(lead.id)} index={index}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style, marginBottom: 8 }}>
                                    <div style={{ background: '#fff', border: snapshot.isDragging ? `2px solid ${colors.header}` : '1px solid #e8edf3', borderRadius: 10, padding: '10px 12px', cursor: 'grab', boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)', transform: snapshot.isDragging ? 'rotate(1.5deg)' : 'none', transition: 'box-shadow 0.15s, border 0.15s' }}>
                                      {/* Card top row */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: colors.header, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{lead.name?.charAt(0)?.toUpperCase()}</div>
                                          <Text strong style={{ fontSize: 12, color: '#1e293b', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}>{lead.name}</Text>
                                        </div>
                                        <Dropdown menu={{ items: getCardMenu(lead) }} trigger={['click']}>
                                          <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: '#94a3b8', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>···</button>
                                        </Dropdown>
                                      </div>
                                      {lead.company_name && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}><UserOutlined style={{ color: '#cbd5e1', fontSize: 10 }} /><Text style={{ color: '#64748b', fontSize: 11 }}>{lead.company_name}</Text></div>}
                                      {lead.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}><PhoneOutlined style={{ color: '#cbd5e1', fontSize: 10 }} /><Text style={{ color: '#64748b', fontSize: 11 }}>{lead.phone}</Text></div>}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                                        {lead.expected_revenue > 0 ? <Text style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>₹{(lead.expected_revenue || 0).toLocaleString('en-IN')}</Text> : <span />}
                                        <span style={{ background: prio.bg, color: prio.color, border: `1px solid ${prio.color}40`, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>{prio.label}</span>
                                      </div>
                                      {lead.expected_closing && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><CalendarOutlined style={{ color: '#cbd5e1', fontSize: 10 }} /><Text style={{ color: '#94a3b8', fontSize: 10 }}>{lead.expected_closing}</Text></div>}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    {/* Add button */}
                    <div style={{ padding: '8px', borderTop: `1px solid ${colors.border}` }}>
                      <button onClick={() => { setQuickAddModal(stage.id); quickForm.resetFields() }}
                        style={{ width: '100%', border: `1px dashed ${colors.border}`, borderRadius: 8, background: 'transparent', color: colors.header, cursor: 'pointer', padding: '6px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <PlusOutlined /> Add
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* ── Quick Add Modal ─────────────────────────────────────── */}
      <Modal title={<Space><PlusOutlined style={{ color: '#6366f1' }} /><span>Quick Add Lead</span></Space>} open={quickAddModal !== null} onCancel={() => setQuickAddModal(null)} footer={null} width={440}>
        <Form form={quickForm} layout="vertical" onFinish={handleQuickAdd} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Opportunity Title" rules={[{ required: true, message: 'Enter title' }]}><Input placeholder="e.g., Glass partition for office" /></Form.Item>
          <Form.Item name="company_name" label="Company / Customer"><Input placeholder="Customer name or company" /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input placeholder="+91 XXXXX XXXXX" /></Form.Item>
          <Form.Item name="expected_revenue" label="Expected Revenue (₹)"><InputNumber style={{ width: '100%' }} min={0} formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setQuickAddModal(null)}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#6366f1', borderColor: '#6366f1' }}>Add Lead</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Lost Reason Modal ───────────────────────────────────── */}
      <Modal title="Mark as Lost" open={lostModal !== null} onCancel={() => setLostModal(null)} footer={null} width={400}>
        <Form layout="vertical" onFinish={handleLostConfirm} style={{ marginTop: 12 }}>
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
