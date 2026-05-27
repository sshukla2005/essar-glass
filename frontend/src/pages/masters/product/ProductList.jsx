// ─── ProductList.jsx ─────────────────────────────────────────────────────────
import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { productApi } from '../../../api'

const ProductList = () => (
  <MasterList
    title="Products"
    queryKey="products"
    api={productApi}
    columns={[
      { title: 'Name',         dataIndex: 'name',         key: 'name',         width: 220 },
      { title: 'Internal Ref', dataIndex: 'internal_ref', key: 'internal_ref', width: 130, render: v => v ? <Tag>{v}</Tag> : '—' },
      { title: 'Type',         dataIndex: 'product_type', key: 'product_type', width: 130,
        render: v => {
          const colors = { storable: 'blue', consumable: 'orange', service: 'green' }
          return <Tag color={colors[v] || 'default'}>{v}</Tag>
        }
      },
      { title: 'Category', dataIndex: 'glass_category', key: 'glass_category', width: 110,
        render: v => v ? <Tag color="blue">{v}</Tag> : '—'
      },
      { title: 'Sale Price',  dataIndex: 'sale_price', key: 'sale_price', width: 100,
        render: v => v != null ? `₹ ${v.toLocaleString('en-IN')}` : '—'
      },
      { title: 'On Hand', dataIndex: 'on_hand_qty', width: 100, render: (v, r) => (
        <span style={{ fontSize: 14, fontWeight: 700, color: v === 0 ? '#dc2626' : v < (r.min_qty||0) ? '#f59e0b' : '#10b981' }}>{v || 0}</span>
      )},
      { title: 'HSN Code',    dataIndex: 'hsn_id',        key: 'hsn',        width: 100, render: v => v ? <Tag color="geekblue">{v}</Tag> : '—' },
    ]}
    createPath="/masters/products/new"
    editPath={(r) => `/masters/products/${r.id}/edit`}
    searchPlaceholder="Search by name, SKU, category..."
  />
)

export default ProductList
