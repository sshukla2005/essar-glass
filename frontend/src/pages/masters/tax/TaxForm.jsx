import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Switch, App } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MasterForm from '../../../components/common/MasterForm'
import { taxApi, taxGroupApi } from '../../../api'
import { TAX_TYPES } from '../../../utils/constants'

// ─── Tax Group Form ───────────────────────────────────────────────────────────
export const TaxGroupForm = () => {
  const { message } = App.useApp()
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['tax-groups', id],
    queryFn:  () => taxGroupApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })
  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? taxGroupApi.update(id, data) : taxGroupApi.create(data),
    onSuccess: () => { message.success('Tax Group saved'); queryClient.invalidateQueries({ queryKey: ['tax-groups'] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/settings/tax-groups/new') }
      else navigate('/settings/tax-groups')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Tax Group"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Settings' }, { label: 'Tax Groups', path: '/settings/tax-groups' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/settings/tax-groups')}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={10}><Form.Item name="name" label="Group Name" rules={[{ required: true }]}><Input placeholder="e.g., GST 18%" /></Form.Item></Col>
          <Col span={6}><Form.Item name="gst_rate" label="Total GST Rate %"><InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="18" /></Form.Item></Col>
          <Col span={8}><Form.Item name="description" label="Description"><Input /></Form.Item></Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

// ─── Tax Form ─────────────────────────────────────────────────────────────────
const TaxForm = () => {
  const { id }        = useParams()
  const isEdit        = Boolean(id)
  const [form]        = Form.useForm()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const isWithholding = Form.useWatch('is_withholding', form)
  const compType      = Form.useWatch('computation_type', form)

  const { data: record, isLoading } = useQuery({
    queryKey: ['taxes', id],
    queryFn:  () => taxApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  const { data: taxGroups = [] } = useQuery({
    queryKey: ['tax-groups-dropdown'],
    queryFn:  () => taxGroupApi.dropdown().then(r => r.data),
  })

  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? taxApi.update(id, data) : taxApi.create(data),
    onSuccess: () => { message.success('Tax saved'); queryClient.invalidateQueries({ queryKey: ['taxes'] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/masters/taxes/new') }
      else navigate('/masters/taxes')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Tax"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'Taxes', path: '/masters/taxes' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/taxes')}
    >
      <Form form={form} layout="vertical" initialValues={{ computation_type: 'percentage', rate: 0, is_withholding: false }}>
        <Divider orientation="left">Tax Details</Divider>
        <Row gutter={16}>
          <Col span={10}><Form.Item name="name" label="Tax Name" rules={[{ required: true }]}><Input placeholder="e.g., CGST @ 9%" /></Form.Item></Col>
          <Col span={6}>
            <Form.Item name="tax_type" label="Tax Type" rules={[{ required: true }]}>
              <Select options={TAX_TYPES.map(t => ({ value: t, label: t }))} placeholder="Select type" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="tax_group_id" label="Tax Group">
              <Select
                showSearch allowClear
                placeholder="Assign to group"
                options={taxGroups.map(g => ({ value: g.id, label: g.name }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="computation_type" label="Computation">
              <Select options={[{ value: 'percentage', label: 'Percentage of amount' }, { value: 'fixed', label: 'Fixed amount' }]} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="rate" label={compType === 'fixed' ? 'Fixed Amount (₹)' : 'Rate %'} rules={[{ required: true }]}>
              <InputNumber min={0} max={compType === 'fixed' ? undefined : 100} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={10}><Form.Item name="description" label="Description"><Input /></Form.Item></Col>
        </Row>

        <Divider orientation="left">TDS / TCS Configuration</Divider>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="is_withholding" label="Is Withholding Tax (TDS/TCS)" valuePropName="checked"><Switch /></Form.Item></Col>
          {isWithholding && (
            <Col span={8}>
              <Form.Item name="threshold_amount" label="Threshold Amount (₹)" tooltip="TDS applies only above this amount">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </MasterForm>
  )
}

export default TaxForm
