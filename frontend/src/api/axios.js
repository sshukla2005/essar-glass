import { message } from 'antd'

// ── MOCK LOCAL STORAGE DATABASE ───────────────────────────────────────────
const delay = (ms) => new Promise(res => setTimeout(res, ms))

const getMockData = (endpoint) => {
  const data = localStorage.getItem(`mock_${endpoint}`)
  return data ? JSON.parse(data) : []
}

const setMockData = (endpoint, data) => {
  localStorage.setItem(`mock_${endpoint}`, JSON.stringify(data))
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const throwError = (msg) => {
  const error = { response: { data: { message: msg } } }
  message.error(msg)
  throw error
}

const api = {
  get: async (url, config) => {
    await delay(300);
    // e.g. /branches/ or /branches/dropdown
    const parts = url.replace('/api/v1', '').split('/').filter(Boolean)
    const endpoint = parts[0]
    const id = parts[1]

    const data = getMockData(endpoint)

    if (id === 'dropdown') {
        return { data: data.filter(i => i.is_active !== false) }
    }
    
    if (id) {
        const item = data.find(i => String(i.id) === String(id))
        if (!item) return throwError(`${endpoint} not found`)
        return { data: item }
    }

    return { data: { items: data, total: data.length } }
  },
  post: async (url, payload) => {
    await delay(300);
    const parts = url.replace('/api/v1', '').split('/').filter(Boolean)
    const endpoint = parts[0]
    
    // Custom actions: /quotations/{id}/confirm
    if (parts.length >= 3) {
       const id = parts[1];
       const action = parts[2];
       const data = getMockData(endpoint)
       const index = data.findIndex(i => String(i.id) === String(id))
       
       if (index > -1) {
           if (action === 'confirm') data[index].status = 'Confirmed'
           if (action === 'cancel') data[index].status = 'Cancelled'
           if (action === 'clone') {
               const clone = { ...data[index], id: generateId(), name: (data[index].name || '') + ' (Copy)' }
               data.push(clone)
               setMockData(endpoint, data)
               return { data: clone }
           }
           setMockData(endpoint, data)
           message.success(`Successfully completed ${action}`)
           return { data: data[index] }
       }
       return throwError("Not found")
    }
    
    // Create
    const data = getMockData(endpoint)
    const newItem = { id: generateId(), ...payload, created_at: new Date().toISOString(), is_active: true }
    data.push(newItem)
    setMockData(endpoint, data)
    message.success('Created successfully')
    return { data: newItem }
  },
  put: async (url, payload) => {
    await delay(300);
    const parts = url.replace('/api/v1', '').split('/').filter(Boolean)
    const endpoint = parts[0]
    const id = parts[1]
    
    const data = getMockData(endpoint)
    const index = data.findIndex(i => String(i.id) === String(id))
    if (index > -1) {
        data[index] = { ...data[index], ...payload, updated_at: new Date().toISOString() }
        setMockData(endpoint, data)
        message.success('Updated successfully')
        return { data: data[index] }
    }
    return throwError("Not found")
  },
  patch: async (url, payload) => {
    await delay(300);
    const parts = url.replace('/api/v1', '').split('/').filter(Boolean)
    const endpoint = parts[0]
    const id = parts[1]
    
    const data = getMockData(endpoint)
    const index = data.findIndex(i => String(i.id) === String(id))
    if (index > -1) {
        data[index] = { ...data[index], ...payload }
        setMockData(endpoint, data)
        message.success('Status updated')
        return { data: data[index] }
    }
    return throwError("Not found")
  }
}

// ── Generic master API factory ─────────────────────────────────────────────
export const createMasterApi = (endpoint) => {
  // Helper to read from localStorage
  const getMockData = () => {
    try {
      const data = localStorage.getItem(endpoint)
      if (data) return JSON.parse(data)
    } catch (e) {}
    return null
  }

  return {
    list: async (params) => {
      const mockData = getMockData()
      if (mockData) {
        let items = [...mockData]
        if (params?.search) {
          const s = params.search.toLowerCase()
          items = items.filter(i => (i.name || '').toLowerCase().includes(s))
        }
        return Promise.resolve({ data: { items, total: items.length } })
      }
      return api.get(`/${endpoint}/`, { params })
    },
    dropdown: () => {
      const mockData = getMockData()
      if (mockData) {
        return Promise.resolve({ data: mockData.map(i => ({ value: i.id, label: i.name })) })
      }
      return api.get(`/${endpoint}/dropdown`)
    },
    get: (id) => {
      const mockData = getMockData()
      if (mockData) {
        const item = mockData.find(i => String(i.id) === String(id))
        return Promise.resolve({ data: item })
      }
      return api.get(`/${endpoint}/${id}`)
    },
    create: (data) => api.post(`/${endpoint}/`, data),
    update: (id, data) => api.put(`/${endpoint}/${id}`, data),
    archive: (id, active) => api.patch(`/${endpoint}/${id}/archive`, { is_active: active }),
    clone: (id) => api.post(`/${endpoint}/${id}/clone`),
  }
}

export default api
