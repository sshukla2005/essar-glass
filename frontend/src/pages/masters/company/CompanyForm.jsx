import React, { useEffect } from 'react'
import { Form, Input, Select, Row, Col, Divider, InputNumber, App } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MasterForm from '../../../components/common/MasterForm'
import { companyApi, currencyApi } from '../../../api'
import { INDIAN_STATES, FISCAL_MONTHS } from '../../../utils/constants'

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

const CompanyForm = () => {
  const { message } = App.useApp()
  const { id }       = useParams()
  const isEdit       = Boolean(id)
  const [form]       = Form.useForm()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  // ── Fetch existing record ─────────────────────────────────────────────────
  const { data: record, isLoading } = useQuery({
    queryKey: ['companies', id],
    queryFn:  () => companyApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  // ── Currencies dropdown ───────────────────────────────────────────────────
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies-dropdown'],
    queryFn:  () => currencyApi.dropdown().then(r => r.data),
  })

  useEffect(() => {
    if (record) form.setFieldsValue(record)
  }, [record])

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEdit ? companyApi.update(id, data) : companyApi.create(data),
    onSuccess: (res) => {
      message.success(`Company ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      return res
    },
    onError: () => {},
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      // Normalize
      if (values.code)  values.code  = values.code.toUpperCase()
      if (values.gstin) values.gstin = values.gstin.toUpperCase()
      if (values.pan)   values.pan   = values.pan.toUpperCase()
      const res = await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        navigate('/masters/companies/new')
      } else {
        navigate('/masters/companies')
      }
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Company"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'Companies', path: '/masters/companies' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/companies')}
    >
      <Form form={form} layout="vertical" initialValues={{ country: 'India', fiscal_year_start: 4, fiscal_year_end: 3 }}>

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <Divider orientation="left">Company Identity</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code is required' }]}>
              <Input placeholder="e.g., GLSS01" style={{ textTransform: 'uppercase' }} maxLength={20} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
              <Input placeholder="Trading name" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="legal_name" label="Legal / Registered Name">
              <Input placeholder="As per MCA registration" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Indian Statutory ──────────────────────────────────────────── */}
        <Divider orientation="left">Statutory Details</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="gstin"
              label="GSTIN"
              rules={[{ pattern: GSTIN_REGEX, message: 'Invalid GSTIN format' }]}
            >
              <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item
              name="pan"
              label="PAN"
              rules={[{ pattern: PAN_REGEX, message: 'Invalid PAN format' }]}
            >
              <Input placeholder="AAAPL1234C" maxLength={10} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item name="cin" label="CIN">
              <Input placeholder="L17110MH2000PLC128859" maxLength={21} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="tan" label="TAN">
              <Input placeholder="PUNE12345A" maxLength={10} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Address ───────────────────────────────────────────────────── */}
        <Divider orientation="left">Registered Address</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="address_line1" label="Address Line 1">
              <Input placeholder="Building, Street" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="address_line2" label="Address Line 2">
              <Input placeholder="Area, Landmark" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="city" label="City">
              <Input placeholder="Mumbai" />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item name="state" label="State">
              <Select
                showSearch
                placeholder="Select state"
                options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="pincode" label="Pincode">
              <Input placeholder="400001" maxLength={6} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="country" label="Country">
              <Input defaultValue="India" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Contact ───────────────────────────────────────────────────── */}
        <Divider orientation="left">Contact</Divider>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="phone"   label="Phone">  <Input placeholder="+91 22 XXXX XXXX" /></Form.Item></Col>
          <Col span={6}><Form.Item name="mobile"  label="Mobile"> <Input placeholder="+91 9XXXXXXXXX" /></Form.Item></Col>
          <Col span={7}><Form.Item name="email"   label="Email">  <Input placeholder="info@company.com" type="email" /></Form.Item></Col>
          <Col span={5}><Form.Item name="website" label="Website"><Input placeholder="https://..." /></Form.Item></Col>
        </Row>

        {/* ── Financial Config ──────────────────────────────────────────── */}
        <Divider orientation="left">Financial Configuration</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="currency_id" label="Base Currency">
              <Select
                showSearch
                placeholder="Select currency"
                options={currencies.map(c => ({ value: c.id, label: `${c.code} — ${c.name} (${c.symbol})` }))}
                filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="fiscal_year_start" label="Fiscal Year Start">
              <Select options={FISCAL_MONTHS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="fiscal_year_end" label="Fiscal Year End">
              <Select options={FISCAL_MONTHS} />
            </Form.Item>
          </Col>
        </Row>

      </Form>
    </MasterForm>
  )
}

export default CompanyForm
