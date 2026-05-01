import axios from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attach JWT when auth is added
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor — unified error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong'
    message.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    return Promise.reject(error)
  }
)

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
