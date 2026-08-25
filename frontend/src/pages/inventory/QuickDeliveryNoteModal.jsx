import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, DatePicker, Table, InputNumber, Button, Row, Col, Typography, App } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { deliveryNoteApi, stockMovementApi } from '../../api'
import { generateDeliveryNotePDF } from '../../utils/pdfGenerator'

const { Text } = Typography

const QuickDeliveryNoteModal = ({ open, onClose, products = [], warehouseName = '', warehouseId }) => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  const [form] = Form.useForm()
  const [quantities, setQuantities] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        consignee_name: 'CASH SALES',
        note_date: dayjs(),
      })
      setQuantities({})
      setSubmitting(false)
    }
  }, [open, form, products])

  const handleQtyChange = (productId, val) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: val
    }))
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // Validate sheet quantities for all selected products (must be present and > 0)
      for (const p of products) {
        const qty = quantities[p.id]
        if (qty === undefined || qty === null || qty === '' || parseFloat(qty) <= 0 || isNaN(parseFloat(qty))) {
          message.error(`Please enter a valid sheet quantity (> 0) for ${p.name}`)
          return
        }
      }

      setSubmitting(true)

      const payload = {
        note_date: values.note_date ? values.note_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        consignee_name: values.consignee_name,
        buyer_name: values.consignee_name,
        lines: products.map(p => {
          const numSheets = parseFloat(quantities[p.id])
          const widthM = (p.sheet_width_mm || 0) / 1000.0
          const heightM = (p.sheet_height_mm || 0) / 1000.0
          const derivedSqm = Math.round(numSheets * widthM * heightM * 10000) / 10000
          return {
            description: p.name,
            hsn_sac: p.hsn_code || p.hsn || '',
            quantity_sqm: derivedSqm,
            quantity_pcs: numSheets,
            rate: p.cost_price ? parseFloat(p.cost_price) : null,
            unit: 'Sqmt'
          }
        })
      }

      const res = await deliveryNoteApi.create(payload)
      message.success(`Delivery Note ${res.data.note_number} created`)

      const noteNo = res.data.note_number
      const failed = []
      for (const p of products) {
        const numSheets = parseFloat(quantities[p.id])
        const widthM = (p.sheet_width_mm || 0) / 1000.0
        const heightM = (p.sheet_height_mm || 0) / 1000.0
        const derivedSqm = Math.round(numSheets * widthM * heightM * 10000) / 10000

        try {
          await stockMovementApi.create({
            product_id: p.id,
            movement_type: 'adjustment',
            quantity: -derivedSqm,
            quantity_sqm: -derivedSqm,
            quantity_sheets: -numSheets,
            warehouse_id: warehouseId,
            reference: noteNo,
            remarks: `Delivery Note ${noteNo}`,
          })
        } catch (e) {
          console.error(`Failed to deduct stock for ${p.name}:`, e)
          failed.push(p.name)
        }
      }

      if (failed.length) {
        message.warning(`Note ${noteNo} created, but stock was not deducted for: ${failed.join(', ')}. Adjust manually.`)
      }

      queryClient.invalidateQueries({ queryKey: ['products-all'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements-overview'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses-dd'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })

      await generateDeliveryNotePDF(res.data)
      onClose()
    } catch (err) {
      if (err?.errorFields) {
        // Form field validation error
        return
      }
      console.error('Failed to create Delivery Note:', err)
      const serverDetail = err?.response?.data?.detail || err?.message || 'Failed to create Delivery Note'
      message.error(serverDetail)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong style={{ color: '#1e293b' }}>{text}</Text>
    },
    {
      title: 'Available',
      key: 'available',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const avail = record.on_hand_sheets ?? record.available_sheets ?? record.sheets ?? record.on_hand_qty ?? 0
        return <Text>{avail}</Text>
      }
    },
    {
      title: 'QTY (sheets)',
      key: 'qty_sheets',
      width: 150,
      render: (_, record) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          placeholder="Sheets"
          value={quantities[record.id] ?? null}
          onChange={val => handleQtyChange(record.id, val)}
        />
      )
    },
    {
      title: 'QTY (sqm)',
      key: 'qty_sqm',
      width: 150,
      align: 'right',
      render: (_, record) => {
        const numSheets = parseFloat(quantities[record.id])
        if (!numSheets || isNaN(numSheets) || numSheets <= 0) {
          return <Text type="secondary">0.0000</Text>
        }
        const widthM = (record.sheet_width_mm || 0) / 1000.0
        const heightM = (record.sheet_height_mm || 0) / 1000.0
        const sqm = numSheets * widthM * heightM
        return <Text>{sqm.toFixed(4)}</Text>
      }
    }
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      title="🚚 Quick Delivery Note"
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          Create & Download
        </Button>
      ]}
    >
      {warehouseName && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Warehouse: <strong>{warehouseName}</strong>
          </Text>
        </div>
      )}

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="consignee_name"
              label="Consignee Name"
              rules={[{ required: true, message: 'Please enter consignee name' }]}
            >
              <Input placeholder="Consignee Name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="note_date"
              label="Document Date"
              rules={[{ required: true, message: 'Please select document date' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Table
        dataSource={products}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        style={{ marginTop: 8 }}
      />
    </Modal>
  )
}

export default QuickDeliveryNoteModal
