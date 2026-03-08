<template>
  <div class="app-page school-source-page route-fade-up">
    <div class="app-page-header">
      <n-page-header
        title="学校 / 研究所官方源库"
        subtitle="像后台控制台一样管理研招单位官网、研究生院与招生入口，提升检索稳定性与命中率。"
      />
      <div class="school-source-header-actions">
        <n-tag round :bordered="false" type="info">即时筛选</n-tag>
        <n-tag round :bordered="false" :type="canManage ? 'success' : 'warning'">
          {{ canManage ? '管理员可编辑' : '只读模式' }}
        </n-tag>
        <n-button secondary @click="handleGoSearch">返回院校检索</n-button>
        <n-button v-if="canManage" type="primary" @click="handleOpenCreateModal">新增官方源</n-button>
      </div>
    </div>

    <div class="school-source-overview">
      <n-card class="app-card school-source-overview__main" :bordered="false">
        <div class="school-source-overview__badge">Official Source Console</div>
        <div class="school-source-overview__headline">
          <div>
            <h3 class="school-source-overview__title">把零散官网入口沉淀成可检索、可维护、可运营的官方源台账</h3>
            <p class="school-source-overview__description">
              本页优先服务冷门学校、研究所、研究生院子站与研招专题页。你看到的筛选与排序都是即时生效的，体验更接近成熟后台系统，而不是传统表格堆砌。
            </p>
          </div>
          <div class="school-source-overview__halo" />
        </div>
        <div class="school-source-overview__chips">
          <span v-for="item in heroChecklist" :key="item" class="app-chip school-source-overview__chip">
            {{ item }}
          </span>
        </div>
        <div class="school-source-overview__metrics">
          <div class="school-source-overview__metric">
            <div class="school-source-overview__metric-label">当前数据规模</div>
            <div class="school-source-overview__metric-value">{{ stats.totalSchools }} 个单位 / {{ stats.totalSources }} 条源</div>
          </div>
          <div class="school-source-overview__metric">
            <div class="school-source-overview__metric-label">即时结果</div>
            <div class="school-source-overview__metric-value">{{ filteredStats.totalRows }} 条命中 / {{ filteredStats.schoolCount }} 个单位</div>
          </div>
        </div>
      </n-card>

      <n-card class="app-card school-source-overview__side" :bordered="false">
        <div class="school-source-side__section">
          <div class="school-source-side__section-title">快速洞察</div>
          <div class="school-source-side__insight-grid">
            <div v-for="item in insightCards" :key="item.label" class="school-source-side__insight-card">
              <div class="school-source-side__insight-label">{{ item.label }}</div>
              <div class="school-source-side__insight-value">{{ item.value }}</div>
              <div class="school-source-side__insight-hint">{{ item.hint }}</div>
            </div>
          </div>
        </div>

        <div class="school-source-side__section">
          <div class="school-source-side__section-title">高频域名</div>
          <div class="school-source-side__domain-list">
            <button
              v-for="item in topDomains"
              :key="item.domain"
              type="button"
              class="school-source-side__domain-chip"
              @click="handleApplyDomain(item.domain)"
            >
              <span>{{ item.domain }}</span>
              <strong>{{ item.count }}</strong>
            </button>
            <div v-if="topDomains.length === 0" class="school-source-side__empty">暂无可展示的外部域名</div>
          </div>
        </div>

        <div class="school-source-side__section">
          <div class="school-source-side__section-title">快捷筛选</div>
          <div class="school-source-side__preset-list">
            <button
              v-for="preset in quickPresets"
              :key="preset.key"
              type="button"
              class="school-source-side__preset"
              @click="handleApplyPreset(preset.key)"
            >
              <span class="school-source-side__preset-title">{{ preset.label }}</span>
              <span class="school-source-side__preset-text">{{ preset.description }}</span>
            </button>
          </div>
        </div>
      </n-card>
    </div>

    <div class="school-source-stats">
      <n-card
        v-for="item in dashboardCards"
        :key="item.label"
        class="app-card school-source-stat-card"
        :bordered="false"
      >
        <div class="school-source-stat-card__head">
          <div class="school-source-stat-card__label">{{ item.label }}</div>
          <n-tag size="small" round :bordered="false" :type="item.tagType">{{ item.tag }}</n-tag>
        </div>
        <div class="school-source-stat-card__value">{{ item.value }}</div>
        <div class="school-source-stat-card__hint">{{ item.hint }}</div>
      </n-card>
    </div>

    <n-card class="app-card school-source-console" :bordered="false">
      <div class="school-source-console__header">
        <div>
          <div class="school-source-console__title">检索控制台</div>
          <div class="school-source-console__subtitle">关键词、状态、来源、类型、排序全部即时生效，适合高频排查与运营维护。</div>
        </div>
        <div class="school-source-console__actions">
          <span class="app-chip">当前命中 {{ filteredStats.totalRows }} 条</span>
          <n-button quaternary @click="handleResetFilters">清空筛选</n-button>
          <n-button :loading="loading" @click="handleRefresh">同步最新数据</n-button>
        </div>
      </div>

      <div class="school-source-console__grid">
        <div class="school-source-console__main">
          <div class="school-source-console__filters">
            <n-input
              v-model:value="filterModel.keyword"
              clearable
              maxlength="80"
              placeholder="搜索学校名 / 站点名 / 域名 / 描述"
              @keyup.enter="handleSearch"
            />
            <n-input
              v-model:value="filterModel.schoolName"
              clearable
              maxlength="80"
              placeholder="按学校或研究所名称过滤"
              @keyup.enter="handleSearch"
            />
            <n-select
              v-model:value="filterModel.kind"
              :options="kindOptions"
              placeholder="站点类型"
            />
            <n-select
              v-model:value="filterModel.sort"
              :options="sortOptions"
              placeholder="排序方式"
            />
          </div>

          <div class="school-source-console__switches">
            <div class="school-source-console__switch-block">
              <div class="school-source-console__switch-label">状态</div>
              <n-radio-group v-model:value="filterModel.status" size="small">
                <n-radio-button v-for="item in statusOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </n-radio-button>
              </n-radio-group>
            </div>
            <div class="school-source-console__switch-block">
              <div class="school-source-console__switch-label">来源</div>
              <n-radio-group v-model:value="filterModel.origin" size="small">
                <n-radio-button v-for="item in originOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </n-radio-button>
              </n-radio-group>
            </div>
            <div class="school-source-console__switch-block school-source-console__switch-block--compact">
              <div class="school-source-console__switch-label">紧凑表格</div>
              <n-switch v-model:value="tableModel.compact" />
            </div>
          </div>
        </div>

        <div class="school-source-console__aside">
          <div class="school-source-console__aside-title">推荐维护动作</div>
          <div class="school-source-console__aside-list">
            <div v-for="item in maintenanceTips" :key="item.title" class="school-source-console__aside-item">
              <div class="school-source-console__aside-item-title">{{ item.title }}</div>
              <div class="school-source-console__aside-item-text">{{ item.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </n-card>

    <n-alert v-if="!canManage" type="warning" :show-icon="false" class="school-source-alert">
      当前账号仅可查看官方源库。若要新增、编辑、停用或删除，请使用管理员账号登录。
    </n-alert>

    <n-card class="app-card school-source-results" :bordered="false">
      <div class="school-source-results__header">
        <div>
          <div class="school-source-results__title">结果列表</div>
          <div class="school-source-results__subtitle">
            按「{{ currentSortLabel }}」排序，当前展示 {{ pagedRows.length }} / {{ filteredStats.totalRows }} 条，覆盖 {{ filteredStats.schoolCount }} 个单位。
          </div>
        </div>
        <div class="school-source-results__controls">
          <n-select
            v-model:value="tableModel.pageSize"
            :options="pageSizeOptions"
            class="school-source-results__page-size"
          />
        </div>
      </div>

      <div v-if="activeFilterTags.length > 0" class="school-source-results__filters">
        <span v-for="item in activeFilterTags" :key="item" class="school-source-results__filter-tag">
          {{ item }}
        </span>
      </div>

      <n-spin :show="loading">
        <n-empty
          v-if="!loading && pagedRows.length === 0"
          class="app-empty"
          description="当前筛选条件下没有命中的官方源，建议放宽关键词或切换来源范围。"
        />

        <n-data-table
          v-else
          :class="['school-source-results__table', tableModel.compact && 'school-source-results__table--compact']"
          :columns="columns"
          :data="pagedRows"
          :row-key="(row: SchoolOfficialSourceItem) => row.id"
          :scroll-x="1420"
        />
      </n-spin>

      <div v-if="filteredStats.totalRows > tableModel.pageSize" class="school-source-results__pagination">
        <n-pagination
          v-model:page="tableModel.page"
          :page-size="tableModel.pageSize"
          :item-count="filteredStats.totalRows"
          :show-size-picker="false"
        />
      </div>
    </n-card>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editingSourceId ? '编辑官方源' : '新增官方源'"
      style="width: 820px"
      :mask-closable="false"
      @after-leave="handleModalAfterLeave"
    >
      <n-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <div class="school-source-form-grid">
          <n-form-item label="学校 / 研究所名称" path="schoolName">
            <n-input v-model:value="formModel.schoolName" maxlength="80" placeholder="例如：西藏大学 / 中国空间技术研究院(510所)" />
          </n-form-item>

          <n-form-item label="站点名称" path="siteName">
            <n-input v-model:value="formModel.siteName" maxlength="80" placeholder="例如：学校官网 / 研究生院 / 招生专题" />
          </n-form-item>

          <n-form-item class="school-source-form-grid__full" label="官方链接" path="baseUrl">
            <n-input
              v-model:value="formModel.baseUrl"
              maxlength="300"
              placeholder="支持直接输入域名，系统会自动补全 https://"
            />
          </n-form-item>

          <n-form-item label="优先级" path="priority">
            <n-input-number v-model:value="formModel.priority" :min="0" :max="999" style="width: 100%" />
          </n-form-item>

          <n-form-item label="启用状态" path="isActive">
            <n-switch v-model:value="formModel.isActive" />
          </n-form-item>

          <n-form-item class="school-source-form-grid__full" label="补充说明" path="description">
            <n-input
              v-model:value="formModel.description"
              type="textarea"
              maxlength="300"
              :autosize="{ minRows: 3, maxRows: 5 }"
              placeholder="例如：用于研招简章入口 / 联系方式页 / 导师目录页"
            />
          </n-form-item>
        </div>
      </n-form>

      <template #footer>
        <div class="school-source-modal-footer">
          <div class="school-source-modal-footer__hint">
            建议优先录入官网首页、研究生院与招生专题入口；优先级越高，检索时越容易被优先命中。
          </div>
          <n-space>
            <n-button @click="showModal = false">取消</n-button>
            <n-button type="primary" :loading="saving" @click="handleSubmit">保存</n-button>
          </n-space>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NTag,
  useDialog,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {
  schoolSourceApi,
  type SchoolOfficialSourceItem,
  type SchoolOfficialSourceListResult,
  type SchoolOfficialSourcePayload,
} from '@/api'

/** @description 状态筛选类型。 */
type SourceStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
/** @description 来源类型筛选。 */
type SourceOriginFilter = 'ALL' | 'OFFICIAL' | 'YZ'
/** @description 站点分类筛选。 */
type SourceKindFilter = 'ALL' | 'DETAIL' | 'HOMEPAGE' | 'GRADUATE' | 'PORTAL' | 'OTHER'
/** @description 排序模式。 */
type SortMode = 'SMART' | 'UPDATED' | 'PRIORITY' | 'SCHOOL'
/** @description 快捷预设键。 */
type QuickPresetKey = 'GRADUATE' | 'HOMEPAGE' | 'PORTAL' | 'OFFICIAL' | 'HIGH_PRIORITY' | 'DETAIL'

interface FilterModel {
  keyword: string
  schoolName: string
  status: SourceStatusFilter
  origin: SourceOriginFilter
  kind: SourceKindFilter
  sort: SortMode
}

interface SourceFormModel {
  schoolName: string
  siteName: string
  baseUrl: string
  description: string
  priority: number | null
  isActive: boolean
}

interface TableModel {
  page: number
  pageSize: number
  compact: boolean
}

interface InsightCard {
  label: string
  value: number | string
  hint: string
}

interface DashboardCard {
  label: string
  value: number | string
  hint: string
  tag: string
  tagType: 'default' | 'info' | 'success' | 'warning'
}

interface DomainCounter {
  domain: string
  count: number
}

interface QuickPreset {
  key: QuickPresetKey
  label: string
  description: string
}

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editingSourceId = ref<string | null>(null)
const sourceList = ref<SchoolOfficialSourceItem[]>([])
const canManage = ref(false)
const stats = ref<SchoolOfficialSourceListResult['stats']>({
  totalSources: 0,
  totalSchools: 0,
  activeSources: 0,
  inactiveSources: 0,
})

const heroChecklist = ['全国研招单位覆盖', '学校官网兜底', '研究生院优先', '招生专题定位', '线上热更新发布']
const maintenanceTips = [
  {
    title: '优先补齐官网首页',
    description: '官网首页是最稳的兜底入口，能显著降低冷门单位检索漂移。',
  },
  {
    title: '研究生院入口要单独录',
    description: '研究生院、招生网、联系方式页往往比学校首页更适合落地检索。',
  },
  {
    title: '描述写清使用场景',
    description: '如“研招简章入口”“导师目录页”，后续排查和批量维护会更快。',
  },
]
const quickPresets: QuickPreset[] = [
  { key: 'GRADUATE', label: '只看研究生院', description: '优先维护真正高价值入口' },
  { key: 'HOMEPAGE', label: '只看学校官网', description: '排查每个单位的基础兜底站点' },
  { key: 'PORTAL', label: '只看招生专题', description: '适合补齐研招公告、简章入口' },
  { key: 'OFFICIAL', label: '只看外部官网', description: '排除研招网详情页，专看真正外站' },
  { key: 'HIGH_PRIORITY', label: '只看高优先级', description: '快速审查最优先命中的站点' },
  { key: 'DETAIL', label: '只看研招网详情', description: '适合检查基础收录面是否完整' },
]

const filterModel = reactive<FilterModel>({
  keyword: '',
  schoolName: '',
  status: 'ALL',
  origin: 'ALL',
  kind: 'ALL',
  sort: 'SMART',
})

const formModel = reactive<SourceFormModel>({
  schoolName: '',
  siteName: '',
  baseUrl: '',
  description: '',
  priority: 100,
  isActive: true,
})

const tableModel = reactive<TableModel>({
  page: 1,
  pageSize: 20,
  compact: false,
})

const statusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
] satisfies Array<{ label: string; value: SourceStatusFilter }>

const originOptions = [
  { label: '全部来源', value: 'ALL' },
  { label: '外部官网', value: 'OFFICIAL' },
  { label: '研招网详情', value: 'YZ' },
] satisfies Array<{ label: string; value: SourceOriginFilter }>

const kindOptions = [
  { label: '全部类型', value: 'ALL' },
  { label: '研招网详情', value: 'DETAIL' },
  { label: '学校官网', value: 'HOMEPAGE' },
  { label: '研究生院', value: 'GRADUATE' },
  { label: '招生专题', value: 'PORTAL' },
  { label: '其他', value: 'OTHER' },
] satisfies Array<{ label: string; value: SourceKindFilter }>

const sortOptions = [
  { label: '智能排序', value: 'SMART' },
  { label: '最近更新', value: 'UPDATED' },
  { label: '优先级最高', value: 'PRIORITY' },
  { label: '单位名称', value: 'SCHOOL' },
] satisfies Array<{ label: string; value: SortMode }>

const pageSizeOptions = [
  { label: '20 条 / 页', value: 20 },
  { label: '50 条 / 页', value: 50 },
  { label: '100 条 / 页', value: 100 },
]

const formRules: FormRules = {
  schoolName: [
    { required: true, message: '请输入学校或研究所名称', trigger: ['blur', 'input'] },
    { min: 2, max: 80, message: '名称长度需在 2-80 个字符之间', trigger: ['blur', 'input'] },
  ],
  siteName: [
    { required: true, message: '请输入站点名称', trigger: ['blur', 'input'] },
    { min: 2, max: 80, message: '站点名称长度需在 2-80 个字符之间', trigger: ['blur', 'input'] },
  ],
  baseUrl: [
    { required: true, message: '请输入官方链接', trigger: ['blur', 'input'] },
    { validator: validateSourceUrl, trigger: ['blur', 'input'] },
  ],
  description: [
    { max: 300, message: '补充说明最多 300 个字符', trigger: ['blur', 'input'] },
  ],
}

/**
 * @description 规范化文本，便于筛选比较。
 * @param value 原始文本
 * @returns 归一化后的文本
 */
function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * @description 判断记录是否来自真正的外部官网。
 * @param row 官方源记录
 * @returns 是否为外部官网
 */
function isExternalOfficial(row: SchoolOfficialSourceItem): boolean {
  return row.domain !== 'yz.chsi.com.cn'
}

/**
 * @description 根据名称、描述与链接推断站点类型。
 * @param row 官方源记录
 * @returns 站点类型
 */
function inferSourceKind(row: SchoolOfficialSourceItem): Exclude<SourceKindFilter, 'ALL'> {
  const text = normalizeText(`${row.siteName} ${row.description ?? ''} ${row.baseUrl}`)

  if (row.domain === 'yz.chsi.com.cn' || text.includes('研招网院校详情')) {
    return 'DETAIL'
  }
  if (/研究生院|graduate|yjsy|yjs/.test(text)) {
    return 'GRADUATE'
  }
  if (/学校官网|官网首页|官方网站|官网|home/.test(text)) {
    return 'HOMEPAGE'
  }
  if (/招生|招办|招生网|招生专题|admission|yanzhao|zhaosheng|简章/.test(text)) {
    return 'PORTAL'
  }
  return 'OTHER'
}

/**
 * @description 获取站点类型展示配置。
 * @param row 官方源记录
 * @returns 标签名称与样式
 */
function resolveKindMeta(row: SchoolOfficialSourceItem): { label: string; type: 'default' | 'info' | 'success' | 'warning' } {
  const kind = inferSourceKind(row)
  switch (kind) {
    case 'DETAIL':
      return { label: '研招网详情', type: 'default' }
    case 'HOMEPAGE':
      return { label: '学校官网', type: 'info' }
    case 'GRADUATE':
      return { label: '研究生院', type: 'success' }
    case 'PORTAL':
      return { label: '招生专题', type: 'warning' }
    default:
      return { label: '其他来源', type: 'default' }
  }
}

/**
 * @description 生成用于本地搜索的全文文本。
 * @param row 官方源记录
 * @returns 可搜索字符串
 */
function buildSearchText(row: SchoolOfficialSourceItem): string {
  return normalizeText([row.schoolName, row.siteName, row.baseUrl, row.domain, row.description].join(' '))
}

/**
 * @description 计算优先级标签样式。
 * @param priority 优先级数值
 * @returns 标签样式
 */
function resolvePriorityTagType(priority: number): 'default' | 'info' | 'success' | 'warning' {
  if (priority >= 260) {
    return 'success'
  }
  if (priority >= 180) {
    return 'info'
  }
  if (priority >= 100) {
    return 'warning'
  }
  return 'default'
}

const filteredRows = computed(() => {
  const keyword = normalizeText(filterModel.keyword)
  const schoolName = normalizeText(filterModel.schoolName)

  const rows = sourceList.value.filter((row) => {
    if (filterModel.status === 'ACTIVE' && !row.isActive) {
      return false
    }
    if (filterModel.status === 'INACTIVE' && row.isActive) {
      return false
    }
    if (filterModel.origin === 'OFFICIAL' && !isExternalOfficial(row)) {
      return false
    }
    if (filterModel.origin === 'YZ' && isExternalOfficial(row)) {
      return false
    }
    if (filterModel.kind !== 'ALL' && inferSourceKind(row) !== filterModel.kind) {
      return false
    }
    if (schoolName && !normalizeText(row.schoolName).includes(schoolName)) {
      return false
    }
    if (keyword && !buildSearchText(row).includes(keyword)) {
      return false
    }
    return true
  })

  return rows.sort((left, right) => {
    switch (filterModel.sort) {
      case 'UPDATED':
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      case 'PRIORITY':
        return right.priority - left.priority || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      case 'SCHOOL':
        return left.schoolName.localeCompare(right.schoolName, 'zh-CN') || right.priority - left.priority
      case 'SMART':
      default:
        return Number(right.isActive) - Number(left.isActive)
          || Number(isExternalOfficial(right)) - Number(isExternalOfficial(left))
          || right.priority - left.priority
          || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      }
  })
})

const filteredStats = computed(() => {
  const schoolSet = new Set(filteredRows.value.map((item) => item.schoolName))
  const externalCount = filteredRows.value.filter((item) => isExternalOfficial(item)).length
  const graduateCount = filteredRows.value.filter((item) => inferSourceKind(item) === 'GRADUATE').length
  const portalCount = filteredRows.value.filter((item) => inferSourceKind(item) === 'PORTAL').length
  const highPriorityCount = filteredRows.value.filter((item) => item.priority >= 180).length

  return {
    totalRows: filteredRows.value.length,
    schoolCount: schoolSet.size,
    externalCount,
    graduateCount,
    portalCount,
    highPriorityCount,
  }
})

const currentSortLabel = computed(() => {
  return sortOptions.find((item) => item.value === filterModel.sort)?.label || '智能排序'
})

const insightCards = computed<InsightCard[]>(() => ([
  {
    label: '外部官网',
    value: filteredStats.value.externalCount,
    hint: '排除研招网详情后的真实外部站点',
  },
  {
    label: '研究生院',
    value: filteredStats.value.graduateCount,
    hint: '适合作为导师与招办检索入口',
  },
  {
    label: '招生专题',
    value: filteredStats.value.portalCount,
    hint: '适合定位简章、公告与联系方式',
  },
  {
    label: '高优先级',
    value: filteredStats.value.highPriorityCount,
    hint: '优先级 ≥ 180 的高价值入口',
  },
]))

const dashboardCards = computed<DashboardCard[]>(() => ([
  {
    label: '全量单位',
    value: stats.value.totalSchools,
    hint: '源库当前覆盖的学校 / 研究所数量',
    tag: '全局',
    tagType: 'info',
  },
  {
    label: '全量官方源',
    value: stats.value.totalSources,
    hint: '包含研招网详情、学校官网与各类专题入口',
    tag: '库存',
    tagType: 'success',
  },
  {
    label: '当前命中',
    value: filteredStats.value.totalRows,
    hint: '当前筛选条件下即时返回的记录总量',
    tag: '即时',
    tagType: 'info',
  },
  {
    label: '启用中',
    value: stats.value.activeSources,
    hint: '会参与检索优先命中的记录数',
    tag: '生产',
    tagType: 'success',
  },
  {
    label: '停用中',
    value: stats.value.inactiveSources,
    hint: '保留历史站点，避免误删导致丢链',
    tag: '存档',
    tagType: 'warning',
  },
]))

const topDomains = computed<DomainCounter[]>(() => {
  const counter = new Map<string, number>()
  filteredRows.value.forEach((item) => {
    if (!isExternalOfficial(item)) {
      return
    }
    counter.set(item.domain, (counter.get(item.domain) || 0) + 1)
  })

  return [...counter.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)
})

const activeFilterTags = computed(() => {
  const tags: string[] = []
  if (filterModel.keyword.trim()) {
    tags.push(`关键词：${filterModel.keyword.trim()}`)
  }
  if (filterModel.schoolName.trim()) {
    tags.push(`单位：${filterModel.schoolName.trim()}`)
  }
  if (filterModel.status !== 'ALL') {
    tags.push(`状态：${statusOptions.find((item) => item.value === filterModel.status)?.label}`)
  }
  if (filterModel.origin !== 'ALL') {
    tags.push(`来源：${originOptions.find((item) => item.value === filterModel.origin)?.label}`)
  }
  if (filterModel.kind !== 'ALL') {
    tags.push(`类型：${kindOptions.find((item) => item.value === filterModel.kind)?.label}`)
  }
  if (filterModel.sort !== 'SMART') {
    tags.push(`排序：${currentSortLabel.value}`)
  }
  return tags
})

const pagedRows = computed(() => {
  const start = (tableModel.page - 1) * tableModel.pageSize
  return filteredRows.value.slice(start, start + tableModel.pageSize)
})

const columns = computed<DataTableColumns<SchoolOfficialSourceItem>>(() => {
  const baseColumns: DataTableColumns<SchoolOfficialSourceItem> = [
    {
      title: '单位 / 站点',
      key: 'siteName',
      minWidth: 260,
      render: (row) => {
        const kindMeta = resolveKindMeta(row)
        return h('div', { class: 'school-source-cell' }, [
          h('div', { class: 'school-source-cell__title-row' }, [
            h('div', { class: 'school-source-cell__school' }, row.schoolName),
            h(NTag, { bordered: false, size: 'small', type: kindMeta.type }, { default: () => kindMeta.label }),
            h(
              NTag,
              { bordered: false, size: 'small', type: isExternalOfficial(row) ? 'success' : 'default' },
              { default: () => (isExternalOfficial(row) ? '外部官网' : '研招网') }
            ),
          ]),
          h('div', { class: 'school-source-cell__site' }, row.siteName),
        ])
      },
    },
    {
      title: '链接与描述',
      key: 'baseUrl',
      minWidth: 420,
      render: (row) => h('div', { class: 'school-source-cell school-source-cell--url' }, [
        h('a', {
          href: row.baseUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'school-source-link',
        }, row.baseUrl),
        h('div', { class: 'school-source-cell__domain' }, row.domain),
        h(
          'div',
          { class: ['school-source-cell__description', !row.description && 'school-source-cell__description--muted'] },
          row.description || '暂无补充说明'
        ),
      ]),
    },
    {
      title: '优先级',
      key: 'priority',
      width: 140,
      render: (row) => h('div', { class: 'school-source-priority' }, [
        h(NTag, { bordered: false, type: resolvePriorityTagType(row.priority) }, { default: () => `P${row.priority}` }),
        h('div', { class: 'school-source-priority__track' }, [
          h('span', {
            class: 'school-source-priority__bar',
            style: { width: `${Math.min(100, Math.max(10, row.priority / 3))}%` },
          }),
        ]),
      ]),
    },
    {
      title: '状态',
      key: 'isActive',
      width: 110,
      render: (row) => h(NTag, { bordered: false, type: row.isActive ? 'success' : 'warning' }, {
        default: () => row.isActive ? '启用' : '停用',
      }),
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      width: 180,
      render: (row) => h('div', { class: 'school-source-time' }, [
        h('div', formatDateTime(row.updatedAt)),
        h('div', { class: 'school-source-time__relative' }, formatRelativeTime(row.updatedAt)),
      ]),
    },
  ]

  const actionColumn: DataTableColumns<SchoolOfficialSourceItem>[number] = {
    title: '操作',
    key: 'actions',
    width: canManage.value ? 280 : 120,
    fixed: 'right',
    render: (row) => h('div', { class: 'school-source-actions' }, [
      h(NButton, {
        size: 'small',
        text: true,
        type: 'primary',
        onClick: () => handleOpenLink(row.baseUrl),
      }, { default: () => '打开' }),
      h(NButton, {
        size: 'small',
        text: true,
        onClick: () => void handleCopyLink(row),
      }, { default: () => '复制链接' }),
      ...(canManage.value
        ? [
            h(NButton, {
              size: 'small',
              text: true,
              onClick: () => handleOpenEditModal(row),
            }, { default: () => '编辑' }),
            h(NButton, {
              size: 'small',
              text: true,
              type: row.isActive ? 'warning' : 'success',
              onClick: () => void handleToggleActive(row),
            }, { default: () => row.isActive ? '停用' : '启用' }),
            h(NButton, {
              size: 'small',
              text: true,
              type: 'error',
              onClick: () => handleRemove(row),
            }, { default: () => '删除' }),
          ]
        : []),
    ]),
  }

  return [...baseColumns, actionColumn]
})

/**
 * @description 当筛选或分页尺寸变化时，重置到第一页。
 */
watch(
  () => [
    filterModel.keyword,
    filterModel.schoolName,
    filterModel.status,
    filterModel.origin,
    filterModel.kind,
    filterModel.sort,
    tableModel.pageSize,
  ],
  () => {
    tableModel.page = 1
  }
)

/**
 * @description 保证当前页码始终在合法范围内。
 */
watch(
  () => filteredRows.value.length,
  (count) => {
    const maxPage = Math.max(1, Math.ceil(count / tableModel.pageSize))
    if (tableModel.page > maxPage) {
      tableModel.page = maxPage
    }
  }
)

/**
 * @description 提取接口错误消息。
 * @param error 错误对象
 * @param fallback 默认提示
 * @returns 可读错误文案
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 格式化时间。
 * @param value ISO 时间字符串
 * @returns 本地化时间文本
 */
function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN')
}

