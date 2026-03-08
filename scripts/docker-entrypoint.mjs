import { spawn } from 'node:child_process'

/**
 * @description 以继承标准输入输出的方式执行子进程。
 * @param command 可执行命令
 * @param args 命令参数
 * @returns 子进程退出码
 */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`子进程被信号中断：${signal}`))
        return
      }
      resolve(code ?? 0)
    })
  })
}

/**
 * @description 启动应用前自动执行数据库迁移。
 */
async function main() {
  const autoMigrate = process.env.AUTO_MIGRATE !== 'false'

  if (autoMigrate) {
    console.log('[startup] 开始执行 Prisma 生产迁移...')
    const migrateCode = await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'])
    if (migrateCode !== 0) {
      process.exit(migrateCode)
    }
    console.log('[startup] Prisma 迁移完成。')
  } else {
    console.log('[startup] 已跳过自动迁移（AUTO_MIGRATE=false）。')
  }

  console.log('[startup] 启动应用服务...')
  const serverProcess = spawn('node', ['packages/server/dist/index.js'], {
    stdio: 'inherit',
  })

  const forwardSignal = (signal) => {
    if (!serverProcess.killed) {
      serverProcess.kill(signal)
    }
  }

  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  serverProcess.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error('[startup] 启动失败：', error)
  process.exit(1)
})
