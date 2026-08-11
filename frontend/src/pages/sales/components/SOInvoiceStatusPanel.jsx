import React from 'react'
import { Typography } from 'antd'

const { Text } = Typography

const SOInvoiceStatusPanel = ({
  invoices = [],
  soTotal = 0,
  isEdit = false,
  onNavigate,
}) => {
  const activeInvoices = (invoices || []).filter(
    (inv) => inv && inv.is_active !== false && inv.status !== 'cancelled'
  )

  const fmt = (val) =>
    `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  if (!isEdit || activeInvoices.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            fontSize: 13,
            color: '#475569',
            lineHeight: '1.5',
          }}
        >
          Not yet invoiced — <strong>{fmt(soTotal)}</strong> to be billed
        </div>
      </div>
    )
  }

  const rolledUpInvoiced = activeInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) || 0),
    0
  )
  const rolledUpPaid = activeInvoices.reduce(
    (sum, inv) => sum + (Number(inv.amount_paid) || 0),
    0
  )
  const rolledUpOutstanding = activeInvoices.reduce(
    (sum, inv) => sum + (Number(inv.balance_due) || 0),
    0
  )

  const unbilledAmount = Math.max(0, (soTotal || 0) - rolledUpInvoiced)
  const isPartiallyInvoiced = unbilledAmount > 0.01

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
      <div
        style={{
          fontSize: 10,
          color: '#64748B',
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Invoice Status ({activeInvoices.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {activeInvoices.map((inv) => (
          <div
            key={inv.id}
            style={{
              background: '#F8FAFC',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              padding: '8px 12px',
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <a
                onClick={() => onNavigate && onNavigate(`/invoices/${inv.id}/edit`)}
                style={{ fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
              >
                {inv.invoice_number}
              </a>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {inv.invoice_date || '—'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#475569',
              }}
            >
              <span>Total: {fmt(inv.total_amount)}</span>
              <span>
                Paid: <strong style={{ color: '#16a34a' }}>{fmt(inv.amount_paid)}</strong>
              </span>
              <span>
                Due:{' '}
                <strong style={{ color: inv.balance_due > 0 ? '#dc2626' : '#16a34a' }}>
                  {fmt(inv.balance_due)}
                </strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Rolled-up Summary Bar */}
      <div
        style={{
          background: '#eff6ff',
          borderRadius: 10,
          border: '1px solid #bfdbfe',
          padding: '10px 12px',
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            fontWeight: 600,
            color: '#1e40af',
            marginBottom: 4,
          }}
        >
          <span>Invoiced {fmt(rolledUpInvoiced)}</span>
          <span>Paid {fmt(rolledUpPaid)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            fontWeight: 700,
            color: rolledUpOutstanding > 0 ? '#b91c1c' : '#15803d',
          }}
        >
          <span>Outstanding</span>
          <span>{fmt(rolledUpOutstanding)}</span>
        </div>
      </div>

      {isPartiallyInvoiced && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: 6,
            fontSize: 11,
            color: '#d97706',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {fmt(unbilledAmount)} of the order value not yet invoiced
        </div>
      )}
    </div>
  )
}

export default SOInvoiceStatusPanel
