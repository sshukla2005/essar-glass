import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Switch, Row, Col, Divider, DatePicker } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import dayjs from 'dayjs'
import MasterForm from '../../../components/common/MasterForm'
import { currencyApi } from '../../../api'

const CurrencyForm = () => {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['currencies', id],
    queryFn:  () => currencyApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        rate_date: record.rate_date ? dayjs(record.rate_date) : null,
      })
    }
  }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? currencyApi.update(id, data) : currencyApi.create(data),
    onSuccess: () => {
      message.success('Currency saved')
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
    },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      values.code = values.code?.toUpperCase()
      if (values.rate_date) values.rate_date = values.rate_date.format('YYYY-MM-DD')
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/settings/currencies/new') }
      else navigate('/settings/currencies')
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Currency"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Settings' }, { label: 'Currencies', path: '/settings/currencies' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/settings/currencies')}
    >
      <Form form={form} layout="vertical" initialValues={{ rate: 1.0, decimal_places: 2, is_base: false }}>
        <Divider orientation="left">Currency Details</Divider>
        <Row gutter={16}>
          <Col span={5}>
            <Form.Item name="code" label="ISO Code" rules={[{ required: true }, { max: 3, message: 'Max 3 chars' }]}>
              <Input placeholder="INR" maxLength={3} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="name" label="Currency Name" rules={[{ required: true }]}>
              <Input placeholder="Indian Rupee" />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}>
              <Input placeholder="₹" maxLength={5} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="decimal_places" label="Decimals">
              <InputNumber min={0} max={6} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Exchange Rate</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="rate" label="Rate vs INR" rules={[{ required: true }]}>
              <InputNumber min={0.0001} step={0.01} precision={6} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="rate_date" label="Rate Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="is_base" label="Base Currency (INR)" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default CurrencyForm