/**
 * @description 生成相对时间描述。
 * @param value ISO 时间字符串
 * @returns 相对时间文案
 */
function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未知'
  }

  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`
  }
  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))} 小时前`
  }
  return `${Math.max(1, Math.floor(diff / day))} 天前`
}

/**
 * @description 规范化链接输入。
 * @param value 原始输入值
 * @returns 补齐协议后的链接
 */
function normalizeUrlInput(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalized) ? normalized : `https://${normalized}`
}

/**
 * @description 校验官方源链接。
 * @param _rule 校验规则
 * @param value 输入值
 * @returns 是否通过
 */
function validateSourceUrl(_rule: unknown, value: string): true | Error {
  const normalized = normalizeUrlInput(value)
  if (!normalized) {
    return new Error('请输入合法链接')
  }

  try {
    const parsed = new URL(normalized)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return true
    }
    return new Error('请输入合法链接')
  } catch {
    return new Error('请输入合法链接')
  }
}

/**
 * @description 拉取官方源全量列表，供本地即时检索。
 */
async function fetchSourceList() {
  loading.value = true
  try {
    const response = await schoolSourceApi.list()
    const payload = response.data.data
    sourceList.value = payload?.items ?? []
    canManage.value = payload?.canManage ?? false
    stats.value = payload?.stats ?? {
      totalSources: 0,
      totalSchools: 0,
      activeSources: 0,
      inactiveSources: 0,
    }
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取学校官方源列表失败'))
  } finally {
    loading.value = false
  }
}

