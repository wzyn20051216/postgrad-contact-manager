import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const LIST_BASE_URL = 'https://yz.chsi.com.cn/sch/'
const SITE_BASE_URL = 'https://yz.chsi.com.cn'
const PAGE_SIZE = 20
const CONTACT_CATEGORY_ID = '481381'
const INTRO_CATEGORY_ID = '481342'
const BLOCKED_DOMAINS = ['yz.chsi.com.cn', 'chsi.com.cn', 'chei.com.cn', 'miit.gov.cn', 'beian.gov.cn']
const BINARY_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z']

/**
 * @description 读取命令行参数。
 * @param key 参数名
 * @returns 参数值
 */
function readArg(key) {
  const direct = process.argv.find((item) => item.startsWith(`--${key}=`))
  if (direct) {
    return direct.slice(key.length + 3)
  }

  const index = process.argv.findIndex((item) => item === `--${key}`)
  if (index >= 0) {
    return process.argv[index + 1]
  }

  return undefined
}

/**
 * @description 等待一段时间，避免请求过快。
 * @param milliseconds 等待毫秒数
 */
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * @description 去除 HTML 标签并压缩空白。
 * @param value 原始 HTML 文本
 * @returns 纯文本结果
 */
function stripHtml(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#xa0;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @description 判断是否为可收录的网页链接。
 * @param url 链接地址
 * @returns 是否可收录
 */
function isCollectableUrl(url) {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()
    if (BLOCKED_DOMAINS.some((item) => hostname === item || hostname.endsWith(`.${item}`))) {
      return false
    }

    const pathname = parsed.pathname.toLowerCase()
    if (BINARY_EXTENSIONS.some((extension) => pathname.endsWith(extension))) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * @description 规范化链接，去除 hash 并补全相对路径。
 * @param candidate 原始链接
 * @param baseUrl 当前页面 URL
 * @returns 规范化后的绝对链接
 */
function normalizeUrl(candidate, baseUrl = SITE_BASE_URL) {
  try {
    const parsed = new URL(candidate, baseUrl)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * @description 提取域名。
 * @param url 链接地址
 * @returns 归一化域名
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * @description 将链接裁剪为站点根地址。
 * @param url 链接地址
 * @returns 站点根地址
 */
function toSiteRoot(url) {
  try {
    const parsed = new URL(url)
    parsed.pathname = '/'
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * @description 通过官方页面标题或 URL 推测站点名称。
 * @param title 锚文本
 * @param url 链接地址
 * @returns 站点名称
 */
function inferSiteName(title, url) {
  const normalizedTitle = title.trim()
  if (normalizedTitle) {
    return normalizedTitle.slice(0, 80)
  }

  const lower = url.toLowerCase()
  if (lower.includes('admission') || lower.includes('yanzhao') || lower.includes('zhaosheng') || lower.includes('zs')) {
    return '研究生招生信息'
  }
  if (lower.includes('yjs') || lower.includes('graduate')) {
    return '研究生院'
  }
  return '官方站点'
}

/**
 * @description 为外部链接推断优先级。
 * @param title 锚文本
 * @param url 链接地址
 * @returns 优先级数值
 */
function inferPriority(title, url) {
  const text = `${title} ${url}`.toLowerCase()
  if (/(研究生|招生|研招|硕士|博士|联系办法|招办)/.test(text)) {
    return 280
  }
  if (/(graduate|admission|yjs|yz|zs)/.test(text)) {
    return 260
  }
  return 220
}

/**
 * @description 请求网页文本，内置超时和重试。
 * @param url 目标地址
 * @param retries 重试次数
 * @returns 网页文本
 */
async function fetchText(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'zh-CN,zh;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      if (attempt >= retries) {
        throw error
      }
      await sleep(400 * attempt)
    } finally {
      clearTimeout(timeout)
    }
  }

  return ''
}

/**
 * @description 解析总页数。
 * @param html 列表页 HTML
 * @returns 总页数
 */
function parseTotalPages(html) {
  const starts = [...html.matchAll(/href=['"]\/sch\/\?start=(\d+)['"]/g)]
    .map((item) => Number(item[1]))
    .filter((value) => Number.isFinite(value))

  if (starts.length === 0) {
    return 1
  }

  return Math.floor(Math.max(...starts) / PAGE_SIZE) + 1
}

/**
 * @description 解析列表页中的学校信息。
 * @param html 列表页 HTML
 * @returns 学校列表
 */
function parseSchoolList(html) {
  const schools = []
  const pattern = /<a[^>]+class=['"][^'"]*js-yxk-yxmc[^'"]*['"][^>]+href=['"]\/sch\/schoolInfo--schId-(\d+)\.dhtml['"][^>]*>([\s\S]*?)<\/a>/g

  for (const match of html.matchAll(pattern)) {
    const schoolId = match[1]
    const schoolName = stripHtml(match[2])
    if (!schoolId || !schoolName) {
      continue
    }

    schools.push({
      schoolId,
      schoolName,
      detailUrl: `${SITE_BASE_URL}/sch/schoolInfo--schId-${schoolId}.dhtml`,
      contactUrl: `${SITE_BASE_URL}/sch/schoolInfo--schId-${schoolId},categoryId-${CONTACT_CATEGORY_ID}.dhtml`,
      introUrl: `${SITE_BASE_URL}/sch/schoolInfo--schId-${schoolId},categoryId-${INTRO_CATEGORY_ID}.dhtml`,
    })
  }

  return schools
}

/**
 * @description 从院校详情子页面中提取外部链接。
 * @param html 页面 HTML
 * @param pageUrl 页面地址
 * @returns 锚点列表
 */
function parseExternalAnchors(html, pageUrl) {
  const anchors = []
  const pattern = /<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g

  for (const match of html.matchAll(pattern)) {
    const href = normalizeUrl(match[1], pageUrl)
    if (!href || !isCollectableUrl(href)) {
      continue
    }

    anchors.push({
      url: href,
      text: stripHtml(match[2]),
    })
  }

  return anchors
}

/**
 * @description 以 baseUrl 为唯一键写入官方源。
 * @param payload 源数据
 */
async function upsertSource(payload) {
  await prisma.schoolOfficialSource.upsert({
    where: {
      baseUrl: payload.baseUrl,
    },
    update: {
      schoolName: payload.schoolName,
      siteName: payload.siteName,
      domain: payload.domain,
      description: payload.description,
      priority: payload.priority,
      isActive: true,
    },
    create: {
      schoolName: payload.schoolName,
      siteName: payload.siteName,
      baseUrl: payload.baseUrl,
      domain: payload.domain,
      description: payload.description,
      priority: payload.priority,
      isActive: true,
    },
  })
}

/**
 * @description 处理单个学校，写入研招网详情页、官网和招生联系页。
 * @param school 学校信息
 * @returns 导入统计
 */
async function processSchool(school) {
  let importedCount = 0

  await upsertSource({
    schoolName: school.schoolName,
    siteName: '研招网院校详情',
    baseUrl: school.detailUrl,
    domain: extractDomain(school.detailUrl),
    description: '来源：中国研究生招生信息网院校信息库，覆盖具有研究生招生资格的高校院校详情页。',
    priority: 180,
  })
  importedCount += 1

  const introHtml = await fetchText(school.introUrl).catch(() => '')
  if (introHtml) {
    const introAnchors = parseExternalAnchors(introHtml, school.introUrl)
    const introSiteRoots = new Map()

    for (const anchor of introAnchors) {
      const siteRoot = toSiteRoot(anchor.url)
      const domain = extractDomain(siteRoot)
      if (!siteRoot || !domain || introSiteRoots.has(domain)) {
        continue
      }

      introSiteRoots.set(domain, {
        schoolName: school.schoolName,
        siteName: '学校官网',
        baseUrl: siteRoot,
        domain,
        description: '来源：研招网院校简介页提取的学校官网域名。',
        priority: 210,
      })
    }

    for (const item of introSiteRoots.values()) {
      await upsertSource(item)
      importedCount += 1
    }
  }

  const contactHtml = await fetchText(school.contactUrl).catch(() => '')
  if (contactHtml) {
    const contactAnchors = parseExternalAnchors(contactHtml, school.contactUrl)
    const deduplicated = new Map()

    for (const anchor of contactAnchors) {
      if (!deduplicated.has(anchor.url)) {
        deduplicated.set(anchor.url, anchor)
      }
    }

    for (const anchor of deduplicated.values()) {
      await upsertSource({
        schoolName: school.schoolName,
        siteName: inferSiteName(anchor.text, anchor.url),
        baseUrl: anchor.url,
        domain: extractDomain(anchor.url),
        description: `来源：研招网联系办法页提取的官方链接${anchor.text ? `（${anchor.text}）` : ''}。`,
        priority: inferPriority(anchor.text, anchor.url),
      })
      importedCount += 1
    }
  }

  return importedCount
}

/**
 * @description 并发执行异步任务。
 * @param items 任务输入列表
 * @param concurrency 并发数
 * @param worker 处理函数
 * @returns 所有处理结果
 */
async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  })

  await Promise.all(workers)
  return results
}

/**
 * @description 主执行入口。
 */
async function main() {
  const pageLimitArg = Number(readArg('page-limit') || '0')
  const concurrencyArg = Number(readArg('concurrency') || '6')
  const pageLimit = Number.isFinite(pageLimitArg) && pageLimitArg > 0 ? Math.floor(pageLimitArg) : 0
  const concurrency = Number.isFinite(concurrencyArg) && concurrencyArg > 0 ? Math.min(Math.floor(concurrencyArg), 12) : 6

  console.log('[import] 正在读取研招网院校库首页...')
  const firstPageHtml = await fetchText(LIST_BASE_URL)
  const totalPages = parseTotalPages(firstPageHtml)
  const pagesToFetch = pageLimit > 0 ? Math.min(pageLimit, totalPages) : totalPages

  console.log(`[import] 预计总页数：${totalPages}，本次抓取页数：${pagesToFetch}`)

  const schoolMap = new Map()
  for (let pageIndex = 0; pageIndex < pagesToFetch; pageIndex += 1) {
    const start = pageIndex * PAGE_SIZE
    const pageUrl = start === 0 ? LIST_BASE_URL : `${LIST_BASE_URL}?start=${start}`
    const html = pageIndex === 0 ? firstPageHtml : await fetchText(pageUrl)
    const schools = parseSchoolList(html)
    console.log(`[import] 第 ${pageIndex + 1}/${pagesToFetch} 页解析到 ${schools.length} 所学校`)

    for (const school of schools) {
      schoolMap.set(school.schoolId, school)
    }
  }

  const schools = [...schoolMap.values()]
  console.log(`[import] 去重后学校数量：${schools.length}`)

  let totalImportedSources = 0
  let successCount = 0
  let failedCount = 0

  await runWithConcurrency(schools, concurrency, async (school, index) => {
    try {
      const importedCount = await processSchool(school)
      totalImportedSources += importedCount
      successCount += 1
      console.log(`[import] ${index + 1}/${schools.length} 已完成：${school.schoolName}（写入 ${importedCount} 条）`)
    } catch (error) {
      failedCount += 1
      console.error(`[import] ${school.schoolName} 处理失败：`, error instanceof Error ? error.message : error)
    }
  })

  const finalCount = await prisma.schoolOfficialSource.count()
  console.log(JSON.stringify({
    totalPages,
    fetchedPages: pagesToFetch,
    schools: schools.length,
    successCount,
    failedCount,
    totalImportedSources,
    finalCount,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[import] 执行失败：', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
