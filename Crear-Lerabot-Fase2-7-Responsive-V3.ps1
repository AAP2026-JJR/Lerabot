param([switch]$Aplicar)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $raiz 'package.json'))) { throw 'Coloca este script junto a package.json en la raiz de LERABOT.' }

# Cada sustitucion debe existir exactamente una vez; se cancela TODO antes de escribir si hay un conflicto.
$cambios = @(
  @{ Ruta='src/nucleo/layouts/MainLayout.vue'; Pares=@(
    @{ Antes='class="min-h-screen lg:pl-[248px]"'; Despues='class="min-h-screen min-w-0 lg:pl-[248px]"' },
    @{ Antes='class="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8"'; Despues='class="mx-auto w-full min-w-0 max-w-[1440px] p-3 sm:p-6 lg:p-8"' }
  )},
  @{ Ruta='src/compartido/componentes/MenuLateral.vue'; Pares=@(
    @{ Antes='class="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col'; Despues='class="fixed inset-y-0 left-0 z-40 flex w-[min(248px,85vw)] overflow-y-auto flex-col' }
  )},
  @{ Ruta='src/compartido/componentes/Encabezado.vue'; Pares=@(
    @{ Antes='class="text-xl font-bold text-[#102c37]"'; Despues='class="truncate text-base font-bold text-[#102c37] sm:text-xl"' },
    @{ Antes='class="sticky top-0 z-20 flex h-[72px]'; Despues='class="sticky top-0 z-20 flex h-[72px] min-w-0' }
  )},
  @{ Ruta='src/compartido/componentes/TablaDatos.vue'; Pares=@(
    @{ Antes='class="overflow-x-auto rounded-2xl'; Despues='class="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl' },
    @{ Antes='class="w-full min-w-[480px] text-left text-sm"'; Despues='class="w-full min-w-[600px] text-left text-sm"' }
  )},
  @{ Ruta='src/modulos/exchanges/ExchangesView.vue'; Pares=@(
    @{ Antes='class="grid gap-4 sm:grid-cols-3"'; Despues='class="grid gap-4 md:grid-cols-3"' },
    @{ Antes='class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"'; Despues='class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"' }
  )},
  @{ Ruta='src/modulos/portafolio/PortafolioView.vue'; Pares=@(
    @{ Antes='class="grid gap-4 sm:grid-cols-3"'; Despues='class="grid gap-4 md:grid-cols-3"' }
  )},
  @{ Ruta='src/modulos/operaciones/OperacionesView.vue'; Pares=@(
    @{ Antes='class="grid gap-4 sm:grid-cols-3"'; Despues='class="grid gap-4 md:grid-cols-3"' }
  )},
  @{ Ruta='src/modulos/reportes/ReportesView.vue'; Pares=@(
    @{ Antes='class="grid gap-4 sm:grid-cols-3"'; Despues='class="grid gap-4 md:grid-cols-3"' }
  )}
)

$utf8SinBom = New-Object System.Text.UTF8Encoding($false)
$pendientes = @()
foreach ($entrada in $cambios) {
  $archivo = Join-Path $raiz ($entrada.Ruta -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path $archivo)) { throw "Falta archivo: $($entrada.Ruta). Ningun cambio aplicado." }
  $original = [IO.File]::ReadAllText($archivo, [Text.Encoding]::UTF8)
  $nuevo = $original
  # Los pares son objetos con nombres; PowerShell no puede aplanarlos en caracteres.
  foreach ($par in $entrada.Pares) {
    $antes = [string]$par.Antes
    $despues = [string]$par.Despues
    if ($antes -ceq $despues) { continue }
    $n = ([regex]::Matches($nuevo, [regex]::Escape($antes))).Count
    if ($n -ne 1) { throw "Conflicto en $($entrada.Ruta): se esperaba una coincidencia exacta de '$antes', hay $n. Ningun cambio aplicado." }
    $nuevo = $nuevo.Replace($antes, $despues)
  }
  if ($nuevo -cne $original) { $pendientes += @{ Ruta=$entrada.Ruta; Archivo=$archivo; Original=$original; Nuevo=$nuevo } }
}
Write-Host 'LERABOT - Fase 2.7 - Responsive VERSION 3'
Write-Host 'Cambios previstos (sin tocar datos, rutas ni API):'
foreach ($p in $pendientes) { Write-Host " - $($p.Ruta)" }
if (-not $Aplicar) { Write-Host 'Vista previa lista. Para aplicar: agrega -Aplicar'; exit 0 }
if ($pendientes.Count -eq 0) { Write-Host 'No hay cambios pendientes.'; exit 0 }
$respaldo = Join-Path $env:TEMP ('LERABOT-Fase2-7-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
foreach ($p in $pendientes) {
  $destino = Join-Path $respaldo ($p.Ruta -replace '/', [IO.Path]::DirectorySeparatorChar)
  New-Item -ItemType Directory -Path (Split-Path $destino -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $p.Archivo -Destination $destino -Force
}
try {
  foreach ($p in $pendientes) {
    [IO.File]::WriteAllText($p.Archivo, $p.Nuevo, $utf8SinBom)
    Write-Host "Actualizado: $($p.Ruta)"
  }
} catch {
  foreach ($p in $pendientes) {
    $destino = Join-Path $respaldo ($p.Ruta -replace '/', [IO.Path]::DirectorySeparatorChar)
    Copy-Item -LiteralPath $destino -Destination $p.Archivo -Force
  }
  throw
}
Write-Host "Respaldo: $respaldo"
Write-Host 'Valida: npm run build; luego prueba 375px, 768px y escritorio.'
Write-Host 'No hagas commit todavia.'
