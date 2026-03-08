import axios from 'axios'

const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized'

/** 创建 axios 实例 */
export const request = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** 请求拦截器：自动附加 token */
request.interceptors.request.use(
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

/** 响应拦截器：统一错误处理 */
request.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || '请求失败'

    if (status === 401) {
      localStorage.removeItem('token')

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
        const publicAuthPaths = ['/login', '/register', '/reset-password']
        if (!publicAuthPaths.includes(window.location.pathname)) {
          window.location.assign('/login')
        }
      }
    }

    console.error(`[API Error] ${status}: ${message}`)
    return Promise.reject(error)
  }
)
