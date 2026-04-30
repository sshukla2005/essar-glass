import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { crmStageApi } from '../../api'

const StageList = () => (
  <MasterList
    title="CRM Stages"
    queryKey="crm-stages"
    api={crmStageApi}
    columns={[
      { title: 'Sequence', dataIndex: 'sequence', key: 'sequence', width: 100 },
      { title: 'Name',     dataIndex: 'name',     key: 'name',     width: 200 },
      { title: 'Prob %',   dataIndex: 'probability', key: 'prob',  width: 100, render: v => `${v}%` },
      { title: 'Won',      dataIndex: 'is_won',   key: 'won',      width: 80,  render: v => v ? <Tag color="green">Yes</Tag> : '—' },
      { title: 'Lost',     dataIndex: 'is_lost',  key: 'lost',     width: 80,  render: v => v ? <Tag color="red">Yes</Tag> : '—' },
      { title: 'Fold',     dataIndex: 'fold',     key: 'fold',     width: 80,  render: v => v ? <Tag>Hidden</Tag> : '—' },
    ]}
    createPath="/crm/stages/new"
    editPath={(r) => `/crm/stages/${r.id}/edit`}
    searchPlaceholder="Search stages..."
  />
)

export default StageList
