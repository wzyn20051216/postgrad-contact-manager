<template>
  <div class="auth-page">
    <section class="auth-showcase">
      <div class="showcase-ring showcase-ring--outer" />
      <div class="showcase-ring showcase-ring--inner" />

      <div class="showcase-content">
        <div class="showcase-logo">
          <span class="showcase-logo__icon">TC</span>
          <div>
            <p class="showcase-logo__title">套磁管理系统</p>
            <p class="showcase-logo__subtitle">Postgrad Contact Manager</p>
          </div>
        </div>

        <h1 class="showcase-title">从第一封邮件开始，建立你的可持续套磁系统</h1>
        <p class="showcase-slogan">
          注册后即可统一管理导师库、跟进动作与结果复盘，让每一步都留痕可追溯。
        </p>

        <div class="showcase-list">
          <div class="showcase-list__item">统一导师档案，支持标签分组筛选</div>
          <div class="showcase-list__item">看板拖拽推进状态，效率更高</div>
          <div class="showcase-list__item">模板与提醒联动，降低遗漏风险</div>
        </div>
      </div>

      <p class="showcase-domain">your-domain.example</p>
    </section>

    <section class="auth-form-panel">
      <div class="auth-card">
        <p class="auth-card__eyebrow">CREATE ACCOUNT</p>
        <h2 class="auth-card__title">创建账号</h2>
        <p class="auth-card__subtitle">开始管理你的套磁进度，建立清晰可控的联系节奏。</p>

        <n-form
          ref="formRef"
          class="auth-form"
          :model="formData"
          :rules="rules"
          label-placement="top"
          @submit.prevent="handleRegister"
        >
          <n-form-item label="邮箱" path="email">
            <n-input v-model:value="formData.email" placeholder="请输入邮箱地址" />
          </n-form-item>
          <n-form-item label="邮箱验证码" path="verificationCode">
            <div class="verify-code-row">
              <n-input
                v-model:value="formData.verificationCode"
                maxlength="6"
                placeholder="请输入 6 位验证码"
              />
              <n-button
                class="verify-code-btn"
                secondary
                :loading="sendCodeLoading"
                :disabled="sendCodeLoading || loading || resendCountdown > 0"
                @click="handleSendRegisterCode"
              >
                {{ resendCountdown > 0 ? `${resendCountdown}s 后重发` : '发送验证码' }}
              </n-button>
            </div>
          </n-form-item>
          <n-form-item label="昵称" path="nickname">
            <n-input v-model:value="formData.nickname" placeholder="请输入昵称（可选）" />
          </n-form-item>
          <n-form-item label="密码" path="password">
            <n-input
              v-model:value="formData.password"
              type="password"
              show-password-on="click"
              placeholder="请输入登录密码"
            />
          </n-form-item>
          <n-form-item label="确认密码" path="confirmPassword">
            <n-input
              v-model:value="formData.confirmPassword"
              type="password"
              show-password-on="click"
              placeholder="请再次输入密码"
            />
          </n-form-item>
          <n-button
            class="auth-submit-btn"
            type="primary"
            block
            attr-type="submit"
            :loading="loading"
            :disabled="loading || sendCodeLoading"
          >
            立即注册
          </n-button>
        </n-form>

        <div class="auth-divider"><span>或</span></div>

        <n-button
          class="auth-oauth-btn"
          block
          secondary
          :disabled="loading || sendCodeLoading"
          @click="handleGithubRegister"
        >
          使用 GitHub 一键注册 / 登录
        </n-button>
        <p class="auth-helper-text">邮箱注册需验证码校验，GitHub 注册会自动读取已验证邮箱。</p>

        <div class="auth-link-row">
          已有账号？
          <n-button text type="primary" @click="router.push('/login')">
            去登录
          </n-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()
const loading = ref(false)
const sendCodeLoading = ref(false)
const resendCountdown = ref(0)
const formRef = ref<FormInst | null>(null)
let countdownTimer: number | null = null

const formData = reactive({
  email: '',
  verificationCode: '',
  nickname: '',
  password: '',
  confirmPassword: '',
})

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  verificationCode: [
    { required: true, message: '请输入邮箱验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '请输入 6 位数字验证码', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => {
        if (value !== formData.password) {
          return new Error('两次输入的密码不一致')
        }
        return true
      },
      trigger: 'blur',
    },
  ],
}

async function handleRegister() {
  if (loading.value || sendCodeLoading.value) return

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await authStore.register(
      formData.email,
      formData.password,
      formData.verificationCode,
      formData.nickname || undefined
    )
    message.success('注册成功')
    await router.push('/dashboard')
  } catch (error: unknown) {
    const errorMessage =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message || '注册失败'
    message.error(errorMessage)
  } finally {
    loading.value = false
  }
}

/**
 * @description 启动验证码倒计时。
 * @param seconds 秒数
 */
