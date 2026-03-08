import { resolve4, resolve6 } from 'node:dns/promises'

const DOH_PROVIDERS = [
  {
    name: 'Google DoH',
    url: (domain, type) => `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
    options: undefined,
  },
  {
    name: 'Cloudflare DoH',
    url: (domain, type) =>
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
    options: {
      headers: {
        accept: 'application/dns-json',
      },
    },
  },
]

/**
 * @description 解析命令行参数或环境变量中的域名。
 * @returns {string} 域名
 */
function resolveDomain() {
  const fromArgv = process.argv[2]?.trim()
  const fromEnv = process.env.DOMAIN?.trim()
  const domain = fromArgv || fromEnv

  if (!domain) {
    throw new Error('请提供域名，例如：pnpm verify:domain -- example.com')
  }

  return domain
}

/**
 * @description 执行带超时控制的请求。
 * @param {string} url 请求地址
 * @param {RequestInit} [options] 请求配置
 * @returns {Promise<Response>} 响应对象
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * @description 输出步骤日志。
 * @param {string} message 日志信息
 */
function logStep(message) {
  console.log(`[验证] ${message}`)
}

/**
 * @description 判断 IPv4 是否为可公网路由地址。
 * @param {string} ip IPv4 地址
 * @returns {boolean} 是否为公网 IPv4
 */
function isPublicIpv4(ip) {
  const parts = ip.split('.').map((item) => Number.parseInt(item, 10))
  if (parts.length !== 4 || parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
    return false
  }

  const [a, b, c] = parts
  const firstTwo = a * 256 + b

  if (a === 0) return false
  if (a === 10) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 192 && b === 0 && c === 2) return false
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  if (firstTwo >= 0xc612 && firstTwo <= 0xc613) return false // 198.18.0.0/15
  if (a >= 224) return false

  return true
}

/**
 * @description 去重并清理 DNS 结果。
 * @param {string[]} items 原始结果
 * @returns {string[]} 清理后的结果
 */
function normalizeDnsList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

/**
 * @description 通过公网 DoH 解析指定记录类型。
 * @param {string} domain 目标域名
 * @param {'A' | 'AAAA'} type 记录类型
 * @returns {Promise<{ provider: string, records: string[] }>} 解析结果
 */
async function resolveViaDoh(domain, type) {
  const errors = []

  for (const provider of DOH_PROVIDERS) {
    try {
      const response = await fetchWithTimeout(provider.url(domain, type), provider.options)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json()
      const typeCode = type === 'A' ? 1 : 28
      const records = normalizeDnsList(
        Array.isArray(payload?.Answer)
          ? payload.Answer.filter((item) => item?.type === typeCode).map((item) => String(item.data || ''))
          : []
      )

      return {
        provider: provider.name,
        records,
      }
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`)
    }
  }

  throw new Error(`DoH 查询失败：${errors.join('；')}`)
}

/**
 * @description 判断当前 DNS 结果是否为可接受状态。
 * @param {string[]} v4List IPv4 列表
 * @param {string[]} v6List IPv6 列表
 * @returns {boolean} 是否可接受
 */
function hasUsableDnsResult(v4List, v6List) {
  return v4List.some((ip) => isPublicIpv4(ip)) || v6List.length > 0
}

/**
 * @description 验证 DNS 解析结果。
 * @param {string} domain 目标域名
 */
async function verifyDns(domain) {
  logStep(`开始检查 DNS：${domain}`)
  const [ipv4, ipv6] = await Promise.allSettled([resolve4(domain), resolve6(domain)])

  const localV4List = normalizeDnsList(ipv4.status === 'fulfilled' ? ipv4.value : [])
  const localV6List = normalizeDnsList(ipv6.status === 'fulfilled' ? ipv6.value : [])

  if (localV4List.length > 0) {
    logStep(`系统 DNS - A 记录：${localV4List.join(', ')}`)
  }
  if (localV6List.length > 0) {
    logStep(`系统 DNS - AAAA 记录：${localV6List.join(', ')}`)
  }

  if (hasUsableDnsResult(localV4List, localV6List)) {
    return
  }

  logStep('系统 DNS 返回异常或不可公网路由，开始使用 DoH 复核')
  const [dohAResult, dohAAAAResult] = await Promise.allSettled([
    resolveViaDoh(domain, 'A'),
    resolveViaDoh(domain, 'AAAA'),
  ])

  const dohV4List = normalizeDnsList(dohAResult.status === 'fulfilled' ? dohAResult.value.records : [])
  const dohV6List = normalizeDnsList(dohAAAAResult.status === 'fulfilled' ? dohAAAAResult.value.records : [])
  const dohProvider =
    (dohAResult.status === 'fulfilled' && dohAResult.value.provider) ||
    (dohAAAAResult.status === 'fulfilled' && dohAAAAResult.value.provider) ||
    '公网 DoH'

  if (dohV4List.length > 0) {
    logStep(`${dohProvider} - A 记录：${dohV4List.join(', ')}`)
  }
  if (dohV6List.length > 0) {
    logStep(`${dohProvider} - AAAA 记录：${dohV6List.join(', ')}`)
  }

  if (hasUsableDnsResult(dohV4List, dohV6List)) {
    logStep('检测到当前网络的系统 DNS 存在缓存/污染/劫持现象，但公网解析已经正确')
    return
  }

  const displayedV4 = localV4List.length > 0 ? localV4List : dohV4List
  if (displayedV4.length > 0 && displayedV4.every((ip) => !isPublicIpv4(ip)) && dohV6List.length === 0 && localV6List.length === 0) {
    throw new Error(
      `A 记录不是公网可路由地址（当前：${displayedV4.join(
        ', '
      )}）。若为 198.18.0.0/15（如 198.18.0.30）属于测试网段，公网证书签发会失败。`
    )
  }

  throw new Error(`DNS 解析失败：${domain} 未查询到可用的 A/AAAA 记录`)
}

/**
 * @description 验证 HTTPS 健康检查接口。
 * @param {string} domain 目标域名
 */
async function verifyHttps(domain) {
  const healthUrl = `https://${domain}/api/health`
  logStep(`检查 HTTPS 健康接口：${healthUrl}`)
  const response = await fetchWithTimeout(healthUrl)

  if (!response.ok) {
    throw new Error(`HTTPS 健康接口状态异常：${response.status}`)
  }

  const payload = await response.json().catch(() => null)
  if (!payload || payload.status !== 'ok') {
    throw new Error('HTTPS 健康接口返回格式异常')
  }

  logStep('HTTPS 健康接口返回正常')
}

/**
 * @description 检查 HTTP 到 HTTPS 的行为（提示级，不阻断）。
 * @param {string} domain 目标域名
 */
async function verifyHttpRedirect(domain) {
  const httpUrl = `http://${domain}/`
  logStep(`检查 HTTP 行为：${httpUrl}`)
  const response = await fetchWithTimeout(httpUrl, { redirect: 'manual' })

  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get('location') || ''
    logStep(`HTTP 已跳转：${response.status} -> ${location}`)
    return
  }

  if (response.ok) {
    logStep(`HTTP 可直接访问（状态 ${response.status}），如需强制 HTTPS 可在代理层开启重定向`)
    return
  }

  logStep(`HTTP 检查返回状态 ${response.status}（非阻断）`)
}

async function main() {
  const domain = resolveDomain()
  await verifyDns(domain)
  await verifyHttps(domain)
  await verifyHttpRedirect(domain)
  logStep('域名接入验证通过 ✅')
}

main().catch((error) => {
  console.error(`[验证失败] ${error.message}`)
  process.exit(1)
})