/**
 * @description 清空筛选条件。
 */
function handleResetFilters() {
  filterModel.keyword = ''
  filterModel.schoolName = ''
  filterModel.status = 'ALL'
  filterModel.origin = 'ALL'
  filterModel.kind = 'ALL'
  filterModel.sort = 'SMART'
}

/**
 * @description 当前页的搜索为前端即时过滤，此方法仅保留统一入口。
 */
function handleSearch() {
  tableModel.page = 1
}

/**
 * @description 刷新最新服务端数据。
 */
function handleRefresh() {
  void fetchSourceList()
}

/**
 * @description 跳转回院校检索页。
 */
function handleGoSearch() {
  void router.push({ name: 'SchoolSearch' })
}

/**
 * @description 通过快捷预设一键修改筛选条件。
 * @param key 预设键
 */
function handleApplyPreset(key: QuickPresetKey) {
  switch (key) {
    case 'GRADUATE':
      filterModel.kind = 'GRADUATE'
      break
    case 'HOMEPAGE':
      filterModel.kind = 'HOMEPAGE'
      break
    case 'PORTAL':
      filterModel.kind = 'PORTAL'
      break
    case 'OFFICIAL':
      filterModel.origin = 'OFFICIAL'
      break
    case 'HIGH_PRIORITY':
      filterModel.sort = 'PRIORITY'
      filterModel.origin = 'OFFICIAL'
      break
    case 'DETAIL':
      filterModel.kind = 'DETAIL'
      break
  }
}

