// ─── BranchList.jsx ──────────────────────────────────────────────────────────
import React from 'react'
import { Tag, Typography, Badge } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { branchApi } from '../../../api'

const { Text } = Typography

export const BranchList = () => (
  <MasterList
    title="Branches"
    queryKey="branches"
    api={branchApi}
    columns={[
      { title: 'Code',         dataIndex: 'code',           key: 'code',         width: 90,  render: v => <Tag>{v}</Tag> },
      { title: 'Name',         dataIndex: 'name',           key: 'name',         width: 200 },
      { title: 'Company',      dataIndex: 'company',        key: 'company',      width: 180, render: v => v?.name || '—' },
      { title: 'GSTIN',        dataIndex: 'gstin',          key: 'gstin',        width: 170, render: v => v ? <Text code>{v}</Text> : '—' },
      { title: 'City',         dataIndex: 'city',           key: 'city',         width: 110 },
      { title: 'State',        dataIndex: 'state',          key: 'state',        width: 150 },
      { title: 'Head Office',  dataIndex: 'is_head_office', key: 'head_office',  width: 110, render: v => v ? <Badge status="processing" text="Yes" /> : '—' },
      { title: 'Type',         key: 'type',                 width: 180,
        render: (_, r) => (
          <>
            {r.is_manufacturing && <Tag color="orange">Manufacturing</Tag>}
            {r.is_warehouse     && <Tag color="blue">Warehouse</Tag>}
          </>
        )
      },
    ]}
    createPath="/settings/branches/new"
    editPath={(r) => `/settings/branches/${r.id}/edit`}
    searchPlaceholder="Search by name, code, city..."
  />
)
