# Atalho Windows: mesmo fluxo do setup.mjs
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
node (Join-Path $PSScriptRoot "setup.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
