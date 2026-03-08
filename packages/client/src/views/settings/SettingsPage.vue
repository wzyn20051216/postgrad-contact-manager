<template>
  <div class="app-page settings-page">
    <n-page-header title="账号设置" subtitle="维护账号资料、安全信息与风险操作" />

    <n-card size="small" class="app-card">
      <div class="user-info-card">
        <n-avatar :size="56" round :src="authStore.user?.avatar || undefined">
          {{ userAvatarLetter }}
        </n-avatar>
        <div class="user-info-main">
          <div class="user-info-name">{{ userDisplayName }}</div>
          <div class="text-sm text-gray-600">邮箱：{{ authStore.user?.email || '-' }}</div>
          <div class="text-sm text-gray-600">昵称：{{ authStore.user?.nickname || '-' }}</div>
        </div>
      </div>
    </n-card>

    <n-grid cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
      <n-gi>
        <n-card title="个人信息" size="small" class="app-card">
          <n-form
            ref="profileFormRef"
            :model="profileFormModel"
            :rules="profileFormRules"
            label-placement="top"
          >
            <n-form-item label="昵称" path="nickname">
              <n-input
                v-model:value="profileFormModel.nickname"
                placeholder="请输入昵称"
                maxlength="30"
                clearable
              />
            </n-form-item>

            <n-form-item label="头像 URL（可选）" path="avatar">
              <n-input
                v-model:value="profileFormModel.avatar"
                placeholder="请输入头像链接（可选）"
                clearable
              />
            </n-form-item>

            <n-button
              type="primary"
              :loading="profileSaving"
              :disabled="profileSaving"
              @click="handleUpdateProfile"
            >
              保存
            </n-button>
          </n-form>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card title="修改密码" size="small" class="app-card">
          <n-form
            ref="passwordFormRef"
            :model="passwordFormModel"
            :rules="passwordFormRules"
            label-placement="top"
          >
            <n-form-item label="旧密码" path="oldPassword">
              <n-input
                v-model:value="passwordFormModel.oldPassword"
                type="password"
                show-password-on="click"
                placeholder="请输入旧密码"
              />
            </n-form-item>

            <n-form-item label="新密码" path="newPassword">
              <n-input
                v-model:value="passwordFormModel.newPassword"
                type="password"
                show-password-on="click"
                placeholder="请输入新密码"
              />
            </n-form-item>

            <n-form-item label="确认新密码" path="confirmPassword">
              <n-input
                v-model:value="passwordFormModel.confirmPassword"
                type="password"
                show-password-on="click"
                placeholder="请再次输入新密码"
              />
            </n-form-item>

            <n-divider />

            <n-button
              type="primary"
              :loading="passwordSaving"
              :disabled="passwordSaving"
              @click="handleUpdatePassword"
            >
              保存
            </n-button>
          </n-form>
        </n-card>
      </n-gi>

      <n-gi span="1 m:2">
        <n-card title="危险操作" size="small" class="app-card">
          <n-space vertical size="small">
            <div class="text-sm text-gray-600">
              注销后账号不可恢复，所有关联数据将被永久删除。
            </div>

            <n-popconfirm
              v-model:show="deleteConfirmVisible"
              positive-text="确认注销"
              negative-text="取消"
              :positive-button-props="{ loading: deleteLoading }"
              @positive-click="handleDeleteAccount"
              @negative-click="handleDeleteCancel"
            >
              <template #trigger>
                <n-button type="error">注销账号</n-button>
              </template>

              <template #default>
                <div class="delete-confirm-content">
                  <div>请输入「确认注销」后再继续</div>
                  <n-input
                    v-model:value="deleteConfirmText"
                    placeholder="请输入确认注销"
                    clearable
                  />
                </div>
              </template>
            </n-popconfirm>
          </n-space>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api'

const message = useMessage()
const router = useRouter()
const authStore = useAuthStore()

const profileFormRef = ref<FormInst | null>(null)
const passwordFormRef = ref<FormInst | null>(null)

const profileFormModel = reactive({
  nickname: '',
  avatar: '',
})

const passwordFormModel = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const profileFormRules: FormRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: ['input', 'blur'] },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '请输入昵称',
      trigger: ['blur'],
    },
  ],
}

