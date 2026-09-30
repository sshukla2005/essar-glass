import React, { useRef, useState } from 'react'
import { Card, Table, Input, Button, Space, Typography, Popconfirm, App, Image, Alert, Empty } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useArtworkMaster, newArtworkEntry } from '../../../hooks/useArtworkMaster'
import { useAuth } from '../../../hooks/useAuth'

const { Title, Text } = Typography
const MAX_BYTES = 2 * 1024 * 1024

// Inline name editor: saves on Enter or when the field loses focus
const NameCell = ({ row, onSave }) => {
  const [value, setValue] = useState(row.name || '')
  const save = () => {
    const name = value.trim()
    if (!name) { setValue(row.name || ''); return }
    if (name !== row.name) onSave(row.id, name)
  }
  return <Input size="small" value={value} onChange={e => setValue(e.target.value)} onPressEnter={save} onBlur={save} />
}

const ArtworkMaster = () => {
  const { message } = App.useApp()
  const { user } = useAuth()
  const canDeleteAll = user?.role === 'superadmin' || user?.role === 'admin'
  const { artworks, isLoading, isError, refetch, isSaving, add, rename, remove, removeAll } = useArtworkMaster()
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)   // { name, data }
  const fileInput = useRef(null)

  const pickFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { message.error('Choose an image file (PNG, JPG…)'); return }
    if (f.size > MAX_BYTES) { message.error('Image is larger than 2 MB. Please use a smaller file.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      setFile({ name: f.name, data: ev.target.result })
      if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsDataURL(f)
  }

  const run = async (fn, ok) => {
    try { await fn(); if (ok) message.success(ok) } catch { message.error('Could not save Artwork Master. Please try again.') }
  }

  const handleAdd = () => run(async () => {
    await add(newArtworkEntry(name.trim(), file.name, file.data))
    setName(''); setFile(null)
  }, 'Artwork added')

  const columns = [
    {
      title: 'Preview', dataIndex: 'file_data', width: 110,
      render: v => v ? <Image src={v} width={80} height={60} style={{ objectFit: 'contain', background: '#f8fafc', borderRadius: 4 }} /> : '—',
    },
    { title: 'Name', dataIndex: 'name', render: (_, r) => <NameCell key={`${r.id}-${r.name}`} row={r} onSave={(id, n) => run(() => rename(id, n), 'Renamed')} /> },
    { title: 'File', dataIndex: 'file_name', width: 220, render: v => <Text type="secondary">{v || '—'}</Text> },
    { title: 'Added', dataIndex: 'created_at', width: 120 },
    {
      title: '', key: 'del', width: 70, align: 'center',
      render: (_, r) => (
        <Popconfirm title={`Delete "${r.name}"?`} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => run(() => remove(r.id), 'Artwork deleted')}>
          <Button size="small" danger icon={<DeleteOutlined />} aria-label="Delete artwork" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>Artwork Master</Title>
          <Text type="secondary">Artwork you can pick on Workshop Order lines. Deleting one here does not remove it from orders that already use it.</Text>
        </div>
        {canDeleteAll && artworks.length > 0 && (
          <Popconfirm
            title={`Delete all ${artworks.length} artworks?`}
            description="This clears the Artwork Master for this company. Orders that already use an artwork keep their copy."
            okText="Delete all" okButtonProps={{ danger: true }}
            onConfirm={() => run(removeAll, 'All artworks deleted')}
          >
            <Button danger icon={<DeleteOutlined />} loading={isSaving}>Delete all</Button>
          </Popconfirm>
        )}
      </Space>

      <Card size="small" title="Add artwork" style={{ marginTop: 16 }}>
        <Space wrap>
          <Input style={{ width: 260 }} placeholder="Artwork name" value={name} onChange={e => setName(e.target.value)} />
          <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
          <Button icon={<UploadOutlined />} onClick={() => fileInput.current?.click()}>
            {file ? file.name : 'Choose image'}
          </Button>
          {file && <Image src={file.data} width={60} height={45} style={{ objectFit: 'contain' }} />}
          <Button type="primary" icon={<PlusOutlined />} disabled={!file || !name.trim()} loading={isSaving} onClick={handleAdd}>
            Add
          </Button>
        </Space>
        <div><Text type="secondary" style={{ fontSize: 12 }}>PNG or JPG, up to 2 MB.</Text></div>
      </Card>

      <Card size="small" style={{ marginTop: 16 }}>
        {isError && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Could not load the Artwork Master."
            action={<Button size="small" onClick={() => refetch()}>Retry</Button>} />
        )}
        <Table rowKey="id" size="small" loading={isLoading} columns={columns} dataSource={artworks} pagination={false}
          locale={{ emptyText: <Empty description="No artwork yet. Add one above." /> }} />
      </Card>
    </div>
  )
}

export default ArtworkMaster
