import type { Prisma } from '@prisma/client'
import { prisma } from '../config/database.js'
import { AppError } from '../middlewares/errorHandler.js'

type SchoolSearchQuality = 'high' | 'medium' | 'low'

interface SearchSeedResult {
  title: string
  url: string
  snippet: string
  seedScore?: number
}

interface SchoolSearchSource {
  title: string
  url: string
  snippet: string
  isOfficial: boolean
  summary: string
  mentorHints: string[]
  emails: string[]
  domain: string
  quality: SchoolSearchQuality
}

interface SchoolSearchResult {
  query: string
  focus: string
  totalSources: number
  fetchedAt: string
  fromCache: boolean
  sources: SchoolSearchSource[]
}

interface CacheValue {
  expiresAt: number
  value: Omit<SchoolSearchResult, 'fromCache'>
}

const DEFAULT_FOCUS = '研究生院 导师 招生'
const DEFAULT_MAX_SOURCES = 5
const MAX_SEARCH_SOURCES = 8
const CACHE_TTL_MS = 10 * 60 * 1000
const HTTP_TIMEOUT_MS = 8000
const SEARCH_ENGINE_TIMEOUT_MS = 10000
const REDIRECT_RESOLVE_TIMEOUT_MS = 5000
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

const SEARCH_REDIRECT_RULES = [
  { hostname: 'baidu.com', pathPrefix: '/link' },
  { hostname: 'sogou.com', pathPrefix: '/link' },
  { hostname: 'so.com', pathPrefix: '/link' },
  { hostname: 'bing.com', pathPrefix: '/ck/' },
]

const LOW_PRIORITY_DOMAINS = [
  'zhihu.com',
  'bilibili.com',
  'weibo.com',
  'tieba.baidu.com',
  'blog.csdn.net',
  'youtube.com',
  'google.com',
  'microsoft.com',
]

const BLOCKED_RESULT_DOMAINS = [
  'baidu.com',
  'sogou.com',
  'so.com',
  'bing.com',
  'duckduckgo.com',
]

const SEARCH_PRIORITY_KEYWORDS = [
  '研究生',
  '招生',
  '导师',
  '硕士',
  '博士',
  '学院',
  '研究方向',
  '联系方式',
]

const REDIRECT_QUERY_KEYS = [
  'url',
  'target',
  'targeturl',
  'u',
  'ru',
  'to',
  'dest',
  'destination',
  'jump',
  'redirect',
]

export class SchoolSearchService {
  private cache = new Map<string, CacheValue>()

  /**
   * @description 根据学校名称检索导师/招生相关信息
   * @param schoolName 学校名称
   * @param focus 关注关键词
   * @param maxSources 返回来源数量上限
   * @returns 检索结果
   */
  async search(
    schoolName: string,
    focus = DEFAULT_FOCUS,
    maxSources = DEFAULT_MAX_SOURCES
  ): Promise<SchoolSearchResult> {
    const normalizedSchoolName = schoolName.trim()
    if (!normalizedSchoolName) {
      throw new AppError('学校名称不能为空', 400)
    }

    const normalizedFocus = (focus || DEFAULT_FOCUS).trim()
    const normalizedMaxSources = this.normalizeMaxSources(maxSources)
    const cacheKey = `${normalizedSchoolName}__${normalizedFocus}__${normalizedMaxSources}`
    const now = Date.now()
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > now && cached.value.totalSources > 0) {
      return {
        ...cached.value,
        fromCache: true,
      }
    }
    if (cached && cached.value.totalSources <= 0) {
      this.cache.delete(cacheKey)
    }

    const seedResults = await this.fetchSeedResults(normalizedSchoolName, normalizedFocus, normalizedMaxSources)
    const candidateSeeds = seedResults.slice(0, Math.max(normalizedMaxSources * 2, normalizedMaxSources))
    const enrichedSources = await Promise.all(
      candidateSeeds.map((seed) => this.enrichSeed(seed, normalizedSchoolName))
    )
    const rankedSources = this.rankSources(enrichedSources, normalizedSchoolName, normalizedFocus)
    const finalSources = rankedSources.slice(0, normalizedMaxSources)

    const responseValue: Omit<SchoolSearchResult, 'fromCache'> = {
      query: normalizedSchoolName,
      focus: normalizedFocus,
      totalSources: finalSources.length,
      fetchedAt: new Date().toISOString(),
      sources: finalSources,
    }

    if (responseValue.totalSources > 0) {
      this.cache.set(cacheKey, {
        expiresAt: now + CACHE_TTL_MS,
        value: responseValue,
      })
    } else {
      this.cache.delete(cacheKey)
    }
    this.cleanupCache(now)

