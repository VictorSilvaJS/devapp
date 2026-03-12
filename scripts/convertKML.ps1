param()

$kmlPath = "C:\Users\e_vsjesus\Desktop\devapp\Fazenda Sela de Prata I.kml"
$outPath = "C:\Users\e_vsjesus\Desktop\devapp\src\assets\kml\selaDeprata1.ts"

$cores = @('#22C55E','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#10B981','#EC4899','#84CC16','#6366F1','#14B8A6','#F43F5E','#A855F7','#0EA5E9','#D97706')

[xml]$kml = Get-Content $kmlPath -Encoding UTF8 -Raw
$placemarks = $kml.kml.Document.Folder.Placemark
Write-Host "Placemarks encontrados: $($placemarks.Count)"

# Agrupa por nome
$groups = [ordered]@{}
foreach ($pm in $placemarks) {
    $name = $pm.name
    $coordText = $pm.LineString.coordinates.Trim()
    $rawPts = $coordText -split '\s+' | Where-Object { $_ -ne '' }
    if (-not $groups.Contains($name)) {
        $groups[$name] = New-Object 'System.Collections.Generic.List[PSObject]'
    }
    foreach ($pt in $rawPts) {
        $parts = $pt -split ','
        if ($parts.Count -ge 2) {
            $lng = [double]::Parse($parts[0], [System.Globalization.CultureInfo]::InvariantCulture)
            $lat = [double]::Parse($parts[1], [System.Globalization.CultureInfo]::InvariantCulture)
            $obj = New-Object PSObject -Property @{ lat=$lat; lng=$lng }
            $groups[$name].Add($obj)
        }
    }
}

Write-Host "Grupos: $($groups.Count)"
foreach ($k in $groups.Keys) { Write-Host "  $k : $($groups[$k].Count) pts" }

# Simplificacao por amostragem uniforme
function Get-Sampled($pts, $maxPts) {
    if ($pts.Count -le $maxPts) { return [System.Collections.Generic.List[object]]$pts }
    $step = [Math]::Ceiling($pts.Count / ($maxPts - 1))
    $result = [System.Collections.Generic.List[object]]::new()
    for ($i = 0; $i -lt $pts.Count - 1; $i += $step) { $result.Add($pts[$i]) }
    $result.Add($pts[$pts.Count - 1])
    return $result
}

$inv = [System.Globalization.CultureInfo]::InvariantCulture
$idx = 0
$sb = [System.Text.StringBuilder]::new()

$null = $sb.AppendLine("// Dados convertidos automaticamente de: Fazenda Sela de Prata I.kml")
$null = $sb.AppendLine("// Data: $(Get-Date -Format 'yyyy-MM-dd')")
$null = $sb.AppendLine("import { TalhaoMapa } from '../../components/MapaFazendaView';")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("export const SELA_DEPRATA_1_NOME = 'Fazenda Sela de Prata I';")
$null = $sb.AppendLine("export const SELA_DEPRATA_1_PRODUTOR_ID = 'p_sela1';")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("export const talhoesSelaDeprata1: TalhaoMapa[] = [")

foreach ($key in $groups.Keys) {
    $allPts = $groups[$key]
    $pts = Get-Sampled $allPts 220

    $cor = $cores[$idx % $cores.Count]
    $id = "sela1_t$($idx + 1)"

    # Calcula area bbox aproximada em hectares
    $lats = @($pts | ForEach-Object { $_.lat })
    $lngs = @($pts | ForEach-Object { $_.lng })
    $latMin = ($lats | Measure-Object -Minimum).Minimum
    $latMax = ($lats | Measure-Object -Maximum).Maximum
    $lngMin = ($lngs | Measure-Object -Minimum).Minimum
    $lngMax = ($lngs | Measure-Object -Maximum).Maximum
    $latMid = ($latMin + $latMax) / 2.0
    $latRange = $latMax - $latMin
    $lngRange = $lngMax - $lngMin
    $areaHa = [Math]::Round($latRange * 111000 * $lngRange * 111000 * [Math]::Cos($latMid * [Math]::PI / 180) / 10000, 1)

    $null = $sb.AppendLine("  {")
    $null = $sb.AppendLine("    id: '$id',")
    $escapedKey = $key -replace "'","\\'"
    $null = $sb.AppendLine("    talhao: '$escapedKey',")
    $null = $sb.AppendLine("    nome: '$escapedKey',")
    $null = $sb.AppendLine("    area_hectares: $($areaHa.ToString($inv)),")
    $null = $sb.AppendLine("    cor: '$cor',")
    $null = $sb.AppendLine("    cultura_atual: '',")
    $null = $sb.AppendLine("    safra: '2025/2026',")
    $null = $sb.AppendLine("    poligono: [")

    foreach ($pt in $pts) {
        $latS = $pt.lat.ToString("F7", $inv)
        $lngS = $pt.lng.ToString("F7", $inv)
        $null = $sb.AppendLine("      { lat: $latS, lng: $lngS },")
    }

    $null = $sb.AppendLine("    ],")
    $null = $sb.AppendLine("  },")
    $idx++
}

$null = $sb.AppendLine("];")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("export default talhoesSelaDeprata1;")

New-Item -ItemType Directory -Path (Split-Path $outPath) -Force | Out-Null
Set-Content -Path $outPath -Value $sb.ToString() -Encoding UTF8

$lines = (Get-Content $outPath).Count
$sizeKB = [Math]::Round((Get-Item $outPath).Length / 1024, 1)
Write-Host "Gerado: $outPath"
Write-Host "  Linhas: $lines | Tamanho: $sizeKB KB | Talhoes: $idx"
