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
      { title: 'Category',    dataIndex: 'category',   key: 'category',   width: 150 },
      { title: 'UoM',         dataIndex: 'uom',        key: 'uom',        width: 100, render: v => v?.name || '—' },
      { title: 'Sale Price',  dataIndex: 'sale_price', key: 'sale_price', width: 120,
        render: v => v != null ? `₹ ${v.toLocaleString('en-IN')}` : '—'
      },
      { title: 'HSN Code',    dataIndex: 'hsn',        key: 'hsn',        width: 120, render: v => v?.code ? <Tag color="geekblue">{v.code}</Tag> : '—' },
    ]}
    createPath="/masters/products/new"
    editPath={(r) => `/masters/products/${r.id}/edit`}
    searchPlaceholder="Search by name, SKU, category..."
  />
)

export default ProductList
