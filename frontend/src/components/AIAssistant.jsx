import React, { useState, useRef, useEffect } from 'react'
import { Typography, Spin, Avatar } from 'antd'
import {
  RobotOutlined, SendOutlined, CloseOutlined,
  UserOutlined, LinkOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, LoadingOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const readObj = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} } }
const save = (k, d) => localStorage.setItem(k, JSON.stringify(d))
const nowStr = () => new Date().toISOString()
const nextId = (a) => a.length ? Math.max(...a.map(r => r.id || 0)) + 1 : 1
const autoCode = (p, id) => `${p}${String(id).padStart(4, '0')}`
const getCompanyId = () => { try { return JSON.parse(localStorage.getItem('auth_user') || '{}').company_id || 1 } catch { return 1 } }

// ── Execute ERP action from Claude's JSON ─────────────────────
const executeAction = (action) => {
  const cid = getCompanyId()

  if (action.type === 'create_lead') {
    const d = action.data, leads = read('crm_leads'), custs = read('customers')
    const stages = read('crm_stages').filter(s => s.is_active !== false).sort((a,b) => a.sequence - b.sequence)
    let customer_id = null
    if (d.customer_name) {
      const ex = custs.find(c => c.name?.toLowerCase() === d.customer_name.toLowerCase())
      if (ex) { customer_id = ex.id } else {
        const nid = nextId(custs)
        custs.push({ id: nid, name: d.customer_name, customer_code: autoCode('CUST', nid), customer_type: 'company', phone: d.phone || null, email: d.email || null, company_id: cid, is_active: true, created_at: nowStr(), updated_at: nowStr() })
        save('customers', custs); customer_id = nid
      }
    }
    const nid = nextId(leads)
    const lead = { id: nid, lead_number: autoCode('OPP', nid), name: d.title || d.customer_name || 'New Opportunity', customer_id, company_name: d.customer_name || '', phone: d.phone || '', email: d.email || '', expected_revenue: d.expected_revenue || 0, priority: d.priority || 'normal', stage_id: d.stage_id || stages[0]?.id || 1, salesperson: d.salesperson || '', lead_type: 'opportunity', probability: stages[0]?.probability || 10, company_id: cid, is_active: true, created_at: nowStr(), updated_at: nowStr() }
    leads.push(lead); save('crm_leads', leads)
    return { success: true, message: '✅ Lead created!', details: [`📋 Lead: **${lead.lead_number}**`, `👤 ${lead.name}`, d.customer_name ? `🏢 Customer: ${d.customer_name}` : null, d.expected_revenue ? `💰 ₹${Number(d.expected_revenue).toLocaleString('en-IN')}` : null].filter(Boolean), link: `/crm/leads/${nid}/edit`, linkText: `Open ${lead.lead_number}` }
  }

  if (action.type === 'create_quotation') {
    const d = action.data, quotes = read('quotations'), custs = read('customers'), prods = read('products')
    let customer_id = null, customer_name = d.customer_name || ''
    if (d.customer_name) {
      const ex = custs.find(c => c.name?.toLowerCase().includes(d.customer_name.toLowerCase()))
      if (ex) { customer_id = ex.id; customer_name = ex.name } else {
        const nid = nextId(custs)
        custs.push({ id: nid, name: d.customer_name, customer_code: autoCode('CUST', nid), customer_type: 'company', phone: d.phone || null, company_id: cid, is_active: true, created_at: nowStr(), updated_at: nowStr() })
        save('customers', custs); customer_id = nid
      }
    }
    const ceil6 = x => Math.ceil(x / 6) * 6
    const groups = (d.lines || []).map((ln, gi) => {
      const prod = prods.find(p => p.name?.toLowerCase().includes((ln.product || '').toLowerCase().split(' ')[0]) || (ln.product || '').toLowerCase().includes(p.name?.toLowerCase()?.split(' ')[0] || ''))
      const rate = ln.rate || prod?.sale_price || 0
      const w = parseFloat(ln.width) || 0, h = parseFloat(ln.height) || 0, qty = parseInt(ln.qty) || 1
      const aspc = w > 0 && h > 0 ? (ceil6(w) * ceil6(h)) / 144 : 0
      const tsq = aspc * qty, sub = parseFloat((tsq * rate).toFixed(2))
      return { group_key: Date.now() + gi, product_id: prod?.id || null, description: prod?.name || ln.product || 'Glass', rate, pricing_method: 'per_sqft', tax_rate: 18, processes: [], sizes: [{ size_key: Date.now() + gi + 50, width_inch: w, height_inch: h, quantity: qty, area_sqft_pc: parseFloat(aspc.toFixed(4)), total_sqft: parseFloat(tsq.toFixed(4)), running_ft: parseFloat(((w + h) * 2 * qty / 12).toFixed(4)), charged_sqft: parseFloat(((Math.ceil(w/3)*3) * (Math.ceil(h/3)*3) * qty / 144).toFixed(4)), subtotal: sub, tax_amount: parseFloat((sub * 0.18).toFixed(2)), line_total: parseFloat((sub * 1.18).toFixed(2)) }] }
    })
    const allSz = groups.flatMap(g => g.sizes), subI = parseFloat(allSz.reduce((s,x) => s + (x.subtotal||0), 0).toFixed(2))
    const cgst = parseFloat((subI * 0.09).toFixed(2)), sgst = cgst, grand = parseFloat((subI + cgst + sgst).toFixed(2))
    const flatLines = groups.flatMap(g => g.sizes.map(s => ({ product_id: g.product_id, description: g.description, rate: g.rate, pricing_method: g.pricing_method, tax_rate: g.tax_rate, width_inch: s.width_inch, height_inch: s.height_inch, quantity: s.quantity, area_sqft_pc: s.area_sqft_pc, total_sqft: s.total_sqft, running_ft: s.running_ft, charged_sqft: s.charged_sqft, subtotal: s.subtotal, tax_amount: s.tax_amount, line_total: s.line_total })))
    const today = new Date(), vu = new Date(today.getTime() + 8 * 86400000), fmt = d => d.toISOString().split('T')[0]
    const nid = nextId(quotes)
    const qt = { id: nid, quote_number: autoCode('QT', nid), customer_id, customer_name, crm_lead_id: d.crm_lead_id || null, quote_date: fmt(today), valid_until: fmt(vu), salesperson: d.salesperson || '', payment_terms: d.payment_terms || 'immediate', status: 'draft', lines: flatLines, groups, subtotal: subI, tax_amount: cgst + sgst, total_amount: grand, cgst, sgst, totals: { subI, procTotal: 0, dcCharges: 0, subII: subI, discountAmt: 0, subIII: subI, cgst, sgst, igst: 0, grandTotal: grand, balance: grand }, company_id: cid, is_active: true, created_at: nowStr(), updated_at: nowStr() }
    quotes.push(qt); save('quotations', quotes)
    return { success: true, message: '✅ Quotation created!', details: [`📋 **${qt.quote_number}**`, `👤 ${customer_name || 'N/A'}`, `📦 ${flatLines.length} item(s)`, `💰 Total: ₹${grand.toLocaleString('en-IN')}`, `📅 Valid: ${fmt(vu)}`], link: `/quotations/${nid}/edit`, linkText: `Open ${qt.quote_number}` }
  }

  if (action.type === 'list_leads') {
    const leads = read('crm_leads').filter(l => l.is_active !== false), stages = read('crm_stages')
    let f = leads
    if (action.data?.stage) f = f.filter(l => { const s = stages.find(x => x.id === l.stage_id); return s?.name?.toLowerCase().includes(action.data.stage.toLowerCase()) })
    if (action.data?.search) f = f.filter(l => l.name?.toLowerCase().includes(action.data.search.toLowerCase()) || l.company_name?.toLowerCase().includes(action.data.search.toLowerCase()))
    if (action.data?.priority) f = f.filter(l => l.priority === action.data.priority)
    const show = f.slice(0, 5)
    return { success: true, message: `📋 Found ${f.length} lead${f.length !== 1 ? 's' : ''}`, details: show.map(l => { const s = stages.find(x => x.id === l.stage_id); return `• **${l.lead_number}** — ${l.name} | ${s?.name || '—'} | ₹${(l.expected_revenue||0).toLocaleString('en-IN')}` }).concat(f.length > 5 ? [`...and ${f.length - 5} more`] : []), link: '/crm/leads', linkText: 'View All Leads' }
  }

  if (action.type === 'list_quotations') {
    const q = read('quotations').filter(x => x.is_active !== false)
    let f = q
    if (action.data?.status) f = f.filter(x => x.status === action.data.status)
    if (action.data?.customer) f = f.filter(x => x.customer_name?.toLowerCase().includes(action.data.customer.toLowerCase()))
    const show = f.slice(0, 5)
    return { success: true, message: `📋 Found ${f.length} quotation${f.length !== 1 ? 's' : ''}`, details: show.map(x => `• **${x.quote_number}** — ${x.customer_name || 'N/A'} | ${x.status?.toUpperCase()} | ₹${(x.total_amount||0).toLocaleString('en-IN')}`).concat(f.length > 5 ? [`...and ${f.length - 5} more`] : []), link: '/quotations', linkText: 'View All Quotations' }
  }

  if (action.type === 'get_stats') {
    const inv = read('invoices').filter(i => i.is_active !== false)
    const rev = inv.filter(i => ['paid','sent'].includes(i.status)).reduce((s,i) => s + (i.total_amount||0), 0)
    const out = inv.filter(i => i.status === 'sent').reduce((s,i) => s + (i.total_amount||0), 0)
    return { success: true, message: '📊 Business Summary:', details: [`💰 Revenue: **₹${rev.toLocaleString('en-IN')}**`, `⚠️ Outstanding: ₹${out.toLocaleString('en-IN')}`, `📋 Quotations: ${read('quotations').filter(q=>q.is_active!==false).length}`, `📦 Sales Orders: ${read('sales_orders').filter(s=>s.is_active!==false).length}`, `🎯 Active Leads: ${read('crm_leads').filter(l=>l.is_active!==false).length}`] }
  }

  if (action.type === 'update_lead') {
    const d = action.data, leads = read('crm_leads'), stages = read('crm_stages')
    const idx = leads.findIndex(l => l.lead_number?.toLowerCase() === (d.lead_number || '').toLowerCase() || (d.search && l.name?.toLowerCase().includes(d.search.toLowerCase())))
    if (idx === -1) return { success: false, message: `❌ Lead not found: "${d.lead_number || d.search}"`, details: ['Try the lead number like OPP0001.'] }
    if (d.stage) { const st = stages.find(s => s.name?.toLowerCase().includes(d.stage.toLowerCase())); if (st) leads[idx].stage_id = st.id }
    if (d.priority) leads[idx].priority = d.priority
    if (d.salesperson) leads[idx].salesperson = d.salesperson
    if (d.expected_revenue) leads[idx].expected_revenue = d.expected_revenue
    leads[idx].updated_at = nowStr(); save('crm_leads', leads)
    const ns = stages.find(s => s.id === leads[idx].stage_id)
    return { success: true, message: '✅ Lead updated!', details: [`📋 ${leads[idx].lead_number} — ${leads[idx].name}`, d.stage ? `📍 Stage: ${ns?.name}` : null, d.priority ? `🔥 Priority: ${d.priority}` : null].filter(Boolean), link: `/crm/leads/${leads[idx].id}/edit`, linkText: 'Open Lead' }
  }

  return { success: false, message: "❓ I couldn't understand that.", details: ['Try: "create lead for [name]", "show quotations", "revenue stats"'] }
}

