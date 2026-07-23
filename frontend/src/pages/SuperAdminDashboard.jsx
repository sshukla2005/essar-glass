import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { superApi } from '../api'
import {
  Row, Col, Card, Typography, Tag, Table,
  Statistic, Progress, Badge, Space, Button, Spin
} from 'antd'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  DollarOutlined, ShoppingOutlined,
  TeamOutlined, BankOutlined, LogoutOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Title, Text } = Typography

const SuperAdminDashboard = () => {
  const navigate = useNavigate()
  const { logout, setActiveCompany } = useAuth()

  const { data: overviewRes, isLoading } = useQuery({
    queryKey: ['superadmin-group-overview'],
    queryFn: () => superApi.getGroupOverview().then(r => r.data),
    staleTime: 30000,
  })

  const companyMetrics = overviewRes?.company_metrics || []
  const groupRevenueData = overviewRes?.group_revenue_data || []
  const totalGroupRevenue = overviewRes?.totals?.group_revenue || 0
  const totalGroupCustomers = overviewRes?.totals?.total_customers || 0
  const totalGroupActiveSOs = overviewRes?.totals?.active_orders || 0
  const totalGroupOutstanding = overviewRes?.totals?.outstanding || 0

  const fmt = (v) => {
    if (v >= 100000) return `₹${(v/100000).toFixed(1)}L`
    if (v >= 1000)   return `₹${(v/1000).toFixed(1)}K`
    return `₹${(v || 0).toLocaleString('en-IN')}`
  }

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spin size="large" tip="Loading Group Overview..." />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ color: '#fff', margin: 0 }}>👑 Group Overview Dashboard</Title>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Super Admin · All Companies · Real-time</Text>
        </div>
        <Space>
          <Button icon={<BankOutlined />} style={{ borderColor: '#6366f1', color: '#6366f1' }} onClick={() => navigate('/super/users')}>Manage Users</Button>
          <Button danger icon={<LogoutOutlined />} onClick={logout}>Logout</Button>
        </Space>
      </div>

      {/* Group KPI */}
      <Row gutter={[16,16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Group Revenue', value: fmt(totalGroupRevenue), color: '#ffd700' },
          { title: 'Total Customers', value: totalGroupCustomers, color: '#34d399', prefix: <TeamOutlined /> },
          { title: 'Active Orders', value: totalGroupActiveSOs, color: '#60a5fa', prefix: <ShoppingOutlined /> },
          { title: 'Outstanding', value: fmt(totalGroupOutstanding), color: '#f87171', prefix: <DollarOutlined /> },
        ].map((kpi, i) => (
          <Col span={6} key={i}>
            <Card style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}>
              <Statistic
                title={<Text style={{color:'rgba(255,255,255,0.6)'}}>{kpi.title}</Text>}
                value={kpi.value}
                valueStyle={{ color: kpi.color, fontSize: 28, fontWeight: 800 }}
                prefix={kpi.prefix}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Company Cards */}
      <Row gutter={[16,16]} style={{ marginBottom: 24 }}>
        {companyMetrics.map(company => (
          <Col key={company.id} xs={24} sm={12} xl={6}>
            <Card hoverable style={{ borderRadius: 16, border: `2px solid ${company.color}`, background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
              onClick={() => {
                setActiveCompany(company.id)
                navigate('/', { state: { company_id: company.id } })
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: company.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: company.accent, fontWeight: 900, fontSize: 14 }}>
                  {company.short_name.slice(0,2)}
                </div>
                <div>
                  <Text strong style={{ color: '#fff', display: 'block' }}>{company.name}</Text>
                  <Tag color={company.color} style={{ marginTop: 2 }}>{company.short_name}</Tag>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Revenue</Text>
                <div style={{ fontSize: 26, fontWeight: 800, color: company.accent || '#fff' }}>{fmt(company.revenue)}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Gross Margin</Text>
                  <Text style={{ color: company.grossMargin >= 20 ? '#34d399' : company.grossMargin >= 10 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>{company.grossMargin}%</Text>
                </div>
                <Progress percent={Math.min(company.grossMargin, 100)} showInfo={false}
                  strokeColor={company.grossMargin >= 20 ? '#34d399' : company.grossMargin >= 10 ? '#fbbf24' : '#f87171'}
                  trailColor="rgba(255,255,255,0.1)" size="small" />
              </div>
              <Row gutter={8}>
                {[['Quotes', company.totalQuotes], ['Active Orders', company.activeSOs], ['Customers', company.totalCustomers]].map(([label, val]) => (
                  <Col span={8} style={{ textAlign: 'center' }} key={label}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{label}</Text>
                    <div style={{ color: '#fff', fontWeight: 700 }}>{val}</div>
                  </Col>
                ))}
              </Row>
              {company.outstanding > 0 && (
                <div style={{ marginTop: 12, padding: '6px 10px', background: 'rgba(248,113,113,0.15)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.3)' }}>
                  <Text style={{ color: '#f87171', fontSize: 12 }}>⚠️ Outstanding: {fmt(company.outstanding)}</Text>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={[16,16]} style={{ marginBottom: 24 }}>
        <Col span={15}>
          <Card style={{ borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 20 }}>Revenue Trend — All Companies (Last 6 Months)</Title>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={groupRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}K` : `₹${v}`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.2)' }} labelStyle={{ color: '#fff' }} formatter={(v, name) => [`₹${(v || 0).toLocaleString('en-IN')}`, name]} />
                <Legend />
                {companyMetrics.map(c => (
                  <Bar key={c.id} dataKey={c.short_name} fill={c.color} radius={[4,4,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={9}>
          <Card style={{ borderRadius: 16, height: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 20 }}>Revenue Share</Title>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={companyMetrics.map(c => ({ name: c.short_name, value: c.revenue || 0 }))} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {companyMetrics.map((c, i) => (<Cell key={i} fill={c.color} />))}
                </Pie>
                <Tooltip formatter={v => [`₹${(v || 0).toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{ background: '#1e293b' }} />
              </PieChart>
            </ResponsiveContainer>
            {companyMetrics.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Space>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{c.short_name}</Text>
                </Space>
                <Text style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{fmt(c.revenue)}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Comparison Table */}
      <Card style={{ borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>Company Performance Comparison</Title>
        <div className="super-admin-table-wrap">
          <Table dataSource={companyMetrics} rowKey="id" pagination={false} size="small" style={{ background: 'transparent' }}
            columns={[
              { title: 'Company', dataIndex: 'name', width: 180, render: (v, r) => (<Space align="center"><div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0, boxShadow: `0 0 6px ${r.color}88` }} /><span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{v}</span></Space>) },
              { title: 'Revenue', dataIndex: 'revenue', align: 'right', render: v => <span style={{ color: '#ffd700', fontWeight: 700 }}>{fmt(v)}</span> },
              { title: 'Gross Margin', dataIndex: 'grossMargin', align: 'center', render: v => <Tag color={v>=20?'green':v>=10?'orange':'red'}>{v}%</Tag> },
              { title: 'Quotations', dataIndex: 'totalQuotes', align: 'center', render: v => <span style={{ color: '#60a5fa' }}>{v}</span> },
              { title: 'Sales Orders', dataIndex: 'totalSOs', align: 'center', render: v => <span style={{ color: '#34d399' }}>{v}</span> },
              { title: 'Active SOs', dataIndex: 'activeSOs', align: 'center', render: v => <Badge count={v} showZero style={{ backgroundColor: v>0?'#3b82f6':'#374151' }} /> },
              { title: 'Customers', dataIndex: 'totalCustomers', align: 'center', render: v => <span style={{ color: '#a78bfa' }}>{v}</span> },
              { title: 'Outstanding', dataIndex: 'outstanding', align: 'right', render: v => <span style={{ color: v > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>{fmt(v)}</span> },
            ]}
          />
        </div>
      </Card>

      <style>{`
        .super-admin-table-wrap .ant-table { background: transparent !important; color: #e2e8f0 !important; }
        .super-admin-table-wrap .ant-table-tbody > tr > td { background: transparent !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; color: #e2e8f0 !important; }
        .super-admin-table-wrap .ant-table-tbody > tr:hover > td { background: rgba(255,255,255,0.05) !important; }
        .super-admin-table-wrap .ant-table-thead > tr > th { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.5) !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: 0.5px; }
        .super-admin-table-wrap .ant-table-cell { color: #e2e8f0 !important; }
        .super-admin-table-wrap .ant-pagination-item a, .super-admin-table-wrap .ant-pagination-prev button, .super-admin-table-wrap .ant-pagination-next button { color: #94a3b8 !important; }
      `}</style>
    </div>
  )
}

export default SuperAdminDashboard
