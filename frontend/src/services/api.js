import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error)
  }
)

// Auth API
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  
  register: (username, email, password, role) =>
    api.post('/auth/register', { username, email, password, role }),
  
  verify: (token) =>
    api.post('/auth/verify', { token }),
}

// Subnets API
export const subnetsAPI = {
  getAll: (params = {}) =>
    api.get('/subnets', { params }),
  
  getById: (id) =>
    api.get(`/subnets/${id}`),
  
  create: (data) =>
    api.post('/subnets', data),
  
  update: (id, data) =>
    api.patch(`/subnets/${id}`, data),
  
  delete: (id) =>
    api.delete(`/subnets/${id}`),
}

// Transactions API
export const transactionsAPI = {
  getBySubnet: (subnetId, params = {}) =>
    api.get(`/subnets/${subnetId}/transactions`, { params }),
  
  getByHash: (hash) =>
    api.get(`/transactions/${hash}`),
}

// Alerts API
export const alertsAPI = {
  getBySubnet: (subnetId, params = {}) =>
    api.get(`/subnets/${subnetId}/alerts`, { params }),
  
  acknowledge: (id) =>
    api.patch(`/alerts/${id}/acknowledge`),
  
  markFalsePositive: (id) =>
    api.post(`/alerts/${id}/false-positive`),
}

// Stats API
export const statsAPI = {
  getSubnetStats: (subnetId) =>
    api.get(`/subnets/${subnetId}/stats`),
}

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
}

export default api
