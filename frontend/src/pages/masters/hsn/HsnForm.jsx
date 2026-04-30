import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Alert } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import MasterForm from '../../../components/common/MasterForm'
import { hsnApi } from '../../../api'
import { HSN_TYPES, GST_RATES } from '../../../utils/constants'

const HsnForm = () => {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['hsn-codes', id],
    queryFn:  () => hsnApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })
  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? hsnApi.update(id, data) : hsnApi.create(data),
    onSuccess: () => { message.success('HSN Code saved'); queryClient.invalidateQueries({ queryKey: ['hsn-codes'] }) },
  })

  // Auto-fill split rates when GST rate selected
  const handleGstRateChange = (val) => {
    if (val != null) {
      const half = val / 2
      form.setFieldsValue({ cgst_rate: half, sgst_rate: half, igst_rate: val })
    }
  }

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/masters/hsn-codes/new') }
      else navigate('/masters/hsn-codes')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="HSN / SAC Code"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'HSN Codes', path: '/masters/hsn-codes' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/hsn-codes')}
    >
      <Form form={form} layout="vertical" initialValues={{ hsn_type: 'HSN', cess_rate: 0 }}>
        <Divider orientation="left">Code Details</Divider>
        <Row gutter={16}>
          <Col span={5}>
            <Form.Item name="hsn_type" label="Type" rules={[{ required: true }]}>
              <Select options={HSN_TYPES} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="code" label="HSN / SAC Code" rules={[{ required: true }]}>
              <Input placeholder="e.g., 70091000" maxLength={20} />
            </Form.Item>
          </Col>
          <Col span={13}>
            <Form.Item name="description" label="Description" rules={[{ required: true }]}>
              <Input placeholder="e.g., Mirrors of glass, whether or not framed" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}><Form.Item name="chapter_heading" label="Chapter Heading"><Input placeholder="e.g., Chapter 70 - Glass and Glassware" /></Form.Item></Col>
          <Col span={12}><Form.Item name="section" label="Section"><Input placeholder="e.g., Section XIII" /></Form.Item></Col>
        </Row>

        <Divider orientation="left">
          GST Rates
          <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8, color: '#888' }}>
            Select total GST rate to auto-fill CGST/SGST/IGST
          </span>
        </Divider>

        <Row gutter={16}>
          <Col span={5}>
            <Form.Item name="gst_rate" label="Total GST Rate %">
              <Select
                options={GST_RATES.map(r => ({ value: r, label: `${r}%` }))}
                placeholder="Select"
                onChange={handleGstRateChange}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="cgst_rate" label="CGST %"><InputNumber min={0} max={50} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="sgst_rate" label="SGST %"><InputNumber min={0} max={50} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="igst_rate" label="IGST %"><InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={4}><Form.Item name="cess_rate" label="CESS %"><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Any additional notes..." />
        </Form.Item>
      </Form>
    </MasterForm>
  )
}

export default HsnForm
