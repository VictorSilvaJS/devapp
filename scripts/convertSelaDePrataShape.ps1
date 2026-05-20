param(
  [string]$SampleDir = "C:\Users\e_vsjesus\Desktop\devapp\Sela-de-Prata-I",
  [string]$OutGeoJson = "C:\Users\e_vsjesus\Desktop\devapp\data\processados\p_sela1\2025\limites_talhoes.geojson",
  [string]$OutTs = "C:\Users\e_vsjesus\Desktop\devapp\src\assets\geojson\selaDePrata1Talhoes.ts"
)

$ErrorActionPreference = "Stop"

$baseName = "Fazenda_Sela_de_Prata_I_poly"
$shpPath = Join-Path $SampleDir "$baseName.shp"
$dbfPath = Join-Path $SampleDir "$baseName.dbf"
$prjPath = Join-Path $SampleDir "$baseName.prj"

foreach ($path in @($shpPath, $dbfPath, $prjPath)) {
  if (-not (Test-Path $path)) {
    throw "Arquivo obrigatorio nao encontrado: $path"
  }
}

function Read-BigEndianInt32([System.IO.BinaryReader]$Reader) {
  $bytes = $Reader.ReadBytes(4)
  [array]::Reverse($bytes)
  return [BitConverter]::ToInt32($bytes, 0)
}