// ── Claude API ──────────────────────────────────────────────────
const SYSTEM = (ctx) => `You are an AI assistant for ESSAR GLASS ERP. Respond with ONLY valid JSON.
Context: ${JSON.stringify(ctx)}
Action types:
1. create_lead: {"type":"create_lead","data":{"title":"...","customer_name":"...","phone":"...","email":null,"expected_revenue":0,"priority":"normal","salesperson":null}}
2. create_quotation: {"type":"create_quotation","data":{"customer_name":"...","lines":[{"product":"12mm Extra Clear","width":84,"height":48,"qty":3,"rate":null,"cep":false}]}}
3. list_leads: {"type":"list_leads","data":{"stage":null,"search":null,"priority":null}}
4. list_quotations: {"type":"list_quotations","data":{"status":null,"customer":null}}
5. get_stats: {"type":"get_stats","data":{}}
6. update_lead: {"type":"update_lead","data":{"lead_number":"OPP0001","search":null,"stage":null,"priority":null}}
7. unknown: {"type":"unknown","data":{},"suggestion":"..."}
Rules: dimensions "84x48"→width=84,height=48. "50k"=50000,"1L"=100000. "toughened/CEP"→cep:true. "show/list/find"→list. "stats/revenue"→get_stats. "move/update"→update_lead. ONLY JSON, no markdown.`

