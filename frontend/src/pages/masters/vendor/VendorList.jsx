// ─── VendorList.jsx ──────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { Tag, Typography, Button, App } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import MasterList from '../../../components/common/MasterList'
import { vendorApi } from '../../../api'

const { Text } = Typography

const JOBWORK_VENDORS = [
  { name: 'MEBT',      vendor_type: 'jobwork', phone: '', email: '' },
  { name: 'Amath',     vendor_type: 'jobwork', phone: '', email: '' },
  { name: 'Sapphire',  vendor_type: 'jobwork', phone: '', email: '' },
  { name: 'Al Burhan', vendor_type: 'jobwork', phone: '', email: '' },
  { name: 'RDTuff',    vendor_type: 'jobwork', phone: '', email: '' },
  { name: 'Diamond',   vendor_type: 'jobwork', phone: '', email: '' },
]

const VendorList = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [seeding, setSeeding] = useState(false)

  // Query all vendors to check for existence
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-dd'],
    queryFn: () => vendorApi.dropdown().then(r => r.data)
  })
  const vendors = Array.isArray(vendorsData)
    ? vendorsData
    : (vendorsData?.items || [])

  const handleSeedVendors = async () => {
    setSeeding(true)
    try {
      let added = 0
      let skipped = 0
      for (const v of JOBWORK_VENDORS) {
        // Check if already exists in current list
        const existing = vendors.find(x => x.name?.toLowerCase() === v.name.toLowerCase())

        if (existing) {
          skipped++
          continue
        }
        try {
          await vendorApi.create(v)
          added++
        } catch (err) {
          console.warn(`Failed to add ${v.name}:`, err)
        }
      }
      message.success(
        `Seeded ${added} vendors${skipped > 0 ? `, ${skipped} already existed` : ''}!`
      )
      queryClient.invalidateQueries({ queryKey: ['vendors-dd'] })
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    } catch (err) {
      message.error('Seed failed: ' + (err?.message || ''))
    } finally {
      setSeeding(false)
    }
  }

  const extraHeaderActions = (
    <Button
      onClick={handleSeedVendors}
      loading={seeding}
      style={{
        borderColor: '#f59e0b',
        color: '#f59e0b',
        fontWeight: 600
      }}
      icon={<span>🏭</span>}
    >
      Seed Jobwork Vendors
    </Button>
  )

  return (
    <MasterList
      title="Vendors"
      queryKey="vendors"
      api={vendorApi}
      columns={[
        { title: 'Name',        dataIndex: 'name',        key: 'name',        width: 200 },
        { title: 'Vendor Code', dataIndex: 'vendor_code', key: 'vendor_code', width: 130, render: v => v ? <Tag>{v}</Tag> : '—' },
        { title: 'Type',        dataIndex: 'vendor_type', key: 'vendor_type', width: 110, render: v => <Tag color={v === 'company' ? 'blue' : 'green'}>{v}</Tag> },
        { title: 'GSTIN',       dataIndex: 'gstin',       key: 'gstin',       width: 170, render: v => v ? <Text code>{v}</Text> : '—' },
        { title: 'City',        dataIndex: 'city',        key: 'city',        width: 120 },
        { title: 'State',       dataIndex: 'state',       key: 'state',       width: 140 },
        { title: 'Phone',       dataIndex: 'phone',       key: 'phone',       width: 130 },
        { title: 'Email',       dataIndex: 'email',       key: 'email',       width: 200 },
      ]}
      createPath="/masters/vendors/new"
      editPath={(r) => `/masters/vendors/${r.id}/edit`}
      searchPlaceholder="Search by name, code, GSTIN, email..."
      extraHeaderActions={extraHeaderActions}
    />
  )
}

export default VendorList