/**
 * @description 点击高频域名后自动带入关键词筛选。
 * @param domain 域名
 */
function handleApplyDomain(domain: string) {
  filterModel.keyword = domain
  filterModel.origin = 'OFFICIAL'
}

/**
 * @description 重置弹窗表单。
 */
function resetForm() {
  formModel.schoolName = ''
  formModel.siteName = ''
  formModel.baseUrl = ''
  formModel.description = ''
  formModel.priority = 100
  formModel.isActive = true
}

/**
 * @description 打开新增弹窗。
 */
function handleOpenCreateModal() {
  editingSourceId.value = null
  resetForm()
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 打开编辑弹窗。
 * @param row 当前行数据
 */
function handleOpenEditModal(row: SchoolOfficialSourceItem) {
  editingSourceId.value = row.id
  formModel.schoolName = row.schoolName
  formModel.siteName = row.siteName
  formModel.baseUrl = row.baseUrl
  formModel.description = row.description || ''
  formModel.priority = row.priority
  formModel.isActive = row.isActive
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 弹窗关闭后的清理逻辑。
 */
function handleModalAfterLeave() {
  editingSourceId.value = null
  resetForm()
  formRef.value?.restoreValidation()
}

/**
 * @description 打开官方链接。
 * @param url 链接地址
 */
function handleOpenLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * @description 复制官方链接到剪贴板。
 * @param row 当前行数据
 */
async function handleCopyLink(row: SchoolOfficialSourceItem) {
  try {
    await navigator.clipboard.writeText(row.baseUrl)
    message.success(`已复制：${row.siteName}`)
  } catch {
    message.error('复制失败，请手动复制链接')
  }
}

/**
 * @description 提交新增或编辑。
 */
async function handleSubmit() {
  await formRef.value?.validate()

  const payload: SchoolOfficialSourcePayload = {
    schoolName: formModel.schoolName.trim(),
    siteName: formModel.siteName.trim(),
    baseUrl: normalizeUrlInput(formModel.baseUrl),
    description: formModel.description.trim() || undefined,
    priority: formModel.priority ?? 100,
    isActive: formModel.isActive,
  }

  saving.value = true
  try {
    if (editingSourceId.value) {
      await schoolSourceApi.update(editingSourceId.value, payload)
      message.success('官方源更新成功')
    } else {
      await schoolSourceApi.create(payload)
      message.success('官方源新增成功')
    }

    showModal.value = false
    await fetchSourceList()
  } catch (error) {
    message.error(getApiErrorMessage(error, editingSourceId.value ? '更新官方源失败' : '新增官方源失败'))
  } finally {
    saving.value = false
  }
}

/**
 * @description 切换官方源状态。
 * @param row 当前行数据
 */
async function handleToggleActive(row: SchoolOfficialSourceItem) {
  try {
    await schoolSourceApi.update(row.id, { isActive: !row.isActive })
    message.success(row.isActive ? '该官方源已停用' : '该官方源已启用')
    await fetchSourceList()
  } catch (error) {
    message.error(getApiErrorMessage(error, '更新官方源状态失败'))
  }
}

/**
 * @description 删除官方源。
 * @param row 当前行数据
 */
function handleRemove(row: SchoolOfficialSourceItem) {
  dialog.warning({
    title: '删除官方源',
    content: `确认删除“${row.schoolName} / ${row.siteName}”吗？删除后将不再参与院校检索。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await schoolSourceApi.remove(row.id)
        message.success('官方源已删除')
        await fetchSourceList()
      } catch (error) {
        message.error(getApiErrorMessage(error, '删除官方源失败'))
      }
    },
  })
}

onMounted(() => {
  void fetchSourceList()
})
</script>

<style scoped>
.school-source-page {
  gap: 16px;
}

.school-source-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.school-source-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.95fr);
  gap: 16px;
}

.school-source-overview__main,
.school-source-overview__side,
.school-source-stat-card,
.school-source-console,
.school-source-results {
  overflow: hidden;
}

.school-source-overview__main {
  position: relative;
  min-height: 260px;
  padding: 26px;
  background:
    radial-gradient(circle at 100% 0%, rgba(59, 130, 246, 0.18), transparent 32%),
    radial-gradient(circle at 0% 100%, rgba(45, 212, 191, 0.16), transparent 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(245, 249, 255, 0.94));
}

.school-source-overview__badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.school-source-overview__headline {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-top: 18px;
}

.school-source-overview__title {
  margin: 0;
  max-width: 780px;
  font-size: 31px;
  line-height: 1.18;
  letter-spacing: -0.035em;
  color: #0f172a;
}

.school-source-overview__description {
  max-width: 720px;
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.85;
  color: #475569;
}

.school-source-overview__halo {
  width: 112px;
  height: 112px;
  flex-shrink: 0;
  border-radius: 32px;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.92), rgba(45, 212, 191, 0.62));
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.45),
    0 22px 48px rgba(37, 99, 235, 0.24);
}

.school-source-overview__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.school-source-overview__chip {
  background: rgba(255, 255, 255, 0.82);
  color: #334155;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.12);
}

.school-source-overview__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 26px;
}

.school-source-overview__metric {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.school-source-overview__metric-label {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: #64748b;
}

.school-source-overview__metric-value {
  margin-top: 8px;
  font-size: 19px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.school-source-overview__side {
  padding: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 250, 255, 0.92));
}

.school-source-side__section + .school-source-side__section {
  margin-top: 20px;
}

.school-source-side__section-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.school-source-side__insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.school-source-side__insight-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.school-source-side__insight-label {
  font-size: 12px;
  color: #64748b;
}

.school-source-side__insight-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.school-source-side__insight-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.school-source-side__domain-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.school-source-side__domain-chip {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.05);
  color: #334155;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.school-source-side__domain-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  background: rgba(59, 130, 246, 0.08);
}

.school-source-side__domain-chip span {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.school-source-side__domain-chip strong {
  color: #2563eb;
}

.school-source-side__empty {
  font-size: 13px;
  color: #94a3b8;
}

.school-source-side__preset-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 12px;
}

.school-source-side__preset {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border: 0;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.12);
  cursor: pointer;
  text-align: left;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.school-source-side__preset:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.22);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.school-source-side__preset-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.school-source-side__preset-text {
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.school-source-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.school-source-stat-card {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.88);
}

.school-source-stat-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.school-source-stat-card__label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.school-source-stat-card__value {
  margin-top: 16px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: #0f172a;
}

.school-source-stat-card__hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
}

.school-source-console,
.school-source-results {
  background: rgba(255, 255, 255, 0.86);
}

.school-source-console__header,
.school-source-results__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.school-source-console__title,
.school-source-results__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.school-source-console__subtitle,
.school-source-results__subtitle {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}

.school-source-console__actions,
.school-source-results__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.school-source-console__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.95fr);
  gap: 16px;
  margin-top: 18px;
}

.school-source-console__main {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.school-source-console__filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.school-source-console__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.school-source-console__switch-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.school-source-console__switch-block--compact {
  margin-left: auto;
  align-items: flex-end;
}

.school-source-console__switch-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.school-source-console__aside {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(247, 250, 255, 0.86), rgba(255, 255, 255, 0.78));
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.school-source-console__aside-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.school-source-console__aside-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.school-source-console__aside-item {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.school-source-console__aside-item-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.school-source-console__aside-item-text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
}

.school-source-alert {
  margin-top: -2px;
}

.school-source-results__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 14px;
}

.school-source-results__filter-tag {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
}

.school-source-results__page-size {
  width: 140px;
}

.school-source-results__table :deep(.n-data-table-th) {
  font-size: 12px;
}

.school-source-results__table--compact :deep(.n-data-table-td) {
  padding-top: 10px;
  padding-bottom: 10px;
}

.school-source-results__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.school-source-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.school-source-cell__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.school-source-cell__school {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.school-source-cell__site {
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
}

.school-source-link {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.7;
  color: #2563eb;
  word-break: break-all;
}

.school-source-link:hover {
  text-decoration: underline;
}

.school-source-cell__domain {
  font-size: 12px;
  color: #475569;
  word-break: break-all;
}

.school-source-cell__description {
  font-size: 12px;
  line-height: 1.7;
  color: #475569;
}

.school-source-cell__description--muted {
  color: #94a3b8;
}

.school-source-priority {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.school-source-priority__track {
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
}

.school-source-priority__bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
}

.school-source-time {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}

.school-source-time__relative {
  color: #94a3b8;
}

.school-source-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.school-source-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.school-source-form-grid__full {
  grid-column: 1 / -1;
}

.school-source-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.school-source-modal-footer__hint {
  max-width: 520px;
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
}

@media (max-width: 1280px) {
  .school-source-overview,
  .school-source-console__grid,
  .school-source-stats {
    grid-template-columns: 1fr;
  }

  .school-source-console__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .school-source-header-actions,
  .school-source-console__header,
  .school-source-results__header {
    flex-direction: column;
    align-items: stretch;
  }

  .school-source-overview__headline {
    flex-direction: column;
  }

  .school-source-overview__halo {
    width: 72px;
    height: 72px;
    border-radius: 22px;
  }

  .school-source-overview__metrics,
  .school-source-side__insight-grid,
  .school-source-console__filters,
  .school-source-form-grid {
    grid-template-columns: 1fr;
  }

  .school-source-console__switch-block--compact {
    margin-left: 0;
    align-items: flex-start;
  }

  .school-source-modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
