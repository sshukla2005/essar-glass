const getAll = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
const saveAll = (key, data) => localStorage.setItem(key, JSON.stringify(data))
const getNextId = (records) => records.length ? Math.max(...records.map(r => r.id || 0)) + 1 : 1
const nowStr = () => new Date().toISOString()
const ok = (data) => Promise.resolve({ data })
const notFound = () => Promise.reject({ response: { status: 404, data: { detail: 'Not found' } } })

export const createLocalApi = (key, codeConfig = null) => ({

  list: (params = {}) => {
    const { page = 1, page_size = 20, search = '', is_active, company_id, ...extraFilters } = params
    let records = getAll(key)

    // Company filter — if company_id provided, filter by it
    // If not provided, check active user's company
    const filterCompanyId = company_id || (() => {
      try {
        const user = JSON.parse(localStorage.getItem('auth_user') || 'null')
        if (!user || user.role === 'superadmin') return null
        return user.company_id || null
      } catch { return null }
    })()

    if (filterCompanyId) {
      records = records.filter(r =>
        r.company_id === filterCompanyId ||
        r.company_id === undefined  // legacy records without company_id
      )
    }

    if (is_active !== undefined && is_active !== null && is_active !== '')
      records = records.filter(r => r.is_active === is_active)
    if (search && search.trim()) {
      const q = search.toLowerCase()
      records = records.filter(r =>
        Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(q))
      )
    }
    Object.entries(extraFilters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '')
        records = records.filter(r => String(r[k]) === String(v))
    })
    const total = records.length
    const items = [...records].reverse().slice((page - 1) * page_size, page * page_size)
    return ok({ items, total, page: Number(page), page_size: Number(page_size), pages: Math.ceil(total / page_size) || 1 })
  },

  dropdown: () => {
    let records = getAll(key).filter(r => r.is_active !== false)
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') || 'null')
      if (user && user.role !== 'superadmin' && user.company_id) {
        records = records.filter(r => r.company_id === user.company_id || r.company_id === undefined)
      }
    } catch {}
    return ok(records)
  },

  get: (id) => {
    const rec = getAll(key).find(r => r.id === parseInt(id))
    return rec ? ok(rec) : notFound()
  },

  create: (data) => {
    const records = getAll(key)
    const newId = getNextId(records)
    const autoCode = {}
    if (codeConfig && !data[codeConfig.field])
      autoCode[codeConfig.field] = `${codeConfig.prefix}${String(newId).padStart(4, '0')}`
    const newRec = { ...data, ...autoCode, id: newId, is_active: true, created_at: nowStr(), updated_at: nowStr() }
    records.push(newRec)
    saveAll(key, records)
    return ok(newRec)
  },

  update: (id, data) => {
    const records = getAll(key)
    const idx = records.findIndex(r => r.id === parseInt(id))
    if (idx === -1) return notFound()
    records[idx] = { ...records[idx], ...data, id: parseInt(id), updated_at: nowStr() }
    saveAll(key, records)
    return ok(records[idx])
  },

  archive: (id, is_active) => {
    const records = getAll(key)
    const idx = records.findIndex(r => r.id === parseInt(id))
    if (idx === -1) return notFound()
    records[idx].is_active = is_active
    records[idx].updated_at = nowStr()
    saveAll(key, records)
    return ok(records[idx])
  },

  clone: (id) => {
    const records = getAll(key)
    const original = records.find(r => r.id === parseInt(id))
    if (!original) return notFound()
    const newId = getNextId(records)
    const cloned = { ...original, id: newId, is_active: true, created_at: nowStr(), updated_at: nowStr() }
    if (cloned.name) cloned.name = `Copy of ${cloned.name}`
    if (codeConfig) cloned[codeConfig.field] = `${codeConfig.prefix}${String(newId).padStart(4, '0')}`
    records.push(cloned)
    saveAll(key, records)
    return ok(cloned)
  },
})

export const createStatusApi = (key, codeConfig = null) => {
  const base = createLocalApi(key, codeConfig)
  return {
    ...base,
    changeStatus: (id, status) => {
      const records = getAll(key)
      const idx = records.findIndex(r => r.id === parseInt(id))
      if (idx === -1) return notFound()
      records[idx].status = status
      records[idx].updated_at = nowStr()
      saveAll(key, records)
      return ok(records[idx])
    },
    confirm:  (id) => base.update(id, { status: 'confirmed',  updated_at: nowStr() }).then(r => { const recs = getAll(key); const idx = recs.findIndex(x => x.id === parseInt(id)); recs[idx].status = 'confirmed'; saveAll(key, recs); return ok(recs[idx]) }),
    cancel:   (id) => { const recs = getAll(key); const idx = recs.findIndex(x => x.id === parseInt(id)); if(idx===-1) return notFound(); recs[idx].status = 'cancelled'; saveAll(key, recs); return ok(recs[idx]) },
    send:     (id) => { const recs = getAll(key); const idx = recs.findIndex(x => x.id === parseInt(id)); if(idx===-1) return notFound(); recs[idx].status = 'sent'; saveAll(key, recs); return ok(recs[idx]) },
  }
}
