import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, type AuthResult, type AuthUser } from '@/api'

type UserInfo = AuthUser
const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<UserInfo | null>(null)
  const isInitialized = ref(false)
  let initializingPromise: Promise<void> | null = null

  const isLoggedIn = computed(() => !!token.value)

  /** 设置 token */
  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  /** 清除认证信息 */
  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  /**
   * @description 统一写入登录结果。
   * @param authResult 认证结果
   */
  function applyAuthResult(authResult: AuthResult) {
    setToken(authResult.token)
    user.value = authResult.user
    isInitialized.value = true
  }

  /** 初始化登录态 */
  async function initAuth() {
    if (isInitialized.value) {
      return
    }

    if (!initializingPromise) {
      initializingPromise = (async () => {
        if (token.value) {
          try {
            await fetchUser()
          } catch {
          }
        }
        isInitialized.value = true
        initializingPromise = null
      })()
    }

    await initializingPromise
  }

  /** 登录 */
  async function login(email: string, password: string) {
    const response = await authApi.login({ email, password })
    applyAuthResult(response.data.data)
    return response.data
  }

  /** 注册 */
  async function register(
    email: string,
    password: string,
    verificationCode: string,
    nickname?: string
  ) {
    const response = await authApi.register({
      email,
      password,
      verificationCode,
      nickname,
    })
    applyAuthResult(response.data.data)
    return response.data
  }

  /** 发送注册验证码 */
  async function sendRegisterCode(email: string) {
    const response = await authApi.sendRegisterCode({ email })
    return response.data
  }

  /** 发送重置密码验证码 */
  async function sendResetPasswordCode(email: string) {
    const response = await authApi.sendResetPasswordCode({ email })
    return response.data
  }

  /** 使用邮箱验证码重置密码 */
  async function resetPassword(email: string, verificationCode: string, newPassword: string) {
    const response = await authApi.resetPassword({
      email,
      verificationCode,
      newPassword,
    })
    return response.data
  }

  /** 消费第三方 OAuth 登录令牌 */
  async function consumeExternalToken(externalToken: string) {
    setToken(externalToken)
    try {
      const response = await authApi.getMe()
      user.value = response.data.data
      isInitialized.value = true
      return response.data
    } catch (error) {
      clearAuth()
      throw error
    }
  }

  /** 获取当前用户信息 */
  async function fetchUser() {
    try {
      const response = await authApi.getMe()
      user.value = response.data.data
      return response.data
    } catch {
      clearAuth()
      throw new Error('获取用户信息失败')
    }
  }

  /** 登出 */
  async function logout() {
    try {
      await authApi.logout()
    } catch {
    } finally {
      clearAuth()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearAuth)
  }

  return {
    token,
    user,
    isLoggedIn,
    isInitialized,
    initAuth,
    login,
    register,
    sendRegisterCode,
    sendResetPasswordCode,
    resetPassword,
    consumeExternalToken,
    fetchUser,
    logout,
    setToken,
    clearAuth,
  }
})
