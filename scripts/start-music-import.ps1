$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoPath
$pythonPath = Join-Path $repoPath '.venv\Scripts\python.exe'
$requirementsPath = Join-Path $repoPath 'services\music-import\requirements.txt'
$stampPath = Join-Path $repoPath '.venv\safi-import-requirements.sha256'
try {
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        Write-Host 'First-time setup: creating the SAFI importer environment...'
        & python -m venv (Join-Path $repoPath '.venv')
        if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.12 or newer, then open this launcher again.' }
    }
    $requirementsHash = (Get-FileHash -LiteralPath $requirementsPath -Algorithm SHA256).Hash
    $installedHash = if (Test-Path -LiteralPath $stampPath) { (Get-Content -LiteralPath $stampPath -Raw).Trim() } else { '' }
    if ($installedHash -ne $requirementsHash) {
        Write-Host 'Installing importer dependencies (only on first run or after requirements change)...'
        & $pythonPath -m pip install -r $requirementsPath
        if ($LASTEXITCODE -ne 0) { throw 'Dependency setup failed. Check your connection and try again.' }
        Set-Content -LiteralPath $stampPath -Value $requirementsHash
    }
    & $pythonPath -u (Join-Path $repoPath 'services\music-import\desktop.py') @args
    exit $LASTEXITCODE
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
