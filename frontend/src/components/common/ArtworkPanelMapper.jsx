import React, { useRef, useState, useEffect } from 'react'
import { Button, Select, Input, Space, Table } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'

const GROUP_COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#ec4899','#f97316'
]

// Props:
// lines      — array of workshop lines (each has key, description, act_w_in, act_h_in, qty)
// value      — saved panels array
// onChange   — callback(panels)
// onImageChange — callback(base64string)

const ArtworkPanelMapper = ({ lines = [], value = [], onChange, onImageChange }) => {
  const canvasRef = useRef(null)
  const [imgSrc, setImgSrc] = useState(null)
  const [imgObj, setImgObj] = useState(null)
  const [panels, setPanels] = useState(value || [])
  const [selectedPanel, setSelectedPanel] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const fileInputRef = useRef(null)

  // sync panels to parent
  useEffect(() => {
    onChange && onChange(panels)
  }, [panels])

  // load image onto canvas
  useEffect(() => {
    if (!imgSrc) return
    const img = new Image()
    img.onload = () => {
      setImgObj(img)
      const canvas = canvasRef.current
      if (!canvas) return
      const maxW = canvas.parentElement?.clientWidth || 500
      const maxH = 460
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      redraw(img, panels, selectedPanel, currentRect, canvas)
    }
    img.src = imgSrc
  }, [imgSrc])

  const redraw = (img, pnls, selPanel, curRect, cvs) => {
    const canvas = cvs || canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    pnls.forEach((p, i) => {
      const color = GROUP_COLORS[i % GROUP_COLORS.length]
      ctx.strokeStyle = color
      ctx.lineWidth = p === selPanel ? 3 : 2
      ctx.strokeRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = color + '30'
      ctx.fillRect(p.x, p.y, p.w, p.h)
      // badge
      ctx.font = 'bold 13px sans-serif'
      const label = String(i + 1)
      const tw = ctx.measureText(label).width
      ctx.fillStyle = color
      ctx.fillRect(p.x + 4, p.y + 4, tw + 10, 22)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, p.x + 9, p.y + 20)
      // dashed selection
      if (p === selPanel) {
        ctx.setLineDash([5, 3])
        ctx.strokeStyle = color
        ctx.strokeRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4)
        ctx.setLineDash([])
      }
    })

    if (curRect) {
      ctx.setLineDash([6, 3])
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.strokeRect(curRect.x, curRect.y, curRect.w, curRect.h)
      ctx.fillStyle = '#6366f120'
      ctx.fillRect(curRect.x, curRect.y, curRect.w, curRect.h)
      ctx.setLineDash([])
    }
  }

  useEffect(() => {
    if (imgObj) redraw(imgObj, panels, selectedPanel, currentRect)
  }, [panels, selectedPanel, currentRect, imgObj])

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    }
  }

  const hitTest = (x, y) => {
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i]
      const x1 = Math.min(p.x, p.x + p.w)
      const x2 = Math.max(p.x, p.x + p.w)
      const y1 = Math.min(p.y, p.y + p.h)
      const y2 = Math.max(p.y, p.y + p.h)
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return panels[i]
    }
    return null
  }

  const handleMouseDown = (e) => {
    const { x, y } = getPos(e)
    const hit = hitTest(x, y)
    if (hit) {
      setSelectedPanel(hit)
      return
    }
    setDrawing(true)
    setStartPos({ x, y })
    setCurrentRect({ x, y, w: 0, h: 0 })
    setSelectedPanel(null)
  }

  const handleMouseMove = (e) => {
    if (!drawing || !startPos) return
    const { x, y } = getPos(e)
    setCurrentRect({ x: startPos.x, y: startPos.y, w: x - startPos.x, h: y - startPos.y })
  }

  const handleMouseUp = () => {
    if (!drawing || !currentRect) return
    setDrawing(false)
    if (Math.abs(currentRect.w) > 10 && Math.abs(currentRect.h) > 10) {
      const newPanel = {
        id: Date.now(),
        x: currentRect.w < 0 ? currentRect.x + currentRect.w : currentRect.x,
        y: currentRect.h < 0 ? currentRect.y + currentRect.h : currentRect.y,
        w: Math.abs(currentRect.w),
        h: Math.abs(currentRect.h),
        lineIndex: lines.length > 0 ? 0 : null,
        note: '',
      }
      const updated = [...panels, newPanel]
      setPanels(updated)
      setSelectedPanel(newPanel)
    }
    setCurrentRect(null)
    setStartPos(null)
  }

  const updateSelectedPanel = (field, val) => {
    if (!selectedPanel) return
    const updated = panels.map(p =>
      p.id === selectedPanel.id ? { ...p, [field]: val } : p
    )
    setPanels(updated)
    setSelectedPanel({ ...selectedPanel, [field]: val })
  }

  const deleteSelectedPanel = () => {
    setPanels(panels.filter(p => p.id !== selectedPanel.id))
    setSelectedPanel(null)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImgSrc(ev.target.result)
      onImageChange && onImageChange(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const lineOptions = lines.map((l, i) => ({
    value: i,
    label: `${i + 1}. ${l.description || 'Line ' + (i + 1)} (${l.act_w_in || '?'}" × ${l.act_h_in || '?'}" × ${l.qty || 1}pcs)`,
  }))

  const selectedIdx = selectedPanel ? panels.findIndex(p => p.id === selectedPanel.id) : -1
  const selectedLine = (selectedPanel && selectedPanel.lineIndex != null)
    ? lines[selectedPanel.lineIndex]
    : null

  return (
    <div>
      {/* Top controls */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Button
          icon={<UploadOutlined />}
          onClick={() => fileInputRef.current?.click()}
          style={{ borderColor: '#0ea5e9', color: '#0ea5e9' }}
        >
          Upload Artwork Image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
        {panels.length > 0 && (
          <Button
            danger
            size="small"
            onClick={() => { setPanels([]); setSelectedPanel(null) }}
          >
            Clear All Panels
          </Button>
        )}
        {!imgSrc && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Upload artwork image to start mapping panels
          </span>
        )}
      </Space>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {imgSrc ? (
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'inline-block',
              cursor: 'crosshair',
            }}>
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
          ) : (
            <div style={{
              border: '1px dashed #d1d5db',
              borderRadius: 8,
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: 13,
            }}>
              Upload an image to start drawing panels
            </div>
          )}
          {imgSrc && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Click and drag to draw a panel. Click an existing panel to select it.
            </p>
          )}
        </div>

        {/* Panel detail sidebar */}
        {selectedPanel && selectedIdx >= 0 && (
          <div style={{
            width: 220,
            padding: 12,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            alignSelf: 'flex-start',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
              Panel {selectedIdx + 1}
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Assign to workshop line
              </div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={selectedPanel.lineIndex ?? null}
                options={lineOptions}
                onChange={(val) => updateSelectedPanel('lineIndex', val)}
                placeholder="Select line"
              />
            </div>
            {selectedLine && (
              <div style={{
                fontSize: 11, color: '#64748b', marginBottom: 8,
                padding: '4px 6px', background: '#e0e7ff', borderRadius: 4,
              }}>
                {selectedLine.description || 'Line'} — {selectedLine.act_w_in || '?'}" × {selectedLine.act_h_in || '?'}" × {selectedLine.qty || 1}pcs
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Note
              </div>
              <Input
                size="small"
                value={selectedPanel.note || ''}
                onChange={(e) => updateSelectedPanel('note', e.target.value)}
                placeholder="Optional note"
              />
            </div>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={deleteSelectedPanel}
              block
            >
              Delete Panel
            </Button>
          </div>
        )}
      </div>

      {/* Panel mapping summary table */}
      {panels.length > 0 && (
        <Table
          size="small"
          pagination={false}
          style={{ marginTop: 12 }}
          dataSource={panels.map((p, i) => ({ ...p, _idx: i }))}
          rowKey="id"
          onRow={(record) => ({
            onClick: () => setSelectedPanel(panels.find(pp => pp.id === record.id)),
            style: {
              cursor: 'pointer',
              background: selectedPanel?.id === record.id ? '#eff6ff' : undefined,
            },
          })}
          columns={[
            {
              title: '#',
              width: 40,
              render: (_, r) => (
                <span style={{
                  display: 'inline-block', width: 20, height: 20,
                  borderRadius: 4, textAlign: 'center', lineHeight: '20px',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  background: GROUP_COLORS[r._idx % GROUP_COLORS.length],
                }}>
                  {r._idx + 1}
                </span>
              ),
            },
            {
              title: 'Line',
              render: (_, r) => {
                const line = (r.lineIndex != null) ? lines[r.lineIndex] : null
                return line
                  ? `${line.description || '—'} (${line.act_w_in || '?'}" × ${line.act_h_in || '?'}")`
                  : <span style={{ color: '#ef4444' }}>Not assigned</span>
              },
            },
            { title: 'Note', dataIndex: 'note', width: 120 },
            {
              title: '',
              width: 40,
              render: (_, r) => (
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPanels(prev => prev.filter(p => p.id !== r.id))
                    if (selectedPanel?.id === r.id) setSelectedPanel(null)
                  }}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  )
}

export default ArtworkPanelMapper
