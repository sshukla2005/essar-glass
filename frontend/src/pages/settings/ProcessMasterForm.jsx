import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, App } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MasterForm from '../../components/common/MasterForm'
import { processMasterApi } from '../../api'

const { TextArea } = Input

const PROCESS_TYPES = [
  { value: 'cutting',   label: 'Cutting' },
  { value: 'polishing', label: 'Polishing' },
  { value: 'beveling',  label: 'Beveling' },
  { value: 'hole',      label: 'Hole Drilling' },
  { value: 'cutout',    label: 'Cutout' },
  { value: 'farma',     label: 'Farma / Shape Cut' },
  { value: 'fabrication', label: 'Fabrication' },
  { value: 'toughening',  label: 'Toughening' },
  { value: 'handling',    label: 'Handling' },
  { value: 'delivery',    label: 'Delivery' },
  { value: 'other',       label: 'Other' },
]

const CHARGE_TYPES = [
  { value: 'per_sqft', label: 'Per Sqft' },
  { value: 'per_rft', label: 'Per Running Ft' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'per_sqmt', label: 'Per Sqmt' },
  { value: 'fixed', label: 'Fixed Amount' },
]

const ProcessMasterForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['process_masters', id], queryFn: () => processMasterApi.get(id).then(r => r.data), enabled: isEdit,
  })

  useEffect(() => {
    if (record) form.setFieldsValue(record)
  }, [record, form])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? processMasterApi.update(id, data) : processMasterApi.create(data),
    onSuccess: (res) => {
      message.success(`Process ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['process_masters'] })
      if (!isEdit && res?.data?.id) navigate(`/settings/process-masters/${res.data.id}/edit`)
    },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/settings/process-masters/new') }
    } catch (err) {}
  }

  return (
    <MasterForm title="Process Master" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Settings' }, { label: 'Process Masters', path: '/settings/process-masters' }, { label: isEdit ? record?.name || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/settings/process-masters')}>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="name" label="Process Name" rules={[{ required: true }]}>
              <Input placeholder="e.g., Cutting, Polishing (4 sides)" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="process_type" label="Process Type" rules={[{ required: true }]}>
              <Select options={PROCESS_TYPES} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="charge_type" label="Charge Type" rules={[{ required: true }]}>
              <Select options={CHARGE_TYPES} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="rate" label="Default Rate (₹)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} addonBefore="₹" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="unit" label="Unit">
              <Input placeholder="sqft / rft / hole / job" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="notes" label="Notes">
              <TextArea rows={3} placeholder="Additional notes about this process..." />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default ProcessMasterForm
