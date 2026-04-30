// ─── LeadList.jsx ────────────────────────────────────────────────────────────
import React from 'react'
import { Tag, Typography } from 'antd'
import MasterList from '../../components/common/MasterList'
import { crmLeadApi } from '../../api'

const { Text } = Typography

const PRIORITY_COLORS = { low: 'default', normal: 'blue', high: 'orange', urgent: 'red' }

const LeadList = () => (
  <MasterList
    title="Leads & Opportunities"
    queryKey="crm-leads"
    api={crmLeadApi}
    columns={[
      { title: 'Lead No.',  dataIndex: 'lead_number',      key: 'lead_number',  width: 120, render: v => v ? <Tag>{v}</Tag> : '—' },
      { title: 'Title',     dataIndex: 'name',             key: 'name',         width: 220 },
      { title: 'Stage',     dataIndex: 'stage',            key: 'stage',        width: 130,
        render: v => v ? <Tag color="processing">{v.name}</Tag> : '—' },
      { title: 'Customer',  dataIndex: 'customer',         key: 'customer',     width: 180, render: v => v?.name || '—' },
      { title: 'Revenue',   dataIndex: 'expected_revenue', key: 'revenue',      width: 140,
        render: v => v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—' },
      { title: 'Prob %',    dataIndex: 'probability',      key: 'probability',  width: 90,
        render: v => v != null ? `${v}%` : '—' },
      { title: 'Priority',  dataIndex: 'priority',         key: 'priority',     width: 100,
        render: v => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v}</Tag> },
      { title: 'Closing',   dataIndex: 'expected_closing', key: 'closing',      width: 120 },
      { title: 'Salesperson', dataIndex: 'salesperson',    key: 'salesperson',  width: 140 },
    ]}
    createPath="/crm/leads/new"
    editPath={(r) => `/crm/leads/${r.id}/edit`}
    searchPlaceholder="Search by title, lead number, email..."
  />
)

export default LeadList
