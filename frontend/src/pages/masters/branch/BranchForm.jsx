import React, { useEffect } from 'react'
import { Form, Input, Select, Row, Col, Divider, Switch, Space } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import MasterForm from '../../../components/common/MasterForm'
import { branchApi, companyApi } from '../../../api'
import { INDIAN_STATES } from '../../../utils/constants'

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const BranchForm = () => {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['branches', id],
    queryFn:  () => branchApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-dropdown'],
    queryFn:  () => companyApi.dropdown().then(r => r.data),
  })

  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? branchApi.update(id, data) : branchApi.create(data),
    onSuccess: () => {
      message.success(`Branch ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.code)  values.code  = values.code.toUpperCase()
      if (values.gstin) values.gstin = values.gstin.toUpperCase()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/settings/branches/new') }
      else navigate('/settings/branches')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Branch"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Settings' }, { label: 'Branches', path: '/settings/branches' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/settings/branches')}
    >
      <Form form={form} layout="vertical" initialValues={{ is_head_office: false, is_manufacturing: false, is_warehouse: true }}>

        <Divider orientation="left">Branch Details</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="company_id" label="Company" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select company"
                options={companies.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="code" label="Branch Code" rules={[{ required: true }]}>
              <Input placeholder="e.g., MUM01" maxLength={20} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={11}>
            <Form.Item name="name" label="Branch Name" rules={[{ required: true }]}>
              <Input placeholder="e.g., Mumbai Head Office" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="gstin" label="Branch GSTIN" rules={[{ pattern: GSTIN_REGEX, message: 'Invalid GSTIN' }]}>
              <Input placeholder="27AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="phone" label="Phone"><Input placeholder="+91 22 XXXX XXXX" /></Form.Item>
          </Col>
          <Col span={11}>
            <Form.Item name="email" label="Email"><Input placeholder="branch@company.com" type="email" /></Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Address</Divider>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="address_line1" label="Address Line 1"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="address_line2" label="Address Line 2"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
          <Col span={8}>
            <Form.Item name="state" label="State">
              <Select showSearch options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          </Col>
          <Col span={5}><Form.Item name="pincode" label="Pincode"><Input maxLength={6} /></Form.Item></Col>
        </Row>

        <Divider orientation="left">Branch Configuration</Divider>
        <Row gutter={32}>
          <Col><Form.Item name="is_head_office"   label="Head Office"    valuePropName="checked"><Switch /></Form.Item></Col>
          <Col><Form.Item name="is_manufacturing" label="Manufacturing"  valuePropName="checked"><Switch /></Form.Item></Col>
          <Col><Form.Item name="is_warehouse"     label="Warehouse"      valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>

      </Form>
    </MasterForm>
  )
}

export default BranchForm
