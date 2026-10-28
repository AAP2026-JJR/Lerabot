#requires -Version 5.1
<#
.SYNOPSIS
 Exporta una copia diagnostica del codigo ACTUAL de LERABOT, sin modificar el proyecto.
.USAGE
 powershell -NoProfile -ExecutionPolicy Bypass -File .\Exportar-LERABOT-Codigo-Actual.ps1
 powershell -NoProfile -ExecutionPolicy Bypass -File .\Exportar-LERABOT-Codigo-Actual.ps1 -Proyecto "C:\ruta\Lerabot"
#>
[CmdletBinding()]
param(
    [string]$Proyecto = (Get-Location).Path,
    [string]$Salida = ""
)
$ErrorActionPreference = 'Stop'
$Proyecto = (Resolve-Path -LiteralPath $Proyecto).Path.TrimEnd('\','/')
if (-not (Test-Path -LiteralPath (Join-Path $Proyecto 'package.json'))) {
    throw "No encuentro package.json en '$Proyecto'. Ejecuta desde la raiz de LERABOT o usa -Proyecto."
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($Salida)) { $Salida = Join-Path $Proyecto '_diagnosticos-lerabot' }
New-Item -ItemType Directory -Path $Salida -Force | Out-Null
$Salida = (Resolve-Path -LiteralPath $Salida).Path
$temporal = Join-Path ([System.IO.Path]::GetTempPath()) ("lerabot-snapshot-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporal -Force | Out-Null

# Inclusion selectiva. Evitamos secretos, cache, builds y directorios de dependencias.
$directorios = @('src','backend','infraestructura','scripts','docs','public','tests','test','e2e','.github')
$archivosRaiz = @('package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','vite.config.ts','vite.config.js','tsconfig.json','tsconfig.app.json','tsconfig.node.json','eslint.config.js','eslint.config.mjs','postcss.config.js','tailwind.config.js','tailwind.config.ts','README.md','index.html','.gitignore','.npmrc.example','amplify.yml','vitest.config.ts')
$bloquearDirs = @('node_modules','.git','.idea','.vscode','dist','build','coverage','.next','.nuxt','.output','.aws','.terraform','venv','.venv','__pycache__','tmp','temp','logs','.cache','.turbo','_diagnosticos-lerabot')
$bloquearNombres = @('.env','.env.local','.env.production','.env.development','.npmrc','credentials','config','id_rsa','id_ed25519','known_hosts')
$bloquearExt = @('.pem','.key','.p12','.pfx','.jks','.keystore','.asc','.sqlite','.db','.log','.zip','.7z','.rar','.exe','.dll','.png','.jpg','.jpeg','.webp','.gif','.ico','.mp4','.pdf','.docx','.xlsx','.pptx','.map')
$omitidos = New-Object System.Collections.Generic.List[string]
$incluidos = New-Object System.Collections.Generic.List[string]

function Esta-Bloqueado([string]$rel) {
    $r = $rel.Replace('\','/')
    $partes = $r.Split('/')
    foreach ($p in $partes) { if ($bloquearDirs -contains $p) { return $true } }
    $nombre = $partes[-1]
    $minus = $nombre.ToLowerInvariant()
    if ($minus -match '^\.env($|\.)' -or $minus -match '(^|[._-])(secret|secrets|credential|credentials|private[-_]?key|token|password|apikey|api[-_]?key)([._-]|$)') { return $true }
    if ($bloquearNombres -contains $minus) { return $true }
    if ($bloquearExt -contains [System.IO.Path]::GetExtension($minus)) { return $true }
    if ($minus -match '\.(min\.js|tsbuildinfo)$') { return $true }
    return $false
}

try {
    foreach ($dir in $directorios) {
        $origen = Join-Path $Proyecto $dir
        if (-not (Test-Path -LiteralPath $origen -PathType Container)) { continue }
        Get-ChildItem -LiteralPath $origen -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
            $rel = $_.FullName.Substring($Proyecto.Length).TrimStart('\','/')
            if (Esta-Bloqueado $rel) { $omitidos.Add($rel); return }
            if ($_.Length -gt 2MB) { $omitidos.Add("$rel [mayor de 2MB]"); return }
            $dest = Join-Path $temporal $rel
            $parent = Split-Path -Parent $dest
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
            $incluidos.Add($rel)
        }
    }
    foreach ($f in $archivosRaiz) {
        $origen = Join-Path $Proyecto $f
        if (Test-Path -LiteralPath $origen -PathType Leaf) {
            $dest = Join-Path $temporal $f
            Copy-Item -LiteralPath $origen -Destination $dest -Force
            $incluidos.Add($f)
        }
    }
    # Metadata util sin credenciales AWS, variables de entorno ni URL remotas con tokens.
    $gitRama = 'No disponible'; $gitEstado = 'No disponible'
    if (Get-Command git -ErrorAction SilentlyContinue) {
        try { $gitRama = (& git -C $Proyecto branch --show-current 2>$null | Out-String).Trim() } catch {}
        try { $gitEstado = (& git -C $Proyecto status --short 2>$null | Out-String).Trim() } catch {}
    }
    $reporte = @(
        'LERABOT - INVENTARIO DEL CODIGO ACTUAL',
        "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "Carpeta local: $Proyecto",
        "Rama Git: $gitRama",
        'Estado Git (archivos modificados):',
        $gitEstado,
        '',
        "Archivos incluidos: $($incluidos.Count)",
        '--- ARCHIVOS ---'
    ) + @($incluidos | Sort-Object) + @('','--- ARCHIVOS OMITIDOS (nombres solamente) ---') + @($omitidos | Sort-Object)
    $reportePath = Join-Path $temporal 'INVENTARIO_LERABOT.txt'
    $reporte | Out-File -LiteralPath $reportePath -Encoding UTF8
    $zip = Join-Path $Salida "LERABOT-CODIGO-ACTUAL-$stamp.zip"
    Compress-Archive -Path (Join-Path $temporal '*') -DestinationPath $zip -CompressionLevel Optimal -Force
    Write-Host ''
    Write-Host 'EXPORTACION COMPLETADA' -ForegroundColor Green
    Write-Host "ZIP: $zip" -ForegroundColor Cyan
    Write-Host "Archivos incluidos: $($incluidos.Count)"
    Write-Host "Archivos excluidos: $($omitidos.Count)"
    Write-Host 'No se modifico el codigo fuente ni se consulto AWS.'
    Write-Host ''
    Write-Host 'Adjunta este ZIP en el chat para revisar la version actual de LERABOT.' -ForegroundColor Yellow
    Write-Warning 'Revisa el ZIP antes de compartirlo: archivos de codigo pueden contener claves incrustadas. Si encuentras alguna, retirala antes de enviarlo.'
}
finally {
    if (Test-Path -LiteralPath $temporal) { Remove-Item -LiteralPath $temporal -Recurse -Force }
}
