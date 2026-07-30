import React, { useState, useRef, useEffect } from 'react'
import { Typography, Spin, Avatar } from 'antd'
import {
  RobotOutlined, SendOutlined, CloseOutlined,
  UserOutlined, LinkOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, LoadingOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  crmLeadApi,
  crmStageApi,
  customerApi,
  quotationApi,
  salesOrderApi,
  invoiceApi,
  productApi,
} from '../api'

const { Text } = Typography

const formatApiError = (err) => {
  if (!err) return 'Unknown error'
  const data = err.response?.data
  if (data?.detail) {
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail)) {
      return data.detail.map(item => typeof item === 'string' ? item : item.msg || JSON.stringify(item)).join('; ')
    }
    if (typeof data.detail === 'object') return data.detail.msg || JSON.stringify(data.detail)
  }
  if (data?.message) return String(data.message)
  return err.message || 'Request failed'
}

// ── Execute ERP action via real API calls ─────────────────────
const executeAction = async (action) => {
  try {
    if (action.type === 'create_lead') {
      const d = action.data
      let customer_id = null

      if (d.customer_name?.trim()) {
        const cListRes = await customerApi.list({ search: d.customer_name.trim(), page_size: 50 }).catch(() => ({ data: [] }))
        const custs = Array.isArray(cListRes.data) ? cListRes.data : (cListRes.data?.items || [])
        const ex = custs.find(c => c.name?.toLowerCase() === d.customer_name.trim().toLowerCase())

        if (ex) {
          customer_id = ex.id
        } else {
          const newCustRes = await customerApi.create({
            name: d.customer_name.trim(),
            customer_type: 'company',
            phone: d.phone || null,
            email: d.email || null,
            is_active: true,
          })
          customer_id = newCustRes.data?.id
        }
      }

      const sRes = await crmStageApi.list({ is_active: true, page_size: 100 }).catch(() => ({ data: [] }))
      const stages = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.items || [])
      const sortedStages = [...stages].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      const defaultStageId = d.stage_id || sortedStages[0]?.id || 1

      const leadRes = await crmLeadApi.create({
        name: d.title || d.customer_name || 'New Opportunity',
        customer_id,
        company_name: d.customer_name || '',
        phone: d.phone || '',
        email: d.email || '',
        expected_revenue: d.expected_revenue || 0,
        priority: d.priority || 'normal',
        stage_id: defaultStageId,
        salesperson: d.salesperson || '',
        lead_type: 'opportunity',
        is_active: true,
      })

      const lead = leadRes.data || {}
      return {
        success: true,
        message: '✅ Lead created!',
        details: [
          `📋 Lead: **${lead.lead_number || ('ID #' + lead.id)}**`,
          `👤 ${lead.name}`,
          d.customer_name ? `🏢 Customer: ${d.customer_name}` : null,
          d.expected_revenue ? `💰 ₹${Number(d.expected_revenue).toLocaleString('en-IN')}` : null,
        ].filter(Boolean),
        link: `/crm/leads/${lead.id}/edit`,
        linkText: `Open ${lead.lead_number || 'Lead'}`
      }
    }

    if (action.type === 'create_quotation') {
      const d = action.data
      let customer_id = null, customer_name = d.customer_name || ''

      if (d.customer_name?.trim()) {
        const cListRes = await customerApi.list({ search: d.customer_name.trim(), page_size: 50 }).catch(() => ({ data: [] }))
        const custs = Array.isArray(cListRes.data) ? cListRes.data : (cListRes.data?.items || [])
        const ex = custs.find(c => c.name?.toLowerCase().includes(d.customer_name.trim().toLowerCase()))
        if (ex) {
          customer_id = ex.id
          customer_name = ex.name
        } else {
          const newCustRes = await customerApi.create({
            name: d.customer_name.trim(),
            customer_type: 'company',
            phone: d.phone || null,
            is_active: true,
          })
          customer_id = newCustRes.data?.id
          customer_name = newCustRes.data?.name || d.customer_name
        }
      }

      const pRes = await productApi.dropdown().catch(() => ({ data: [] }))
      const prods = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.items || [])

      const ceil6 = x => Math.ceil(x / 6) * 6
      const groups = (d.lines || []).map((ln, gi) => {
        const prod = prods.find(p => p.name?.toLowerCase().includes((ln.product || '').toLowerCase().split(' ')[0]) || (ln.product || '').toLowerCase().includes(p.name?.toLowerCase()?.split(' ')[0] || ''))
        const rate = ln.rate || prod?.sale_price || 0
        const w = parseFloat(ln.width) || 0, h = parseFloat(ln.height) || 0, qty = parseInt(ln.qty) || 1
        const aspc = w > 0 && h > 0 ? (ceil6(w) * ceil6(h)) / 144 : 0
        const tsq = aspc * qty, sub = parseFloat((tsq * rate).toFixed(2))
        return {
          group_key: Date.now() + gi,
          product_id: prod?.id || null,
          description: prod?.name || ln.product || 'Glass',
          rate,
          pricing_method: 'per_sqft',
          tax_rate: 18,
          processes: [],
          sizes: [{
            size_key: Date.now() + gi + 50,
            width_inch: w,
            height_inch: h,
            quantity: qty,
            area_sqft_pc: parseFloat(aspc.toFixed(4)),
            total_sqft: parseFloat(tsq.toFixed(4)),
            running_ft: parseFloat(((w + h) * 2 * qty / 12).toFixed(4)),
            charged_sqft: parseFloat(((Math.ceil(w/3)*3) * (Math.ceil(h/3)*3) * qty / 144).toFixed(4)),
            subtotal: sub,
            tax_amount: parseFloat((sub * 0.18).toFixed(2)),
            line_total: parseFloat((sub * 1.18).toFixed(2))
          }]
        }
      })
      const allSz = groups.flatMap(g => g.sizes)
      const subI = parseFloat(allSz.reduce((s,x) => s + (x.subtotal||0), 0).toFixed(2))
      const cgst = parseFloat((subI * 0.09).toFixed(2)), sgst = cgst, grand = parseFloat((subI + cgst + sgst).toFixed(2))
      const flatLines = groups.flatMap(g => g.sizes.map(s => ({
        product_id: g.product_id,
        description: g.description,
        rate: g.rate,
        pricing_method: g.pricing_method,
        tax_rate: g.tax_rate,
        width_inch: s.width_inch,
        height_inch: s.height_inch,
        quantity: s.quantity,
        area_sqft_pc: s.area_sqft_pc,
        total_sqft: s.total_sqft,
        running_ft: s.running_ft,
        charged_sqft: s.charged_sqft,
        subtotal: s.subtotal,
        tax_amount: s.tax_amount,
        line_total: s.line_total
      })))
      const today = new Date(), vu = new Date(today.getTime() + 8 * 86400000), fmt = dt => dt.toISOString().split('T')[0]
      const payload = {
        customer_id,
        customer_name,
        crm_lead_id: d.crm_lead_id || null,
        quote_date: fmt(today),
        valid_until: fmt(vu),
        salesperson: d.salesperson || '',
        payment_terms: d.payment_terms || 'immediate',
        status: 'draft',
        lines: flatLines,
        groups,
        subtotal: subI,
        tax_amount: cgst + sgst,
        total_amount: grand,
        cgst,
        sgst,
        totals: { subI, procTotal: 0, dcCharges: 0, subII: subI, discountAmt: 0, subIII: subI, cgst, sgst, igst: 0, grandTotal: grand, balance: grand },
        is_active: true
      }

      const qRes = await quotationApi.create(payload)
      const qt = qRes.data || {}
      return {
        success: true,
        message: '✅ Quotation created!',
        details: [
          `📋 **${qt.quote_number || ('QT #' + qt.id)}**`,
          `👤 ${customer_name || 'N/A'}`,
          `📦 ${flatLines.length} item(s)`,
          `💰 Total: ₹${grand.toLocaleString('en-IN')}`,
          `📅 Valid: ${fmt(vu)}`
        ],
        link: `/quotations/${qt.id}/edit`,
        linkText: `Open ${qt.quote_number || 'Quotation'}`
      }
    }

    if (action.type === 'list_leads') {
      const [lRes, sRes] = await Promise.all([
        crmLeadApi.list({ page_size: 100, ...(action.data?.search ? { search: action.data.search } : {}) }),
        crmStageApi.list({ page_size: 100 }).catch(() => ({ data: [] }))
      ])
      let leads = Array.isArray(lRes.data) ? lRes.data : (lRes.data?.items || [])
      const stages = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.items || [])

      if (action.data?.stage) {
        leads = leads.filter(l => {
          const s = stages.find(x => x.id === l.stage_id)
          return s?.name?.toLowerCase().includes(action.data.stage.toLowerCase())
        })
      }
      if (action.data?.search) {
        const q = action.data.search.toLowerCase()
        leads = leads.filter(l => l.name?.toLowerCase().includes(q) || l.company_name?.toLowerCase().includes(q) || l.lead_number?.toLowerCase().includes(q))
      }
      if (action.data?.priority) {
        leads = leads.filter(l => l.priority === action.data.priority)
      }

      const show = leads.slice(0, 5)
      return {
        success: true,
        message: `📋 Found ${leads.length} lead${leads.length !== 1 ? 's' : ''}`,
        details: show.map(l => {
          const s = stages.find(x => x.id === l.stage_id)
          return `• **${l.lead_number || ('#' + l.id)}** — ${l.name} | ${s?.name || '—'} | ₹${(l.expected_revenue||0).toLocaleString('en-IN')}`
        }).concat(leads.length > 5 ? [`...and ${leads.length - 5} more`] : []),
        link: '/crm/leads',
        linkText: 'View All Leads'
      }
    }

    if (action.type === 'list_quotations') {
      const qRes = await quotationApi.list({
        page_size: 100,
        ...(action.data?.status ? { status: action.data.status } : {})
      })
      let quotes = Array.isArray(qRes.data) ? qRes.data : (qRes.data?.items || [])

      if (action.data?.status) {
        quotes = quotes.filter(x => x.status === action.data.status)
      }
      if (action.data?.customer) {
        const cName = action.data.customer.toLowerCase()
        quotes = quotes.filter(x => (x.customer_name || '').toLowerCase().includes(cName))
      }

      const show = quotes.slice(0, 5)
      return {
        success: true,
        message: `📋 Found ${quotes.length} quotation${quotes.length !== 1 ? 's' : ''}`,
        details: show.map(x => `• **${x.quote_number || ('#' + x.id)}** — ${x.customer_name || 'N/A'} | ${(x.status || 'draft').toUpperCase()} | ₹${(x.total_amount||0).toLocaleString('en-IN')}`).concat(quotes.length > 5 ? [`...and ${quotes.length - 5} more`] : []),
        link: '/quotations',
        linkText: 'View All Quotations'
      }
    }

    if (action.type === 'get_stats') {
      const [qRes, soRes, lRes, invRes] = await Promise.all([
        quotationApi.list({ page_size: 500 }).catch(() => ({ data: [] })),
        salesOrderApi.list({ page_size: 500 }).catch(() => ({ data: [] })),
        crmLeadApi.list({ page_size: 500 }).catch(() => ({ data: [] })),
        invoiceApi.list({ page_size: 500 }).catch(() => ({ data: [] })),
      ])

      const quotes = Array.isArray(qRes.data) ? qRes.data : (qRes.data?.items || [])
      const salesOrders = Array.isArray(soRes.data) ? soRes.data : (soRes.data?.items || [])
      const leads = Array.isArray(lRes.data) ? lRes.data : (lRes.data?.items || [])
      const invoices = Array.isArray(invRes.data) ? invRes.data : (invRes.data?.items || [])

      const rev = invoices
        .filter(i => ['paid', 'sent'].includes(i.status))
        .reduce((s, i) => s + (i.total_amount || 0), 0)
      const out = invoices
        .filter(i => i.status === 'sent')
        .reduce((s, i) => s + (i.total_amount || i.balance_due || 0), 0)

      return {
        success: true,
        message: '📊 Business Summary:',
        details: [
          `💰 Revenue: **₹${rev.toLocaleString('en-IN')}**`,
          `⚠️ Outstanding: ₹${out.toLocaleString('en-IN')}`,
          `📋 Quotations: ${quotes.length}`,
          `📦 Sales Orders: ${salesOrders.length}`,
          `🎯 Active Leads: ${leads.filter(l => l.is_active !== false).length}`,
        ]
      }
    }

    if (action.type === 'update_lead') {
      const d = action.data
      const [lRes, sRes] = await Promise.all([
        crmLeadApi.list({ page_size: 500 }),
        crmStageApi.list({ page_size: 100 }).catch(() => ({ data: [] }))
      ])
      const leads = Array.isArray(lRes.data) ? lRes.data : (lRes.data?.items || [])
      const stages = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.items || [])

      const leadMatch = leads.find(l =>
        l.lead_number?.toLowerCase() === (d.lead_number || '').toLowerCase() ||
        (d.search && (
          l.name?.toLowerCase().includes(d.search.toLowerCase()) ||
          l.lead_number?.toLowerCase().includes(d.search.toLowerCase())
        ))
      )

      if (!leadMatch) {
        return {
          success: false,
          message: `❌ Lead not found: "${d.lead_number || d.search}"`,
          details: ['Try specifying the lead number (e.g. OPP0001) or exact name.']
        }
      }

      const updates = {}
      let targetStageName = null
      if (d.stage) {
        const st = stages.find(s => s.name?.toLowerCase().includes(d.stage.toLowerCase()))
        if (st) {
          updates.stage_id = st.id
          targetStageName = st.name
        }
      }
      if (d.priority) updates.priority = d.priority
      if (d.salesperson) updates.salesperson = d.salesperson
      if (d.expected_revenue) updates.expected_revenue = d.expected_revenue

      const upRes = await crmLeadApi.update(leadMatch.id, updates)
      const updatedLead = upRes.data || leadMatch

      return {
        success: true,
        message: '✅ Lead updated!',
        details: [
          `📋 ${updatedLead.lead_number || leadMatch.lead_number} — ${updatedLead.name || leadMatch.name}`,
          targetStageName ? `📍 Stage: ${targetStageName}` : null,
          d.priority ? `🔥 Priority: ${d.priority}` : null,
        ].filter(Boolean),
        link: `/crm/leads/${leadMatch.id}/edit`,
        linkText: 'Open Lead'
      }
    }

    return {
      success: false,
      message: "❓ I couldn't understand that.",
      details: ['Try: "create lead for [name]", "show quotations", "revenue stats"']
    }
  } catch (err) {
    console.error('Action execution error:', err)
    const errText = formatApiError(err)
    const actionLabel = action.type ? action.type.replace('_', ' ') : 'complete action'
    return {
      success: false,
      message: `❌ Couldn't ${actionLabel}: ${errText}`,
      details: [errText]
    }
  }
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

