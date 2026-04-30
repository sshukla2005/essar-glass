import React, { useState } from 'react'
import {
  Table, Button, Input, Space, Tag, Tooltip, Popconfirm,
  Select, Card, Typography, Row, Col, Badge, Dropdown, message
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, CopyOutlined,
  StopOutlined, CheckCircleOutlined, MoreOutlined, ReloadOutlined,
  FilterOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_PAGE_SIZE } from '../../utils/constants'

const { Search } = Input
const { Title, Text } = Typography

/**
 * MasterList — reusable list view for all master modules.
 * Props:
 *   title         — Page title
 *   queryKey      — TanStack Query cache key
 *   api           — { list, archive, clone } functions
 *   columns       — Ant Design table columns (without Actions column)
 *   createPath    — Route to create form
 *   editPath      — (record) => route string
 *   searchPlaceholder
 *   extraFilters  — Optional JSX for additional filter controls
 */
const MasterList = ({
  title,
  queryKey,
  api,
  columns,
  createPath,
  editPath,
  searchPlaceholder = 'Search...',
  nameField = 'name',
  extraFilters,
}) => {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(DEFAULT_PAGE_SIZE)
  const [search,    setSearch]    = useState('')
  const [isActive,  setIsActive]  = useState(undefined) // undefined = show all

  // ── Fetch data ────────────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [queryKey, page, pageSize, search, isActive, extraFilters],
    queryFn:  () => api.list({ page, page_size: pageSize, search, is_active: isActive, ...extraFilters }).then(r => r.data),
    keepPreviousData: true,
  })

  // ── Archive ───────────────────────────────────────────────────────────────
  const archiveMutation = useMutation({
    mutationFn: ({ id, active }) => api.archive(id, active),
    onSuccess: (_, { active }) => {
      message.success(active ? 'Record activated' : 'Record archived')
      queryClient.invalidateQueries({ queryKey: [queryKey] })
    },
  })

  // ── Clone ─────────────────────────────────────────────────────────────────
  const cloneMutation = useMutation({
    mutationFn: (id) => api.clone(id),
    onSuccess: (res) => {
      message.success('Record cloned successfully')
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      navigate(editPath(res.data))
    },
  })

  // ── Action column ─────────────────────────────────────────────────────────
  const actionColumn = {
    title: 'Actions',
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: (_, record) => {
      const menuItems = [
        {
          key: 'clone',
          icon: <CopyOutlined />,
          label: 'Duplicate',
          onClick: () => cloneMutation.mutate(record.id),
        },
        {
          key: 'archive',
          icon: record.is_active ? <StopOutlined /> : <CheckCircleOutlined />,
          label: record.is_active ? 'Archive' : 'Unarchive',
          onClick: () => archiveMutation.mutate({ id: record.id, active: !record.is_active }),
          danger: record.is_active,
        },
      ]
      return (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(editPath(record))}
            />
          </Tooltip>
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      )
    },
  }

  // ── Status column (prepend to user columns) ───────────────────────────────
  const statusColumn = {
    title: 'Status',
    key: 'status',
    width: 90,
    render: (_, record) =>
      record.is_active
        ? <Badge status="success" text="Active" />
        : <Badge status="default" text="Archived" />,
  }

  // ── Make name column clickable ──────────────────────────────────────────────
  const enhancedColumns = columns.map((col, idx) => {
    if (col.dataIndex === nameField || (idx === 0 && !nameField)) {
      return {
        ...col,
        render: (val, record) => (
          <a
            onClick={() => navigate(editPath(record))}
            style={{ color: '#1677ff', cursor: 'pointer', fontWeight: 500 }}
          >
            {val}
          </a>
        ),
      }
    }
    return col
  })

  const allColumns = [...enhancedColumns, statusColumn, actionColumn]

  return (
    <div style={{ padding: '24px' }}>
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>{title}</Title>
          <Text type="secondary">{data?.total ?? 0} records</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(createPath)}>
            New {title}
          </Button>
        </Col>
      </Row>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Search
              placeholder={searchPlaceholder}
              allowClear
              prefix={<SearchOutlined />}
              onSearch={(val) => { setSearch(val); setPage(1) }}
              onChange={(e) => !e.target.value && setSearch('')}
              style={{ maxWidth: 340 }}
            />
          </Col>
          <Col>
            <Select
              placeholder={<><FilterOutlined /> Status</>}
              allowClear
              style={{ width: 140 }}
              value={isActive}
              onChange={(val) => { setIsActive(val); setPage(1) }}
              options={[
                { value: true,  label: 'Active' },
                { value: false, label: 'Archived' },
              ]}
            />
          </Col>
          {extraFilters}
          <Col>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined spin={isFetching} />}
                onClick={() => queryClient.invalidateQueries({ queryKey: [queryKey] })}
              />
            </Tooltip>
          </Col>
        </Row>
      </Card>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          dataSource={data?.items || []}
          columns={allColumns}
          loading={isLoading || isFetching}
          scroll={{ x: 'max-content' }}
          rowClassName={(r) => !r.is_active ? 'row-archived' : ''}
          pagination={{
            current:   page,
            pageSize:  pageSize,
            total:     data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            onChange:  (p, ps) => { setPage(p); setPageSize(ps) },
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </Card>

      <style>{`.row-archived td { opacity: 0.5; }`}</style>
    </div>
  )
}

export default MasterList
