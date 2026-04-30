// ─── UomList.jsx ─────────────────────────────────────────────────────────────
import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { uomApi, uomCategoryApi } from '../../../api'

export const UomList = () => (
  <MasterList
    title="Units of Measure"
    queryKey="uoms"
    api={uomApi}
    columns={[
      { title: 'Name',      dataIndex: 'name',     key: 'name',     width: 160 },
      { title: 'Symbol',    dataIndex: 'symbol',   key: 'symbol',   width: 100, render: v => <Tag>{v}</Tag> },
      { title: 'Category',  dataIndex: 'category', key: 'category', width: 160, render: v => v?.name || '—' },
      { title: 'Type',      dataIndex: 'uom_type', key: 'uom_type', width: 160,
        render: v => {
          const colors = { reference: 'green', smaller: 'blue', bigger: 'orange' }
          return <Tag color={colors[v] || 'default'}>{v}</Tag>
        }
      },
      { title: 'Ratio',     dataIndex: 'ratio',    key: 'ratio',    width: 100 },
      { title: 'Rounding',  dataIndex: 'rounding', key: 'rounding', width: 100 },
    ]}
    createPath="/masters/uoms/new"
    editPath={(r) => `/masters/uoms/${r.id}/edit`}
    searchPlaceholder="Search by name or symbol..."
  />
)

// ─── UomCategoryList.jsx ─────────────────────────────────────────────────────
export const UomCategoryList = () => (
  <MasterList
    title="UoM Categories"
    queryKey="uom-categories"
    api={uomCategoryApi}
    columns={[
      { title: 'Name', dataIndex: 'name', key: 'name', width: 250 },
      { title: 'Note', dataIndex: 'note', key: 'note', render: v => v || '—' },
    ]}
    createPath="/settings/uom-categories/new"
    editPath={(r) => `/settings/uom-categories/${r.id}/edit`}
    searchPlaceholder="Search categories..."
  />
)
