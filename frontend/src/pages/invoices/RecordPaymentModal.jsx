import React, { useState, useEffect } from 'react'
import {
  Modal, Form, InputNumber, Select, Input,
  DatePicker, Radio, Space, Typography, Tag,
  Divider, App, Row, Col
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { paymentApi, salesOrderApi } from '../../api'
import { settingsApi } from '../../api/settingsApi'

const { Text } = Typography

const RecordPaymentModal = ({
  open,
  onClose,
  customerId,
  customerName,
  outstandingSos = [],  // array of {so_id, so_number, outstanding_amount}
  onSuccess,
}) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paymentAccounts, setPaymentAccounts] = useState([])

  // Load payment accounts from company settings
  useEffect(() => {
    settingsApi.get('payment_accounts').then(data => {
      if (data && Array.isArray(data)) {
        setPaymentAccounts(data)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ payment_date: dayjs() })
      setPaymentMode('cash')
    }
  }, [open])

  const upiAccounts = paymentAccounts.filter(a => a.type === 'upi')
  const neftAccounts = paymentAccounts.filter(a => a.type === 'neft')

  const saveMutation = useMutation({
    mutationFn: (data) => paymentApi.create(data),
    onSuccess: () => {
      message.success('✅ Payment recorded!')
      queryClient.invalidateQueries({ queryKey: ['receivables-summary'] })
      queryClient.invalidateQueries({ queryKey: ['receivables-customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', customerId] })
      if (onSuccess) onSuccess()
      onClose()
    },
    onError: () => message.error('Failed to record payment'),
  })

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (values.payment_date) {
        values.payment_date = values.payment_date.format('YYYY-MM-DD')
      }
      values.customer_id = customerId

      // Build payment_account display string
      if (paymentMode === 'upi' && values.upi_account) {
        values.payment_account = values.upi_account
        delete values.upi_account
      } else if (paymentMode === 'neft' && values.neft_account) {
        values.payment_account = values.neft_account
        delete values.neft_account
      } else {
        values.payment_account = null
      }

      await saveMutation.mutateAsync(values)
    } catch (_) {}
  }

  return (
    <Modal
      title={
        <Space>
          <span>💳 Record Payment</span>
          <Tag color="blue">{customerName}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save Payment"
      okButtonProps={{
        loading: saveMutation.isPending,
        style: { background: '#10b981', borderColor: '#10b981' }
      }}
      width={560}
    >
      <Form form={form} layout="vertical">

        {/* Against SO */}
        <Form.Item name="so_id" label="Against Sales Order">
          <Select
            placeholder="Select SO (leave empty for advance)"
            allowClear
            options={[
              { value: null, label: '📦 Advance / No specific SO' },
              ...outstandingSos.map(so => ({
                value: so.so_id,
                label: `${so.so_number} — Outstanding: ₹${Number(so.outstanding_amount || 0).toLocaleString('en-IN')}`,
              }))
            ]}
          />
        </Form.Item>

        {/* Amount */}
        <Form.Item
          name="amount"
          label="Amount Received (₹)"
          rules={[{ required: true, message: 'Enter amount' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            prefix="₹"
            size="large"
            placeholder="0.00"
          />
        </Form.Item>

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
                  : [{ value: 'upi_default', label: '⚠️ No UPI accounts configured — add in Settings' }]
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
                  : [{ value: 'neft_default', label: '⚠️ No bank accounts configured — add in Settings' }]
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

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="payment_date" label="Payment Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="notes" label="Notes">
              <Input placeholder="Optional remarks" />
            </Form.Item>
          </Col>
        </Row>

      </Form>
    </Modal>
  )
}

export default RecordPaymentModal