// The API key lives in the browser (localStorage) and is visible in DevTools/network to anyone
// using this browser. Acceptable for trusted internal users; for public/multi-tenant use, proxy
// these calls through the backend so the key stays server-side.
const callClaude = async (msg, ctx) => {
  const apiKey = localStorage.getItem('ai_api_key') || ''
  if (!apiKey.trim()) {
    throw new Error('NO_API_KEY')
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, system: SYSTEM(ctx), messages: [{ role: 'user', content: msg }] }),
  })
  if (!r.ok) {
    const errText = await r.text()
    throw new Error(`API ${r.status}: ${errText.slice(0,200)}`)
  }

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

  const buildCtx = async () => {
    try {
      const [cRes, pRes, sRes] = await Promise.all([
        customerApi.dropdown().catch(() => ({ data: [] })),
        productApi.dropdown().catch(() => ({ data: [] })),
        crmStageApi.list({ is_active: true, page_size: 100 }).catch(() => ({ data: [] })),
      ])
      const custs = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.items || [])
      const prods = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.items || [])
      const stages = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.items || [])

      return {
        customers: custs.slice(0, 10).map(c => ({ id: c.id, name: c.name })),
        products: prods.slice(0, 15).map(p => ({ id: p.id, name: p.name, sale_price: p.sale_price })),
        stages: stages.filter(s => s.is_active !== false).map(s => ({ id: s.id, name: s.name })),
      }
    } catch {
      return { customers: [], products: [], stages: [] }
    }
  }

  const send = async (text) => {
    const t = text || input.trim()
    if (!t || loading) return
    const uMsg = { id: Date.now(), role: 'user', content: t }
    const lMsg = { id: Date.now() + 1, role: 'assistant', loading: true }
    setMsgs(p => [...p, uMsg, lMsg]); setInput(''); setLoading(true)
    try {
      const ctx = await buildCtx()
      const action = await callClaude(t, ctx)
      const result = action.type === 'unknown'
        ? { success: false, message: '🤔 Not sure what you mean.', details: [action.suggestion || 'Try: "create lead for Rahul" or "show quotations"'] }
        : await executeAction(action)
      setMsgs(p => p.map(m => m.id === lMsg.id ? { ...m, loading: false, result } : m))
    } catch (err) {
      console.error('AI error:', err)
      if (err.message === 'NO_API_KEY') {
        setMsgs(p => p.map(m => m.id === lMsg.id ? {
          ...m,
          loading: false,
          result: {
            success: false,
            message: '⚙️ No API key set',
            details: ['Add your Anthropic API key in Settings → AI Assistant to enable the assistant.'],
            link: '/settings/ai',
            linkText: 'Go to AI Settings'
          }
        } : m))
      } else {
        setMsgs(p => p.map(m => m.id === lMsg.id ? {
          ...m,
          loading: false,
          result: {
            success: false,
            message: '❌ AI Assistant Error',
            details: [err.message || 'Check your connection and try again.']
          }
        } : m))
      }
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