    return {
      ...responseValue,
      fromCache: false,
    }
  }

  /**
   * @description 清理过期缓存，避免缓存无限增长
   * @param now 当前时间戳
   */
  clearCache(): void {
    this.cache.clear()
  }

  private cleanupCache(now: number): void {
    if (this.cache.size <= 50) {
      return
    }

    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * @description 规范化来源数量上限
   * @param maxSources 来源数量上限
   * @returns 合法数量
   */
  private normalizeMaxSources(maxSources: number): number {
    if (!Number.isFinite(maxSources)) {
      return DEFAULT_MAX_SOURCES
    }
    const normalized = Math.floor(maxSources)
    if (normalized < 1) {
      return 1
    }
    if (normalized > MAX_SEARCH_SOURCES) {
      return MAX_SEARCH_SOURCES
    }
    return normalized
  }

  /**
   * @description 执行搜索引擎抓取，优先百度/搜狗，其次 Bing/DuckDuckGo
   * @param schoolName 学校名称
   * @param focus 关注关键词
   * @param maxSources 返回来源数量上限
   * @returns 初始来源列表
   */
  private async fetchSeedResults(
    schoolName: string,
    focus: string,
    maxSources: number
  ): Promise<SearchSeedResult[]> {
    const query = `${schoolName} ${focus}`.trim()
    const eduQuery = `${query} site:edu.cn`
    const targetCount = Math.max(maxSources * 3, maxSources + 4)
    const perEngineLimit = Math.max(maxSources + 2, 6)

    const [
      baiduResults,
      baiduEduResults,
      sogouResults,
      sogouEduResults,
      bingRssResults,
      bingRssEduResults,
      bingResults,
      duckResults,
    ] = await Promise.all([
      this.fetchFromBaidu(query, perEngineLimit),
      this.fetchFromBaidu(eduQuery, perEngineLimit),
      this.fetchFromSogou(query, perEngineLimit),
      this.fetchFromSogou(eduQuery, perEngineLimit),
      this.fetchFromBingRss(query, perEngineLimit),
      this.fetchFromBingRss(eduQuery, perEngineLimit),
      this.fetchFromBing(eduQuery, perEngineLimit),
      this.fetchFromDuckDuckGo(eduQuery, perEngineLimit),
    ])

    const mergedResults = [
      ...baiduResults,
      ...baiduEduResults,
      ...sogouResults,
      ...sogouEduResults,
      ...bingRssResults,
      ...bingRssEduResults,
      ...bingResults,
      ...duckResults,
    ]

    const deduplicated = this.deduplicateSeedResults(mergedResults)
    const filtered = this.filterSeedResultsBySchool(deduplicated, schoolName)
    const ranked = this.rankSeedResults(filtered, schoolName, focus)
    const preferred = ranked.filter((item) => {
      const domain = this.extractDomain(item.url)
      return !this.isBlockedResultDomain(item.url)
        && !LOW_PRIORITY_DOMAINS.some((blocked) => domain.endsWith(blocked))
    })
    const selected = preferred.length >= maxSources ? preferred : ranked
    const officialLibrarySeeds = await this.getKnownSchoolOfficialSeeds(schoolName)
    if (officialLibrarySeeds.length === 0) {
      return selected.slice(0, targetCount)
    }

    const mergedWithKnown = this.rankSeedResults(
      this.deduplicateSeedResults([...officialLibrarySeeds, ...selected]),
      schoolName,
      focus
    )
    return mergedWithKnown.slice(0, targetCount)
  }

  /**
   * @description 通过百度页面抓取结果
   * @param query 搜索词
   * @param limit 最大结果数
   * @returns 搜索结果
   */
  private async fetchFromBaidu(query: string, limit: number): Promise<SearchSeedResult[]> {
    const url = `http://www.baidu.com/s?wd=${encodeURIComponent(query)}`
    const html = await this.fetchText(url, SEARCH_ENGINE_TIMEOUT_MS)
    if (!html) {
      return []
    }

    const resultPattern = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi
    const results: SearchSeedResult[] = []
    let match: RegExpExecArray | null

    while ((match = resultPattern.exec(html)) !== null) {
      const rawUrl = this.decodeHtml(match[1])
      const title = this.cleanText(match[2])
      if (!rawUrl || !title) {
        continue
      }

      const resolvedUrl = await this.resolveSearchUrl(rawUrl)
      const normalizedUrl = this.normalizeResultUrl(resolvedUrl)
      if (!normalizedUrl) {
        continue
      }

      const windowStart = match.index + match[0].length
      const snippetWindow = html.slice(windowStart, windowStart + 1200)
      const snippet = this.extractSnippet(snippetWindow)

      results.push({
        title,
        url: normalizedUrl,
        snippet,
      })

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  /**
   * @description 通过搜狗页面抓取结果（百度不可用时兜底）
   * @param query 搜索词
   * @param limit 最大结果数
   * @returns 搜索结果
   */
  private async fetchFromSogou(query: string, limit: number): Promise<SearchSeedResult[]> {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
    const html = await this.fetchText(url, SEARCH_ENGINE_TIMEOUT_MS)
    if (!html) {
      return []
    }

    const resultPattern =
      /<h3[^>]*>[\s\S]*?<a[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi
    const results: SearchSeedResult[] = []
    let match: RegExpExecArray | null

    while ((match = resultPattern.exec(html)) !== null) {
      const rawUrl = this.decodeHtml(match[1] || match[2] || match[3] || '')
      const normalizedRawUrl = rawUrl.startsWith('/')
        ? `https://www.sogou.com${rawUrl}`
        : rawUrl
      const resolvedUrl = await this.resolveSearchUrl(normalizedRawUrl)
      const normalizedUrl = this.normalizeResultUrl(resolvedUrl)
      if (!normalizedUrl) {
        continue
      }

      const title = this.cleanText(match[4] || '')
      if (!title) {
        continue
      }

      const snippetWindow = html.slice(match.index + match[0].length, match.index + match[0].length + 1200)
      const snippet = this.extractSnippet(snippetWindow)

      results.push({
        title,
        url: normalizedUrl,
        snippet,
      })

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  /**
   * @description 通过 Bing RSS 接口抓取结果（高可用兜底）
   * @param query 搜索词
   * @param limit 最大结果数
   * @returns 搜索结果
   */
  private async fetchFromBingRss(query: string, limit: number): Promise<SearchSeedResult[]> {
    const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`
    const xml = await this.fetchRawText(url, SEARCH_ENGINE_TIMEOUT_MS)
    if (!xml) {
      return []
    }

    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
    const results: SearchSeedResult[] = []

    for (const item of items) {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i)
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i)
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i)

      const title = this.cleanText(titleMatch?.[1] ?? '')
      const rawUrl = this.decodeHtml((linkMatch?.[1] ?? '').trim())
      const normalizedUrl = this.normalizeResultUrl(rawUrl)
      if (!title || !normalizedUrl) {
        continue
      }

      results.push({
        title,
        url: normalizedUrl,
        snippet: this.cleanText(descMatch?.[1] ?? ''),
      })

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  /**
   * @description 通过 Bing HTML 页面抓取结果
   * @param query 搜索词
   * @param limit 最大结果数
   * @returns 搜索结果
   */
  private async fetchFromBing(query: string, limit: number): Promise<SearchSeedResult[]> {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-Hans`
    const html = await this.fetchText(url, SEARCH_ENGINE_TIMEOUT_MS)
    if (!html) {
      return []
    }

    const blocks = html.match(/<li[^>]*class=(?:"[^"]*b_algo[^"]*"|'[^']*b_algo[^']*')[\s\S]*?<\/li>/gi) ?? []
    const results: SearchSeedResult[] = []

    for (const block of blocks) {
      const linkMatch = block.match(
        /<h2[^>]*>\s*<a[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i
      )
      if (!linkMatch) {
        continue
      }

      const rawUrl = this.decodeHtml(linkMatch[1] || linkMatch[2] || linkMatch[3] || '')
      const resolvedUrl = await this.resolveSearchUrl(rawUrl)
      const normalizedUrl = this.normalizeResultUrl(resolvedUrl)
      if (!normalizedUrl) {
        continue
      }

      const title = this.cleanText(linkMatch[4] || '')
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
      const snippet = this.cleanText(snippetMatch?.[1] ?? '')
      if (!title) {
        continue
      }

      results.push({
        title,
        url: normalizedUrl,
        snippet,
      })

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  /**
   * @description 通过 DuckDuckGo HTML 页面抓取结果（兜底）
   * @param query 搜索词
   * @param limit 最大结果数
   * @returns 搜索结果
   */
  private async fetchFromDuckDuckGo(query: string, limit: number): Promise<SearchSeedResult[]> {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const html = await this.fetchText(url, SEARCH_ENGINE_TIMEOUT_MS)
    if (!html) {
      return []
    }

    const blocks = html.match(
      /<div[^>]*class=(?:"[^"]*result__body[^"]*"|'[^']*result__body[^']*')[\s\S]*?<\/div>\s*<\/div>/gi
    ) ?? []
    const results: SearchSeedResult[] = []

    for (const block of blocks) {
      const linkMatch = block.match(
        /<a[^>]*class=(?:"[^"]*result__a[^"]*"|'[^']*result__a[^']*')[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i
      )
      if (!linkMatch) {
        continue
      }

      const rawUrl = this.decodeDuckDuckGoUrl(this.decodeHtml(linkMatch[1] || linkMatch[2] || linkMatch[3] || ''))
      const resolvedUrl = await this.resolveSearchUrl(rawUrl)
      const normalizedUrl = this.normalizeResultUrl(resolvedUrl)
      if (!normalizedUrl) {
        continue
      }

      const title = this.cleanText(linkMatch[4] || '')
      const snippetMatch = block.match(/class=(?:"[^"]*result__snippet[^"]*"|'[^']*result__snippet[^']*')[^>]*>([\s\S]*?)<\/a>/i)
      const snippet = this.cleanText(snippetMatch?.[1] ?? '')
      if (!title) {
        continue
      }

      results.push({
        title,
        url: normalizedUrl,
        snippet,
      })

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  /**
   * @description 去重并过滤无效搜索结果
   * @param seedResults 初始结果
   * @returns 去重后的结果
   */
  private deduplicateSeedResults(seedResults: SearchSeedResult[]): SearchSeedResult[] {
    const uniqueMap = new Map<string, SearchSeedResult>()

    for (const item of seedResults) {
      const key = this.normalizeUrlForDedup(item.url)
      if (!key || uniqueMap.has(key)) {
        continue
      }
      uniqueMap.set(key, item)
    }

    return Array.from(uniqueMap.values())
  }

  /**
   * @description 按学校关键词过滤搜索结果，尽量提升相关性
   * @param seedResults 初始结果
   * @param schoolName 学校名称
   * @returns 过滤后的结果
   */
  private filterSeedResultsBySchool(seedResults: SearchSeedResult[], schoolName: string): SearchSeedResult[] {
    const keywords = this.buildSchoolKeywords(schoolName)
    if (keywords.length === 0) {
      return seedResults
    }

    const filtered = seedResults.filter((item) => {
      const text = `${item.title} ${item.snippet} ${item.url}`.toLowerCase()
      return keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    })

    if (filtered.length > 0) {
      return filtered
    }

    const academicResults = seedResults.filter((item) => this.isAcademicDomain(item.url))
    if (academicResults.length > 0) {
      return academicResults
    }

    const cleanedResults = seedResults.filter((item) => {
      const domain = this.extractDomain(item.url)
      return !LOW_PRIORITY_DOMAINS.some((blocked) => domain.endsWith(blocked))
    })
    if (cleanedResults.length > 0) {
      return cleanedResults
    }

    return seedResults
  }

  /**
   * @description 提取学校关键词，用于结果相关性评估
   * @param schoolName 学校名称
   * @returns 关键词数组
   */
  private buildSchoolKeywords(schoolName: string): string[] {
    const trimmed = schoolName.trim()
    if (!trimmed) {
      return []
    }

    const candidates = new Set<string>()
    candidates.add(trimmed)

    const normalized = trimmed.replace(/\s+/g, '')
    candidates.add(normalized)

    const normalizedWithoutSuffix = normalized
      .replace(/大学$/, '')
      .replace(/学院$/, '')
      .replace(/研究院$/, '')
      .replace(/研究生院$/, '')

    if (normalizedWithoutSuffix.length >= 2) {
      candidates.add(normalizedWithoutSuffix)
    }

    return Array.from(candidates).filter((item) => item.length >= 2)
  }

  /**
   * @description 获取内置学校官方入口候选，兜底提升准确率
   * @param schoolName 学校名称
   * @returns 官方入口候选
   */
  private async getKnownSchoolOfficialSeeds(schoolName: string): Promise<SearchSeedResult[]> {
    const normalizedName = schoolName.trim()
    if (!normalizedName) {
      return []
    }

    const schoolKeywords = this.buildSchoolKeywords(normalizedName)
    const schoolNameConditions = schoolKeywords.map((keyword) => ({
      schoolName: {
        contains: keyword,
      },
    }))
    const queryOptions = {
      select: {
        schoolName: true,
        siteName: true,
        baseUrl: true,
        description: true,
        priority: true,
      },
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' },
      ],
    } satisfies Pick<Prisma.SchoolOfficialSourceFindManyArgs, 'select' | 'orderBy'>

    try {
      const exactMatchItems = await prisma.schoolOfficialSource.findMany({
        where: {
          schoolName: normalizedName,
          isActive: true,
        },
        ...queryOptions,
      })

      const items = exactMatchItems.length > 0
        ? exactMatchItems
        : await prisma.schoolOfficialSource.findMany({
          where: {
            isActive: true,
            OR: schoolNameConditions.length > 0
              ? schoolNameConditions
              : [{ schoolName: normalizedName }],
          },
          ...queryOptions,
        })

      return items.map((item) => ({
        title: item.siteName || `${item.schoolName} 官方入口`,
        url: item.baseUrl,
        snippet: item.description || '院校官方源库优先命中',
        seedScore: 200 + item.priority,
      }))
    } catch {
      return []
    }
  }

  /**
   * @description 提取关注关键词并规范化
   * @param focus 关注关键词
   * @returns 关键词数组
   */
  private buildFocusKeywords(focus: string): string[] {
    if (!focus.trim()) {
      return []
    }

    const keywords = focus
      .split(/[\s,，、;；|]+/)
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length >= 2)

    return this.uniqueList(keywords).slice(0, 10)
  }

  /**
   * @description 对初始结果进行评分排序，优先高相关+官方域名
   * @param seedResults 初始结果
   * @param schoolName 学校名称
   * @param focus 关注关键词
   * @returns 排序后的结果
   */
  private rankSeedResults(seedResults: SearchSeedResult[], schoolName: string, focus: string): SearchSeedResult[] {
    const schoolKeywords = this.buildSchoolKeywords(schoolName)
    const focusKeywords = this.buildFocusKeywords(focus)

    return [...seedResults]
      .map((item) => ({
        ...item,
        seedScore: (item.seedScore ?? 0) + this.scoreSeedResult(item, schoolKeywords, focusKeywords),
      }))
      .sort((left, right) => (right.seedScore ?? 0) - (left.seedScore ?? 0))
  }

  /**
   * @description 计算初始结果评分
   * @param seed 搜索结果
   * @param schoolKeywords 学校关键词
   * @param focusKeywords 关注关键词
   * @returns 分数
   */
  private scoreSeedResult(
    seed: Pick<SearchSeedResult, 'title' | 'url' | 'snippet'>,
    schoolKeywords: string[],
    focusKeywords: string[]
  ): number {
    const titleText = seed.title.toLowerCase()
    const snippetText = seed.snippet.toLowerCase()
    const urlText = seed.url.toLowerCase()
    const fullText = `${titleText} ${snippetText} ${urlText}`
    const domain = this.extractDomain(seed.url)

    let score = 0
    let schoolKeywordMatched = 0
    if (this.isLikelyOfficialSite(seed.url)) {
      score += 46
    }
    if (domain.endsWith('.edu.cn') || domain.endsWith('.ac.cn')) {
      score += 22
    }
    if (domain.startsWith('yz.')) {
      score += 10
    }

    for (const keyword of schoolKeywords) {
      const normalizedKeyword = keyword.toLowerCase()
      if (titleText.includes(normalizedKeyword)) {
        score += 18
        schoolKeywordMatched += 1
      }
      if (snippetText.includes(normalizedKeyword)) {
        score += 10
        schoolKeywordMatched += 1
      }
      if (urlText.includes(normalizedKeyword)) {
        score += 6
        schoolKeywordMatched += 1
      }
    }

    if (schoolKeywords.length > 0 && schoolKeywordMatched === 0) {
      score -= 80
    }

    for (const keyword of focusKeywords) {
      const normalizedKeyword = keyword.toLowerCase()
      if (fullText.includes(normalizedKeyword)) {
        score += 8
      }
    }

    for (const keyword of SEARCH_PRIORITY_KEYWORDS) {
      if (fullText.includes(keyword.toLowerCase())) {
        score += 6
      }
    }

    if (this.isSearchRedirectUrl(seed.url)) {
      score -= 120
    }
    if (this.isBlockedResultDomain(seed.url)) {
      score -= 200
    }

    if (LOW_PRIORITY_DOMAINS.some((item) => domain.endsWith(item))) {
      score -= 40
    }

    return score
  }

  /**
   * @description 抓取并提炼单个来源信息
   * @param seed 搜索来源
   * @param schoolName 学校名称
   * @returns 提炼后的来源信息
   */
  private async enrichSeed(seed: SearchSeedResult, schoolName: string): Promise<SchoolSearchSource> {
    const domain = this.extractDomain(seed.url)
    const isOfficial = this.isLikelyOfficialSite(seed.url)
    const fallbackSummary = seed.snippet || '未获取到页面摘要'

    const html = await this.fetchText(seed.url, HTTP_TIMEOUT_MS)
    if (!html) {
      return {
        ...seed,
        isOfficial,
        summary: fallbackSummary,
        mentorHints: [],
        emails: [],
        domain,
        quality: isOfficial ? 'high' : 'medium',
      }
    }

    const text = this.htmlToText(html)
    const mentorHints = this.extractMentorHints(text, schoolName)
    const emails = this.extractEmails(text)
    const summary = this.buildSummary(text, mentorHints, fallbackSummary)

    return {
      ...seed,
      isOfficial,
      summary,
      mentorHints,
      emails,
      domain,
      quality: isOfficial ? 'high' : 'medium',
    }
  }

  /**
   * @description 对已提炼来源排序并打质量标签
   * @param sources 来源列表
   * @param schoolName 学校名称
   * @param focus 关注关键词
   * @returns 排序后的来源
   */
  private rankSources(sources: SchoolSearchSource[], schoolName: string, focus: string): SchoolSearchSource[] {
    const schoolKeywords = this.buildSchoolKeywords(schoolName)
    const focusKeywords = this.buildFocusKeywords(focus)

    const scored = sources.map((source) => {
      const score = this.scoreSource(source, schoolKeywords, focusKeywords)
      return {
        ...source,
        domain: source.domain || this.extractDomain(source.url),
        quality: this.mapQuality(score),
        _score: score,
      }
    })

    const nonRedirectSources = scored.filter((source) => !this.isSearchRedirectUrl(source.url))
    const rankingPool = nonRedirectSources.length > 0 ? nonRedirectSources : scored
    const nonBlockedSources = rankingPool.filter((source) => !this.isBlockedResultDomain(source.url))
    const poolAfterBlockedFilter = nonBlockedSources.length > 0 ? nonBlockedSources : rankingPool
    const nonLowPrioritySources = poolAfterBlockedFilter.filter(
      (source) => !LOW_PRIORITY_DOMAINS.some((item) => source.domain.endsWith(item))
    )
    const displayPool = nonLowPrioritySources.length > 0 ? nonLowPrioritySources : poolAfterBlockedFilter

    displayPool.sort((left, right) => {
      if (right._score !== left._score) {
        return right._score - left._score
      }
      if (left.isOfficial !== right.isOfficial) {
        return left.isOfficial ? -1 : 1
      }
      return right.mentorHints.length + right.emails.length - (left.mentorHints.length + left.emails.length)
    })

    return displayPool.map(({ _score, ...source }) => source)
  }

  /**
   * @description 计算来源综合评分
   * @param source 来源信息
   * @param schoolKeywords 学校关键词
   * @param focusKeywords 关注关键词
   * @returns 分数
   */
  private scoreSource(source: SchoolSearchSource, schoolKeywords: string[], focusKeywords: string[]): number {
    let score = this.scoreSeedResult(source, schoolKeywords, focusKeywords)

    if (source.isOfficial) {
      score += 28
    }
    if (source.mentorHints.length > 0) {
      score += Math.min(24, source.mentorHints.length * 6)
    }
    if (source.emails.length > 0) {
      score += Math.min(20, source.emails.length * 5)
    }

    const summaryLowerText = source.summary.toLowerCase()
    for (const keyword of SEARCH_PRIORITY_KEYWORDS) {
      if (summaryLowerText.includes(keyword.toLowerCase())) {
        score += 4
      }
    }

    if (this.isSearchRedirectUrl(source.url)) {
      score -= 100
    }
    if (this.isBlockedResultDomain(source.url)) {
      score -= 200
    }
    if (LOW_PRIORITY_DOMAINS.some((item) => source.domain.endsWith(item))) {
      score -= 40
    }

    return score
  }

  /**
   * @description 根据评分映射质量等级
   * @param score 评分
   * @returns 质量等级
   */
  private mapQuality(score: number): SchoolSearchQuality {
    if (score >= 95) {
      return 'high'
    }
    if (score >= 58) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * @description 提取链接域名
   * @param url 链接地址
   * @returns 域名
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  /**
   * @description 判断是否为搜索引擎中转链接
   * @param url 链接地址
   * @returns 是否中转链接
   */
  private isSearchRedirectUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.toLowerCase()
      const pathname = parsed.pathname.toLowerCase()

      return SEARCH_REDIRECT_RULES.some((rule) => {
        if (!hostname.endsWith(rule.hostname)) {
          return false
        }
        return pathname.startsWith(rule.pathPrefix)
      })
    } catch {
      return false
    }
  }

  /**
   * @description 判断是否为应剔除的搜索引擎结果域名
   * @param url 链接地址
   * @returns 是否剔除
   */
  private isBlockedResultDomain(url: string): boolean {
    const domain = this.extractDomain(url)
    if (!domain) {
      return false
    }

    return BLOCKED_RESULT_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))
  }

  /**
   * @description 解析搜索引擎中转地址，获取最终落地链接
   * @param rawUrl 原始结果地址
   * @returns 跳转后的地址
   */
  private async resolveSearchUrl(rawUrl: string): Promise<string> {
    const normalized = this.normalizeResultUrl(rawUrl)
    if (!normalized) {
      return rawUrl
    }

    if (!this.isSearchRedirectUrl(normalized)) {
      return normalized
    }

    const queryTarget = this.extractRedirectTargetFromUrl(normalized)
    if (queryTarget && !this.isSearchRedirectUrl(queryTarget)) {
      return queryTarget
    }

    const manualResolved = await this.resolveByManualRedirect(normalized)
    if (manualResolved && !this.isSearchRedirectUrl(manualResolved)) {
      return manualResolved
    }

    const followResolved = await this.resolveByFollowFetch(normalized)
    if (followResolved && !this.isSearchRedirectUrl(followResolved)) {
      return followResolved
    }

    return normalized
  }

  /**
   * @description 从 URL 查询参数中提取可能的目标地址
   * @param rawUrl 原始中转地址
   * @returns 目标地址
   */
  private extractRedirectTargetFromUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl)
      for (const key of REDIRECT_QUERY_KEYS) {
        const value = parsed.searchParams.get(key)
        if (!value) {
          continue
        }
        const normalizedCandidate = this.normalizeResultUrl(this.decodePotentialUrl(value))
        if (normalizedCandidate) {
          return normalizedCandidate
        }
      }
      return ''
    } catch {
      return ''
    }
  }

  /**
   * @description 通过手动跟随重定向链还原目标地址
   * @param startUrl 起始地址
   * @returns 还原后的地址
   */
  private async resolveByManualRedirect(startUrl: string): Promise<string> {
    let currentUrl = startUrl

    for (let index = 0; index < 4; index += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REDIRECT_RESOLVE_TIMEOUT_MS)

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'user-agent': DEFAULT_USER_AGENT,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'cache-control': 'no-cache',
          },
          signal: controller.signal,
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location) {
            break
          }
          const nextUrl = this.normalizeResultUrl(new URL(location, currentUrl).toString())
          if (!nextUrl || nextUrl === currentUrl) {
            break
          }
          currentUrl = nextUrl
          continue
        }

        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('text/html')) {
            const html = await response.text()
            const htmlTarget = this.extractRedirectTargetFromHtml(html, currentUrl)
            if (htmlTarget && htmlTarget !== currentUrl) {
              currentUrl = htmlTarget
              continue
            }
          }
        }
        break
      } catch {
        break
      } finally {
        clearTimeout(timer)
      }
    }

    return this.normalizeResultUrl(currentUrl) || startUrl
  }

  /**
   * @description 通过自动重定向请求获取最终地址
   * @param url 中转地址
   * @returns 最终地址
   */
  private async resolveByFollowFetch(url: string): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REDIRECT_RESOLVE_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      })
      return this.normalizeResultUrl(response.url || '') || url
    } catch {
      return url
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * @description 从中转页 HTML 提取潜在目标地址
   * @param html HTML 内容
   * @param baseUrl 基础地址
   * @returns 目标地址
   */
  private extractRedirectTargetFromHtml(html: string, baseUrl: string): string {
    const patterns = [
      /http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)[^"']*["']/i,
      /location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
      /window\.open\(\s*["']([^"']+)["']/i,
      /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/i,
    ]

    for (const pattern of patterns) {
      const matched = html.match(pattern)
      if (!matched?.[1]) {
        continue
      }

      const candidate = this.normalizeResultUrl(
        this.toAbsoluteUrl(this.decodePotentialUrl(this.decodeHtml(matched[1])), baseUrl)
      )
      if (!candidate) {
        continue
      }
      return candidate
    }

    return ''
  }

  /**
   * @description 将相对/绝对 URL 规范为绝对 URL
   * @param candidate 候选地址
   * @param baseUrl 基础地址
   * @returns 绝对地址
   */
  private toAbsoluteUrl(candidate: string, baseUrl: string): string {
    try {
      return new URL(candidate, baseUrl).toString()
    } catch {
      return candidate
    }
  }

  /**
   * @description 尝试解码可能多次编码的 URL
   * @param value 原始值
   * @returns 解码后的字符串
   */
  private decodePotentialUrl(value: string): string {
    let decoded = value.trim()
    for (let index = 0; index < 3; index += 1) {
      try {
        const nextValue = decodeURIComponent(decoded)
        if (nextValue === decoded) {
          break
        }
        decoded = nextValue
      } catch {
        break
      }
    }
    return this.decodeHtml(decoded)
  }

  /**
   * @description 请求任意文本内容（不限制 Content-Type）
   * @param url 请求地址
   * @param timeoutMs 超时时间
   * @returns 响应文本
   */
  private async fetchRawText(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
          accept: '*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        return ''
      }

      return await response.text()
    } catch {
      return ''
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * @description 请求文本内容（带超时与基础头）
   * @param url 请求地址
   * @param timeoutMs 超时时间
   * @returns 页面文本，失败时返回空字符串
   */
  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        return ''
      }

      const contentType = response.headers.get('content-type') || ''
      if (
        contentType
        && !contentType.includes('text/html')
        && !contentType.includes('application/xhtml+xml')
      ) {
        return ''
      }

      return await response.text()
    } catch {
      return ''
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * @description 构建页面摘要
   * @param text 页面纯文本
   * @param hints 关键词命中段落
   * @param fallback 兜底摘要
   * @returns 摘要内容
   */
  private buildSummary(text: string, hints: string[], fallback: string): string {
    if (hints.length > 0) {
      return hints.slice(0, 2).join('；')
    }

    const compact = text.replace(/\s+/g, ' ').trim()
    if (compact.length >= 20) {
      return `${compact.slice(0, 180)}${compact.length > 180 ? '...' : ''}`
    }

    return fallback
  }

  /**
   * @description 从正文中提取导师相关线索
   * @param text 页面纯文本
   * @param schoolName 学校名称
   * @returns 命中片段
   */
  private extractMentorHints(text: string, schoolName: string): string[] {
    const keywords = [
      schoolName,
      '导师',
      '教授',
      '副教授',
      '研究员',
      '博导',
      '硕导',
      '研究方向',
      '招生',
      '联系方式',
      '邮箱',
      'E-mail',
      'Email',
    ]

    const segments = text
      .split(/[\r\n。！；]/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length >= 8 && segment.length <= 140)

    const matched: string[] = []
    for (const segment of segments) {
      const hasKeyword = keywords.some((keyword) => segment.includes(keyword))
      if (!hasKeyword) {
        continue
      }

      matched.push(segment)
      if (matched.length >= 6) {
        break
      }
    }

    return this.uniqueList(matched)
  }

  /**
   * @description 提取正文中的邮箱地址
   * @param text 页面纯文本
   * @returns 邮箱列表
   */
  private extractEmails(text: string): string[] {
    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
    const normalized = matches
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length <= 120)

    return this.uniqueList(normalized).slice(0, 8)
  }

  /**
   * @description 判断是否可能为官网或教育站点
   * @param url 页面地址
   * @returns 是否疑似官网
   */
  private isLikelyOfficialSite(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname.endsWith('.edu.cn')
        || hostname.includes('.edu.')
        || hostname.endsWith('.ac.cn')
        || hostname.startsWith('yz.')
    } catch {
      return false
    }
  }

  /**
   * @description 判断是否为高校/科研域名
   * @param url 页面地址
   * @returns 是否学术域名
   */
  private isAcademicDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname.endsWith('.edu.cn')
        || hostname.endsWith('.ac.cn')
        || hostname.includes('.edu.')
        || hostname.startsWith('yz.')
    } catch {
      return false
    }
  }

  /**
   * @description 将 HTML 转换为纯文本
   * @param html HTML 内容
   * @returns 纯文本
   */
  private htmlToText(html: string): string {
    const withoutScript = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    const withoutTags = withoutScript.replace(/<[^>]+>/g, ' ')
    return this.cleanText(withoutTags)
  }

  /**
   * @description 清洗 HTML 片段文本
   * @param text 原始文本
   * @returns 清洗后的文本
   */
  private cleanText(text: string): string {
    return this.decodeHtml(text)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim()
  }

  /**
   * @description 解码 HTML 实体
   * @param text 原始文本
   * @returns 解码后的文本
   */
  private decodeHtml(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, '\'')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_matched, codePoint) => {
        const parsed = Number.parseInt(codePoint, 10)
        if (!Number.isFinite(parsed)) {
          return ''
        }
        return String.fromCodePoint(parsed)
      })
  }

  /**
   * @description 对 URL 做去重归一化
   * @param url 链接地址
   * @returns 归一化键
   */
  private normalizeUrlForDedup(url: string): string {
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      if (parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1)
      }
      parsed.searchParams.delete('from')
      parsed.searchParams.delete('utm_source')
      parsed.searchParams.delete('utm_medium')
      parsed.searchParams.delete('utm_campaign')
      return parsed.toString().toLowerCase()
    } catch {
      return ''
    }
  }

  /**
   * @description 标准化搜索结果 URL
   * @param rawUrl 原始 URL
   * @returns 标准 URL，不合法则返回空字符串
   */
  private normalizeResultUrl(rawUrl: string): string {
    if (!rawUrl) {
      return ''
    }

    const decoded = rawUrl.trim()
    if (!decoded || decoded.startsWith('javascript:')) {
      return ''
    }
    if (decoded.startsWith('/')) {
      return ''
    }

    try {
      const parsed = new URL(decoded)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return ''
      }
      parsed.hash = ''
      return parsed.toString()
    } catch {
      return ''
    }
  }

  /**
   * @description 解析 DuckDuckGo 跳转链接
   * @param rawUrl 原始地址
   * @returns 真实地址
   */
  private decodeDuckDuckGoUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl, 'https://duckduckgo.com')
      if (parsed.hostname === 'duckduckgo.com' && parsed.pathname === '/l/') {
        const target = parsed.searchParams.get('uddg')
        if (target) {
          return decodeURIComponent(target)
        }
      }
      return parsed.toString()
    } catch {
      return rawUrl
    }
  }

  /**
   * @description 从 HTML 片段中提取简短摘要
   * @param htmlSnippet HTML 片段
   * @returns 摘要文本
   */
  private extractSnippet(htmlSnippet: string): string {
    const plainText = this.cleanText(htmlSnippet)
    if (!plainText) {
      return ''
    }
    return plainText.slice(0, 140)
  }

  /**
   * @description 数组去重
   * @param values 原始数组
   * @returns 去重数组
   */
  private uniqueList(values: string[]): string[] {
    return Array.from(new Set(values))
  }
}

export const schoolSearchService = new SchoolSearchService()
