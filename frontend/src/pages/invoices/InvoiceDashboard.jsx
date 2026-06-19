import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Table, Tag, Typography,
  Input, Select, Space, Statistic, Button, Badge
} from 'antd'
import {
  DollarOutlined, CheckCircleOutlined,
  ClockCircleOutlined, RiseOutlined, SearchOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { receivablesApi } from '../../api'

const { Text, Title } = Typography

const fmt = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

const InvoiceDashboard = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['receivables-summary'],
    queryFn: () => receivablesApi.summary().then(r => r.data),
    staleTime: 30000,
  })

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['receivables-customers'],
    queryFn: () => receivablesApi.byCustomer().then(r => r.data),
    staleTime: 30000,
  })

  const customers = customersData?.items || []

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_phone.includes(search)
    const matchFilter =
      filter === 'all' ||
      (filter === 'pending' && c.status === 'pending') ||
      (filter === 'advance' && c.status === 'advance') ||
      (filter === 'settled' && c.status === 'settled')
    return matchSearch && matchFilter
  })

  const columns = [
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      render: (name, row) => (
        <div>
          <Text
            strong
            style={{ color: '#6366f1', cursor: 'pointer', fontSize: 14 }}
            onClick={() => navigate(`/invoices/customer/${row.customer_id}`)}
          >
            {name}
          </Text>
          {row.customer_phone && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                📞 {row.customer_phone}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Total Billed',
      dataIndex: 'total_billed',
      align: 'right',
      render: v => <Text strong>{fmt(v)}</Text>,
    },
    {
      title: 'Total Collected',
      dataIndex: 'total_paid',
      align: 'right',
      render: v => (
        <Text strong style={{ color: '#16a34a' }}>{fmt(v)}</Text>
      ),
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      align: 'right',
      render: (v, row) => {
        if (row.status === 'settled') {
          return <Tag color="green">✅ Settled</Tag>
        }
        if (row.status === 'advance') {
          return (
            <Tag color="blue">
              +{fmt(Math.abs(v))} CR
            </Tag>
          )
        }
        return (
          <Text strong style={{ color: '#dc2626' }}>
            {fmt(v)} due
          </Text>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center',
      render: (s) => {
        const map = {
          pending: { color: 'red', label: '⚠️ Pending' },
          advance: { color: 'blue', label: '💰 Credit' },
          settled: { color: 'green', label: '✅ Settled' },
        }
        const cfg = map[s] || map.pending
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '',
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          onClick={() => navigate(`/invoices/customer/${row.customer_id}`)}
        >
          View Ledger →
        </Button>
      ),
    },
  ]

  const rowClassName = (record) => {
    if (record.status === 'advance') return 'row-advance'
    if (record.status === 'pending') return 'row-pending'
    return ''
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .row-advance td { background: #eff6ff !important; }
        .row-pending td { background: #fff7f7 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a237e, #3949ab)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            💰 Accounts Receivable
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
            Track payments, outstanding dues and customer credit balances
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ background: '#10b981', borderColor: '#10b981' }}
          onClick={() => navigate('/invoices/new')}
        >
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            title: 'Total Billed',
            value: summary?.total_billed || 0,
            color: '#1a237e',
            bg: '#eff6ff',
            icon: <DollarOutlined />,
          },
          {
            title: 'Total Collected',
            value: summary?.total_collected || 0,
            color: '#16a34a',
            bg: '#f0fdf4',
            icon: <CheckCircleOutlined />,
          },
          {
            title: 'Outstanding',
            value: summary?.outstanding || 0,
            color: '#dc2626',
            bg: '#fff7f7',
            icon: <ClockCircleOutlined />,
          },
          {
            title: 'Advance / Credit',
            value: summary?.advance || 0,
            color: '#6366f1',
            bg: '#f5f3ff',
            icon: <RiseOutlined />,
          },
        ].map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card
              style={{
                borderRadius: 12,
                background: card.bg,
                border: `1px solid ${card.color}22`,
              }}
              loading={summaryLoading}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>
                    {card.title}
                  </Text>
                  <div style={{
                    fontSize: 22, fontWeight: 800,
                    color: card.color, marginTop: 4
                  }}>
                    {fmt(card.value)}
                  </div>
                </div>
                <div style={{
                  fontSize: 24, color: card.color,
                  opacity: 0.4
                }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter bar */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={filter}
            onChange={setFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '🔍 All Customers' },
              { value: 'pending', label: '⚠️ Outstanding' },
              { value: 'advance', label: '💰 Credit Balance' },
              { value: 'settled', label: '✅ Settled' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 13 }}>
            {filtered.length} customers
          </Text>
        </Space>
      </Card>

      {/* Customer Table */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="customer_id"
          loading={customersLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          rowClassName={rowClassName}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/invoices/customer/${record.customer_id}`),
          })}
        />
      </Card>
    </div>
  )
}

export default InvoiceDashboard
