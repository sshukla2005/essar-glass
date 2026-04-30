// ─── CurrencyList.jsx ────────────────────────────────────────────────────────
import React from 'react'
import { Tag, Badge } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { currencyApi } from '../../../api'

export const CurrencyList = () => (
  <MasterList
    title="Currencies"
    queryKey="currencies"
    api={currencyApi}
    columns={[
      { title: 'Code',     dataIndex: 'code',           key: 'code',     width: 80,  render: v => <Tag color="blue">{v}</Tag> },
      { title: 'Name',     dataIndex: 'name',           key: 'name',     width: 180 },
      { title: 'Symbol',   dataIndex: 'symbol',         key: 'symbol',   width: 80 },
      { title: 'Rate (vs INR)', dataIndex: 'rate',      key: 'rate',     width: 130, render: v => v?.toFixed(4) },
      { title: 'Decimals', dataIndex: 'decimal_places', key: 'decimals', width: 90 },
      { title: 'Base',     dataIndex: 'is_base',        key: 'is_base',  width: 90,  render: v => v ? <Badge status="success" text="Yes" /> : '—' },
      { title: 'Rate Date',dataIndex: 'rate_date',      key: 'rate_date',width: 120, render: v => v || '—' },
    ]}
    createPath="/settings/currencies/new"
    editPath={(r) => `/settings/currencies/${r.id}/edit`}
    searchPlaceholder="Search by name or code..."
  />
)
