/**
 * @description 从多个公网服务查询当前出口公网 IPv4。
 * @returns {Promise<string>} 公网 IPv4
 */
async function fetchPublicIp() {
  const endpoints = ['https://api.ipify.org', 'https://ifconfig.me/ip', 'https://ip.sb']

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) {
        continue
      }
      const ip = (await response.text()).trim()
      if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        return ip
      }
    } catch {
      // 忽略单个服务错误，继续尝试下一个服务。
    }
  }

  throw new Error('未能获取公网 IPv4，请在服务器上手动执行 curl ifconfig.me')
}

async function main() {
  const ip = await fetchPublicIp()
  console.log(`[公网IP] ${ip}`)
  console.log('请将域名 A 记录（@ / www）的记录值都改成这个 IP。')
}

main().catch((error) => {
  console.error(`[失败] ${error.message}`)
  process.exit(1)
})
