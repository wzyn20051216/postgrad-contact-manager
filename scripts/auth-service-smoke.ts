async function main() {
  const timestamp = Date.now()
  const smokeEmail = `codex-${timestamp}@example.com`

  process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'demo-client-id'
  process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'demo-client-secret'
  process.env.GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/auth/github/callback'

  const [{ AuthService }, { prisma }] = await Promise.all([
    import('../packages/server/src/services/auth.service.ts'),
    import('../packages/server/src/config/database.ts'),
  ])

  const authService = new AuthService()

  try {
    const codeResult = await authService.sendRegisterCode(smokeEmail)
    if (!codeResult.debugCode) {
      throw new Error('未返回调试验证码，无法完成本地烟测')
    }

    const registerResult = await authService.register(
      smokeEmail,
      'abc12345',
      codeResult.debugCode,
      'Codex测试'
    )

    const loginResult = await authService.login(smokeEmail, 'abc12345')
    const githubAuthorizeUrl = authService.getGithubAuthorizeUrl('/dashboard', 'login')

    console.log(
      JSON.stringify(
        {
          sendCodeOk: Boolean(codeResult.debugCode),
          registerOk: Boolean(registerResult.token),
          loginOk: Boolean(loginResult.token),
          emailVerified: registerResult.user.emailVerified,
          githubAuthorizeUrl,
        },
        null,
        2
      )
    )
  }
  finally {
    await prisma.emailVerificationCode.deleteMany({ where: { email: smokeEmail } })
    await prisma.user.deleteMany({ where: { email: smokeEmail } })
    await prisma.$disconnect()
  }
}

void main()
