import React, { useState, useEffect } from 'react'
import {
  Modal, Form, Input, DatePicker, Table, InputNumber,
  Button, Typography, App, Divider
} from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { stockMovementApi } from '../../api'

const { Text } = Typography

/**
 * BulkAddStockModal — add stock for multiple products in one go.
 *
 * Props:
 *   open         — boolean
 *   onClose      — () => void
 *   products     — full product objects (no lookup needed)
 *   warehouseId  — already-selected warehouse id
 *   warehouseName — display name for the warehouse
 *
 * Payload shape mirrors adjustMutation in StockOverview.jsx (lines 573-587):
 *   { product_id, movement_type: 'adjustment', quantity: qtySqm,
 *     quantity_sqm: qtySqm, quantity_sheets: qtySheets,
 *     warehouse_id, reference, remarks, unit_rate, total_value, date }
 */
const BulkAddStockModal = ({
  open,
  onClose,
  products = [],
  warehouseId,
  warehouseName = '',
}) => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  const [form] = Form.useForm()

  // Per-row state: { [productId]: { sheets, rate } }
  const [rows, setRows] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      form.resetFields()
      setRows({})
      setSubmitting(false)
    }
  }, [open, form])

  const setRowField = (productId, field, val) => {
    setRows(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [field]: val },
    }))
  }

  const getSqm = (product, sheets) => {
    const numSheets = parseFloat(sheets)
    if (!numSheets || isNaN(numSheets) || numSheets <= 0) return 0
    const wM = (product.sheet_width_mm || 0) / 1000.0
    const hM = (product.sheet_height_mm || 0) / 1000.0
    return Math.round(numSheets * wM * hM * 10000) / 10000
  }

  const getAmount = (product, sheets, rate) => {
    const sqm = getSqm(product, sheets)
    const r = parseFloat(rate)
    if (!sqm || !r || isNaN(r)) return null
    return Math.round(r * sqm * 100) / 100
  }

  // Footer totals
  const totals = products.reduce(
    (acc, p) => {
      const r = rows[p.id] || {}
      const sheets = parseFloat(r.sheets) || 0
      const sqm = getSqm(p, r.sheets)
      const amount = getAmount(p, r.sheets, r.rate) || 0
      return {
        sheets: acc.sheets + sheets,
        sqm: Math.round((acc.sqm + sqm) * 10000) / 10000,
        amount: Math.round((acc.amount + amount) * 100) / 100,
      }
    },
    { sheets: 0, sqm: 0, amount: 0 }
  )

  const handleSubmit = async () => {
    let purchaseValues
    try {
      purchaseValues = await form.validateFields()
    } catch {
      return
    }

    // Build list of rows with qty > 0
    const toPost = products.filter(p => {
      const sheets = parseFloat((rows[p.id] || {}).sheets)
      return sheets > 0 && !isNaN(sheets)
    })

    if (toPost.length === 0) {
      message.error('Please enter a quantity greater than 0 for at least one product.')
      return
    }

    setSubmitting(true)

    const ref = purchaseValues.supplier_invoice_no?.trim() || 'MANUAL-ADD'
    const invoiceDate = purchaseValues.invoice_date
      ? purchaseValues.invoice_date.format('YYYY-MM-DD')
      : null
    const supplierName = purchaseValues.supplier_name?.trim() || ''

    const failed = []

    for (const p of toPost) {
      const r = rows[p.id] || {}
      const qtySheets = parseFloat(r.sheets)
      const qtySqm = getSqm(p, r.sheets)
      const rate = parseFloat(r.rate) || null
      const totalValue = getAmount(p, r.sheets, r.rate) ?? null

      const remarks = supplierName
        ? `Stock addition | Supplier: ${supplierName}`
        : 'Stock addition'

      try {
        // Exact payload shape from adjustMutation (StockOverview.jsx lines 573-587)
        await stockMovementApi.create({
          product_id:       p.id,
          movement_type:    'adjustment',
          quantity:         qtySqm,
          quantity_sqm:     qtySqm,
          quantity_sheets:  qtySheets,
          warehouse_id:     warehouseId,
          reference:        ref,
          remarks:          remarks,
          unit_rate:        rate,
          total_value:      totalValue,
          date:             invoiceDate,
        })
      } catch (err) {
        console.error(`BulkAddStock: failed for ${p.name}:`, err)
        failed.push(p.name)
      }
    }

    // Invalidate exactly what adjustMutation's onSuccess invalidates
    queryClient.invalidateQueries({ queryKey: ['products-all'] })
    queryClient.invalidateQueries({ queryKey: ['stock-movements-overview'] })
    queryClient.invalidateQueries({ queryKey: ['warehouses-dd'] })

    setSubmitting(false)

    const succeeded = toPost.length - failed.length
    if (failed.length > 0) {
      message.warning(
        `Added stock for ${succeeded} product(s). Failed: ${failed.join(', ')}. Adjust manually.`
      )
    } else {
      message.success(`Stock added for ${succeeded} product(s) successfully.`)
    }

    onClose()
  }

  const columns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
      render: v => <Text strong style={{ color: '#1e293b' }}>{v}</Text>,
    },
    {
      title: 'Sheet Size',
      key: 'size',
      width: 140,
      render: (_, p) =>
        p.sheet_width_mm && p.sheet_height_mm
          ? <Text style={{ fontSize: 12 }}>{p.sheet_width_mm} × {p.sheet_height_mm} mm</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Current Stock',
      key: 'stock',
      width: 110,
      align: 'right',
      render: (_, p) => {
        const sheets = p.on_hand_sheets ?? p.available_sheets ?? p.sheets ?? p.on_hand_qty ?? 0
        return <Text>{Number(sheets).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
      },
    },
    {
      title: 'QTY (sheets)',
      key: 'qty_sheets',
      width: 130,
      render: (_, p) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          placeholder="Qty"
          value={(rows[p.id] || {}).sheets ?? null}
          onChange={val => setRowField(p.id, 'sheets', val)}
        />
      ),
    },
    {
      title: 'Qty (sqm)',
      key: 'qty_sqm',
      width: 110,
      align: 'right',
      render: (_, p) => {
        const sqm = getSqm(p, (rows[p.id] || {}).sheets)
        return sqm > 0
          ? <Text>{sqm.toFixed(4)}</Text>
          : <Text type="secondary">0.0000</Text>
      },
    },
    {
      title: 'Rate / SQM (₹)',
      key: 'rate',
      width: 130,
      render: (_, p) => (
        <InputNumber
          min={0}
          step={0.01}
          style={{ width: '100%' }}
          placeholder="Optional"
          value={(rows[p.id] || {}).rate ?? null}
          onChange={val => setRowField(p.id, 'rate', val)}
        />
      ),
    },
    {
      title: 'Amount (₹)',
      key: 'amount',
      width: 110,
      align: 'right',
      render: (_, p) => {
        const amount = getAmount(p, (rows[p.id] || {}).sheets, (rows[p.id] || {}).rate)
        return amount != null
          ? <Text strong>₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          : <Text type="secondary">—</Text>
      },
    },
  ]

  const footerRow = {
    id: '__footer__',
    name: <Text strong>Total</Text>,
    _isFooter: true,
  }

  const tableData = [
    ...products,
    footerRow,
  ]

  const columnsWithFooter = columns.map(col => {
    if (col.key === 'qty_sheets') {
      return {
        ...col,
        render: (_, p) => {
          if (p._isFooter) {
            return (
              <Text strong style={{ color: '#16a34a' }}>
                {totals.sheets.toLocaleString(undefined, { maximumFractionDigits: 2 })} sheets
              </Text>
            )
          }
          return col.render(_, p)
        },
      }
    }
    if (col.key === 'qty_sqm') {
      return {
        ...col,
        render: (_, p) => {
          if (p._isFooter) {
            return (
              <Text strong style={{ color: '#16a34a' }}>
                {totals.sqm.toFixed(4)} sqm
              </Text>
            )
          }
          return col.render(_, p)
        },
      }
    }
    if (col.key === 'amount') {
      return {
        ...col,
        render: (_, p) => {
          if (p._isFooter) {
            return totals.amount > 0
              ? <Text strong style={{ color: '#16a34a' }}>₹{totals.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
              : <Text type="secondary">—</Text>
          }
          return col.render(_, p)
        },
      }
    }
    // Footer cells for other columns: blank or read-only label
    const origRender = col.render
    return {
      ...col,
      render: (v, p, idx) => {
        if (p._isFooter) return null
        return origRender ? origRender(v, p, idx) : v
      },
    }
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={900}
      title="📦 Add Stock — Multiple Products"
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          style={{ background: '#16a34a', borderColor: '#16a34a' }}
          onClick={handleSubmit}
        >
          Add Stock
        </Button>,
      ]}
    >
      {warehouseName && (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Warehouse: <strong>{warehouseName}</strong>
          </Text>
        </div>
      )}

      {/* Shared Purchase Details */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
      }}>
        <Text strong style={{ display: 'block', marginBottom: 10, color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Purchase Details (optional — applied to all rows)
        </Text>
        <Form form={form} layout="inline">
          <Form.Item name="supplier_invoice_no" label="Invoice No." style={{ marginBottom: 0 }}>
            <Input placeholder="e.g. INV-2025-001" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="invoice_date" label="Invoice Date" style={{ marginBottom: 0 }}>
            <DatePicker format="DD/MM/YYYY" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="supplier_name" label="Supplier" style={{ marginBottom: 0 }}>
            <Input placeholder="Supplier name" style={{ width: 180 }} />
          </Form.Item>
        </Form>
      </div>

      <Divider style={{ margin: '0 0 12px 0' }} />

      <Table
        dataSource={tableData}
        columns={columnsWithFooter}
        rowKey="id"
        pagination={false}
        size="small"
        rowClassName={r => r._isFooter ? 'bulk-add-footer-row' : ''}
        style={{ marginBottom: 0 }}
      />

      <style>{`
        .bulk-add-footer-row td {
          background: #f0fdf4 !important;
          font-weight: 600;
          border-top: 2px solid #86efac !important;
        }
      `}</style>
    </Modal>
  )
}

export default BulkAddStockModal
