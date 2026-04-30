// ─── EmployeeForm.jsx ────────────────────────────────────────────────────────
import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import dayjs from 'dayjs'
import MasterForm from '../../../components/common/MasterForm'
import { employeeApi } from '../../../api'
import { INDIAN_STATES } from '../../../utils/constants'

const { TextArea } = Input

const DEPARTMENTS = [
  { value: 'production',     label: 'Production' },
  { value: 'quality',        label: 'Quality Control' },
  { value: 'sales',          label: 'Sales' },
  { value: 'purchase',       label: 'Purchase' },
  { value: 'accounts',       label: 'Accounts & Finance' },
  { value: 'hr',             label: 'Human Resources' },
  { value: 'warehouse',      label: 'Warehouse' },
  { value: 'logistics',      label: 'Logistics' },
  { value: 'maintenance',    label: 'Maintenance' },
  { value: 'administration', label: 'Administration' },
  { value: 'it',             label: 'IT' },
]

const EMPLOYEE_TYPES = [
  { value: 'regular',   label: 'Regular' },
  { value: 'contract',  label: 'Contract' },
  { value: 'probation', label: 'Probation' },
]

const EmployeeForm = () => {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['employees', id],
    queryFn:  () => employeeApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        date_of_birth: record.date_of_birth ? dayjs(record.date_of_birth) : null,
        joining_date:  record.joining_date  ? dayjs(record.joining_date)  : null,
      })
    }
  }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? employeeApi.update(id, data) : employeeApi.create(data),
    onSuccess: () => {
      message.success(`Employee ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      // Convert dayjs dates to ISO strings
      if (values.date_of_birth) values.date_of_birth = values.date_of_birth.format('YYYY-MM-DD')
      if (values.joining_date)  values.joining_date  = values.joining_date.format('YYYY-MM-DD')
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/masters/employees/new') }
      else navigate('/masters/employees')
    } catch (_) {}
  }

  const tabItems = [
    {
      key: 'work',
      label: 'Work Info',
      children: (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="name" label="Employee Name" rules={[{ required: true, message: 'Employee name is required' }]}>
                <Input placeholder="Full name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employee_code" label="Employee Code">
                <Input placeholder="e.g., EMP-001" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="designation" label="Job Position / Designation">
                <Input placeholder="e.g., Production Manager" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="department" label="Department">
                <Select placeholder="Select department" options={DEPARTMENTS} showSearch
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}><Form.Item name="manager" label="Manager"><Input placeholder="Manager name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="branch" label="Branch"><Input placeholder="Branch name" /></Form.Item></Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}><Form.Item name="work_email" label="Work Email"><Input placeholder="employee@essarglass.com" type="email" /></Form.Item></Col>
            <Col span={8}><Form.Item name="work_phone" label="Work Phone"><Input placeholder="+91 XXXX XXXXXX" /></Form.Item></Col>
          </Row>
        </>
      ),
    },
    {
      key: 'personal',
      label: 'Personal Info',
      children: (
        <>
          <Divider orientation="left">Personal Details</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="date_of_birth" label="Date of Birth">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="gender" label="Gender">
                <Select placeholder="Select" options={[
                  { value: 'male',   label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other',  label: 'Other' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="marital_status" label="Marital Status">
                <Select placeholder="Select" options={[
                  { value: 'single',   label: 'Single' },
                  { value: 'married',  label: 'Married' },
                  { value: 'divorced', label: 'Divorced' },
                  { value: 'widowed',  label: 'Widowed' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="personal_mobile" label="Personal Mobile"><Input placeholder="+91 XXXXX XXXXX" /></Form.Item></Col>
            <Col span={8}><Form.Item name="personal_email" label="Personal Email"><Input placeholder="personal@email.com" type="email" /></Form.Item></Col>
          </Row>

          <Divider orientation="left">Identity Documents</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="aadhar_number" label="Aadhar Number"><Input placeholder="XXXX XXXX XXXX" maxLength={14} /></Form.Item></Col>
            <Col span={8}><Form.Item name="pan_number" label="PAN Number"><Input placeholder="AAAAA0000A" maxLength={10} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
          </Row>

          <Divider orientation="left">Address</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="address_line1" label="Address Line 1"><Input placeholder="Street address" /></Form.Item></Col>
            <Col span={12}><Form.Item name="address_line2" label="Address Line 2"><Input placeholder="Apartment, suite, etc." /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="city" label="City"><Input placeholder="City" /></Form.Item></Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Select showSearch placeholder="Select state"
                  options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={5}><Form.Item name="pincode" label="Pincode"><Input maxLength={6} placeholder="000000" /></Form.Item></Col>
          </Row>
        </>
      ),
    },
    {
      key: 'hr',
      label: 'HR & Bank',
      children: (
        <>
          <Divider orientation="left">Employment Details</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="joining_date" label="Joining Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employee_type" label="Employee Type">
                <Select placeholder="Select type" options={EMPLOYEE_TYPES} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notice_period" label="Notice Period (days)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="30" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Bank Details</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="bank_account_number" label="Bank Account Number"><Input placeholder="Account number" /></Form.Item></Col>
            <Col span={8}><Form.Item name="ifsc_code" label="IFSC Code"><Input placeholder="SBIN0001234" maxLength={11} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="bank_name" label="Bank Name"><Input placeholder="Bank name" /></Form.Item></Col>
          </Row>

          <Divider orientation="left">Notes</Divider>
          <Form.Item name="internal_notes" label="Internal Notes">
            <TextArea rows={4} placeholder="Add any internal notes about this employee..." />
          </Form.Item>
        </>
      ),
    },
  ]

  return (
    <MasterForm
      title="Employee"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'Employees', path: '/masters/employees' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/employees')}
    >
      <Form form={form} layout="vertical" initialValues={{ employee_type: 'regular', notice_period: 30 }}>
        <Tabs items={tabItems} size="large" />
      </Form>
    </MasterForm>
  )
}

export default EmployeeForm