const passwordFormRules: FormRules = {
  oldPassword: [
    { required: true, message: '请输入旧密码', trigger: ['input', 'blur'] },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: ['input', 'blur'] },
    { min: 6, message: '新密码至少 6 位', trigger: ['input', 'blur'] },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: ['input', 'blur'] },
    {
      validator: (_rule, value: string) => value === passwordFormModel.newPassword,
      message: '两次输入的新密码不一致',
      trigger: ['input', 'blur'],
    },
  ],
}

const userDisplayName = computed(() => {
  const nickname = authStore.user?.nickname?.trim()
  return nickname || authStore.user?.email || '-'
})

const userAvatarLetter = computed(() => {
  const source = authStore.user?.nickname?.trim() || authStore.user?.email?.trim() || '?'
  return source.slice(0, 1).toUpperCase()
})

const deleteConfirmVisible = ref(false)
const deleteConfirmText = ref('')

const profileSaving = ref(false)
const passwordSaving = ref(false)
const deleteLoading = ref(false)

function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

function syncProfileForm() {
  profileFormModel.nickname = authStore.user?.nickname ?? ''
  profileFormModel.avatar = authStore.user?.avatar ?? ''
}

async function initPageData() {
  if (!authStore.user) {
    try {
      await authStore.fetchUser()
    } catch {
      return
    }
  }
  syncProfileForm()
}

async function handleUpdateProfile() {
  if (profileSaving.value) {
    return
  }

  try {
    await profileFormRef.value?.validate()
  } catch {
    return
  }

  const profilePayload: { nickname?: string; avatar?: string } = {}
  const trimmedNickname = profileFormModel.nickname.trim()
  const trimmedAvatar = profileFormModel.avatar.trim()

  if (trimmedNickname) {
    profilePayload.nickname = trimmedNickname
  }
  if (trimmedAvatar) {
    profilePayload.avatar = trimmedAvatar
  }

  if (!profilePayload.nickname && !profilePayload.avatar) {
    message.warning('请至少填写昵称或头像 URL')
    return
  }

  profileSaving.value = true
  try {
    await authApi.updateProfile(profilePayload)
    await authStore.fetchUser()
    syncProfileForm()
    message.success('个人信息保存成功')
  } catch (error) {
    message.error(getApiErrorMessage(error, '保存个人信息失败'))
  } finally {
    profileSaving.value = false
  }
}

async function handleUpdatePassword() {
  if (passwordSaving.value) {
    return
  }

  try {
    await passwordFormRef.value?.validate()
  } catch {
    return
  }

  const oldValue = passwordFormModel.oldPassword.trim()
  const newValue = passwordFormModel.newPassword.trim()
  const confirmValue = passwordFormModel.confirmPassword.trim()

  if (!oldValue || !newValue || !confirmValue) {
    message.warning('请完整填写密码信息')
    return
  }

  if (newValue !== confirmValue) {
    message.error('两次输入的新密码不一致')
    return
  }

  passwordSaving.value = true
  try {
    const response = await authApi.updatePassword({
      oldPassword: oldValue,
      newPassword: newValue,
    })

    if (response.data.data?.token) {
      authStore.setToken(response.data.data.token)
    }

    passwordFormModel.oldPassword = ''
    passwordFormModel.newPassword = ''
    passwordFormModel.confirmPassword = ''
    passwordFormRef.value?.restoreValidation()
    message.success('密码修改成功，当前登录状态已自动刷新')
  } catch (error) {
    message.error(getApiErrorMessage(error, '修改密码失败'))
  } finally {
    passwordSaving.value = false
  }
}

function handleDeleteCancel() {
  deleteConfirmText.value = ''
}

async function handleDeleteAccount() {
  if (deleteLoading.value) {
    return false
  }

  if (deleteConfirmText.value.trim() !== '确认注销') {
    message.error('请输入「确认注销」以继续')
    return false
  }

  deleteLoading.value = true
  try {
    await authApi.deleteAccount()
    authStore.clearAuth()
    localStorage.removeItem('token')
    deleteConfirmVisible.value = false
    deleteConfirmText.value = ''
    message.success('账号已注销')
    await router.replace('/login')
    return true
  } catch (error) {
    message.error(getApiErrorMessage(error, '注销账号失败'))
    return false
  } finally {
    deleteLoading.value = false
  }
}

onMounted(() => {
  void initPageData()
})
</script>

<style scoped>
.settings-page {
  gap: 14px;
}

.user-info-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-info-name {
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
}

.delete-confirm-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 260px;
}
</style>
