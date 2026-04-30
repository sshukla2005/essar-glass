// ─── EmployeeList.jsx ────────────────────────────────────────────────────────
import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { employeeApi } from '../../../api'

const EmployeeList = () => (
  <MasterList
    title="Employees"
    queryKey="employees"
    api={employeeApi}
    columns={[
      { title: 'Name',          dataIndex: 'name',          key: 'name',          width: 200 },
      { title: 'Employee Code', dataIndex: 'employee_code', key: 'employee_code', width: 130, render: v => v ? <Tag>{v}</Tag> : '—' },
      { title: 'Designation',   dataIndex: 'designation',   key: 'designation',   width: 180 },
      { title: 'Department',    dataIndex: 'department',    key: 'department',    width: 150 },
      { title: 'Work Phone',    dataIndex: 'work_phone',    key: 'work_phone',    width: 140 },
      { title: 'Work Email',    dataIndex: 'work_email',    key: 'work_email',    width: 220 },
    ]}
    createPath="/masters/employees/new"
    editPath={(r) => `/masters/employees/${r.id}/edit`}
    searchPlaceholder="Search by name, code, department..."
  />
)

export default EmployeeList
