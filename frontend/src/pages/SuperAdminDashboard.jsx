import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { superApi } from '../api'
import {
  Row, Col, Card, Typography, Tag, Table,
  Statistic, Progress, Badge, Space, Button, Spin, Modal, Tooltip as AntTooltip
} from 'antd'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  DollarOutlined, ShoppingOutlined,
  TeamOutlined, BankOutlined, LogoutOutlined, InfoCircleOutlined, ExpandOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Title, Text } = Typography

const SuperAdminDashboard = () => {
  const navigate = useNavigate()
  const { logout, setActiveCompany } = useAuth()
  const [expandedChart, setExpandedChart] = useState(null)

  const { data: overviewRes, isLoading } = useQuery({
    queryKey: ['superadmin-group-overview'],
    queryFn: () => superApi.getGroupOverview().then(r => r.data),
    staleTime: 30000,
  })

  const companyMetrics = overviewRes?.company_metrics || []
  const groupRevenueData = overviewRes?.group_revenue_data || []

  // Essar Sons revenue comes from the wholesale app, not the ERP, so the
  // backend series has no ESSAR value. Inject the current month's figure.
  // To revert: set this to `groupRevenueData`.
  const chartData = (() => {
    const w = overviewRes?.wholesale
    if (!w || !groupRevenueData.length) return groupRevenueData
    const last = groupRevenueData.length - 1
    return groupRevenueData.map((row, i) =>
      i === last ? { ...row, ESSAR: w.month_revenue || 0 } : row
    )
  })()
  const totalGroupRevenue = overviewRes?.totals?.group_revenue || 0
  const totalGroupCustomers = overviewRes?.totals?.total_customers || 0
  const totalGroupActiveSOs = overviewRes?.totals?.active_orders || 0
  const totalGroupOutstanding = overviewRes?.totals?.outstanding || 0

  const fmt = (v) => {
    if (v >= 100000) return `₹${(v/100000).toFixed(1)}L`
    if (v >= 1000)   return `₹${(v/1000).toFixed(1)}K`
    return `₹${(v || 0).toLocaleString('en-IN')}`
  }

  const renderTrendChart = () => (
    <BarChart data={chartData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}K` : `₹${v}`} />
      <RechartsTooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb' }} labelStyle={{ color: '#1e293b' }} formatter={(v, name) => [`₹${(v || 0).toLocaleString('en-IN')}`, name]} />
      <Legend />
      {companyMetrics.map(c => (
        <Bar key={c.id} dataKey={c.short_name} fill={c.color} radius={[4,4,0,0]} />
      ))}
    </BarChart>
  )

  const renderShareChart = ({ large = false } = {}) => (
    <PieChart>
      <Pie
        data={[...companyMetrics].sort((a, b) => {
          const order = ['EXCEL', 'ALFA-E', 'ALFA-L', 'ESSAR']
          const ai = order.indexOf(a.short_name), bi = order.indexOf(b.short_name)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        }).map(c => ({ name: c.short_name, value: c.id === 1 ? (overviewRes?.wholesale?.month_revenue || 0) : (c.revenue || 0) }))}
        cx="50%" cy="50%" outerRadius={large ? 220 : 80} dataKey="value"
        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={large}
      >
        {[...companyMetrics].sort((a, b) => {
          const order = ['EXCEL', 'ALFA-E', 'ALFA-L', 'ESSAR']
          const ai = order.indexOf(a.short_name), bi = order.indexOf(b.short_name)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        }).map((c, i) => (<Cell key={i} fill={c.color} />))}
      </Pie>
      <RechartsTooltip formatter={v => [`₹${(v || 0).toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb' }} labelStyle={{ color: '#1e293b' }} />
    </PieChart>
  )

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#eef2f7',
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
      background: '#eef2f7',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ color: '#1e293b', margin: 0 }}>👑 Group Overview Dashboard</Title>
          <Text style={{ color: '#64748b' }}>Super Admin · All Companies · Real-time</Text>
        </div>
        <Space>
          <Button icon={<BankOutlined />} style={{ borderColor: '#6366f1', color: '#6366f1' }} onClick={() => navigate('/super/users')}>Manage Users</Button>
          <Button danger icon={<LogoutOutlined />} onClick={logout}>Logout</Button>
        </Space>
      </div>

      {/* Group KPI */}
      <Row gutter={[16,16]} style={{ marginBottom: 24 }}>
        {[
          {
            title: 'Group Revenue',
            value: fmt(totalGroupRevenue),
            color: '#d97706',
            bg: '#fff7ed',
            tooltip: 'Based on confirmed sales orders. Invoicing is maintained in Tally.'
          },
          { title: 'Total Customers', value: totalGroupCustomers, color: '#059669', bg: '#f0fdf4', prefix: <TeamOutlined style={{ fontSize: 22 }} /> },
          { title: 'Active Orders', value: totalGroupActiveSOs, color: '#2563eb', bg: '#eff6ff', prefix: <ShoppingOutlined style={{ fontSize: 22 }} /> },
          {
            title: 'Outstanding',
            value: fmt(totalGroupOutstanding),
            color: '#dc2626',
            bg: '#fef2f7',
            prefix: <DollarOutlined style={{ fontSize: 22 }} />,
            subtext: totalGroupOutstanding === 0 ? 'Billed in Tally (₹0 in system)' : null
          },
        ].map((kpi, i) => (
          <Col span={6} key={i}>
            <Card style={{ background: kpi.bg, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)', borderRadius: 12 }}>
              <Statistic
                title={
                  <Text style={{ color: '#64748b', fontSize: 13, letterSpacing: 0.3 }}>
                    {kpi.title}
                    {kpi.tooltip && (
                      <AntTooltip title={kpi.tooltip}>
                        <InfoCircleOutlined style={{ marginLeft: 6, cursor: 'pointer', fontSize: 12 }} />
                      </AntTooltip>
                    )}
                  </Text>
                }
                value={kpi.value}
                valueStyle={{ color: kpi.color, fontSize: 34, fontWeight: 800 }}
                prefix={kpi.prefix}
              />
              {kpi.subtext && (
                <Text style={{ color: '#94a3b8', fontSize: 11, display: 'block', marginTop: 4 }}>
                  {kpi.subtext}
                </Text>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Company Cards */}
      <Row gutter={[16,16]} align="stretch" style={{ marginBottom: 24 }}>
        {[...companyMetrics].sort((a, b) => {
          const order = ['EXCEL', 'ALFA-E', 'ALFA-L', 'ESSAR']
          const ai = order.indexOf(a.short_name), bi = order.indexOf(b.short_name)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        }).map(company => {
          // Essar Sons (id=1) trades through the external wholesale app.
          // Hide ERP-derived tiles for that card; show only the wholesale block.
          const wholesaleOnly = company.id === 1
          return (
          <Col key={company.id} xs={24} sm={12} xl={6} style={{ display: 'flex' }}>
            <Card hoverable style={{
              borderRadius: 16,
              border: 'none',
              borderTop: `3px solid ${company.color}`,
              background: `${company.color}0A`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            }}
              onClick={async () => {
                if (wholesaleOnly) {
                  window.open('http://essarwholesale.xo.je/', '_blank', 'noopener')
                  return
                }
                const ok = await setActiveCompany(company.id)
                if (ok === false) return
                navigate('/', { state: { company_id: company.id } })
              }}>
              {/* Company header — always visible */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: company.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: company.accent, fontWeight: 900, fontSize: 14 }}>
                  {company.short_name.slice(0,2)}
                </div>
                <div>
                  <Text strong style={{ color: '#1e293b', display: 'block' }}>{company.name}</Text>
                  <Tag color={company.color} style={{ marginTop: 2 }}>{company.short_name}</Tag>
                </div>
              </div>
              {/* ERP-derived tiles — hidden for wholesale-only cards */}
              {!wholesaleOnly && (
                <div style={{ marginBottom: 12 }}>
                  <AntTooltip title="Based on confirmed sales orders. Invoicing is maintained in Tally.">
                    <Text style={{ color: '#64748b', fontSize: 12, cursor: 'help' }}>
                      Revenue <InfoCircleOutlined style={{ fontSize: 10, marginLeft: 2 }} />
                    </Text>
                  </AntTooltip>
                  <div style={{ fontSize: 26, fontWeight: 800, color: company.accent || '#1e293b' }}>{fmt(company.revenue)}</div>
                </div>
              )}
              {!wholesaleOnly && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>Gross Margin</Text>
                    <Text style={{ color: company.grossMargin == null ? '#94a3b8' : company.grossMargin >= 20 ? '#059669' : company.grossMargin >= 10 ? '#d97706' : '#dc2626', fontWeight: 700 }}>
                      {company.grossMargin != null ? `${company.grossMargin}%` : '—'}
                    </Text>
                  </div>
                  <Progress percent={company.grossMargin != null ? Math.min(company.grossMargin, 100) : 0} showInfo={false}
                    strokeColor={company.grossMargin >= 20 ? '#059669' : company.grossMargin >= 10 ? '#d97706' : '#dc2626'}
                    trailColor="#f1f5f9" size="small" />
                </div>
              )}
              {!wholesaleOnly && (
                <Row gutter={8}>
                  {[['Quotes', company.totalQuotes], ['Active Orders', company.activeSOs], ['Customers', company.totalCustomers]].map(([label, val]) => (
                    <Col span={8} style={{ textAlign: 'center' }} key={label}>
                      <Text style={{ color: '#94a3b8', fontSize: 10 }}>{label}</Text>
                      <div style={{ color: '#1e293b', fontWeight: 700 }}>{val}</div>
                    </Col>
                  ))}
                </Row>
              )}
              {!wholesaleOnly && (
                company.outstanding > 0 ? (
                  <div style={{ marginTop: 12, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
                    <Text style={{ color: '#dc2626', fontSize: 12 }}>⚠️ Outstanding: {fmt(company.outstanding)}</Text>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, padding: '4px 8px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                    <Text style={{ color: '#64748b', fontSize: 11 }}>Outstanding: ₹0 (Billed in Tally)</Text>
                  </div>
                )
              )}
              {/* Wholesale block — Essar Sons only */}
              {company.id === 1 && overviewRes?.wholesale && (() => {
                const w = overviewRes.wholesale
                // Profit Margin — mirrors Gross Margin logic at lines 178-188
                const wMarginPct = w.month_revenue > 0
                  ? Math.round((w.month_profit / w.month_revenue) * 100 * 10) / 10
                  : null
                const ts = w.synced_at
                  ? (() => {
                      const d = new Date(w.synced_at)
                      const dd = String(d.getDate()).padStart(2, '0')
                      const mm = String(d.getMonth() + 1).padStart(2, '0')
                      const hh = String(d.getHours()).padStart(2, '0')
                      const mi = String(d.getMinutes()).padStart(2, '0')
                      return `${dd}-${mm} ${hh}:${mi}`
                    })()
                  : null
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* 1 — Revenue headline: copied from lines 168-175 */}
                    <div style={{ marginBottom: 12 }}>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>Revenue (Month)</Text>
                      <div style={{ fontSize: 26, fontWeight: 800, color: company.accent || '#1e293b' }}>{fmt(w.month_revenue)}</div>
                    </div>
                    {/* 2 — Profit Margin bar: copied from lines 178-188 */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>Profit Margin</Text>
                        <Text style={{ color: wMarginPct == null ? '#94a3b8' : wMarginPct >= 20 ? '#059669' : wMarginPct >= 10 ? '#d97706' : '#dc2626', fontWeight: 700 }}>
                          {wMarginPct != null ? `${wMarginPct}%` : '—'}
                        </Text>
                      </div>
                      <Progress percent={wMarginPct != null ? Math.min(wMarginPct, 100) : 0} showInfo={false}
                        strokeColor={wMarginPct >= 20 ? '#059669' : wMarginPct >= 10 ? '#d97706' : '#dc2626'}
                        trailColor="#f1f5f9" size="small" />
                    </div>
                    {/* 3 — 3-column stat row: copied from lines 191-199 */}
                    <Row gutter={8}>
                      {[['Profit', fmt(w.month_profit)], ['Stock Value', fmt(w.stock_value)], ['Open Orders', w.open_orders]].map(([label, val]) => (
                        <Col span={8} style={{ textAlign: 'center' }} key={label}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>{label}</Text>
                          <div style={{ color: '#1e293b', fontWeight: 700 }}>{val}</div>
                        </Col>
                      ))}
                    </Row>
                    {/* 4 — Bottom strip pinned to card bottom: copied from lines 206-208 */}
                    <div style={{ marginTop: 'auto', padding: '4px 8px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                      <Text style={{ color: '#64748b', fontSize: 11 }}>
                        Synced from wholesale{ts ? ` · as of ${ts}` : ''}
                      </Text>
                    </div>
                  </div>
                )
              })()}
            </Card>
          </Col>
          )
        })}
      </Row>

      {/* Charts */}
      <Row gutter={[16,16]} style={{ marginBottom: 24 }}>
        <Col span={15}>
          <Card
            style={{ borderRadius: 16, background: '#ffffff', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)' }}
            title={<Title level={5} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Revenue Trend — All Companies (Last 6 Months)</Title>}
            extra={
              <AntTooltip title="Expand">
                <Button type="text" size="small" icon={<ExpandOutlined />} onClick={() => setExpandedChart('trend')} />
              </AntTooltip>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              {renderTrendChart()}
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={9}>
          <Card
            style={{ borderRadius: 16, height: '100%', background: '#ffffff', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)' }}
            title={<Title level={5} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Revenue Share</Title>}
            extra={
              <AntTooltip title="Expand">
                <Button type="text" size="small" icon={<ExpandOutlined />} onClick={() => setExpandedChart('share')} />
              </AntTooltip>
            }
          >
            <ResponsiveContainer width="100%" height={200}>
              {renderShareChart()}
            </ResponsiveContainer>
            {[...companyMetrics].sort((a, b) => {
              const order = ['EXCEL', 'ALFA-E', 'ALFA-L', 'ESSAR']
              const ai = order.indexOf(a.short_name), bi = order.indexOf(b.short_name)
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            }).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                <Space>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
                  <Text style={{ color: '#64748b', fontSize: 12 }}>{c.short_name}</Text>
                </Space>
                <Text style={{ color: '#1e293b', fontWeight: 700, fontSize: 12 }}>{fmt(c.id === 1 ? (overviewRes?.wholesale?.month_revenue || 0) : (c.revenue || 0))}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Comparison Table */}
      <Card style={{ borderRadius: 16, background: '#ffffff', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)' }}>
        <Title level={5} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Company Performance Comparison</Title>
        <div className="super-admin-table-wrap">
          <Table dataSource={[...companyMetrics].sort((a, b) => {
            const order = ['EXCEL', 'ALFA-E', 'ALFA-L', 'ESSAR']
            const ai = order.indexOf(a.short_name), bi = order.indexOf(b.short_name)
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })} rowKey="id" pagination={false} size="small" style={{ background: 'transparent' }}
            columns={[
              { title: 'Company', dataIndex: 'name', width: 180, render: (v, r) => (<Space align="center"><div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0, boxShadow: `0 0 6px ${r.color}88` }} /><span style={{ color: '#1e293b', fontWeight: 600, fontSize: 13 }}>{v}</span></Space>) },
              { title: 'Revenue', dataIndex: 'revenue', align: 'right', render: v => <span style={{ color: '#d97706', fontWeight: 700 }}>{fmt(v)}</span> },
              { title: 'Gross Margin', dataIndex: 'grossMargin', align: 'center', render: v => v != null ? <Tag color={v>=20?'green':v>=10?'orange':'red'}>{v}%</Tag> : <span style={{ color: '#94a3b8' }}>—</span> },
              { title: 'Quotations', dataIndex: 'totalQuotes', align: 'center', render: v => <span style={{ color: '#2563eb' }}>{v}</span> },
              { title: 'Sales Orders', dataIndex: 'totalSOs', align: 'center', render: v => <span style={{ color: '#059669' }}>{v}</span> },
              { title: 'Active SOs', dataIndex: 'activeSOs', align: 'center', render: v => <Badge count={v} showZero style={{ backgroundColor: v>0?'#2563eb':'#94a3b8' }} /> },
              { title: 'Customers', dataIndex: 'totalCustomers', align: 'center', render: v => <span style={{ color: '#7c3aed' }}>{v}</span> },
              { title: 'Outstanding', dataIndex: 'outstanding', align: 'right', render: v => v > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmt(v)}</span> : <AntTooltip title="Invoices maintained in Tally"><span style={{ color: '#64748b' }}>₹0 (Tally)</span></AntTooltip> },
            ]}
          />
        </div>
      </Card>

      {/* Fullscreen Chart Modal */}
      <Modal
        open={!!expandedChart}
        onCancel={() => setExpandedChart(null)}
        footer={null}
        width="95vw"
        style={{ top: 20 }}
        styles={{ body: { height: '82vh', overflow: 'auto', padding: 16 } }}
        title={expandedChart === 'trend'
          ? 'Revenue Trend — All Companies (Last 6 Months)'
          : 'Revenue Share'}
      >
        {expandedChart === 'share' && (() => {
          const rawShareData = [...companyMetrics].sort((a, b) => {
            const order = ['EXCEL', 'ALFA-E', 'ALFA-L', 'ESSAR']
            const ai = order.indexOf(a.short_name), bi = order.indexOf(b.short_name)
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          }).map(c => ({
            key: c.id,
            name: c.name,
            short_name: c.short_name,
            color: c.color,
            value: c.id === 1 ? (overviewRes?.wholesale?.month_revenue || 0) : (c.revenue || 0)
          }))
          const totalShareRevenue = rawShareData.reduce((acc, r) => acc + r.value, 0)
          const tableRows = [...rawShareData].sort((a, b) => b.value - a.value).map(item => ({
            ...item,
            pct: totalShareRevenue > 0 ? (item.value / totalShareRevenue) * 100 : 0
          }))
          const totalRow = { key: 'total', name: 'TOTAL', isTotal: true, value: totalShareRevenue, pct: 100 }

          return (
            <Row gutter={[24, 24]} align="middle" style={{ minHeight: '100%' }}>
              <Col xs={24} md={14} style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {renderShareChart({ large: true })}
                </ResponsiveContainer>
              </Col>
              <Col xs={24} md={10}>
                <Card title={<Text strong style={{ fontSize: 14 }}>Revenue Breakdown</Text>} size="small" style={{ borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <Table
                    dataSource={[...tableRows, totalRow]}
                    pagination={false}
                    size="small"
                    rowKey="key"
                    columns={[
                      {
                        title: 'Company',
                        dataIndex: 'name',
                        render: (v, r) => r.isTotal ? <strong>TOTAL</strong> : (
                          <Space align="center">
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                            <span>{r.name} ({r.short_name})</span>
                          </Space>
                        )
                      },
                      {
                        title: 'Revenue',
                        dataIndex: 'value',
                        align: 'right',
                        render: (v, r) => r.isTotal ? <strong>{fmt(r.value)}</strong> : fmt(r.value)
                      },
                      {
                        title: 'Share %',
                        dataIndex: 'pct',
                        align: 'right',
                        render: (v, r) => r.isTotal ? <strong>100.0%</strong> : `${r.pct.toFixed(1)}%`
                      }
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          )
        })()}

        {expandedChart === 'trend' && (() => {
          const orderedCompanies = companyMetrics
          const monthlyRows = chartData.map(row => {
            const rowTotal = orderedCompanies.reduce((sum, c) => sum + (row[c.short_name] || 0), 0)
            return {
              key: row.month,
              month: row.month,
              ...row,
              rowTotal
            }
          })

          const companyTotals = {}
          let grandTotal = 0
          orderedCompanies.forEach(c => {
            const colSum = chartData.reduce((sum, row) => sum + (row[c.short_name] || 0), 0)
            companyTotals[c.short_name] = colSum
            grandTotal += colSum
          })

          const grandTotalRow = {
            key: 'grand-total',
            month: 'TOTAL',
            isTotal: true,
            ...companyTotals,
            rowTotal: grandTotal
          }

          const columns = [
            {
              title: 'Month',
              dataIndex: 'month',
              key: 'month',
              render: (v, r) => r.isTotal ? <strong>TOTAL</strong> : <strong>{v}</strong>
            },
            ...orderedCompanies.map(c => ({
              title: c.short_name,
              dataIndex: c.short_name,
              key: c.short_name,
              align: 'right',
              render: (v, r) => r.isTotal ? <strong>{fmt(r[c.short_name])}</strong> : fmt(r[c.short_name] || 0)
            })),
            {
              title: 'Total',
              dataIndex: 'rowTotal',
              key: 'rowTotal',
              align: 'right',
              render: (v, r) => <strong>{fmt(v)}</strong>
            }
          ]

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {renderTrendChart()}
                </ResponsiveContainer>
              </div>
              <Card title={<Text strong style={{ fontSize: 14 }}>Monthly Breakdown</Text>} size="small" style={{ borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <Table
                  dataSource={[...monthlyRows, grandTotalRow]}
                  columns={columns}
                  pagination={false}
                  size="small"
                  rowKey="key"
                  scroll={{ y: 240 }}
                />
              </Card>
            </div>
          )
        })()}
      </Modal>

      <style>{`
        .super-admin-table-wrap .ant-table { background: transparent !important; color: #1e293b !important; }
        .super-admin-table-wrap .ant-table-tbody > tr > td { background: transparent !important; border-bottom: 1px solid #f1f5f9 !important; color: #1e293b !important; }
        .super-admin-table-wrap .ant-table-tbody > tr:hover > td { background: #f8fafc !important; }
        .super-admin-table-wrap .ant-table-thead > tr > th { background: #f8fafc !important; color: #64748b !important; border-bottom: 1px solid #e5e7eb !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: 0.5px; }
        .super-admin-table-wrap .ant-table-cell { color: #1e293b !important; }
        .super-admin-table-wrap .ant-pagination-item a, .super-admin-table-wrap .ant-pagination-prev button, .super-admin-table-wrap .ant-pagination-next button { color: #64748b !important; }
      `}</style>
    </div>
  )
}

export default SuperAdminDashboard