const callClaude = async (msg, ctx) => {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: SYSTEM(ctx), messages: [{ role: 'user', content: msg }] }),
  })
  const j = await r.json()
  return JSON.parse((j?.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim())
}

// ── Message Bubble ──────────────────────────────────────────────
const Bubble = ({ msg, nav }) => {
  if (msg.role === 'user') return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', mb: 12, marginBottom: 12 }}>
      <div style={{ background: '#6366f1', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', maxWidth: '80%', fontSize: 13 }}>{msg.content}</div>
      <Avatar size={28} icon={<UserOutlined />} style={{ background: '#e2e8f0', color: '#64748b', marginLeft: 8, flexShrink: 0, alignSelf: 'flex-end' }} />
    </div>
  )
  if (msg.loading) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
      <Avatar size={28} icon={<RobotOutlined />} style={{ background: '#6366f1', flexShrink: 0 }} />
      <div style={{ background: '#f1f5f9', borderRadius: '16px 16px 16px 4px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
        <Text style={{ fontSize: 12, color: '#64748b' }}>Thinking...</Text>
      </div>
    </div>
  )
  const res = msg.result
  if (!res) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
      <Avatar size={28} icon={<RobotOutlined />} style={{ background: '#6366f1', flexShrink: 0 }} />
      <div style={{ maxWidth: '85%' }}>
        <div style={{ background: '#f1f5f9', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', marginBottom: res.link ? 6 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {res.success ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 13 }} /> : <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 13 }} />}
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{res.message}</Text>
          </div>
          {res.details?.map((d, i) => (
            <div key={i} style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
              {d.split('**').map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span>)}
            </div>
          ))}
        </div>
        {res.link && (
          <button onClick={() => nav(res.link)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
            <LinkOutlined style={{ fontSize: 11 }} />{res.linkText}
          </button>
        )}
      </div>
    </div>
  )
}

const QUICK = [
  { label: '📊 Stats', text: 'Show me revenue and business stats' },
  { label: '🎯 Leads', text: 'Show all active leads' },
  { label: '📋 Quotes', text: 'Show all draft quotations' },
  { label: '🏆 Won', text: 'Show won leads' },
]

const AIAssistant = () => {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState([{ id: 0, role: 'assistant', result: { success: true, message: "👋 Hi! I'm your Essar Glass ERP Assistant.", details: ['I can help you:', '• **Create leads** — "Create lead for Rahul, 9820123456"', '• **Create quotations** — "Quote for Patel, 12mm clear 84x48 qty 5"', '• **Find records** — "Show draft quotations"', '• **Update leads** — "Move OPP0001 to Won"', '• **Stats** — "Revenue summary"'] } }])
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null), inRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => { if (open) setTimeout(() => inRef.current?.focus(), 100) }, [open])

  const buildCtx = () => ({
    customers: read('customers').slice(0, 10).map(c => ({ id: c.id, name: c.name })),
    products: read('products').slice(0, 15).map(p => ({ id: p.id, name: p.name, sale_price: p.sale_price })),
    stages: read('crm_stages').filter(s => s.is_active !== false).map(s => ({ id: s.id, name: s.name })),
  })

  const send = async (text) => {
    const t = text || input.trim()
    if (!t || loading) return
    const uMsg = { id: Date.now(), role: 'user', content: t }
    const lMsg = { id: Date.now() + 1, role: 'assistant', loading: true }
    setMsgs(p => [...p, uMsg, lMsg]); setInput(''); setLoading(true)
    try {
      const action = await callClaude(t, buildCtx())
      const result = action.type === 'unknown'
        ? { success: false, message: '🤔 Not sure what you mean.', details: [action.suggestion || 'Try: "create lead for Rahul" or "show quotations"'] }
        : executeAction(action)
      setMsgs(p => p.map(m => m.id === lMsg.id ? { ...m, loading: false, result } : m))
    } catch (err) {
      console.error('AI error:', err)
      setMsgs(p => p.map(m => m.id === lMsg.id ? { ...m, loading: false, result: { success: false, message: '❌ Something went wrong.', details: ['Check your connection and try again.'] } } : m))
    } finally { setLoading(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position: 'fixed', bottom: 28, right: 28, width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(99,102,241,0.5)', zIndex: 1000, transition: 'transform 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      <RobotOutlined style={{ fontSize: 24, color: '#fff' }} />
    </button>
  )

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, width: 380, height: 580, background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RobotOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Essar AI Assistant</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Powered by Claude · CRM + Quotations</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', color: '#fff', fontSize: 16 }}><CloseOutlined /></button>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', background: '#fafafe' }}>
        {msgs.map(m => <Bubble key={m.id} msg={m} nav={nav} />)}
        <div ref={endRef} />
      </div>
      {/* Quick actions */}
      <div style={{ padding: '8px 12px 0', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8 }}>
          {QUICK.map(q => (
            <button key={q.text} onClick={() => send(q.text)} disabled={loading}
              style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 20, padding: '4px 10px', fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 500, opacity: loading ? 0.5 : 1 }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
              {q.label}
            </button>
          ))}
        </div>
      </div>
      {/* Input */}
      <div style={{ padding: '10px 12px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
        <input ref={inRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder='Try: "Create lead for Rahul, 9820123456"' disabled={loading}
          style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 12, padding: '9px 14px', fontSize: 13, outline: 'none', background: loading ? '#f8fafc' : '#fff', color: '#1e293b' }} />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ width: 38, height: 38, borderRadius: '50%', background: loading || !input.trim() ? '#e2e8f0' : '#6366f1', border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SendOutlined style={{ color: loading || !input.trim() ? '#94a3b8' : '#fff', fontSize: 14 }} />
        </button>
      </div>
    </div>
  )
}

export default AIAssistant
