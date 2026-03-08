<template>
  <div class="app-page school-search-page">
    <div class="app-page-header">
      <n-page-header
        title="院校信息检索"
        subtitle="输入学校名称，自动汇总官网/招生页中的导师与联系方式线索"
      />
      <n-space>
        <n-tag :bordered="false" type="info" round>支持官方源库增强</n-tag>
        <n-button secondary @click="handleOpenSourceLibrary">维护官方源库</n-button>
      </n-space>
    </div>

    <n-card class="app-card">
      <div class="school-search-form">
        <n-input
          v-model:value="formModel.schoolName"
          placeholder="例如：清华大学、浙江大学、北京航空航天大学"
          clearable
          maxlength="80"
          class="school-search-form__input school-search-form__input--school"
          @keyup.enter="handleSearch"
        />
        <n-input
          v-model:value="formModel.focus"
          placeholder="关注关键词（可选）"
          clearable
          maxlength="80"
          class="school-search-form__input school-search-form__input--focus"
          @keyup.enter="handleSearch"
        />
        <n-select
          v-model:value="formModel.maxSources"
          :options="maxSourceOptions"
          class="school-search-form__select"
        />
        <n-button
          type="primary"
          :loading="loading"
          class="school-search-form__submit"
          @click="handleSearch"
        >
          立即检索
        </n-button>
      </div>
      <n-alert type="info" :show-icon="false" class="school-search-tips">
        数据来自公开网页抓取结果，请以高校官网原文为准。建议优先查看标记为“教育站点”的来源；若是冷门学校或结果不稳定，可前往“官方源库”补齐学校官网与研究生院入口。
      </n-alert>
    </n-card>

    <n-card v-if="searchResult" class="app-card school-search-meta-card">
      <n-space align="center" wrap>
        <n-tag :bordered="false" type="info">查询：{{ searchResult.query }}</n-tag>
        <n-tag :bordered="false" type="success">来源：{{ searchResult.totalSources }}</n-tag>
        <n-tag :bordered="false" :type="searchResult.fromCache ? 'warning' : 'default'">
          {{ searchResult.fromCache ? '命中缓存' : '实时抓取' }}
        </n-tag>
        <span class="school-search-meta-card__time">
          更新时间：{{ formatDateTime(searchResult.fetchedAt) }}
        </span>
      </n-space>
    </n-card>

    <n-spin :show="loading">
      <n-card class="app-card">
        <n-empty
          v-if="!loading && !searchResult"
          description="输入学校后开始检索，结果会附带可追溯来源链接"
          class="app-empty"
        />

        <n-empty
          v-else-if="!loading && sourceList.length === 0"
          description="未检索到可用来源，请尝试补充学院名或研究方向关键词"
          class="app-empty"
        />

        <div v-else class="school-search-results">
          <div
            v-for="(source, index) in sourceList"
            :key="`${source.url}-${index}`"
            class="school-search-source"
          >
            <div class="school-search-source__header">
              <div class="school-search-source__title-group">
                <div class="school-search-source__title-row">
                  <span class="school-search-source__index">{{ index + 1 }}</span>
                  <span class="school-search-source__domain">{{ source.domain || formatDomain(source.url) }}</span>
                </div>
                <a
                  :href="source.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="school-search-source__title"
                >
                  {{ source.title || source.url }}
                </a>
                <n-space size="small" wrap>
                  <n-tag size="small" :type="source.isOfficial ? 'success' : 'default'" :bordered="false">
                    {{ source.isOfficial ? '教育站点' : '普通站点' }}
                  </n-tag>
                  <n-tag size="small" :type="getQualityTagType(source.quality)" :bordered="false">
                    {{ getQualityLabel(source.quality) }}
                  </n-tag>
                </n-space>
              </div>
              <n-button text type="primary" @click="openSource(source.url)">打开来源</n-button>
            </div>

            <div class="school-search-source__summary">{{ source.summary }}</div>
            <div v-if="source.snippet" class="school-search-source__snippet">搜索摘录：{{ source.snippet }}</div>

            <div v-if="source.mentorHints.length > 0" class="school-search-source__section">
              <div class="school-search-source__section-title">导师线索</div>
              <ul class="school-search-source__list">
                <li v-for="(hint, hintIndex) in source.mentorHints" :key="`hint-${hintIndex}`">{{ hint }}</li>
              </ul>
            </div>

            <div v-if="source.emails.length > 0" class="school-search-source__section">
              <div class="school-search-source__section-head">
                <span class="school-search-source__section-title">邮箱线索</span>
                <n-button text size="tiny" @click="handleCopyEmails(source.emails)">复制邮箱</n-button>
              </div>
              <n-space size="small" wrap>
                <n-tag
                  v-for="(email, emailIndex) in source.emails"
                  :key="`email-${emailIndex}`"
                  size="small"
                  :bordered="false"
                >
                  {{ email }}
                </n-tag>
              </n-space>
            </div>
          </div>
        </div>
      </n-card>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { schoolSearchApi, type SchoolSearchResult, type SchoolSearchSource } from '@/api'

