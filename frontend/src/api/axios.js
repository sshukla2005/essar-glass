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
export const createMasterApi = (endpoint) => ({
  list:     (params)     => api.get(`/${endpoint}/`, { params }),
  dropdown: ()           => api.get(`/${endpoint}/dropdown`),
  get:      (id)         => api.get(`/${endpoint}/${id}`),
  create:   (data)       => api.post(`/${endpoint}/`, data),
  update:   (id, data)   => api.put(`/${endpoint}/${id}`, data),
  archive:  (id, active) => api.patch(`/${endpoint}/${id}/archive`, { is_active: active }),
  clone:    (id)         => api.post(`/${endpoint}/${id}/clone`),
})

export default api