function startCountdown(seconds: number) {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }

  resendCountdown.value = seconds
  countdownTimer = window.setInterval(() => {
    if (resendCountdown.value <= 1) {
      resendCountdown.value = 0
      if (countdownTimer !== null) {
        window.clearInterval(countdownTimer)
        countdownTimer = null
      }
      return
    }

    resendCountdown.value -= 1
  }, 1000)
}

/**
 * @description 发送邮箱注册验证码。
 */
async function handleSendRegisterCode() {
  if (sendCodeLoading.value || loading.value || resendCountdown.value > 0) {
    return
  }

  if (!formData.email) {
    message.warning('请先输入邮箱地址')
    return
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(formData.email)) {
    message.warning('请输入有效的邮箱地址')
    return
  }

  sendCodeLoading.value = true
  try {
    const result = await authStore.sendRegisterCode(formData.email)
    startCountdown(result.data.cooldownSeconds)
    message.success('验证码已发送，请前往邮箱查收')
    if (result.data.debugCode) {
      message.info(`当前为本地调试模式，验证码：${result.data.debugCode}`)
    }
  } catch (error: unknown) {
    const errorMessage =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message || '验证码发送失败'
    message.error(errorMessage)
  } finally {
    sendCodeLoading.value = false
  }
}

/**
 * @description 发起 GitHub 注册/登录。
 */
function handleGithubRegister() {
  if (loading.value || sendCodeLoading.value) {
    return
  }

  window.location.assign(authApi.buildGithubAuthorizeUrl('register', '/dashboard'))
}

/**
 * @description 处理来自 OAuth 的错误提示。
 */
async function handleOauthErrorFromQuery() {
  const authError = typeof route.query.authError === 'string' ? route.query.authError : ''
  if (!authError) {
    return
  }

  message.error(authError)
  await router.replace('/register')
}

onMounted(() => {
  void handleOauthErrorFromQuery()
})

onBeforeUnmount(() => {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<style scoped>
.auth-page {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(158deg, #f5f8ff 0%, #edf3ff 48%, #ecfaf4 100%);
}

.auth-showcase {
  width: 54%;
  min-height: 100vh;
  padding: 52px 54px 42px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(152deg, #236af8 0%, #5589ff 44%, #37b58d 100%);
}

.showcase-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.showcase-ring--outer {
  width: 460px;
  height: 460px;
  top: -180px;
  right: -180px;
}

.showcase-ring--inner {
  width: 320px;
  height: 320px;
  right: -110px;
  top: -110px;
}

.showcase-content {
  max-width: 520px;
  position: relative;
  z-index: 1;
}

.showcase-logo {
  margin-bottom: 34px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.showcase-logo__icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.showcase-logo__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.showcase-logo__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
  letter-spacing: 0.04em;
}

.showcase-title {
  margin: 0;
  font-size: 36px;
  line-height: 1.22;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.showcase-slogan {
  margin: 18px 0 0;
  font-size: 16px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.9);
}

.showcase-list {
  margin-top: 34px;
  display: grid;
  gap: 10px;
}

.showcase-list__item {
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.showcase-domain {
  margin: 0;
  position: relative;
  z-index: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.06em;
}

.auth-form-panel {
  width: 46%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 24px;
}

.auth-card {
  width: 100%;
  max-width: 430px;
  padding: 32px 32px 28px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 22px 54px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.auth-card__eyebrow {
  margin: 0;
  font-size: 12px;
  color: #3a7bff;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.auth-card__title {
  margin: 10px 0 0;
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
}

.auth-card__subtitle {
  margin: 10px 0 22px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.auth-form :deep(.n-form-item-label__text) {
  color: #334155;
  font-size: 13px;
}

.auth-submit-btn {
  margin-top: 8px;
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
}

.auth-link-row {
  margin-top: 16px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

.auth-link-row :deep(.n-button) {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 600;
}

.verify-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  width: 100%;
}

.verify-code-btn {
  min-width: 128px;
}

.auth-divider {
  margin: 18px 0 14px;
  position: relative;
  text-align: center;
}

.auth-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid rgba(148, 163, 184, 0.24);
}

.auth-divider span {
  position: relative;
  z-index: 1;
  display: inline-block;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.9);
  color: #94a3b8;
  font-size: 12px;
}

.auth-oauth-btn {
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
}

.auth-helper-text {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
  text-align: center;
}

@media (max-width: 980px) {
  .auth-showcase {
    width: 50%;
    padding: 44px 34px 36px;
  }

  .auth-form-panel {
    width: 50%;
  }
}

@media (max-width: 820px) {
  .auth-showcase {
    display: none;
  }

  .auth-form-panel {
    width: 100%;
    min-height: 100vh;
    padding: 20px;
  }

  .auth-card {
    max-width: 460px;
    padding: 30px 24px 24px;
  }

  .verify-code-row {
    grid-template-columns: 1fr;
  }

  .verify-code-btn {
    width: 100%;
  }
}
</style>
