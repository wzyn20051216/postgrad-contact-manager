$ErrorActionPreference = 'Stop'
$project = 'E:\desktop\管理系统\postgrad-contact-manager'
$stdoutLog = Join-Path $project 'scripts\auth-smoke-test.stdout.log'
$stderrLog = Join-Path $project 'scripts\auth-smoke-test.stderr.log'

if (Test-Path $stdoutLog) { Remove-Item $stdoutLog -Force }
if (Test-Path $stderrLog) { Remove-Item $stderrLog -Force }

$serverCommand = "cd /d `"$project`" && set PORT=3101 && node .\packages\server\dist\index.js"
$process = Start-Process -FilePath cmd.exe -ArgumentList '/c', $serverCommand -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -WindowStyle Hidden

try {
  $healthReady = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 750
    try {
      $null = Invoke-RestMethod -Uri 'http://localhost:3101/api/health' -Method GET
      $healthReady = $true
      break
    }
    catch {
    }
  }

  if (-not $healthReady) {
    $stdout = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { '' }
    $stderr = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { '' }
    throw "服务未能正常启动。stdout: $stdout stderr: $stderr"
  }

  $email = 'codex-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '@example.com'
  $codeResp = Invoke-RestMethod -Uri 'http://localhost:3101/api/auth/register-code' -Method POST -ContentType 'application/json' -Body (@{ email = $email } | ConvertTo-Json)

  if (-not $codeResp.data.debugCode) {
    throw '未拿到调试验证码'
  }

  $registerResp = Invoke-RestMethod -Uri 'http://localhost:3101/api/auth/register' -Method POST -ContentType 'application/json' -Body (@{
    email = $email
    password = 'abc12345'
    nickname = 'Codex测试'
    verificationCode = $codeResp.data.debugCode
  } | ConvertTo-Json)

  $loginResp = Invoke-RestMethod -Uri 'http://localhost:3101/api/auth/login' -Method POST -ContentType 'application/json' -Body (@{
    email = $email
    password = 'abc12345'
  } | ConvertTo-Json)

  [PSCustomObject]@{
    registerSuccess = $registerResp.success
    loginSuccess = $loginResp.success
    emailVerified = $registerResp.data.user.emailVerified
    githubUsername = $registerResp.data.user.githubUsername
  } | ConvertTo-Json -Compress
}
finally {
  if ($process -and !$process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
