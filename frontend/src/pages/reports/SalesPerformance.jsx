import React, { useState, useMemo } from 'react'
import {
  Row, Col, Card, Table, Tag, Button, DatePicker,
  Space, Typography, Progress, App, Empty, Tooltip,
  Alert, Select, Input, Skeleton, Result, Badge
} from 'antd'
import {
  BarChartOutlined, DownloadOutlined, ReloadOutlined,
  UserOutlined, FileTextOutlined, CheckCircleOutlined,
  DollarOutlined, RiseOutlined, ArrowUpOutlined, ArrowDownOutlined,
  MinusOutlined, WarningOutlined, FunnelPlotOutlined, SearchOutlined,
  TeamOutlined, ShoppingCartOutlined, CalendarOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import api from '../../api/axios'
import { companyApi } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import * as XLSX from 'xlsx'

dayjs.extend(quarterOfYear)

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// ── Palette for charts ────────────────────────────────────────────────────────
const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16',
]

// ── Currency Formatter ────────────────────────────────────────────────────────
const fmtINR = (val) => {
  if (val == null) return '—'
  return `₹${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

// ── FY Bounds Helper ──────────────────────────────────────────────────────────
const getFYBounds = (d = dayjs()) => {
  const year = d.month() >= 3 ? d.year() : d.year() - 1
  return [
    dayjs(`${year}-04-01`),
    dayjs(`${year + 1}-03-31`)
  ]
}

const getLastFYBounds = (d = dayjs()) => {
  const currentFYStart = d.month() >= 3 ? d.year() : d.year() - 1
  const lastFYStart = currentFYStart - 1
  return [
    dayjs(`${lastFYStart}-04-01`),
    dayjs(`${lastFYStart + 1}-03-31`)
  ]
}

// ── Delta Badge Helper ────────────────────────────────────────────────────────
const DeltaChip = ({ current, previous, isPercent = false }) => {
  if (current == null || previous == null) return null

  let diff = 0
  let isUp = false
  let isDown = false

  if (isPercent) {
    diff = current - previous
    isUp = diff > 0
    isDown = diff < 0
  } else {
    if (previous === 0) {
      if (current > 0) {
        diff = 100
        isUp = true
      }
    } else {
      diff = ((current - previous) / Math.abs(previous)) * 100
      isUp = diff > 0
      isDown = diff < 0
    }
  }

  const absDiff = Math.abs(diff).toFixed(1)
  const bg = isUp ? '#ecfdf5' : isDown ? '#fef2f2' : '#f1f5f9'
  const textClr = isUp ? '#059669' : isDown ? '#dc2626' : '#64748b'
  const borderClr = isUp ? '#a7f3d0' : isDown ? '#fecaca' : '#cbd5e1'
  const Icon = isUp ? ArrowUpOutlined : isDown ? ArrowDownOutlined : MinusOutlined

  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      color: textClr,
      background: bg,
      border: `1px solid ${borderClr}`,
      padding: '2px 8px',
      borderRadius: 12,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      lineHeight: 1.2
    }}>
      <Icon style={{ fontSize: 10 }} />
      {isPercent ? `${absDiff}%` : `${absDiff}%`}
    </span>
  )
}

// ── KPI Card Component ────────────────────────────────────────────────────────
const KpiCard = ({ title, value, previousValue, prefix, suffix, color, icon, loading, isPercent = false, tooltipText, subLine }) => {
  const formattedVal = value == null ? '—' : `${prefix || ''}${typeof value === 'number' ? value.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : value}${suffix || ''}`

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color, flexShrink: 0,
        }}>
          {icon}
        </div>
        <DeltaChip current={value} previous={previousValue} isPercent={isPercent} />
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          {tooltipText && (
            <Tooltip title={tooltipText}>
              <InfoCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            </Tooltip>
          )}
        </div>
        {loading ? (
          <Skeleton.Button active size="small" style={{ width: 100, height: 28 }} />
        ) : (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: value == null ? '#94a3b8' : '#0f172a', lineHeight: 1.2 }}>
              {formattedVal}
            </div>
            {subLine && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                {subLine}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const SalesPerformance = () => {
  const { message } = App.useApp()
  const { activeCompanyId } = useAuth()
  const [dateRange, setDateRange] = useState(() => getFYBounds())

  // History Filters & Pagination
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(25)
  const [historySalesperson, setHistorySalesperson] = useState('')
  const [historyDocType, setHistoryDocType] = useState('Sales Order')
  const [historySearch, setHistorySearch] = useState('')
  const [exporting, setExporting] = useState(false)

  // Fetch Companies list to find active company name
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await companyApi.getAll()
      return res.data?.items || res.data || []
    },
    staleTime: 300000,
  })

  const activeCompanyName = useMemo(() => {
    if (!companiesData || !companiesData.length) return 'Active Company'
    const found = companiesData.find(c => c.id === activeCompanyId)
    return found ? found.name : 'Active Company'
  }, [companiesData, activeCompanyId])

  const reportParams = useMemo(() => {
    const p = {}
    if (dateRange && dateRange[0]) p.from = dateRange[0].format('YYYY-MM-DD')
    if (dateRange && dateRange[1]) p.to = dateRange[1].format('YYYY-MM-DD')
    return p
  }, [dateRange])

  // Main Report Query
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['sales-performance', reportParams],
    queryFn: async () => {
      const res = await api.get('/api/v1/reports/sales-performance', { params: reportParams })
      return res.data
    },
    staleTime: 30000,
  })

  // History Query
  const historyParams = useMemo(() => {
    const p = {
      page: historyPage,
      page_size: historyPageSize
    }
    if (dateRange && dateRange[0]) p.from = dateRange[0].format('YYYY-MM-DD')
    if (dateRange && dateRange[1]) p.to = dateRange[1].format('YYYY-MM-DD')
    if (historySalesperson) p.salesperson = historySalesperson
    if (historyDocType) p.doc_type = historyDocType
    if (historySearch) p.search = historySearch
    return p
  }, [dateRange, historyPage, historyPageSize, historySalesperson, historyDocType, historySearch])

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory
  } = useQuery({
    queryKey: ['sales-performance-history', historyParams],
    queryFn: async () => {
      const res = await api.get('/api/v1/reports/sales-performance/history', { params: historyParams })
      return res.data
    },
    staleTime: 30000,
  })

  const period      = data?.period      || {}
  const summary     = data?.summary     || {}
  const previous    = data?.previous    || {}
  const funnel      = data?.funnel      || []
  const salespeople = data?.salespeople || []
  const monthly     = data?.monthly     || []
  const dataQuality = data?.data_quality || {}

  const historyItems = historyData?.items || []
  const historyTotal = historyData?.total || 0

  const hasGenuineData = useMemo(() => {
    if (isLoading) return true
    return (
      (summary.so_count || 0) > 0 ||
      (summary.quotes_created || 0) > 0 ||
      (summary.leads_created || 0) > 0
    )
  }, [summary, isLoading])

  const profitSubLine = useMemo(() => {
    const totalSo = summary.so_count || 0
    const withoutCost = summary.so_without_cost_count || 0
    const withCost = summary.so_with_cost_count || 0

    if (totalSo === 0) return 'No sales orders in period'
    if (withoutCost === totalSo) {
      return `No cost data — ${withoutCost} of ${totalSo} orders excluded`
    }
    return `Based on ${withCost} of ${totalSo} orders`
  }, [summary.so_count, summary.so_without_cost_count, summary.so_with_cost_count])

  const maxSoValue = useMemo(() => {
    return Math.max(...salespeople.map(r => r.so_value || 0), 1)
  }, [salespeople])

  // Preset Date Handlers
  const handlePreset = (type) => {
    const now = dayjs()
    if (type === 'this_month') setDateRange([now.startOf('month'), now.endOf('month')])
    else if (type === 'last_month') {
      const lm = now.subtract(1, 'month')
      setDateRange([lm.startOf('month'), lm.endOf('month')])
    }
    else if (type === 'this_quarter') setDateRange([now.startOf('quarter'), now.endOf('quarter')])
    else if (type === 'this_fy') setDateRange(getFYBounds(now))
    else if (type === 'last_fy') setDateRange(getLastFYBounds(now))
    setHistoryPage(1)
  }

  // Multi-Sheet Excel Export
  const handleExport = async () => {
    try {
      setExporting(true)
      const exportParams = { ...reportParams, doc_type: historyDocType }
      if (historySalesperson) exportParams.salesperson = historySalesperson
      const res = await api.get('/api/v1/reports/sales-performance/export', { params: exportParams })
      const fullData = res.data

      const fullHistory = fullData.history || []
      if (!fullHistory.length && !salespeople.length) {
        message.warning('No data to export')
        return
      }

      const wb = XLSX.utils.book_new()

      // Sheet 1: Summary & Period
      const summaryRows = [
        { Metric: 'Report Period', Value: fullData.period?.label || '' },
        { Metric: 'From Date', Value: fullData.period?.from || '' },
        { Metric: 'To Date', Value: fullData.period?.to || '' },
        { Metric: '', Value: '' },
        { Metric: 'Sales Orders Count', Value: fullData.summary?.so_count ?? 0 },
        { Metric: 'Sales Orders Value (₹)', Value: fullData.summary?.so_value ?? 0 },
        { Metric: 'Total Profit (₹)', Value: fullData.summary?.profit_amount ?? 'N/A' },
        { Metric: 'Overall Margin (%)', Value: fullData.summary?.profit_percent != null ? `${fullData.summary.profit_percent}%` : 'N/A' },
        { Metric: 'Orders with Cost Count', Value: fullData.summary?.so_with_cost_count ?? 0 },
        { Metric: 'Orders without Cost Count', Value: fullData.summary?.so_without_cost_count ?? 0 },
        { Metric: 'Quotes Created Count', Value: fullData.summary?.quotes_created ?? 0 },
        { Metric: 'Quotes Value (₹)', Value: fullData.summary?.quotes_value ?? 0 },
        { Metric: 'Quotes Won Count', Value: fullData.summary?.quotes_won ?? 0 },
        { Metric: 'Quotes Won Value (₹)', Value: fullData.summary?.quotes_won_value ?? 0 },
        { Metric: 'Quote Win Rate (by Count %)', Value: fullData.summary?.win_rate_count != null ? `${fullData.summary.win_rate_count}%` : 'N/A' },
        { Metric: 'Quote Win Rate (by Value %)', Value: fullData.summary?.win_rate_value != null ? `${fullData.summary.win_rate_value}%` : 'N/A' },
        { Metric: 'CRM Leads Created', Value: fullData.summary?.leads_created ?? 0 },
        { Metric: 'Lead Conversion Rate (%)', Value: fullData.summary?.lead_conversion_rate != null ? `${fullData.summary.lead_conversion_rate}%` : 'N/A (Zero Leads)' },
        { Metric: 'Invoiced Value (₹)', Value: fullData.summary?.invoiced_value ?? 0 },
        { Metric: 'Collected Value (₹)', Value: fullData.summary?.collected_value ?? 0 },
        { Metric: 'Avg Deal Size (₹)', Value: fullData.summary?.avg_deal_size ?? 0 },
        { Metric: 'Avg Days to Convert', Value: fullData.summary?.avg_days_to_convert ?? 0 },
      ]
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

      // Sheet 2: By Salesperson
      const spRows = (fullData.salespeople || []).map(sp => ({
        'Salesperson': sp.salesperson,
        'Leads Created': sp.leads_created,
        'Lead Conv. Rate': sp.lead_conversion_rate != null ? `${sp.lead_conversion_rate}%` : '—',
        'Quotes Created': sp.quotes_created,
        'Quotes Value (₹)': sp.quotes_value,
        'Quotes Won': sp.quotes_won,
        'Quotes Won Value (₹)': sp.quotes_won_value,
        'Win Rate Count %': sp.win_rate_count != null ? `${sp.win_rate_count}%` : '—',
        'Win Rate Value %': sp.win_rate_value != null ? `${sp.win_rate_value}%` : '—',
        'SO Count': sp.so_count,
        'SO Value (₹)': sp.so_value,
        'Profit (₹)': sp.profit_amount ?? '—',
        'Margin (%)': sp.profit_percent != null ? `${sp.profit_percent}%` : '—',
        'Orders With Cost': sp.so_with_cost_count ?? 0,
        'Orders Without Cost': sp.so_without_cost_count ?? 0,
        'Invoiced Value (₹)': sp.invoiced_value,
        'Collected Value (₹)': sp.collected_value,
        'Avg Deal Size (₹)': sp.avg_deal_size ?? '—',
        'Avg Days to Convert': sp.avg_days_to_convert ?? '—'
      }))
      const wsSp = XLSX.utils.json_to_sheet(spRows)
      wsSp['!cols'] = [
        { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
        { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 18 }
      ]
      XLSX.utils.book_append_sheet(wb, wsSp, 'By Salesperson')

      // Sheet 3: Funnel
      const funnelRows = (fullData.funnel || []).map(f => ({
        'Stage': f.stage,
        'Count': f.count,
        'Total Value (₹)': f.value
      }))
      const wsFunnel = XLSX.utils.json_to_sheet(funnelRows)
      wsFunnel['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, wsFunnel, 'Funnel')

      // Sheet 4: Monthly Trend
      const monthlyRows = (fullData.monthly || []).map(m => ({
        'Month': `${m.month} ${m.year}`,
        'Sales Orders Value (₹)': m.so_value,
        'Collected Value (₹)': m.collected_value
      }))
      const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows)
      wsMonthly['!cols'] = [{ wch: 15 }, { wch: 22 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly')

      // Sheet 5: Documents History
      const docRows = fullHistory.map(h => ({
        'Document Type': h.doc_type,
        'Document No': h.doc_number,
        'Date': h.date,
        'Customer': h.customer_name,
        'Salesperson': h.salesperson,
        'Status': h.status,
        'Amount (₹)': h.amount,
        'Total Cost (₹)': h.total_cost ?? '—',
        'Profit (₹)': h.profit_amount ?? '—',
        'Margin (%)': h.profit_percent != null ? `${h.profit_percent}%` : '—',
        'Linked Lead No': h.linked_lead_number || '—',
        'Linked Ref No': h.linked_so_number || '—'
      }))
      const wsDocs = XLSX.utils.json_to_sheet(docRows)
      wsDocs['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 18 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
        { wch: 16 }, { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(wb, wsDocs, 'Documents')

      const fStr = fullData.period?.from || 'start'
      const tStr = fullData.period?.to || 'end'
      const safeCompany = activeCompanyName.replace(/[^a-zA-Z0-9]/g, '_')
      XLSX.writeFile(wb, `Sales-Performance_${safeCompany}_${fStr}_${tStr}.xlsx`)
      message.success('Report exported successfully')
    } catch (err) {
      console.error('Export error:', err)
      message.error('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  // Salesperson Table Columns
  const spColumns = [
    {
      title: 'Salesperson',
      dataIndex: 'salesperson',
      key: 'salesperson',
      fixed: 'left',
      width: 170,
      render: (v) => (
        <Space>
          <UserOutlined style={{ color: v === 'Unassigned' ? '#94a3b8' : '#6366f1' }} />
          <Text strong style={{ color: v === 'Unassigned' ? '#64748b' : '#0f172a' }}>
            {v}
          </Text>
          {v === 'Unassigned' && (
            <Tag color="default" style={{ fontSize: 10, padding: '0 4px' }}>Unassigned</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Leads',
      dataIndex: 'leads_created',
      key: 'leads_created',
      align: 'center',
      width: 80,
      sorter: (a, b) => a.leads_created - b.leads_created,
      render: v => <Text>{v}</Text>,
    },
    {
      title: 'Quotes',
      key: 'quotes',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.quotes_value - b.quotes_value,
      render: (_, r) => (
        <div>
          <Text strong>{fmtINR(r.quotes_value)}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.quotes_created} quotes</div>
        </div>
      ),
    },
    {
      title: 'Won Quotes',
      key: 'won',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.quotes_won_value - b.quotes_won_value,
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#10b981' }}>{fmtINR(r.quotes_won_value)}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.quotes_won} won</div>
        </div>
      ),
    },
    {
      title: 'Win % (Val)',
      dataIndex: 'win_rate_value',
      key: 'win_rate_value',
      width: 110,
      align: 'center',
      sorter: (a, b) => (a.win_rate_value || 0) - (b.win_rate_value || 0),
      render: (v) => {
        if (v == null) {
          return (
            <Tooltip title="No quotations created for this salesperson in this period.">
              <Text type="secondary">—</Text>
            </Tooltip>
          )
        }
        return (
          <Tag color={v >= 50 ? 'green' : v >= 25 ? 'gold' : 'volcano'} style={{ fontWeight: 700 }}>
            {v}%
          </Tag>
        )
      },
    },
    {
      title: 'Sales Orders',
      key: 'sos',
      align: 'right',
      width: 150,
      sorter: (a, b) => a.so_value - b.so_value,
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#3b82f6', fontSize: 14 }}>{fmtINR(r.so_value)}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.so_count} orders</div>
        </div>
      ),
    },
    {
      title: 'Profit ₹',
      dataIndex: 'profit_amount',
      key: 'profit_amount',
      align: 'right',
      width: 140,
      sorter: (a, b) => (a.profit_amount ?? -Infinity) - (b.profit_amount ?? -Infinity),
      render: (v, r) => {
        if (v == null) {
          return (
            <Tooltip title={r.so_without_cost_count > 0 ? `Cost rate not set for ${r.so_without_cost_count} sales order(s) — excluded from profit` : 'No sales orders with cost rate'}>
              <Text type="secondary">—</Text>
            </Tooltip>
          )
        }
        return (
          <div>
            <Text strong style={{ color: v >= 0 ? '#059669' : '#dc2626' }}>
              {fmtINR(v)}
            </Text>
            {r.so_without_cost_count > 0 && (
              <Tooltip title={`${r.so_without_cost_count} sales order(s) excluded (missing cost rate)`}>
                <div style={{ fontSize: 10, color: '#d97706' }}>
                  <WarningOutlined style={{ marginRight: 3 }} />
                  {r.so_without_cost_count} uncosted
                </div>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      title: 'Margin %',
      dataIndex: 'profit_percent',
      key: 'profit_percent',
      align: 'center',
      width: 110,
      sorter: (a, b) => (a.profit_percent ?? -Infinity) - (b.profit_percent ?? -Infinity),
      render: (v, r) => {
        if (v == null) {
          return (
            <Tooltip title={r.so_without_cost_count > 0 ? `Cost rate not set for ${r.so_without_cost_count} sales order(s) — excluded from margin` : 'No sales orders with cost rate'}>
              <Text type="secondary">—</Text>
            </Tooltip>
          )
        }
        const color = v >= 25 ? 'green' : v >= 10 ? 'blue' : v >= 0 ? 'gold' : 'volcano'
        return (
          <Tooltip title={`Weighted Average Margin: ${v}% across ${r.so_with_cost_count} order(s)`}>
            <Tag color={color} style={{ fontWeight: 700 }}>
              {v}%
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Performance',
      key: 'progress',
      width: 130,
      render: (_, r) => {
        const pct = Math.min(100, Math.round((r.so_value / maxSoValue) * 100))
        return (
          <Progress
            percent={pct}
            size="small"
            strokeColor="#3b82f6"
            showInfo={false}
          />
        )
      }
    },
    {
      title: 'Invoiced',
      dataIndex: 'invoiced_value',
      key: 'invoiced_value',
      align: 'right',
      width: 120,
      sorter: (a, b) => a.invoiced_value - b.invoiced_value,
      render: v => <Text>{fmtINR(v)}</Text>,
    },
    {
      title: 'Collected',
      dataIndex: 'collected_value',
      key: 'collected_value',
      align: 'right',
      width: 120,
      sorter: (a, b) => a.collected_value - b.collected_value,
      render: v => <Text strong style={{ color: '#059669' }}>{fmtINR(v)}</Text>,
    },
    {
      title: 'Avg Deal',
      dataIndex: 'avg_deal_size',
      key: 'avg_deal_size',
      align: 'right',
      width: 120,
      sorter: (a, b) => (a.avg_deal_size || 0) - (b.avg_deal_size || 0),
      render: v => v != null ? fmtINR(v) : <Text type="secondary">—</Text>,
    },
  ]

  // Document History Columns
  const historyColumns = [
    {
      title: 'Type',
      dataIndex: 'doc_type',
      key: 'doc_type',
      width: 110,
      render: v => (
        <Tag color={v === 'Sales Order' ? 'blue' : 'purple'} style={{ fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    { title: 'Doc No', dataIndex: 'doc_number', key: 'doc_number', width: 110, render: v => <Text strong>{v}</Text> },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', ellipsis: true },
    { title: 'Salesperson', dataIndex: 'salesperson', key: 'salesperson', width: 140, render: v => v || 'Unassigned' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: v => {
        const color = v === 'converted' || v === 'confirmed' ? 'green' : v === 'in_production' ? 'cyan' : 'default'
        return <Tag color={color}>{v}</Tag>
      }
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: v => <Text strong>{fmtINR(v)}</Text>
    },
    {
      title: 'Profit',
      key: 'profit',
      width: 130,
      align: 'right',
      render: (_, r) => {
        if (r.profit_amount == null) {
          return (
            <Tooltip title="Cost rate not set for this document">
              <Text type="secondary">—</Text>
            </Tooltip>
          )
        }
        return (
          <div>
            <Text strong style={{ color: r.profit_amount >= 0 ? '#059669' : '#dc2626' }}>
              {fmtINR(r.profit_amount)}
            </Text>
            {r.profit_percent != null && (
              <div style={{ fontSize: 10, color: '#64748b' }}>
                {r.profit_percent}% margin
              </div>
            )}
          </div>
        )
      }
    },
    {
      title: 'Linked Lead',
      dataIndex: 'linked_lead_number',
      key: 'linked_lead_number',
      width: 110,
      render: v => v ? <Tag color="orange">{v}</Tag> : <Text type="secondary">—</Text>
    },
    {
      title: 'Linked Ref',
      dataIndex: 'linked_so_number',
      key: 'linked_so_number',
      width: 110,
      render: v => v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">—</Text>
    },
  ]

  if (isError) {
    return (
      <div style={{ padding: 40, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <Result
          status="error"
          title="Failed to load Sales Performance Report"
          subTitle={error?.response?.data?.detail || error?.message || 'An unexpected error occurred while fetching the report data.'}
          extra={[
            <Button type="primary" key="retry" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Retry
            </Button>
          ]}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChartOutlined style={{ color: '#6366f1' }} />
            Sales Performance Report
          </Title>
          <Space align="center" style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Pipeline & Salesperson attribution analysis — {activeCompanyName}
            </Text>
            {period.label && (
              <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>
                {period.label}
              </Tag>
            )}
          </Space>
        </div>

        <Space wrap>
          {/* Quick Presets */}
          <Space style={{ background: '#f8fafc', padding: 4, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Button size="small" type={dateRange[0]?.isSame(dayjs().startOf('month'), 'day') ? 'primary' : 'text'} onClick={() => handlePreset('this_month')}>This Month</Button>
            <Button size="small" type={dateRange[0]?.isSame(dayjs().subtract(1, 'month').startOf('month'), 'day') ? 'primary' : 'text'} onClick={() => handlePreset('last_month')}>Last Month</Button>
            <Button size="small" type={dateRange[0]?.isSame(dayjs().startOf('quarter'), 'day') ? 'primary' : 'text'} onClick={() => handlePreset('this_quarter')}>This Quarter</Button>
            <Button size="small" type={dateRange[0]?.isSame(getFYBounds()[0], 'day') ? 'primary' : 'text'} onClick={() => handlePreset('this_fy')}>This FY</Button>
            <Button size="small" type={dateRange[0]?.isSame(getLastFYBounds()[0], 'day') ? 'primary' : 'text'} onClick={() => handlePreset('last_fy')}>Last FY</Button>
          </Space>

          <RangePicker
            value={dateRange}
            onChange={val => {
              if (val) {
                setDateRange(val)
                setHistoryPage(1)
              }
            }}
            format="DD/MM/YYYY"
            placeholder={['From date', 'To date']}
            allowClear={false}
            style={{ borderRadius: 8 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { refetch(); refetchHistory(); }}
            loading={isFetching}
            style={{ borderRadius: 8 }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
            style={{ background: '#10b981', borderRadius: 8, borderColor: '#10b981' }}
          >
            Export Excel
          </Button>
        </Space>
      </div>

      {/* ── Data Quality Banner ── */}
      {((dataQuality.blank_salesperson_quotes > 0) || (dataQuality.blank_salesperson_sos > 0) || (dataQuality.unmatched_names?.length > 0)) && (
        <Alert
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #fde68a' }}
          message={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <Text strong style={{ color: '#854d0e' }}>Data Quality Warning: </Text>
                <Text style={{ color: '#a16207' }}>
                  {dataQuality.blank_salesperson_quotes || 0} quotes and {dataQuality.blank_salesperson_sos || 0} sales orders have no salesperson assigned and are grouped under <b>Unassigned</b>.
                  {dataQuality.unmatched_names?.length > 0 && (
                    <span> Unmatched typed names: <b>{dataQuality.unmatched_names.join(', ')}</b>.</span>
                  )}
                </Text>
              </div>
              <Link to="/masters/employees">
                <Button size="small" type="primary" style={{ background: '#d97706', borderColor: '#d97706', borderRadius: 6 }}>
                  Manage Employees
                </Button>
              </Link>
            </div>
          }
        />
      )}

      {/* ── Cost Rate Missing Alert ── */}
      {summary.so_without_cost_count > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #fed7aa' }}
          message={
            <div>
              <Text strong style={{ color: '#9a3412' }}>Cost Rate Missing Alert: </Text>
              <Text style={{ color: '#c2410c' }}>
                <b>{summary.so_without_cost_count}</b> sales order(s) in this period do not have cost rates filled — they are excluded from profit and margin calculations to prevent inaccurate 100% metrics.
              </Text>
            </div>
          }
        />
      )}

      {/* ── KPI Cards Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <KpiCard
            title="Sales Orders Value"
            value={summary.so_value}
            previousValue={previous.so_value}
            prefix="₹"
            color="#3b82f6"
            icon={<ShoppingCartOutlined />}
            loading={isLoading}
            tooltipText="Total total_amount sum of all non-cancelled Sales Orders in the period."
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <KpiCard
            title="Total Profit"
            value={summary.profit_amount}
            previousValue={previous.profit_amount}
            prefix="₹"
            color="#10b981"
            icon={<DollarOutlined />}
            loading={isLoading}
            subLine={profitSubLine}
            tooltipText="Sum of profit amount across sales orders with cost rates. Cost rates are entered on the quotation's Cost Analysis section."
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <KpiCard
            title="Overall Margin"
            value={summary.profit_percent}
            previousValue={previous.profit_percent}
            suffix="%"
            color="#059669"
            icon={<RiseOutlined />}
            loading={isLoading}
            isPercent={true}
            subLine={profitSubLine}
            tooltipText="Weighted average margin % (Total Profit / Total Assessable Value with cost rates). Cost rates are entered on the quotation's Cost Analysis section."
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <KpiCard
            title="Quotes Value"
            value={summary.quotes_value}
            previousValue={previous.quotes_value}
            prefix="₹"
            color="#6366f1"
            icon={<FileTextOutlined />}
            loading={isLoading}
            tooltipText="Total total_amount sum of all non-cancelled Quotations created in the period."
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <KpiCard
            title="Quote Win Rate"
            value={summary.win_rate_value}
            previousValue={previous.win_rate_value}
            suffix="%"
            color="#8b5cf6"
            icon={<CheckCircleOutlined />}
            loading={isLoading}
            isPercent={true}
            tooltipText="Percentage of quotation value won (converted) vs total quote value created."
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <KpiCard
            title="Collected"
            value={summary.collected_value}
            previousValue={previous.collected_value}
            prefix="₹"
            color="#14b8a6"
            icon={<DollarOutlined />}
            loading={isLoading}
            tooltipText="Total payment amounts collected in the period."
          />
        </Col>
      </Row>

      {/* ── Empty State Guard ── */}
      {!hasGenuineData ? (
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          padding: '60px 24px', textAlign: 'center', marginBottom: 24
        }}>
          <Empty
            description={
              <div>
                <Title level={4} style={{ color: '#334155', marginBottom: 8 }}>
                  No sales activity for {activeCompanyName} in {period.label || 'this period'}
                </Title>
                <Text type="secondary">
                  No CRM leads, quotations, or sales orders were created within the selected date range.
                </Text>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {/* ── Pipeline Funnel + Monthly Trend Chart ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>

            {/* Horizontal Funnel */}
            <Col xs={24} lg={10}>
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 24px', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FunnelPlotOutlined style={{ color: '#6366f1' }} />
                      Sales Pipeline Funnel
                    </Text>
                    {summary.leads_created === 0 && (
                      <Tooltip title="No CRM leads in this period. Quotations were created directly, so lead conversion cannot be measured. See quote win rate instead.">
                        <Tag color="warning" icon={<InfoCircleOutlined />} style={{ borderRadius: 10 }}>
                          Zero Leads
                        </Tag>
                      </Tooltip>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {funnel.map((item, idx) => {
                      const maxVal = Math.max(...funnel.map(f => f.value), 1)
                      const pct = Math.min(100, Math.round((item.value / maxVal) * 100))
                      const prevStage = idx > 0 ? funnel[idx - 1] : null
                      
                      let convRate = null
                      if (prevStage && prevStage.count > 0) {
                        const convertedFromPrev = item.converted_from_prev != null ? item.converted_from_prev : item.count
                        convRate = Math.min(100, Math.round((convertedFromPrev / prevStage.count) * 100))
                      }

                      const breakdownTag = item.sub_text ? ` (${item.sub_text})` : ''

                      return (
                        <div key={item.stage} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Space wrap>
                              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{item.stage}</Text>
                              <Tag style={{ borderRadius: 10, fontSize: 11 }}>
                                {item.count} items{breakdownTag}
                              </Tag>
                            </Space>
                            <Space>
                              <Text strong style={{ color: COLORS[idx % COLORS.length], fontSize: 13 }}>
                                {fmtINR(item.value)}
                              </Text>
                              {convRate != null && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  ({convRate}% conv)
                                </Text>
                              )}
                            </Space>
                          </div>
                          <Progress
                            percent={pct}
                            strokeColor={COLORS[idx % COLORS.length]}
                            size="small"
                            showInfo={false}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Col>

            {/* Monthly Trend Chart */}
            <Col xs={24} lg={14}>
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 24px', height: '100%',
              }}>
                <Text style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, display: 'block', marginBottom: 16 }}>
                  12-Month Sales & Collection Trend
                </Text>
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart data={monthly} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value) => [fmtINR(value)]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="so_value" name="Sales Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected_value" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>

          {/* ── Salesperson Performance Table ── */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD',
            }}>
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                Salesperson Performance Summary
              </Text>
              <Tag color="blue" style={{ fontWeight: 600, borderRadius: 12 }}>
                {salespeople.length} salesperson{salespeople.length !== 1 ? 's' : ''}
              </Tag>
            </div>

            <Table
              dataSource={salespeople}
              columns={spColumns}
              rowKey="salesperson"
              loading={isLoading}
              pagination={false}
              size="middle"
              scroll={{ x: 1200 }}
              locale={{ emptyText: <Empty description="No salesperson data found" /> }}
            />
          </div>
        </>
      )}

      {/* ── Document-Centric History Table ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD',
          flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
              Full Document History
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Server-paginated list of Quotations and Sales Orders created in period
            </Text>
          </div>

          <Space wrap>
            <Input
              placeholder="Search doc / customer..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={historySearch}
              onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
              allowClear
              style={{ width: 200, borderRadius: 8 }}
            />
            <Select
              value={historyDocType}
              onChange={v => { setHistoryDocType(v || ''); setHistoryPage(1); }}
              style={{ width: 190, borderRadius: 8 }}
            >
              <Option value="Sales Order">Sales Orders Only</Option>
              <Option value="Quotation">Quotations Only</Option>
              <Option value="">All Documents (SOs & Quotes)</Option>
            </Select>
            <Select
              value={historySalesperson || undefined}
              onChange={v => { setHistorySalesperson(v || ''); setHistoryPage(1); }}
              placeholder="Filter Salesperson"
              allowClear
              style={{ width: 170, borderRadius: 8 }}
            >
              {salespeople.map(s => (
                <Option key={s.salesperson} value={s.salesperson}>{s.salesperson}</Option>
              ))}
            </Select>
          </Space>
        </div>

        <Table
          dataSource={historyItems}
          columns={historyColumns}
          rowKey="id"
          loading={historyLoading}
          pagination={{
            current: historyPage,
            pageSize: historyPageSize,
            total: historyTotal,
            onChange: (p, ps) => { setHistoryPage(p); setHistoryPageSize(ps); },
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            showTotal: total => `Total ${total} documents`
          }}
          size="small"
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="No history records found" /> }}
        />
      </div>
    </div>
  )
}

export default SalesPerformance
