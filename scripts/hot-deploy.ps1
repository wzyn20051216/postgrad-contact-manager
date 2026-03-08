param(
  [ValidateSet('init', 'client', 'server', 'all', 'check')]
  [string]$Target = 'client',

  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 调用 Python 热发布脚本。
$scriptPath = (Resolve-Path '.\scripts\hot-deploy.py').Path
if ($SkipBuild.IsPresent) {
  & python $scriptPath --target $Target --skip-build
} else {
  & python $scriptPath --target $Target
}

exit $LASTEXITCODE
