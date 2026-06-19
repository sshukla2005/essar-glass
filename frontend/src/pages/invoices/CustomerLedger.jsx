import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Table, Tag, Typography, Button,
  Space, Divider, Row, Col, App, Statistic
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined,
  FileTextOutlined, DollarOutlined
} from '@ant-design/icons'
import { receivablesApi } from '../../api'
import RecordPaymentModal from './RecordPaymentModal'

const { Text, Title } = Typography

const fmt = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

const CustomerLedger = () => {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [paymentModal, setPaymentModal] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-ledger', customerId],
    queryFn: () => receivablesApi.customerLedger(customerId).then(r => r.data),
    staleTime: 0,
  })

  const customer = data?.customer || {}
  const transactions = data?.transactions || []
  const balance = data?.balance || 0
  const totalBilled = data?.total_billed || 0
  const totalPaid = data?.total_paid || 0

  // Build outstanding SOs list for payment modal
  const outstandingSos = transactions
    .filter(t => t.type === 'invoice')
    .map(t => {
      const soPayments = transactions
        .filter(p => p.type === 'payment' && p.so_id === t.so_id)
        .reduce((s, p) => s + p.credit, 0)
      const outstanding = t.debit - soPayments
      return {
        so_id: t.so_id,
        so_number: t.reference,
        outstanding_amount: Math.max(0, outstanding),
      }
    })
    .filter(s => s.outstanding_amount > 0)

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      width: 100,
      render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      width: 130,
      render: (v, row) => (
        <Space>
          {row.type === 'invoice'
            ? <FileTextOutlined style={{ color: '#6366f1' }} />
            : <DollarOutlined style={{ color: '#16a34a' }} />
          }
          <Text
            strong
            style={{
              color: row.type === 'invoice' ? '#6366f1' : '#16a34a',
              cursor: row.type === 'invoice' ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (row.type === 'invoice' && row.so_id) {
                navigate(`/sales-orders/${row.so_id}/edit`)
              }
            }}
          >
            {v}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v, row) => (
        <div>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          {row.payment_reference && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Ref: {row.payment_reference}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 90,
      align: 'center',
      render: (v) => (
        <Tag color={v === 'invoice' ? 'purple' : 'green'}>
          {v === 'invoice' ? 'Invoice' : 'Payment'}
        </Tag>
      ),
    },
    {
      title: 'Debit (Dr)',
      dataIndex: 'debit',
      align: 'right',
      width: 120,
      render: (v) =>
        v > 0 ? (
          <Text strong style={{ color: '#dc2626' }}>
            {fmt(v)}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Credit (Cr)',
      dataIndex: 'credit',
      align: 'right',
      width: 120,
      render: (v) =>
        v > 0 ? (
          <Text strong style={{ color: '#16a34a' }}>
            {fmt(v)}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      align: 'right',
      width: 130,
      render: (v) => (
        <Text
          strong
          style={{ color: v > 0 ? '#dc2626' : v < 0 ? '#6366f1' : '#16a34a' }}
        >
          {v > 0 ? `${fmt(v)} Dr` : v < 0 ? `${fmt(Math.abs(v))} Cr` : '✅ Nil'}
        </Text>
      ),
    },
  ]

  const balanceColor = balance > 0 ? '#dc2626' : balance < 0 ? '#6366f1' : '#16a34a'
  const balanceLabel = balance > 0
    ? `${fmt(balance)} Outstanding`
    : balance < 0
    ? `${fmt(Math.abs(balance))} Credit Balance`
    : '✅ Fully Settled'

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a237e, #3949ab)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/invoices')}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}
            />
            <div>
              <Title level={4} style={{ color: '#fff', margin: 0 }}>
                {customer.name || 'Customer Ledger'}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                {customer.phone && `📞 ${customer.phone}`}
                {customer.gstin && ` · GSTIN: ${customer.gstin}`}
              </Text>
            </div>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
            onClick={() => setPaymentModal(true)}
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Balance summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe' }}
            bodyStyle={{ padding: '16px 20px' }}>
            <Text style={{ color: '#64748b', fontSize: 12, display: 'block' }}>TOTAL BILLED</Text>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a237e' }}>
              {fmt(totalBilled)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, background: '#f0fdf4', border: '1px solid #86efac' }}
            bodyStyle={{ padding: '16px 20px' }}>
            <Text style={{ color: '#64748b', fontSize: 12, display: 'block' }}>TOTAL COLLECTED</Text>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>
              {fmt(totalPaid)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{
              borderRadius: 12,
              background: balance > 0 ? '#fff7f7' : balance < 0 ? '#f5f3ff' : '#f0fdf4',
              border: `1px solid ${balance > 0 ? '#fca5a5' : balance < 0 ? '#c4b5fd' : '#86efac'}`,
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Text style={{ color: '#64748b', fontSize: 12, display: 'block' }}>
              {balance > 0 ? 'OUTSTANDING DUE' : balance < 0 ? 'CREDIT BALANCE' : 'STATUS'}
            </Text>
            <div style={{ fontSize: 22, fontWeight: 800, color: balanceColor }}>
              {balanceLabel}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Transactions table */}
      <Card
        title={<Text strong>Transaction History</Text>}
        style={{ borderRadius: 12 }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={transactions}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          size="small"
          rowClassName={(record) =>
            record.type === 'invoice' ? 'row-invoice' : 'row-payment'
          }
        />
        <style>{`
          .row-invoice td { background: #fafafe !important; }
          .row-payment td { background: #f0fdf6 !important; }
        `}</style>
      </Card>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        customerId={parseInt(customerId)}
        customerName={customer.name}
        outstandingSos={outstandingSos}
        onSuccess={() => refetch()}
      />
    </div>
  )
}

export default CustomerLedger
