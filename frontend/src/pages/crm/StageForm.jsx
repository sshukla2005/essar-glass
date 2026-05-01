import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Switch, Row, Col, App } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MasterForm from '../../components/common/MasterForm'
import { crmStageApi } from '../../api'

const StageForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['crm-stages', id], queryFn: () => crmStageApi.get(id).then(r => r.data), enabled: isEdit,
  })

  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? crmStageApi.update(id, data) : crmStageApi.create(data),
    onSuccess: () => { message.success(`Stage ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['crm-stages'] }) },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/crm/stages/new') } else navigate('/crm/stages')
    } catch (_) {}
  }

  return (
    <MasterForm title="CRM Stage" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'CRM' }, { label: 'Stages', path: '/crm/stages' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/crm/stages')}>
      <Form form={form} layout="vertical" initialValues={{ sequence: 10, probability: 10, is_won: false, is_lost: false, fold: false }}
        onValuesChange={(changed) => {
          if (changed.is_won) form.setFieldValue('probability', 100)
          if (changed.is_lost) form.setFieldValue('probability', 0)
        }}>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="name" label="Stage Name" rules={[{ required: true }]}><Input placeholder="e.g., Proposition" /></Form.Item></Col>
          <Col span={8}><Form.Item name="sequence" label="Sequence" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="probability" label="Probability (%)"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="is_won" label="Won Stage" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={8}><Form.Item name="is_lost" label="Lost Stage" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={8}><Form.Item name="fold" label="Fold in Kanban" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default StageForm
