<template>
  <div class="auth-page">
    <section class="auth-showcase">
      <div class="showcase-glow showcase-glow--top" />
      <div class="showcase-glow showcase-glow--bottom" />

      <div class="showcase-content">
        <div class="showcase-logo">
          <span class="showcase-logo__icon">TC</span>
          <div>
            <p class="showcase-logo__title">套磁管理系统</p>
            <p class="showcase-logo__subtitle">Postgrad Contact Manager</p>
          </div>
        </div>

        <h1 class="showcase-title">把套磁流程变成可量化、可复盘的增长路径</h1>
        <p class="showcase-slogan">
          从导师池、文书资料到提醒节点，统一在一个工作台推进，减少遗漏、提升命中率。
        </p>

        <div class="showcase-metrics">
          <div class="metric-item">
            <span class="metric-item__value">导师档案</span>
            <span class="metric-item__label">全周期状态追踪</span>
          </div>
          <div class="metric-item">
            <span class="metric-item__value">面试节奏</span>
            <span class="metric-item__label">多节点提醒同步</span>
          </div>
          <div class="metric-item">
            <span class="metric-item__value">模板资产</span>
            <span class="metric-item__label">复用高质量沟通策略</span>
          </div>
        </div>
      </div>

      <div class="showcase-domain">your-domain.example</div>
    </section>

    <section class="auth-form-panel">
      <div class="auth-card">
        <p class="auth-card__eyebrow">WELCOME BACK</p>
        <h2 class="auth-card__title">欢迎回来</h2>
        <p class="auth-card__subtitle">登录你的账号，继续推进今天的联系计划。</p>

        <n-form
          ref="formRef"
          class="auth-form"
          :model="formData"
          :rules="rules"
          label-placement="top"
          @submit.prevent="handleLogin"
        >
          <n-form-item label="邮箱" path="email">
            <n-input
              v-model:value="formData.email"
              placeholder="请输入邮箱地址"
            />
          </n-form-item>
          <n-form-item label="密码" path="password">
            <n-input
              v-model:value="formData.password"
              type="password"
              show-password-on="click"
              placeholder="请输入登录密码"
            />
          </n-form-item>
          <div class="auth-assist-row">
            <span class="auth-assist-row__text">支持邮箱验证码找回密码</span>
            <n-button
              text
              type="primary"
              @click="router.push({ path: '/reset-password', query: formData.email ? { email: formData.email } : undefined })"
            >
              忘记密码？
            </n-button>
          </div>
          <n-button
            class="auth-submit-btn"
            type="primary"
            block
            attr-type="submit"
            :loading="loading"
            :disabled="loading || oauthLoading"
          >
            登录
          </n-button>
        </n-form>

        <div class="auth-divider"><span>或</span></div>

        <n-button
          class="auth-oauth-btn"
          block
          secondary
          :loading="oauthLoading"
          :disabled="loading || oauthLoading"
          @click="handleGithubLogin"
        >
          使用 GitHub 继续
        </n-button>
        <p class="auth-helper-text">支持 GitHub 一键登录 / 注册，并自动绑定同邮箱账号。</p>

        <div class="auth-link-row">
          还没有账号？
          <n-button text type="primary" @click="router.push('/register')">
            立即注册
          </n-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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
const oauthLoading = ref(false)
const formRef = ref<FormInst | null>(null)

const formData = reactive({
  email: '',
  password: '',
})

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
}

async function handleLogin() {
  if (loading.value || oauthLoading.value) return

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await authStore.login(formData.email, formData.password)
    message.success('登录成功')
    await router.push('/dashboard')
  } catch (error: unknown) {
    const errorMessage =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message || '登录失败'
    message.error(errorMessage)
  } finally {
    loading.value = false
  }
}

/**
 * @description 发起 GitHub 登录。
 */
function handleGithubLogin() {
  if (loading.value || oauthLoading.value) {
    return
  }

  window.location.assign(authApi.buildGithubAuthorizeUrl('login', '/dashboard'))
}

/**
 * @description 处理 GitHub OAuth 回跳参数。
 */
async function handleOauthCallbackFromQuery() {
  const externalToken = typeof route.query.token === 'string' ? route.query.token : ''
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
  const authError = typeof route.query.authError === 'string' ? route.query.authError : ''
  const provider = typeof route.query.provider === 'string' ? route.query.provider : ''

  if (authError) {
    message.error(authError)
    await router.replace('/login')
    return
  }

  if (!externalToken) {
    return
  }

  oauthLoading.value = true
  try {
    await authStore.consumeExternalToken(externalToken)
    message.success(provider === 'github' ? 'GitHub 登录成功' : '登录成功')
    await router.replace(redirect.startsWith('/') ? redirect : '/dashboard')
  } catch (error: unknown) {
    const errorMessage =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message || '第三方登录失败'
    message.error(errorMessage)
    await router.replace('/login')
  } finally {
    oauthLoading.value = false
  }
}

onMounted(() => {
  void handleOauthCallbackFromQuery()
})
</script>

<style scoped>
.auth-page {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(160deg, #f6f9ff 0%, #eef5ff 46%, #edf8f3 100%);
}

.auth-showcase {
  width: 56%;
  min-height: 100vh;
  padding: 52px 56px 42px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(155deg, #1f68f8 0%, #3d8dff 46%, #31b68b 100%);
}

.showcase-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(54px);
  opacity: 0.55;
  pointer-events: none;
}

.showcase-glow--top {
  width: 360px;
  height: 360px;
  top: -120px;
  right: -140px;
  background: rgba(255, 255, 255, 0.45);
}

.showcase-glow--bottom {
  width: 320px;
  height: 320px;
  left: -120px;
  bottom: -160px;
  background: rgba(22, 196, 140, 0.52);
}

.showcase-content {
  position: relative;
  z-index: 1;
  max-width: 520px;
}

.showcase-logo {
  margin-bottom: 36px;
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
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.28);
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
  font-size: 38px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.showcase-slogan {
  margin: 18px 0 0;
  font-size: 16px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.88);
}

.showcase-metrics {
  margin-top: 36px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  padding: 14px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.metric-item__value {
  display: block;
  font-size: 14px;
  font-weight: 700;
}

.metric-item__label {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.84);
}

.showcase-domain {
  position: relative;
  z-index: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.76);
  letter-spacing: 0.06em;
}

.auth-form-panel {
  width: 44%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  padding: 32px 24px;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 34px 32px 30px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.78);
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
  margin: 12px 0 0;
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.auth-card__subtitle {
  margin: 10px 0 26px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.auth-form :deep(.n-form-item-label__text) {
  color: #334155;
  font-size: 13px;
}

.auth-form :deep(.n-input .n-input__input-el) {
  font-size: 14px;
}

.auth-submit-btn {
  margin-top: 6px;
  height: 44px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
}

.auth-assist-row {
  margin: -4px 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
}

.auth-assist-row__text {
  line-height: 1.6;
}

.auth-link-row {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.auth-link-row :deep(.n-button) {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 600;
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
    padding: 42px 34px 36px;
  }

  .showcase-metrics {
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
    padding: 30px 24px 26px;
  }
}
</style>
