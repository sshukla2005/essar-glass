// ─── VendorForm.jsx ──────────────────────────────────────────────────────────
import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Radio, Tabs, App } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MasterForm from '../../../components/common/MasterForm'
import { vendorApi, currencyApi } from '../../../api'
import { INDIAN_STATES } from '../../../utils/constants'
import CompanySelector from '../../../components/common/CompanySelector'

const { TextArea } = Input

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const GST_TREATMENTS = [
  { value: 'registered_regular',     label: 'Registered - Regular' },
  { value: 'registered_composition', label: 'Registered - Composition' },
  { value: 'unregistered',           label: 'Unregistered' },
  { value: 'consumer',              label: 'Consumer' },
  { value: 'overseas',              label: 'Overseas' },
]

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '15_days',   label: '15 Days' },
  { value: '30_days',   label: '30 Days' },
  { value: '45_days',   label: '45 Days' },
  { value: '60_days',   label: '60 Days' },
  { value: '90_days',   label: '90 Days' },
]

const MSME_TYPES = [
  { value: 'none',   label: 'None' },
  { value: 'micro',  label: 'Micro' },
  { value: 'small',  label: 'Small' },
  { value: 'medium', label: 'Medium' },
]

const VendorForm = () => {
  const { message } = App.useApp()
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const vendorType   = Form.useWatch('vendor_type', form)
  const gstTreatment = Form.useWatch('gst_treatment', form)
  const showGstin    = gstTreatment === 'registered_regular' || gstTreatment === 'registered_composition'

  const { data: record, isLoading } = useQuery({
    queryKey: ['vendors', id],
    queryFn:  () => vendorApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies-dropdown'],
    queryFn:  () => currencyApi.dropdown().then(r => r.data),
  })

  useEffect(() => { if (record) form.setFieldsValue(record) }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? vendorApi.update(id, data) : vendorApi.create(data),
    onSuccess: () => {
      message.success(`Vendor ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.gstin) values.gstin = values.gstin.toUpperCase()
      if (values.pan)   values.pan   = values.pan.toUpperCase()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/masters/vendors/new') }
      else navigate('/masters/vendors')
    } catch (_) {}
  }

  const tabItems = [
    {
      key: 'general',
      label: 'General Info',
      children: (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="vendor_type" label="Vendor Type">
                <Radio.Group>
                  <Radio.Button value="individual">Individual</Radio.Button>
                  <Radio.Button value="company">Company</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="name" label="Vendor Name" rules={[{ required: true, message: 'Vendor name is required' }]}>
                <Input placeholder="Enter vendor name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor_code" label="Vendor Code">
                <Input placeholder="Auto-generated or manual" />
              </Form.Item>
            </Col>
          </Row>

          {vendorType === 'individual' && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="company_name" label="Company Name">
                  <Input placeholder="Associated company (if any)" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left">Address & Contact</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="address_line1" label="Address Line 1"><Input placeholder="Street address" /></Form.Item>
              <Form.Item name="address_line2" label="Address Line 2"><Input placeholder="Apartment, suite, etc." /></Form.Item>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="city" label="City"><Input placeholder="City" /></Form.Item></Col>
                <Col span={10}>
                  <Form.Item name="state" label="State">
                    <Select showSearch placeholder="Select state"
                      options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                      filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}><Form.Item name="pincode" label="Pincode"><Input maxLength={6} placeholder="000000" /></Form.Item></Col>
              </Row>
              <Form.Item name="country" label="Country"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="phone" label="Phone"><Input placeholder="+91 XXXX XXXXXX" /></Form.Item></Col>
                <Col span={12}><Form.Item name="mobile" label="Mobile"><Input placeholder="+91 XXXXX XXXXX" /></Form.Item></Col>
              </Row>
              <Form.Item name="email" label="Email"><Input placeholder="vendor@example.com" type="email" /></Form.Item>
              <Form.Item name="website" label="Website"><Input placeholder="https://www.example.com" /></Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">GST Information</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="gst_treatment" label="GST Treatment">
                <Select placeholder="Select treatment" options={GST_TREATMENTS} />
              </Form.Item>
            </Col>
            {showGstin && (
              <Col span={8}>
                <Form.Item name="gstin" label="GSTIN" rules={[{ pattern: GSTIN_REGEX, message: 'Invalid GSTIN format' }]}>
                  <Input placeholder="27AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
            )}
            <Col span={8}>
              <Form.Item name="pan" label="PAN">
                <Input placeholder="AAAAA0000A" maxLength={10} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="msme_type" label="MSME Type">
                <Select placeholder="Select MSME type" options={MSME_TYPES} />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: 'purchase',
      label: 'Purchase',
      children: (
        <>
          <Divider orientation="left">Purchase Information</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="payment_terms" label="Payment Terms">
                <Select placeholder="Select terms" options={PAYMENT_TERMS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="credit_limit" label="Credit Limit (₹)">
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/₹\s?|(,*)/g, '')}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lead_time" label="Lead Time (days)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="currency_id" label="Currency">
                <Select showSearch placeholder="Select currency"
                  options={currencies.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: 'bank',
      label: 'Bank Details',
      children: (
        <>
          <Divider orientation="left">Bank Account Information</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="bank_account_name" label="Bank Account Name"><Input placeholder="Account holder name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="bank_account_number" label="Bank Account Number"><Input placeholder="Account number" /></Form.Item></Col>
            <Col span={8}><Form.Item name="ifsc_code" label="IFSC Code"><Input placeholder="SBIN0001234" maxLength={11} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="bank_name" label="Bank Name"><Input placeholder="Bank name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="bank_branch" label="Branch Name"><Input placeholder="Branch name" /></Form.Item></Col>
          </Row>
        </>
      ),
    },
    {
      key: 'notes',
      label: 'Internal Notes',
      children: (
        <Form.Item name="internal_notes" label="Notes">
          <TextArea rows={6} placeholder="Add any internal notes about this vendor..." />
        </Form.Item>
      ),
    },
  ]

  return (
    <MasterForm
      title="Vendor"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'Vendors', path: '/masters/vendors' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/vendors')}
    >
      <Form form={form} layout="vertical" initialValues={{
        vendor_type: 'company', country: 'India', gst_treatment: 'unregistered', msme_type: 'none',
      }}>
        <CompanySelector form={form} />
        <Tabs items={tabItems} size="large" />
      </Form>
    </MasterForm>
  )
}

export default VendorForm
