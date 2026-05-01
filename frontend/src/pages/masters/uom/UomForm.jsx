import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Alert, App } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MasterForm from '../../../components/common/MasterForm'
import { uomApi, uomCategoryApi } from '../../../api'
import { UOM_TYPES } from '../../../utils/constants'

// ─── UoM Category Form ───────────────────────────────────────────────────────
export const UomCategoryForm = () => {
  const { message } = App.useApp()
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['uom-categories', id],
    queryFn:  () => uomCategoryApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })
  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? uomCategoryApi.update(id, data) : uomCategoryApi.create(data),
    onSuccess: () => { message.success('Saved'); queryClient.invalidateQueries({ queryKey: ['uom-categories'] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/settings/uom-categories/new') }
      else navigate('/settings/uom-categories')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="UoM Category"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Settings' }, { label: 'UoM Categories', path: '/settings/uom-categories' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/settings/uom-categories')}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}><Form.Item name="name" label="Category Name" rules={[{ required: true }]}><Input placeholder="e.g., Weight, Volume, Length" /></Form.Item></Col>
          <Col span={12}><Form.Item name="note" label="Note"><Input placeholder="Optional description" /></Form.Item></Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

// ─── UoM Form ────────────────────────────────────────────────────────────────
const UomForm = () => {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const uomType     = Form.useWatch('uom_type', form)

  const { data: record, isLoading } = useQuery({
    queryKey: ['uoms', id],
    queryFn:  () => uomApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['uom-categories-dropdown'],
    queryFn:  () => uomCategoryApi.dropdown().then(r => r.data),
  })

  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? uomApi.update(id, data) : uomApi.create(data),
    onSuccess: () => { message.success('Saved'); queryClient.invalidateQueries({ queryKey: ['uoms'] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/masters/uoms/new') }
      else navigate('/masters/uoms')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Unit of Measure"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'UoMs', path: '/masters/uoms' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/uoms')}
    >
      <Form form={form} layout="vertical" initialValues={{ uom_type: 'reference', ratio: 1.0, rounding: 0.01 }}>
        <Divider orientation="left">Unit Details</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="category_id" label="Category" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select category"
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}><Form.Item name="name" label="Unit Name" rules={[{ required: true }]}><Input placeholder="e.g., Kilogram" /></Form.Item></Col>
          <Col span={8}><Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}><Input placeholder="e.g., kg" maxLength={10} /></Form.Item></Col>
        </Row>

        <Divider orientation="left">Conversion</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="uom_type" label="Type" rules={[{ required: true }]}>
              <Select options={UOM_TYPES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="ratio"
              label="Ratio to Reference"
              tooltip="How many of this unit equals 1 reference unit. e.g., Gram → KG = 0.001"
            >
              <InputNumber min={0.000001} step={0.001} precision={6} style={{ width: '100%' }} disabled={uomType === 'reference'} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="rounding" label="Rounding Precision" tooltip="e.g., 0.01 = 2 decimal places">
              <InputNumber min={0.000001} step={0.01} precision={6} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {uomType === 'reference' && (
          <Alert message="This is the reference unit. Ratio is fixed at 1.0." type="info" showIcon />
        )}
      </Form>
    </MasterForm>
  )
}

export default UomForm