interface SchoolSearchFormModel {
  schoolName: string
  focus: string
  maxSources: number
}

const router = useRouter()
const message = useMessage()
const loading = ref(false)
const searchResult = ref<SchoolSearchResult | null>(null)

const formModel = reactive<SchoolSearchFormModel>({
  schoolName: '',
  focus: '研究生院 导师 招生',
  maxSources: 5,
})

const maxSourceOptions = [
  { label: '返回 3 个来源', value: 3 },
  { label: '返回 5 个来源', value: 5 },
  { label: '返回 8 个来源', value: 8 },
]

const sourceList = computed<SchoolSearchSource[]>(() => searchResult.value?.sources ?? [])

/**
 * @description 提取接口错误信息
 * @param error 接口异常
 * @param fallback 默认提示
 * @returns 用户可读错误文案
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 格式化时间文本
 * @param value ISO 时间字符串
 * @returns 本地化时间
 */
function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN')
}

/**
 * @description 获取质量标签文案
 * @param quality 质量等级
 * @returns 标签文本
 */
function getQualityLabel(quality: SchoolSearchSource['quality']): string {
  if (quality === 'high') {
    return '高相关'
  }
  if (quality === 'medium') {
    return '中相关'
  }
  return '低相关'
}

/**
 * @description 获取质量标签类型
 * @param quality 质量等级
 * @returns Naive UI 标签类型
 */
function getQualityTagType(quality: SchoolSearchSource['quality']): 'success' | 'warning' | 'error' {
  if (quality === 'high') {
    return 'success'
  }
  if (quality === 'medium') {
    return 'warning'
  }
  return 'error'
}

/**
 * @description 从 URL 提取域名
 * @param url 来源地址
 * @returns 域名
 */
function formatDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return '-'
  }
}

/**
 * @description 打开来源链接
 * @param url 链接地址
 */
function openSource(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * @description 打开官方源库管理页
 */
function handleOpenSourceLibrary() {
  void router.push({ name: 'SchoolSources' })
}

/**
 * @description 复制邮箱列表
 * @param emails 邮箱数组
 */
async function handleCopyEmails(emails: string[]) {
  if (emails.length === 0) {
    return
  }

  try {
    await navigator.clipboard.writeText(emails.join('\n'))
    message.success('邮箱已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动复制')
  }
}

/**
 * @description 执行院校信息检索
 */
async function handleSearch() {
  const schoolName = formModel.schoolName.trim()
  if (schoolName.length < 2) {
    message.warning('请先输入至少2个字符的学校名称')
    return
  }

  loading.value = true
  try {
    const response = await schoolSearchApi.query({
      schoolName,
      focus: formModel.focus.trim() || undefined,
      maxSources: formModel.maxSources,
    })

    const payload = response.data as { data?: SchoolSearchResult } | undefined
    if (!payload?.data) {
      searchResult.value = null
      message.warning('未获取到可用结果，请稍后重试')
      return
    }

    searchResult.value = payload.data
    message.success(`检索完成，共 ${payload.data.totalSources} 个来源`)
  } catch (error) {
    message.error(getApiErrorMessage(error, '检索失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.school-search-page {
  gap: 14px;
}

.school-search-form {
  display: grid;
  grid-template-columns: minmax(280px, 1.5fr) minmax(220px, 1fr) 160px 120px;
  gap: 10px;
  align-items: center;
}

.school-search-form__input,
.school-search-form__select,
.school-search-form__submit {
  width: 100%;
}

.school-search-tips {
  margin-top: 12px;
}

.school-search-meta-card__time {
  font-size: 13px;
  color: #64748b;
}

.school-search-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.school-search-source {
  padding: 14px 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.school-search-source:hover {
  border-color: rgba(37, 99, 235, 0.24);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.school-search-source__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.school-search-source__title-group {
  min-width: 0;
}

.school-search-source__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.school-search-source__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.12);
}

.school-search-source__domain {
  font-size: 12px;
  color: #64748b;
  word-break: break-all;
}

.school-search-source__title {
  display: inline-block;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
  color: #1d4ed8;
  margin-bottom: 8px;
  word-break: break-word;
}

.school-search-source__title:hover {
  text-decoration: underline;
}

.school-search-source__summary {
  font-size: 14px;
  line-height: 1.7;
  color: #0f172a;
}

.school-search-source__snippet {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.school-search-source__section {
  margin-top: 10px;
}

.school-search-source__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.school-search-source__section-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.school-search-source__list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 1080px) {
  .school-search-form {
    grid-template-columns: 1fr;
  }
}
</style>
