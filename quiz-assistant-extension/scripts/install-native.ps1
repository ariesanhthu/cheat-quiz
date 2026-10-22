param([string]$ExtensionId)
$ErrorActionPreference = 'Stop'
$quizSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$quizInstall = Join-Path $env:LOCALAPPDATA 'QuizAssistant\connector'
New-Item -ItemType Directory -Path $quizInstall -Force | Out-Null
$quizNode = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $quizNode) {
  Write-Host 'Installing portable Node.js for the connector...'
  $quizSums = (Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt').Content
  $quizNodeRelease = [regex]::Match($quizSums, '(?m)^([a-f0-9]{64})\s+(node-v22\.[0-9]+\.[0-9]+-win-x64\.zip)\r?$')
  if (-not $quizNodeRelease.Success) { throw 'Cannot verify official Node.js download metadata.' }
  $quizArchiveName = $quizNodeRelease.Groups[2].Value
  $quizNodeArchive = Join-Path $quizInstall $quizArchiveName
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/latest-v22.x/$quizArchiveName" -OutFile $quizNodeArchive
  if ((Get-FileHash -LiteralPath $quizNodeArchive -Algorithm SHA256).Hash -ne $quizNodeRelease.Groups[1].Value) { throw 'Node.js checksum mismatch. Setup stopped.' }
  Expand-Archive -LiteralPath $quizNodeArchive -DestinationPath $quizInstall -Force
  $quizNode = [PSCustomObject]@{ Source = (Join-Path $quizInstall ($quizArchiveName.Replace('.zip','') + '\node.exe')) }
}
$quizNodeVersion = & $quizNode.Source --version
if ([int]($quizNodeVersion -replace '^v(\d+).*','$1') -lt 22) { throw 'Node.js 22+ is required.' }
$quizCodex = Get-Command codex.exe -ErrorAction SilentlyContinue
if ($quizCodex) { $quizCodexPath = $quizCodex.Source } else {
  $quizCodexPath = $null
  foreach ($quizEditor in @('.vscode','.vscode-insiders','.cursor')) {
    $quizEditorRoot = Join-Path $env:USERPROFILE "$quizEditor\extensions"
    if (Test-Path -LiteralPath $quizEditorRoot) {
      $quizFound = Get-ChildItem -LiteralPath $quizEditorRoot -Directory -Filter 'openai.chatgpt-*' | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin\windows-x86_64\codex.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
      if ($quizFound) { $quizCodexPath = $quizFound; break }
    }
  }
}
if (-not $quizCodexPath) {
  Write-Host 'Installing official Codex connector...'
  $quizDeps = Join-Path $quizInstall 'deps'
  $quizNpm = Join-Path (Split-Path -Parent $quizNode.Source) 'npm.cmd'
  $env:PATH = (Split-Path -Parent $quizNode.Source) + [IO.Path]::PathSeparator + $env:PATH
  & $quizNpm install --prefix $quizDeps '@openai/codex' --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Cannot install Codex. Check internet connection and run SETUP again.' }
  $quizCodexPath = (Get-ChildItem -LiteralPath (Join-Path $quizDeps 'node_modules') -Filter codex.exe -Recurse -File | Select-Object -First 1).FullName
  if (-not $quizCodexPath) { throw 'Codex native executable not found.' }
}
$quizIds = [Collections.Generic.HashSet[string]]::new()
if ($ExtensionId) {
  if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID.' }
  [void]$quizIds.Add($ExtensionId)
}
# Read only extension install metadata; never read cookies, passwords or chat credentials.
$quizDetectedIds = & $quizNode.Source (Join-Path $PSScriptRoot 'detect-chrome.cjs') | ConvertFrom-Json
foreach ($quizDetectedId in $quizDetectedIds) { if ($quizDetectedId -match '^[a-p]{32}$') { [void]$quizIds.Add($quizDetectedId) } }
if ($quizIds.Count -eq 0) {
  Write-Host 'Open the extension popup > Install connection > copy extension ID.'
  $quizPastedId = Read-Host 'Paste extension ID'
  if ($quizPastedId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID.' }
  [void]$quizIds.Add($quizPastedId)
}
foreach ($quizFile in @('core.js','ai.js','scripts\cli-bridge.cjs','scripts\native-host.cjs')) {
  $quizDestination = Join-Path $quizInstall $quizFile
  New-Item -ItemType Directory -Path (Split-Path -Parent $quizDestination) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $quizSource $quizFile) -Destination $quizDestination -Force
}
$quizWrapper = Join-Path $quizInstall 'host.cmd'
$quizWrapperText = "@echo off`r`nset `"QA_CODEX_BIN=$($quizCodexPath.Replace('%','%%'))`"`r`n`"$($quizNode.Source.Replace('%','%%'))`" `"$((Join-Path $quizInstall 'scripts\native-host.cjs').Replace('%','%%'))`" %*`r`n"
[IO.File]::WriteAllText($quizWrapper, $quizWrapperText, [Text.Encoding]::Default)
$quizManifest = Join-Path $quizInstall 'vn.quizassistant.ai.json'
$quizHost = @{ name = 'vn.quizassistant.ai'; description = 'Quiz Assistant ChatGPT connector'; path = $quizWrapper; type = 'stdio'; allowed_origins = @($quizIds | ForEach-Object { "chrome-extension://$_/" }) }
[IO.File]::WriteAllText($quizManifest, ($quizHost | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$quizRegistry = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\vn.quizassistant.ai'
New-Item -Path $quizRegistry -Force | Out-Null
Set-Item -Path $quizRegistry -Value $quizManifest
Write-Host 'Done. Open Quiz Assistant > ChatGPT > Sign in. No token or localhost setup needed.' -ForegroundColor Green