function Read-DbfRows([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $recordCount = [BitConverter]::ToInt32($bytes, 4)
  $headerLength = [BitConverter]::ToInt16($bytes, 8)
  $recordLength = [BitConverter]::ToInt16($bytes, 10)
  $fields = @()
  $cursor = 1

  for ($offset = 32; $offset -lt ($headerLength - 1); $offset += 32) {
    if ($bytes[$offset] -eq 0x0D) { break }
    $nameBytes = $bytes[$offset..($offset + 10)] | Where-Object { $_ -ne 0 }
    $name = [System.Text.Encoding]::ASCII.GetString([byte[]]$nameBytes)
    $length = $bytes[$offset + 16]
    $fields += [PSCustomObject]@{ Name = $name; Length = $length; Start = $cursor }
    $cursor += $length
  }

  $encoding = [System.Text.Encoding]::UTF8
  $rows = @()

  for ($r = 0; $r -lt $recordCount; $r++) {
    $base = $headerLength + ($r * $recordLength)
    if ([char]$bytes[$base] -eq '*') { continue }

    $obj = [ordered]@{}
    foreach ($field in $fields) {
      $raw = $bytes[($base + $field.Start)..($base + $field.Start + $field.Length - 1)]
      $obj[$field.Name] = $encoding.GetString([byte[]]$raw).Trim()
    }
    $rows += [PSCustomObject]$obj
  }

  return $rows
}

function Read-ShpPolygons([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $reader = [System.IO.BinaryReader]::new($stream)
  $records = @()

  try {
    $fileCode = Read-BigEndianInt32 $reader
    if ($fileCode -ne 9994) {
      throw "Arquivo SHP invalido: file code $fileCode"
    }

    $null = $reader.ReadBytes(20)
    $null = Read-BigEndianInt32 $reader
    $version = $reader.ReadInt32()
    $shapeType = $reader.ReadInt32()
    if ($version -ne 1000 -or $shapeType -ne 5) {
      throw "Shapefile esperado do tipo Polygon (5). Encontrado version=$version shapeType=$shapeType"
    }

    $null = $reader.ReadBytes(64)

    while ($stream.Position -lt $stream.Length) {
      $recordNumber = Read-BigEndianInt32 $reader
      $contentLengthWords = Read-BigEndianInt32 $reader
      $recordStart = $stream.Position
      $type = $reader.ReadInt32()

      if ($type -eq 0) {
        $stream.Position = $recordStart + ($contentLengthWords * 2)
        continue
      }
      if ($type -ne 5) {
        throw "Registro $recordNumber possui shapeType $type; esperado Polygon (5)."
      }

      $null = @($reader.ReadDouble(), $reader.ReadDouble(), $reader.ReadDouble(), $reader.ReadDouble())
      $numParts = $reader.ReadInt32()
      $numPoints = $reader.ReadInt32()
      $partStarts = for ($i = 0; $i -lt $numParts; $i++) { $reader.ReadInt32() }
      $points = for ($i = 0; $i -lt $numPoints; $i++) {
        [PSCustomObject]@{ lng = $reader.ReadDouble(); lat = $reader.ReadDouble() }
      }

      $parts = @()
      for ($p = 0; $p -lt $numParts; $p++) {
        $start = $partStarts[$p]
        $end = if ($p -lt ($numParts - 1)) { $partStarts[$p + 1] - 1 } else { $numPoints - 1 }
        $parts += ,@($points[$start..$end])
      }

      $records += [PSCustomObject]@{ Record = $recordNumber; Parts = $parts }
      $stream.Position = $recordStart + ($contentLengthWords * 2)
    }
  } finally {
    $reader.Close()
  }

  return $records
}

function Get-PolygonAreaHa($polygon) {
  if (-not $polygon -or $polygon.Count -lt 3) { return 0 }
  $latMid = (($polygon | Measure-Object -Property lat -Average).Average)
  $mPerDegLat = 111320.0
  $mPerDegLng = 111320.0 * [Math]::Cos($latMid * [Math]::PI / 180.0)
  $sum = 0.0

  for ($i = 0; $i -lt $polygon.Count; $i++) {
    $j = ($i + 1) % $polygon.Count
    $x1 = $polygon[$i].lng * $mPerDegLng
    $y1 = $polygon[$i].lat * $mPerDegLat
    $x2 = $polygon[$j].lng * $mPerDegLng
    $y2 = $polygon[$j].lat * $mPerDegLat
    $sum += ($x1 * $y2) - ($x2 * $y1)
  }

  return [Math]::Abs($sum / 2.0) / 10000.0
}

function Convert-PointToHashtable($point) {
  return [ordered]@{
    lat = [Math]::Round([double]$point.lat, 7)
    lng = [Math]::Round([double]$point.lng, 7)
  }
}

function Convert-PolygonToGeoJsonRing($polygon) {
  $ring = [System.Collections.Generic.List[object]]::new()
  foreach ($point in $polygon) {
    $pair = [System.Collections.Generic.List[object]]::new()
    $pair.Add($point.lng) | Out-Null
    $pair.Add($point.lat) | Out-Null
    $ring.Add($pair) | Out-Null
  }

  if ($ring.Count -gt 0) {
    $first = $ring[0]
    $last = $ring[$ring.Count - 1]
    if ($first[0] -ne $last[0] -or $first[1] -ne $last[1]) {
      $pair = [System.Collections.Generic.List[object]]::new()
      $pair.Add($first[0]) | Out-Null
      $pair.Add($first[1]) | Out-Null
      $ring.Add($pair) | Out-Null
    }
  }

  return $ring
}

$dbfRows = Read-DbfRows $dbfPath
$shapeRows = Read-ShpPolygons $shpPath
if ($dbfRows.Count -ne $shapeRows.Count) {
  throw "DBF ($($dbfRows.Count)) e SHP ($($shapeRows.Count)) possuem quantidades diferentes de registros."
}

$groups = [ordered]@{}
for ($i = 0; $i -lt $shapeRows.Count; $i++) {
  $name = $dbfRows[$i].Campo
  if (-not $name) { $name = $dbfRows[$i].Nome_Perim }
  if (-not $name) { $name = "Talhao $($i + 1)" }
  if (-not $groups.Contains($name)) {
    $groups[$name] = [System.Collections.Generic.List[object]]::new()
  }

  foreach ($part in $shapeRows[$i].Parts) {
    $groups[$name].Add($part)
  }
}

$features = @()
$talhoes = @()
$idx = 0
$colors = @('#22C55E','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#10B981','#EC4899','#84CC16','#6366F1','#14B8A6','#F43F5E','#A855F7','#0EA5E9','#D97706')

foreach ($name in $groups.Keys) {
  $parts = @($groups[$name])
  $polygonAreas = @($parts | ForEach-Object { Get-PolygonAreaHa $_ })
  $totalArea = [Math]::Round(($polygonAreas | Measure-Object -Sum).Sum, 1)
  $largestIndex = 0
  for ($i = 1; $i -lt $polygonAreas.Count; $i++) {
    if ($polygonAreas[$i] -gt $polygonAreas[$largestIndex]) { $largestIndex = $i }
  }

  $poligonos = @()
  foreach ($part in $parts) {
    $polygon = @()
    foreach ($point in $part) {
      $polygon += ,(Convert-PointToHashtable $point)
    }
    $poligonos += ,$polygon
  }

  $mainPolygon = @($poligonos[$largestIndex])
  $geoJsonCoordinates = [System.Collections.Generic.List[object]]::new()
  foreach ($polygon in $poligonos) {
    $ring = Convert-PolygonToGeoJsonRing $polygon
    if ($poligonos.Count -gt 1) {
      $polygonCoordinates = [System.Collections.Generic.List[object]]::new()
      $polygonCoordinates.Add($ring) | Out-Null
      $geoJsonCoordinates.Add($polygonCoordinates) | Out-Null
    } else {
      $geoJsonCoordinates.Add($ring) | Out-Null
    }
  }
  $id = "sela1_shape_t$($idx + 1)"
  $color = $colors[$idx % $colors.Count]

  $features += [ordered]@{
    type = 'Feature'
    properties = [ordered]@{
      id = $id
      fazenda_id = 'p_sela1'
      talhao = $name
      nome = $name
      ano = 2025
      area_hectares = $totalArea
      fonte = 'SHP Fazenda_Sela_de_Prata_I_poly'
      partes = $poligonos.Count
    }
    geometry = [ordered]@{
      type = if ($poligonos.Count -gt 1) { 'MultiPolygon' } else { 'Polygon' }
      coordinates = $geoJsonCoordinates
    }
  }

  $talhoes += [ordered]@{
    id = $id
    fazenda_id = 'p_sela1'
    produtor_id = 'p_sela1'
    nome = "LT 2025 - $name"
    ano = 2025
    talhao = $name
    area_hectares = $totalArea
    poligono = $mainPolygon
    poligonos = $poligonos
    cor = $color
    data_upload = (Get-Date '2025-05-01').ToString('o')
    safra = '2025/2026'
    disponivel_offline = $true
    observacoes = "Contorno importado de shapefile real. Dados de solo nao informados nesta camada."
  }
  $idx++
}

$geoJson = [ordered]@{
  type = 'FeatureCollection'
  name = 'Fazenda Sela de Prata I - Talhoes 2025'
  features = $features
}

New-Item -ItemType Directory -Path (Split-Path $OutGeoJson) -Force | Out-Null
$geoJson | ConvertTo-Json -Depth 100 -Compress | Set-Content -Path $OutGeoJson -Encoding UTF8

New-Item -ItemType Directory -Path (Split-Path $OutTs) -Force | Out-Null
$jsonForTs = $talhoes | ConvertTo-Json -Depth 100 -Compress
$ts = @"
// Dados convertidos automaticamente de Sela-de-Prata-I/Fazenda_Sela_de_Prata_I_poly.shp
// Fonte: shapefile real de demarcacao de talhoes. Nao contem analise de solo.
import { MapaTalhao } from '../../types/mapa';

export const SELA_DE_PRATA_1_SHAPE_FAZENDA_ID = 'p_sela1';
export const talhoesSelaDePrata1Shape: (MapaTalhao & {
  ano: number;
  poligonos?: { lat: number; lng: number }[][];
  data_upload?: string;
  disponivel_offline?: boolean;
  observacoes?: string;
})[] = $jsonForTs;

export default talhoesSelaDePrata1Shape;
"@

Set-Content -Path $OutTs -Value $ts -Encoding UTF8

Write-Host "Convertido com sucesso."
Write-Host "Talhoes: $($talhoes.Count)"
Write-Host "Registros SHP: $($shapeRows.Count)"
Write-Host "GeoJSON: $OutGeoJson"
Write-Host "TS: $OutTs"
