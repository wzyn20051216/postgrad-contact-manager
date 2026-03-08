<template>
  <div class="auth-page">
    <section class="auth-showcase">
      <div class="showcase-orbit showcase-orbit--outer" />
      <div class="showcase-orbit showcase-orbit--inner" />

      <div class="showcase-content">
        <div class="showcase-logo">
          <span class="showcase-logo__icon">TC</span>
          <div>
            <p class="showcase-logo__title">套磁管理系统</p>
            <p class="showcase-logo__subtitle">Postgrad Contact Manager</p>
          </div>
        </div>

        <h1 class="showcase-title">快速找回账号访问权，继续推进你的保研节奏</h1>
        <p class="showcase-slogan">
          通过邮箱验证码安全重置密码，不打断资料整理、导师联系和进度跟踪。
        </p>

        <div class="showcase-grid">
          <div class="showcase-grid__item">
            <span class="showcase-grid__label">安全验证</span>
            <strong class="showcase-grid__value">邮箱验证码</strong>
          </div>
          <div class="showcase-grid__item">
            <span class="showcase-grid__label">恢复时长</span>
            <strong class="showcase-grid__value">几分钟完成</strong>
          </div>
          <div class="showcase-grid__item">
            <span class="showcase-grid__label">适用场景</span>
            <strong class="showcase-grid__value">忘记密码 / 换设备</strong>
          </div>
        </div>
      </div>

      <p class="showcase-domain">your-domain.example</p>
    </section>

    <section class="auth-form-panel">
      <div class="auth-card">
        <p class="auth-card__eyebrow">RESET PASSWORD</p>
        <h2 class="auth-card__title">重置密码</h2>
        <p class="auth-card__subtitle">输入注册邮箱与验证码，立即设置一个新的登录密码。</p>

        <n-form
          ref="formRef"
          class="auth-form"
          :model="formData"
          :rules="rules"
          label-placement="top"
          @submit.prevent="handleResetPassword"
        >
          <n-form-item label="邮箱" path="email">
            <n-input v-model:value="formData.email" placeholder="请输入注册邮箱地址" />
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
                @click="handleSendResetCode"
              >
                {{ resendCountdown > 0 ? `${resendCountdown}s 后重发` : '发送验证码' }}
              </n-button>
            </div>
          </n-form-item>
          <n-form-item label="新密码" path="newPassword">
            <n-input
              v-model:value="formData.newPassword"
              type="password"
              show-password-on="click"
              placeholder="请输入新的登录密码"
            />
          </n-form-item>
          <n-form-item label="确认新密码" path="confirmPassword">
            <n-input
              v-model:value="formData.confirmPassword"
              type="password"
              show-password-on="click"
              placeholder="请再次输入新的登录密码"
            />
          </n-form-item>

          <n-alert class="auth-tip" type="info" :show-icon="false">
            验证码默认 10 分钟内有效；若当前为本地开发环境，系统会直接提示调试验证码。
          </n-alert>

          <n-button
            class="auth-submit-btn"
            type="primary"
            block
            attr-type="submit"
            :loading="loading"
            :disabled="loading || sendCodeLoading"
          >
            立即重置密码
          </n-button>
        </n-form>

        <div class="auth-link-actions">
          <n-button text type="primary" @click="router.push('/login')">
            返回登录
          </n-button>
          <n-button text @click="router.push('/register')">
            没有账号？去注册
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
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const sendCodeLoading = ref(false)
const resendCountdown = ref(0)
let countdownTimer: number | null = null

const formData = reactive({
  email: '',
  verificationCode: '',
  newPassword: '',
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
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少6个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) => {
        if (value !== formData.newPassword) {
          return new Error('两次输入的新密码不一致')
        }
        return true
      },
      trigger: 'blur',
    },
  ],
}

/**
 * @description 启动验证码倒计时。
 * @param seconds 倒计时秒数
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
 * @description 发送重置密码验证码。
 */
async function handleSendResetCode() {
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
    const result = await authStore.sendResetPasswordCode(formData.email)
    startCountdown(result.data.cooldownSeconds)
    message.success('如该邮箱已注册，验证码已发送，请前往邮箱查收')
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
 * @description 提交重置密码表单。
 */
async function handleResetPassword() {
  if (loading.value || sendCodeLoading.value) {
    return
  }

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await authStore.resetPassword(formData.email, formData.verificationCode, formData.newPassword)
    message.success('密码重置成功，请使用新密码登录')
    await router.push('/login')
  } catch (error: unknown) {
    const errorMessage =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message || '密码重置失败'
    message.error(errorMessage)
  } finally {
    loading.value = false
  }
}

/**
 * @description 初始化邮箱默认值。
 */
function hydrateEmailFromQuery() {
  if (typeof route.query.email === 'string') {
    formData.email = route.query.email.trim()
  }
}

onMounted(() => {
  hydrateEmailFromQuery()
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
  background: linear-gradient(160deg, #f6f9ff 0%, #eef4ff 48%, #eef9f4 100%);
}

.auth-showcase {
  width: 54%;
  min-height: 100vh;
  padding: 54px 56px 42px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(155deg, #255df6 0%, #4f7dff 44%, #2fb187 100%);
}

.showcase-orbit {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  pointer-events: none;
}

.showcase-orbit--outer {
  width: 520px;
  height: 520px;
  top: -200px;
  right: -220px;
}

.showcase-orbit--inner {
  width: 340px;
  height: 340px;
  right: -80px;
  top: 80px;
}

.showcase-content {
  position: relative;
  z-index: 1;
  max-width: 520px;
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

.showcase-grid {
  margin-top: 34px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.showcase-grid__item {
  padding: 16px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.showcase-grid__label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
}

.showcase-grid__value {
  display: block;
  margin-top: 8px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
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
  max-width: 436px;
  padding: 34px 32px 28px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.82);
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

.verify-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  width: 100%;
}

.verify-code-btn {
  min-width: 128px;
}

.auth-tip {
  margin: 6px 0 12px;
  border-radius: 14px;
}

.auth-submit-btn {
  margin-top: 4px;
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
}

.auth-link-actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-link-actions :deep(.n-button) {
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 980px) {
  .auth-showcase {
    width: 50%;
    padding: 44px 34px 36px;
  }

  .showcase-grid {
    grid-template-columns: 1fr;
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

  .auth-link-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
