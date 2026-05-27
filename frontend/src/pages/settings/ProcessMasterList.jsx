import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { processMasterApi } from '../../api'

const CHARGE_COLORS = { per_sqft: 'blue', per_rft: 'cyan', per_piece: 'green', per_sqmt: 'purple', fixed: 'orange' }

const columns = [
  { title: 'Code', dataIndex: 'code', width: 100, render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
  { title: 'Process Name', dataIndex: 'name', width: 200 },
  { title: 'Type', dataIndex: 'process_type', width: 120, render: v => <Tag>{(v || '').toUpperCase()}</Tag> },
  { title: 'Charge Type', dataIndex: 'charge_type', width: 120, render: v => <Tag color={CHARGE_COLORS[v] || 'default'}>{v}</Tag> },
  { title: 'Rate', dataIndex: 'rate', width: 100, render: v => `₹ ${Number(v || 0).toLocaleString()}` },
  { title: 'Unit', dataIndex: 'unit', width: 80 },
]

const ProcessMasterList = () => (
  <MasterList
    title="Process Masters"
    queryKey="process_masters"
    api={processMasterApi}
    columns={columns}
    createPath="/settings/process-masters/new"
    editPath={(r) => `/settings/process-masters/${r.id}/edit`}
    searchPlaceholder="Search processes..."
  />
)

export default ProcessMasterList
