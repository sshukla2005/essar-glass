import React, { useState, useMemo } from 'react'
import {
  Row, Col, Card, Statistic, Table, Tag, Button, DatePicker,
  Space, Typography, Progress, Divider, App, Spin, Empty,
} from 'antd'
import {
  BarChartOutlined, DownloadOutlined, ReloadOutlined,
  UserOutlined, FileTextOutlined, CheckCircleOutlined,
  DollarOutlined, RiseOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import api from '../../api/axios'
import * as XLSX from 'xlsx'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

// ── palette for chart bars ────────────────────────────────────────────────────
const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16',
]

// ── currency formatter ────────────────────────────────────────────────────────
const fmtINR = (val) =>
  `₹${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// ── KPI card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, suffix, prefix, color, icon, loading }) => (
  <div style={{
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    height: '100%',
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: 12,
      background: `${color}15`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, color,
      flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      {loading
        ? <Spin size="small" />
        : <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
            {prefix}{value}{suffix}
          </div>
      }
    </div>
  </div>
)

// ── main component ────────────────────────────────────────────────────────────
const SalesPerformance = () => {
  const { message } = App.useApp()
  const [dateRange, setDateRange] = useState([null, null])

  const params = useMemo(() => {
    const p = {}
    if (dateRange[0]) p.from = dateRange[0].format('YYYY-MM-DD')
    if (dateRange[1]) p.to   = dateRange[1].format('YYYY-MM-DD')
    return p
  }, [dateRange])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sales-performance', params],
    queryFn: async () => {
      const res = await api.get('/api/v1/reports/sales-performance', { params })
      return res.data
    },
    staleTime: 0,
  })

  const summary    = data?.summary    || {}
  const salespeople = data?.salespeople || []
  const history    = data?.history    || []

  // ── max converted_value for progress bars ─────────────────────────────────
  const maxValue = useMemo(
    () => Math.max(...salespeople.map(r => r.converted_value), 1),
    [salespeople]
  )

  // ── Excel export ─────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!history.length) {
      message.warning('No data to export')
      return
    }
    const rows = history.map(h => ({
      'Lead No':      h.lead_number,
      'Lead Name':    h.lead_name,
      'Salesperson':  h.salesperson,
      'Created Date': h.created_at,
      'Stage':        h.stage,
      'Quote No':     h.quote_number || '',
      'Quote Status': h.quote_status || '',
      'Quote Amount': h.quote_amount,
      'Converted':    h.converted ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Performance')

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    ]

    const today = dayjs().format('YYYY-MM-DD')
    XLSX.writeFile(wb, `SalesPerformance_${today}.xlsx`)
    message.success('Exported successfully')
  }

  // ── salesperson table columns ─────────────────────────────────────────────
  const spColumns = [
    {
      title: 'Salesperson',
      dataIndex: 'salesperson',
      render: (v) => (
        <Space>
          <UserOutlined style={{ color: '#6366f1' }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Leads',
      dataIndex: 'leads_created',
      align: 'center',
      width: 80,
      render: v => <Text>{v}</Text>,
    },
    {
      title: 'Quotes',
      dataIndex: 'quotes_created',
      align: 'center',
      width: 80,
      render: v => <Text>{v}</Text>,
    },
    {
      title: 'Converted',
      dataIndex: 'leads_converted',
      align: 'center',
      width: 95,
      render: v => (
        <Tag color={v > 0 ? 'green' : 'default'} style={{ fontWeight: 700 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Conv. %',
      dataIndex: 'conversion_rate',
      width: 160,
      render: (v) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Progress
            percent={v}
            size="small"
            strokeColor={v >= 50 ? '#10b981' : v >= 25 ? '#f59e0b' : '#ef4444'}
            format={pct => `${pct}%`}
          />
        </Space>
      ),
    },
    {
      title: 'Converted Value',
      dataIndex: 'converted_value',
      align: 'right',
      width: 150,
      render: (v) => (
        <Text strong style={{ color: '#10b981', fontSize: 14 }}>
          {fmtINR(v)}
        </Text>
      ),
    },
  ]

  // ── chart data (top 10 by value) ──────────────────────────────────────────
  const chartData = salespeople
    .filter(r => r.converted_value > 0)
    .slice(0, 10)
    .map(r => ({
      name: r.salesperson.length > 12 ? r.salesperson.slice(0, 12) + '…' : r.salesperson,
      value: r.converted_value,
      fullName: r.salesperson,
    }))

  // ── history table columns ─────────────────────────────────────────────────
  const historyColumns = [
    { title: 'Lead No',    dataIndex: 'lead_number',  width: 110 },
    { title: 'Lead Name',  dataIndex: 'lead_name',    ellipsis: true },
    { title: 'Salesperson',dataIndex: 'salesperson',  width: 140 },
    { title: 'Created',    dataIndex: 'created_at',   width: 110 },
    { title: 'Stage',      dataIndex: 'stage',        width: 130 },
    { title: 'Quote No',   dataIndex: 'quote_number', width: 110, render: v => v || '—' },
    {
      title: 'Quote Status', dataIndex: 'quote_status', width: 120,
      render: v => v
        ? <Tag color={v === 'converted' ? 'green' : v === 'confirmed' ? 'blue' : 'default'}>{v}</Tag>
        : '—'
    },
    {
      title: 'Quote Amount', dataIndex: 'quote_amount', width: 130, align: 'right',
      render: v => v ? fmtINR(v) : '—'
    },
    {
      title: 'Converted', dataIndex: 'converted', width: 95, align: 'center',
      render: v => v
        ? <Tag color="green">✓ Yes</Tag>
        : <Tag color="default">No</Tag>
    },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChartOutlined style={{ color: '#6366f1' }} />
            Sales Performance Report
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Salesperson-wise leads created and converted — active company only
          </Text>
        </div>

        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={val => setDateRange(val || [null, null])}
            format="DD/MM/YYYY"
            placeholder={['From date', 'To date']}
            allowClear
            style={{ borderRadius: 8 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isFetching}
            style={{ borderRadius: 8 }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            style={{ background: '#10b981', borderRadius: 8 }}
          >
            Export Excel
          </Button>
        </Space>
      </div>

      {/* ── KPI cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={24/5 * 1}>
          <KpiCard
            title="Total Leads"
            value={summary.total_leads ?? 0}
            color="#6366f1"
            icon={<UserOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={24/5 * 1}>
          <KpiCard
            title="Total Quotes"
            value={summary.total_quotes ?? 0}
            color="#3b82f6"
            icon={<FileTextOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={24/5 * 1}>
          <KpiCard
            title="Leads Converted"
            value={summary.total_converted ?? 0}
            color="#10b981"
            icon={<CheckCircleOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={24/5 * 1}>
          <KpiCard
            title="Converted Value"
            value={fmtINR(summary.total_converted_value)}
            color="#f59e0b"
            icon={<DollarOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={24/5 * 1}>
          <KpiCard
            title="Overall Conv. Rate"
            value={summary.overall_rate ?? 0}
            suffix="%"
            color="#8b5cf6"
            icon={<RiseOutlined />}
            loading={isLoading}
          />
        </Col>
      </Row>

      {/* ── Chart + Salesperson table ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>

        {/* Bar chart */}
        {chartData.length > 0 && (
          <Col xs={24} lg={10}>
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 24px', height: '100%',
            }}>
              <Text style={{ fontWeight: 600, color: '#0f172a', fontSize: 14, display: 'block', marginBottom: 16 }}>
                Converted Value by Salesperson
              </Text>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ left: 10, right: 10, top: 4, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                  <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    formatter={(value, _, props) => [fmtINR(value), props.payload?.fullName]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Salesperson aggregate table */}
        <Col xs={24} lg={chartData.length > 0 ? 14 : 24}>
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD',
            }}>
              <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                Salesperson Summary
              </Text>
              <Tag color="blue" style={{ fontWeight: 600 }}>
                {salespeople.length} salesperson{salespeople.length !== 1 ? 's' : ''}
              </Tag>
            </div>

            <Table
              dataSource={salespeople}
              columns={spColumns}
              rowKey="salesperson"
              loading={isLoading}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="No data yet" /> }}
              style={{ borderRadius: 0 }}
            />
          </div>
        </Col>
      </Row>

      {/* ── Full Lead History ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD',
        }}>
          <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
            Full Lead History
          </Text>
          <Space>
            <Tag style={{ fontWeight: 600 }}>
              {history.length} lead{history.length !== 1 ? 's' : ''}
            </Tag>
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
          </Space>
        </div>

        <Table
          dataSource={history}
          columns={historyColumns}
          rowKey="lead_id"
          loading={isLoading}
          pagination={{ pageSize: 25, showSizeChanger: true, showTotal: t => `${t} leads` }}
          size="small"
          scroll={{ x: 1000 }}
          rowClassName={row => row.converted ? 'sp-row-converted' : ''}
          locale={{ emptyText: <Empty description="No leads found" /> }}
        />
      </div>

      {/* Subtle highlight for converted rows */}
      <style>{`
        .sp-row-converted td { background: #f0fdf4 !important; }
        .sp-row-converted:hover td { background: #dcfce7 !important; }
      `}</style>
    </div>
  )
}

export default SalesPerformance
