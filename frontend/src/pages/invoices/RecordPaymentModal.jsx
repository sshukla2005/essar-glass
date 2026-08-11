import React, { useState, useEffect, useMemo } from 'react'
import {
  Modal, Form, InputNumber, Select, Input,
  DatePicker, Radio, Space, Typography, Tag,
  Divider, App, Row, Col, Table, Button, Alert
} from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { paymentApi } from '../../api'
import { settingsApi } from '../../api/settingsApi'

const { Text } = Typography

const RecordPaymentModal = ({
  open,
  onClose,
  customerId,
  customerName,
  invoiceId = null,
  initialInvoiceId = null,
  onSuccess,
}) => {
  const targetInvoiceId = invoiceId || initialInvoiceId
  const { message, modal } = App.useApp()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const [paymentMode, setPaymentMode] = useState('cash')
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [allocationsMap, setAllocationsMap] = useState({})
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [manualAllocOverrides, setManualAllocOverrides] = useState(false)
  const [showSplitView, setShowSplitView] = useState(false)

  const { data: outstandingData, isLoading: isLoadingOutstanding } = useQuery({
    queryKey: ['customer-outstanding', customerId],
    queryFn: () => paymentApi.customerOutstanding(customerId).then(r => r.data),
    enabled: open && Boolean(customerId),
  })

  // Filter open/unpaid invoices for this customer (outstanding > 0 or target invoice)
  const unpaidInvoices = useMemo(() => {
    const items = outstandingData?.items || []
    return items.filter(inv => (inv.outstanding || 0) > 0 || inv.invoice_id === targetInvoiceId)
  }, [outstandingData, targetInvoiceId])

  // Find target invoice if targetInvoiceId is passed
  const targetInvoice = useMemo(() => {
    if (!targetInvoiceId || !unpaidInvoices.length) return null
    return unpaidInvoices.find(inv => inv.invoice_id === targetInvoiceId) || null
  }, [targetInvoiceId, unpaidInvoices])

  // Load payment accounts from company settings
  useEffect(() => {
    settingsApi.get('payment_accounts').then(data => {
      if (data && Array.isArray(data)) {
        setPaymentAccounts(data)
      }
    }).catch(() => {})
  }, [])

  const round = (val) => Math.round((val + Number.EPSILON) * 100) / 100

  // Reset form state on modal open
  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        payment_date: dayjs(),
        amount: undefined,
      })
      setPaymentMode('cash')
      setPaymentAmount(0)
      setAllocationsMap({})
      setManualAllocOverrides(false)
      setShowSplitView(false)
    }
  }, [open, form])

  // Auto-allocate & prefill when unpaidInvoices load or targetInvoiceId changes while open
  useEffect(() => {
    if (open && targetInvoice && !manualAllocOverrides) {
      const due = targetInvoice.outstanding || 0
      const currentAmt = form.getFieldValue('amount')
      const initialAmt = currentAmt && currentAmt > 0 ? currentAmt : due

      if (!currentAmt || currentAmt === 0) {
        form.setFieldValue('amount', initialAmt)
        setPaymentAmount(initialAmt)
      }

      const alloc = Math.min(initialAmt, due)
      setAllocationsMap({ [targetInvoiceId]: round(alloc) })

      // Scroll target row into view if table is rendered
      setTimeout(() => {
        const rowEl = document.querySelector('.highlight-target-invoice-row')
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 150)
    }
  }, [open, targetInvoice, targetInvoiceId, manualAllocOverrides, form])

  const upiAccounts = paymentAccounts.filter(a => a.type === 'upi')
  const neftAccounts = paymentAccounts.filter(a => a.type === 'neft')

  const handleAmountChange = (val) => {
    const newAmt = val || 0
    setPaymentAmount(newAmt)

    if (targetInvoice && !manualAllocOverrides) {
      const due = targetInvoice.outstanding || 0
      const autoAlloc = Math.min(newAmt, due)
      setAllocationsMap(prev => {
        const next = { ...prev }
        if (autoAlloc > 0) {
          next[targetInvoiceId] = round(autoAlloc)
        } else {
          delete next[targetInvoiceId]
        }
        return next
      })
    }
  }

  // Determine whether to display the allocation table
  const targetOutstanding = targetInvoice?.outstanding || 0
  const shouldShowTable = useMemo(() => {
    if (!targetInvoiceId) return true
    if (showSplitView) return true
    if (paymentAmount > targetOutstanding) return true
    return false
  }, [targetInvoiceId, showSplitView, paymentAmount, targetOutstanding])

  const totalAllocated = useMemo(() => {
    if (!shouldShowTable && targetInvoiceId) {
      return Math.min(paymentAmount, targetOutstanding)
    }
    return Object.values(allocationsMap).reduce((sum, val) => sum + (Number(val) || 0), 0)
  }, [allocationsMap, shouldShowTable, targetInvoiceId, paymentAmount, targetOutstanding])

  const onAccountAmount = useMemo(() => {
    return Math.max(0, paymentAmount - totalAllocated)
  }, [paymentAmount, totalAllocated])

  const isOverAllocated = totalAllocated > paymentAmount + 0.009

  // FIFO Auto-Allocate
  const handleAutoAllocate = () => {
    if (!paymentAmount || paymentAmount <= 0) {
      message.warning('Please enter Payment Amount first before auto-allocating.')
      return
    }

    let remaining = paymentAmount
    const newAllocations = {}

    const sorted = [...unpaidInvoices].sort((a, b) => {
      if (a.invoice_date && b.invoice_date) {
        return a.invoice_date.localeCompare(b.invoice_date)
      }
      return a.invoice_id - b.invoice_id
    })

    let allocatedCount = 0
    for (const inv of sorted) {
      if (remaining <= 0) break
      const due = inv.outstanding || 0
      if (due > 0) {
        const alloc = Math.min(due, remaining)
        newAllocations[inv.invoice_id] = round(alloc)
        remaining -= alloc
        allocatedCount++
      }
    }

    setManualAllocOverrides(true)
    setAllocationsMap(newAllocations)
    message.success(`Auto-allocated ₹${(paymentAmount - remaining).toLocaleString('en-IN')} across ${allocatedCount} invoice(s).`)
  }

  const handleAllocationChange = (invId, val) => {
    setManualAllocOverrides(true)
    setAllocationsMap(prev => {
      const updated = { ...prev }
      if (val === null || val === undefined || val <= 0) {
        delete updated[invId]
      } else {
        updated[invId] = val
      }
      return updated
    })
  }

  const saveMutation = useMutation({
    mutationFn: (data) => paymentApi.create(data),
    onSuccess: () => {
      message.success('✅ Payment recorded successfully!')
      queryClient.invalidateQueries({ queryKey: ['receivables-summary'] })
      queryClient.invalidateQueries({ queryKey: ['receivables-customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', customerId] })
      queryClient.invalidateQueries({ queryKey: ['customer-outstanding', customerId] })
      queryClient.invalidateQueries({ queryKey: ['payments-inv'] })
      if (onSuccess) onSuccess()
      onClose()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to record payment'
      message.error(msg)
    },
  })

  const handleSave = async () => {
    if (saveMutation.isPending) return
    try {
      const values = await form.validateFields()
      const amt = values.amount || 0

      let finalAllocations = []

      if (!shouldShowTable && targetInvoiceId) {
        const allocAmt = Math.min(amt, targetOutstanding)
        if (allocAmt > 0) {
          finalAllocations = [{ invoice_id: targetInvoiceId, amount: round(allocAmt) }]
        }
      } else {
        finalAllocations = Object.entries(allocationsMap)
          .filter(([_, a]) => Number(a) > 0)
          .map(([invId, a]) => ({
            invoice_id: Number(invId),
            amount: round(Number(a)),
          }))

        const totalAlloc = finalAllocations.reduce((s, a) => s + a.amount, 0)
        if (totalAlloc > amt + 0.009) {
          message.error(`Total allocated (₹${totalAlloc.toLocaleString('en-IN')}) cannot exceed Payment Amount (₹${amt.toLocaleString('en-IN')}).`)
          return
        }

        // On-account confirmation ONLY when user explicitly opened table and left allocation at zero
        const targetAllocAmt = targetInvoiceId ? (allocationsMap[targetInvoiceId] || 0) : null
        const targetInvNum = targetInvoice ? targetInvoice.invoice_number : `INV${targetInvoiceId}`

        if (targetInvoiceId && targetAllocAmt <= 0 && amt > 0) {
          const confirmed = await new Promise((resolve) => {
            modal.confirm({
              title: 'Unallocated Payment (On-Account)',
              content: `This payment will be recorded as unapplied credit and will not reduce ${targetInvNum}'s balance. Continue?`,
              okText: 'Yes, Record On-Account',
              cancelText: 'Cancel',
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            })
          })
          if (!confirmed) return
        } else if (!targetInvoiceId && finalAllocations.length === 0 && amt > 0) {
          const confirmed = await new Promise((resolve) => {
            modal.confirm({
              title: 'Unallocated Payment (On-Account)',
              content: `No invoices selected for allocation. The entire payment of ₹${amt.toLocaleString('en-IN')} will be recorded as On-Account credit for ${customerName || 'customer'}. Do you wish to proceed?`,
              okText: 'Yes, Record On-Account',
              cancelText: 'Cancel',
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            })
          })
          if (!confirmed) return
        }
      }

      const paymentDate = values.payment_date
        ? values.payment_date.format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD')

      let payAccount = null
      if (paymentMode === 'upi' && values.upi_account) {
        payAccount = values.upi_account
      } else if (paymentMode === 'neft' && values.neft_account) {
        payAccount = values.neft_account
      }

      const payload = {
        customer_id: customerId,
        amount: amt,
        payment_mode: values.payment_mode,
        payment_account: payAccount,
        payment_reference: values.payment_reference || null,
        payment_date: paymentDate,
        notes: values.notes || null,
        allocations: finalAllocations,
      }

      await saveMutation.mutateAsync(payload)
    } catch (err) {
      // Form validation errors or mutation errors handled gracefully
    }
  }

  const columns = [
    {
      title: 'Invoice No.',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text, record) => (
        <div>
          <Space>
            <Text strong>{text}</Text>
            {record.invoice_id === targetInvoiceId && (
              <Tag color="indigo" style={{ fontWeight: 600 }}>🎯 Target Invoice</Tag>
            )}
          </Space>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{record.invoice_date || '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Paid',
      dataIndex: 'allocated',
      key: 'allocated',
      align: 'right',
      render: (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding',
      key: 'outstanding',
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: '#d97706' }}>
          ₹{Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Allocate Amount (₹)',
      key: 'allocate',
      width: 180,
      render: (_, record) => {
        const due = record.outstanding || 0
        const currentAlloc = allocationsMap[record.invoice_id]
        return (
          <InputNumber
            min={0}
            max={due}
            precision={2}
            prefix="₹"
            placeholder="0.00"
            style={{ width: '100%' }}
            value={currentAlloc}
            onChange={(val) => handleAllocationChange(record.invoice_id, val)}
          />
        )
      },
    },
  ]

  const remainingDue = Math.max(0, targetOutstanding - paymentAmount)

  return (
    <Modal
      title={
        <Space>
          <span>💳 Record Payment & Allocate</span>
          {customerName && <Tag color="blue">{customerName}</Tag>}
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save Payment"
      okButtonProps={{
        loading: saveMutation.isPending,
        disabled: isOverAllocated,
        style: { background: isOverAllocated ? undefined : '#10b981', borderColor: isOverAllocated ? undefined : '#10b981' }
      }}
      width={760}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            {/* Amount */}
            <Form.Item
              name="amount"
              label="Payment Amount Received (₹)"
              rules={[{ required: true, message: 'Enter payment amount' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0.01}
                prefix="₹"
                size="large"
                placeholder="0.00"
                onChange={handleAmountChange}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="payment_date" label="Payment Date">
              <DatePicker style={{ width: '100%' }} size="large" format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            {/* Payment Mode */}
            <Form.Item
              name="payment_mode"
              label="Payment Mode"
              initialValue="cash"
              rules={[{ required: true }]}
            >
              <Radio.Group
                onChange={e => {
                  setPaymentMode(e.target.value)
                  form.setFieldValue('upi_account', undefined)
                  form.setFieldValue('neft_account', undefined)
                }}
              >
                <Space wrap>
                  {['cash', 'upi', 'neft', 'cheque', 'card'].map(mode => (
                    <Radio.Button key={mode} value={mode} style={{ borderRadius: 8 }}>
                      {mode === 'cash' && '💵 Cash'}
                      {mode === 'upi' && '📱 UPI'}
                      {mode === 'neft' && '🏦 NEFT'}
                      {mode === 'cheque' && '📝 Cheque'}
                      {mode === 'card' && '💳 Card'}
                    </Radio.Button>
                  ))}
                </Space>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={12}>
            {/* UPI Account selector */}
            {paymentMode === 'upi' && (
              <Form.Item
                name="upi_account"
                label="UPI Account"
                rules={[{ required: true, message: 'Select UPI account' }]}
              >
                <Select
                  placeholder="Select which UPI account"
                  options={
                    upiAccounts.length > 0
                      ? upiAccounts.map(a => ({
                          value: `${a.name} — ${a.detail}`,
                          label: (
                            <span>
                              <Tag color="blue" style={{ marginRight: 6 }}>UPI</Tag>
                              {a.name} — {a.detail}
                            </span>
                          ),
                        }))
                      : [{ value: 'upi_default', label: '⚠️ No UPI accounts configured' }]
                  }
                />
              </Form.Item>
            )}

            {/* NEFT Account selector */}
            {paymentMode === 'neft' && (
              <Form.Item
                name="neft_account"
                label="Bank Account (NEFT/RTGS)"
                rules={[{ required: true, message: 'Select bank account' }]}
              >
                <Select
                  placeholder="Select which bank account"
                  options={
                    neftAccounts.length > 0
                      ? neftAccounts.map(a => ({
                          value: `${a.name} — ${a.detail}`,
                          label: (
                            <span>
                              <Tag color="green" style={{ marginRight: 6 }}>NEFT</Tag>
                              {a.name} — {a.detail}
                            </span>
                          ),
                        }))
                      : [{ value: 'neft_default', label: '⚠️ No bank accounts configured' }]
                  }
                />
              </Form.Item>
            )}

            {/* Reference number */}
            {['upi', 'neft', 'cheque'].includes(paymentMode) && (
              <Form.Item name="payment_reference" label="Reference No. (UTR / Cheque No.)">
                <Input placeholder="Enter UTR number or cheque number" />
              </Form.Item>
            )}
          </Col>
        </Row>

        <Form.Item name="notes" label="Notes">
          <Input placeholder="Optional payment remarks" />
        </Form.Item>

        <Divider style={{ margin: '16px 0 12px 0' }} />

        {/* Allocations Section */}
        {!shouldShowTable && targetInvoiceId ? (
          <Alert
            type="info"
            showIcon={false}
            style={{ background: '#eff6ff', borderColor: '#bfdbfe', borderRadius: 8, marginBottom: 16 }}
            message={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14 }}>
                  Applying <strong>₹{paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> to <strong>{targetInvoice?.invoice_number || `INV${targetInvoiceId}`}</strong>
                  {remainingDue > 0 ? (
                    <span> — <strong>₹{remainingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> will remain due</span>
                  ) : (
                    <span> — invoice will be fully paid</span>
                  )}
                </Text>
                <Button type="link" size="small" onClick={() => setShowSplitView(true)}>
                  Split across invoices
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Space>
                <Text strong style={{ fontSize: 15 }}>Invoice Allocations</Text>
                {unpaidInvoices.length > 0 && (
                  <Tag color="purple">{unpaidInvoices.length} Open Invoice(s)</Tag>
                )}
              </Space>

              {unpaidInvoices.length > 0 && (
                <Button
                  type="primary"
                  ghost
                  icon={<ThunderboltOutlined />}
                  onClick={handleAutoAllocate}
                  size="small"
                >
                  Auto-Allocate (FIFO)
                </Button>
              )}
            </div>

            {unpaidInvoices.length > 0 ? (
              <Table
                dataSource={unpaidInvoices}
                columns={columns}
                rowKey="invoice_id"
                pagination={false}
                size="small"
                loading={isLoadingOutstanding}
                bordered
                rowClassName={(record) => record.invoice_id === targetInvoiceId ? 'highlight-target-invoice-row' : ''}
              />
            ) : (
              <Alert
                type="info"
                message="No outstanding invoices found for this customer. Payment will be recorded as On-Account credit."
                showIcon
              />
            )}

            {/* Allocations Summary Bar */}
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
            }}>
              <Space size="large">
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Payment Amount:</Text>
                  <div><Text strong style={{ fontSize: 16 }}>₹{paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total Allocated:</Text>
                  <div><Text strong style={{ fontSize: 16, color: isOverAllocated ? '#ef4444' : '#16a34a' }}>₹{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>On-Account (Unallocated):</Text>
                  <div>
                    {onAccountAmount > 0 ? (
                      <Tag color="warning" style={{ fontSize: 14, padding: '2px 8px' }}>
                        💳 ₹{onAccountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Tag>
                    ) : (
                      <Text strong style={{ fontSize: 16, color: '#64748b' }}>₹0.00</Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            {isOverAllocated && (
              <Alert
                type="error"
                message={`Total allocated (₹${totalAllocated.toLocaleString('en-IN')}) exceeds payment amount (₹${paymentAmount.toLocaleString('en-IN')}). Please adjust allocations.`}
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </>
        )}

        <style>{`
          .highlight-target-invoice-row td {
            background: #eef2ff !important;
            font-weight: 500;
          }
        `}</style>

      </Form>
    </Modal>
  )
}

export default RecordPaymentModal

