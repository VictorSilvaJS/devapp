param(
  [string]$Root = (Join-Path (Join-Path $PSScriptRoot '..') 'PANORAMA-DAS-LAVOURAS'),
  [string]$FazendaId = 'p_sela1',
  [string]$FazendaNome = 'Fazenda Sela de Prata I',
  [int]$AnoContexto = 2025,
  [string]$OutputPath = '',
  [switch]$SkipHash,
  [int]$Limit = 0
)

$ErrorActionPreference = 'Stop'

function Convert-ToRepoRelativePath([string]$Path) {
  $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
  $fullPath = if ($resolved) { $resolved.Path } else { [System.IO.Path]::GetFullPath($Path) }

  if ($fullPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return ($fullPath.Substring($repoRoot.Length).TrimStart([char[]]"\/") -replace '\\','/')
  }

  return ($fullPath -replace '\\','/')
}

function Remove-Diacritics([string]$Text) {
  if (-not $Text) { return '' }

  $normalized = $Text.Normalize([System.Text.NormalizationForm]::FormD)
  $builder = [System.Text.StringBuilder]::new()
  foreach ($char in $normalized.ToCharArray()) {
    $category = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
    if ($category -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }

  return $builder.ToString().Normalize([System.Text.NormalizationForm]::FormC)
}

function Normalize-Text([string]$Text) {
  return (Remove-Diacritics $Text).ToLowerInvariant().Replace('\', '/')
}

function New-ElementDictionary() {
  return [ordered]@{
    AR = [ordered]@{ elemento = 'argila'; rotulo = 'Argila'; grupo = 'fertilidade' }
    PH = [ordered]@{ elemento = 'pH'; rotulo = 'pH'; grupo = 'fertilidade' }
    MO = [ordered]@{ elemento = 'materia_organica'; rotulo = 'Materia organica'; grupo = 'fertilidade' }
    PP = [ordered]@{ elemento = 'fosforo'; rotulo = 'Fosforo'; grupo = 'fertilidade' }
    KK = [ordered]@{ elemento = 'potassio'; rotulo = 'Potassio'; grupo = 'fertilidade' }
    CTC = [ordered]@{ elemento = 'ctc'; rotulo = 'CTC'; grupo = 'fertilidade' }
    CA = [ordered]@{ elemento = 'calcio'; rotulo = 'Calcio'; grupo = 'fertilidade' }
    MG = [ordered]@{ elemento = 'magnesio'; rotulo = 'Magnesio'; grupo = 'fertilidade' }
    CA_MG = [ordered]@{ elemento = 'calcio_magnesio'; rotulo = 'Calcio/Magnesio'; grupo = 'fertilidade' }
    CU = [ordered]@{ elemento = 'cobre'; rotulo = 'Cobre'; grupo = 'fertilidade' }
    MN = [ordered]@{ elemento = 'manganes'; rotulo = 'Manganes'; grupo = 'fertilidade' }
    ZN = [ordered]@{ elemento = 'zinco'; rotulo = 'Zinco'; grupo = 'fertilidade' }
    BB = [ordered]@{ elemento = 'boro'; rotulo = 'Boro'; grupo = 'fertilidade'; aviso = 'confirmar se BB representa boro no padrao do fornecedor' }
    BORc = [ordered]@{ elemento = 'boro'; rotulo = 'Boro'; grupo = 'correcao' }
    CALc = [ordered]@{ elemento = 'calcario'; rotulo = 'Calcario'; grupo = 'correcao' }
    DAPc = [ordered]@{ elemento = 'DAP'; rotulo = 'DAP'; grupo = 'correcao' }
    ENXc = [ordered]@{ elemento = 'enxofre'; rotulo = 'Enxofre'; grupo = 'correcao' }
    KCLc = [ordered]@{ elemento = 'KCL'; rotulo = 'KCL'; grupo = 'correcao' }
    CAL = [ordered]@{ elemento = 'calcario'; rotulo = 'Calcario'; grupo = 'prescricao' }
    FOR = [ordered]@{ elemento = 'fosforo'; rotulo = 'Fosforo'; grupo = 'prescricao' }
    KCL = [ordered]@{ elemento = 'KCL'; rotulo = 'KCL'; grupo = 'prescricao' }
    NDVI = [ordered]@{ elemento = 'NDVI'; rotulo = 'NDVI'; grupo = 'indice_vegetacao' }
    REL = [ordered]@{ elemento = 'relatorio'; rotulo = 'Relatorio'; grupo = 'documento' }
  }
}

function New-ElementLookup($Dictionary) {
  $lookup = @{}
  foreach ($key in $Dictionary.Keys) {
    $lookup[$key.ToUpperInvariant()] = [ordered]@{
      codigo_original = $key
      elemento = $Dictionary[$key].elemento
      rotulo = $Dictionary[$key].rotulo
      grupo = $Dictionary[$key].grupo
      aviso = $Dictionary[$key].aviso
    }
  }
  return $lookup
}

function Get-YearDetected([string]$RelativePath) {
  $match = [regex]::Match($RelativePath, '(?<!\d)(20\d{2})(?!\d)')
  if ($match.Success) { return [int]$match.Groups[1].Value }
  return $null
}

function Get-FarmDetected([string]$RelativePath, [string]$DefaultFarmName) {
  $normalized = Normalize-Text $RelativePath
  $warnings = @()

  $romanMatch = [regex]::Match($normalized, 'sela[\s_-]*de[\s_-]*prata[\s_-]*(?<roman>iv|iii|ii|i)(?![a-z])')
  if ($romanMatch.Success) {
    $roman = $romanMatch.Groups['roman'].Value.ToUpperInvariant()
    $detectedName = "Fazenda Sela de Prata $roman"
    if ($detectedName -ne $DefaultFarmName) {
      $warnings += "fazenda mencionada no arquivo ($detectedName) difere do contexto da importacao ($DefaultFarmName)"
    }

    return [ordered]@{
      nome = $detectedName
      origem = 'nome_arquivo'
      avisos = $warnings
    }
  }

  if ($normalized -match 'sela1' -or $normalized -match '(?<![a-z0-9])sp1(?![a-z0-9])' -or $normalized -match '(?<![a-z0-9])spi(?![a-z0-9])') {
    return [ordered]@{
      nome = $DefaultFarmName
      origem = 'codigo_arquivo'
      avisos = $warnings
    }
  }

  if ($DefaultFarmName) {
    return [ordered]@{
      nome = $DefaultFarmName
      origem = 'contexto_importacao'
      avisos = $warnings
    }
  }

  return [ordered]@{
    nome = $null
    origem = $null
    avisos = $warnings
  }
}

function Get-CategoryDetected([System.IO.FileInfo]$File, [string]$RelativePath) {
  $normalized = Normalize-Text $RelativePath
  $ext = $File.Extension.ToLowerInvariant()
  $base = Normalize-Text $File.BaseName

  if ($normalized -match 'mapas de fertilidade') { return 'fertilidade' }
  if ($normalized -match 'mapas de correcao') { return 'correcao' }
  if ($normalized -match 'mapas de prescricao') { return 'prescricao' }
  if ($normalized -match 'arquivos de prescricao') { return 'arquivo_prescricao' }
  if ($normalized -match 'panorama de manejo') { return 'panorama' }
  if ($normalized -match 'ndvi') { return 'indice_vegetacao' }
  if ($base -match 'fazenda_sela_de_prata_i_poly') { return 'limite_talhoes' }
  if (($ext -eq '.kml' -or $ext -eq '.kmz') -and $base -match 'fazenda sela de prata i') { return 'limite_talhoes' }
  if ($base -match 'capa') { return 'panorama' }
  if ($ext -eq '.pdf') { return 'relatorio' }
  if ($ext -eq '.pptx') { return 'documento_auxiliar' }

  return 'documento_auxiliar'
}

function Get-FileRole([System.IO.FileInfo]$File, [string]$Category, [string]$ElementCode) {
  $ext = $File.Extension.ToLowerInvariant()

  if ($ext -eq '.png') {
    if ($Category -eq 'relatorio' -or $ElementCode -eq 'REL') { return 'relatorio' }
    return 'visualizacao'
  }
  if ($ext -eq '.pdf') { return 'relatorio' }
  if ($ext -eq '.zip') { return 'bundle_zip' }
  if ($ext -in @('.shp', '.dbf', '.shx', '.prj', '.cpg', '.kml', '.kmz')) { return 'vetor_origem' }
  if ($ext -in @('.tif', '.tiff')) { return 'raster_origem' }

  return 'documento'
}

function Get-DepthDetected([string]$RelativePath, [string[]]$Warnings) {
  $matches = [regex]::Matches($RelativePath, '(?i)(0a10|10a20|20a40)')
  if ($matches.Count -eq 0) {
    return [ordered]@{ profundidade = 'nao_informada'; avisos = $Warnings }
  }

  $unique = @($matches | ForEach-Object { $_.Groups[1].Value.ToLowerInvariant() } | Sort-Object -Unique)
  if ($unique.Count -gt 1) {
    $Warnings += "mais de uma profundidade aparece no caminho: $($unique -join ', ')"
  }

  $selected = $matches[$matches.Count - 1].Groups[1].Value.ToLowerInvariant()
  $depth = switch ($selected) {
    '0a10' { '0-10' }
    '10a20' { '10-20' }
    '20a40' { '20-40' }
    default { 'nao_informada' }
  }

  return [ordered]@{ profundidade = $depth; avisos = $Warnings }
}

function Add-TalhaoCode([System.Collections.Generic.List[string]]$List, [string]$Number) {
  if (-not $Number) { return }
  $code = "T$Number"
  if (-not $List.Contains($code)) { [void]$List.Add($code) }
}

function Get-TalhoesDetected([string]$RelativePath, [string]$Category, [string[]]$Warnings) {
  $text = $RelativePath -replace '\\','/'
  $talhoes = [System.Collections.Generic.List[string]]::new()

  foreach ($match in [regex]::Matches($text, '(?i)T(?<first>\d{2})(?:_(?<middle>\d{2})e(?<last>\d{2})|e(?<second>\d{2})|_(?<pair>\d{2})(?!\d))?')) {
    Add-TalhaoCode $talhoes $match.Groups['first'].Value
    Add-TalhaoCode $talhoes $match.Groups['middle'].Value
    Add-TalhaoCode $talhoes $match.Groups['last'].Value
    Add-TalhaoCode $talhoes $match.Groups['second'].Value
    Add-TalhaoCode $talhoes $match.Groups['pair'].Value

    if ($match.Groups['pair'].Success) {
      $Warnings += "grupo de talhoes com separador '_' exige confirmacao manual"
    }
  }

  if ($Category -in @('prescricao', 'arquivo_prescricao')) {
    foreach ($match in [regex]::Matches($text, '(?i)(?<![A-Z0-9])(?<first>\d{2})e(?<second>\d{2})(?![A-Z0-9])')) {
      Add-TalhaoCode $talhoes $match.Groups['first'].Value
      Add-TalhaoCode $talhoes $match.Groups['second'].Value
    }
  }

  $sorted = @($talhoes | Sort-Object -Unique)
  if ($sorted.Count -eq 1) {
    return [ordered]@{
      escopo_espacial_detectado = 'talhao'
      talhao_detectado = $sorted[0]
      talhoes_detectados = $sorted
      avisos = $Warnings
    }
  }
  if ($sorted.Count -gt 1) {
    $Warnings += 'arquivo associado a grupo de talhoes; revisar associacao antes de publicar'
    return [ordered]@{
      escopo_espacial_detectado = 'grupo_talhoes'
      talhao_detectado = $null
      talhoes_detectados = $sorted
      avisos = $Warnings
    }
  }

  if ($Category -in @('fertilidade', 'correcao', 'prescricao', 'limite_talhoes', 'panorama', 'indice_vegetacao', 'relatorio')) {
    return [ordered]@{
      escopo_espacial_detectado = 'fazenda_inteira'
      talhao_detectado = $null
      talhoes_detectados = @()
      avisos = $Warnings
    }
  }

  return [ordered]@{
    escopo_espacial_detectado = 'desconhecido'
    talhao_detectado = $null
    talhoes_detectados = @()
    avisos = $Warnings
  }
}

function Get-ElementDetected([string]$RelativePath, [string]$Category, $Lookup, [string[]]$Warnings) {
  $normalized = Normalize-Text $RelativePath
  $base = [System.IO.Path]::GetFileNameWithoutExtension($RelativePath)
  $code = $null

  if ($Category -eq 'fertilidade') {
    $match = [regex]::Match($base, '(?i)-(?<code>CA_MG|SMG|CTC|AR|BB|CA|CU|KK|MG|MN|MO|PH|PP|SA|SB|SC|SK|SS|ZN|REL)(?:_|$)')
    if ($match.Success) { $code = $match.Groups['code'].Value.ToUpperInvariant() }
  }

  if (-not $code -and $Category -eq 'correcao') {
    $match = [regex]::Match($base, '(?i)(BORc|BOIRc|CALc|DAPc|EN\s*Xc|cENX|ENXc|KCLc)')
    if ($match.Success) {
      $raw = $match.Groups[1].Value
      $code = $raw -replace '\s+', ''
      if ($code -eq 'BOIRc') {
        $Warnings += 'codigo BOIRc parece inconsistente; provavel BORc'
        $code = 'BORc'
      }
      if ($code -eq 'cENX') {
        $Warnings += 'codigo cENX parece inconsistente; provavel ENXc'
        $code = 'ENXc'
      }
    }
  }

  if (-not $code -and $Category -in @('prescricao', 'arquivo_prescricao')) {
    if ($normalized -match '/calcario/' -or $base -match '^(?i)CAL') { $code = 'CAL' }
    elseif ($normalized -match '/fosforo/' -or $base -match '^(?i)FOR') { $code = 'FOR' }
    elseif ($normalized -match '/potassio/' -or $base -match '^(?i)KCL') { $code = 'KCL' }
  }

  if (-not $code -and $normalized -match 'ndvi') { $code = 'NDVI' }
  if (-not $code -and $base -match '(?i)-REL$') { $code = 'REL' }

  if (-not $code) {
    return [ordered]@{
      elemento_ou_produto_detectado = $null
      codigo_original_elemento = $null
      avisos = $Warnings
    }
  }

  $lookupKey = $code.ToUpperInvariant()
  if (-not $Lookup.ContainsKey($lookupKey)) {
    $Warnings += "codigo de elemento/produto nao reconhecido: $code"
    return [ordered]@{
      elemento_ou_produto_detectado = $null
      codigo_original_elemento = $code
      avisos = $Warnings
    }
  }

  $entry = $Lookup[$lookupKey]
  if ($entry.aviso) { $Warnings += $entry.aviso }

  return [ordered]@{
    elemento_ou_produto_detectado = $entry.elemento
    codigo_original_elemento = $entry.codigo_original
    avisos = $Warnings
  }
}

function Get-ShapefileWarnings([System.IO.FileInfo]$File, [string[]]$Warnings) {
  $ext = $File.Extension.ToLowerInvariant()
  if ($ext -notin @('.shp', '.dbf', '.shx', '.prj', '.cpg')) { return $Warnings }

  $base = Join-Path $File.DirectoryName $File.BaseName
  $requiredMissing = @()
  foreach ($requiredExt in @('.shp', '.dbf', '.shx')) {
    if (-not (Test-Path -LiteralPath ($base + $requiredExt))) {
      $requiredMissing += $requiredExt
    }
  }

  if ($requiredMissing.Count -gt 0) {
    $Warnings += "pacote shapefile incompleto; faltando: $($requiredMissing -join ', ')"
  }
  if (-not (Test-Path -LiteralPath ($base + '.prj'))) {
    $Warnings += 'shapefile sem PRJ ao lado; sistema de referencia precisa ser confirmado'
  }
  if (-not (Test-Path -LiteralPath ($base + '.cpg'))) {
    $Warnings += 'shapefile sem CPG ao lado; codificacao precisa ser confirmada'
  }

  return $Warnings
}

function Get-ConfidenceAndStatus([string]$Category, [Nullable[int]]$Year, [string]$Farm, [string]$ElementCode, [string]$Role, [string[]]$Warnings) {
  $confidence = 'alta'
  $status = 'aprovado'

  if ($Warnings.Count -gt 0) {
    $confidence = 'media'
    $status = 'precisa_revisao'
  }
  if (-not $Year -or -not $Farm -or $Category -eq 'documento_auxiliar') {
    $confidence = 'baixa'
    $status = 'precisa_revisao'
  }
  if (($Category -in @('fertilidade', 'correcao', 'prescricao', 'arquivo_prescricao')) -and -not $ElementCode) {
    $confidence = 'baixa'
    $status = 'precisa_revisao'
  }
  if ($Warnings | Where-Object { $_ -match 'incompleto|inconsistente|nao reconhecido' }) {
    $status = 'inconsistente'
  }
  if ($Role -eq 'documento' -and $Category -eq 'documento_auxiliar') {
    $confidence = 'baixa'
  }

  return [ordered]@{
    confianca_classificacao = $confidence
    status_revisao = $status
  }
}

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$dictionary = New-ElementDictionary
$lookup = New-ElementLookup $dictionary
$files = @(Get-ChildItem -LiteralPath $rootPath -File -Recurse -Force | Sort-Object FullName)
if ($Limit -gt 0) {
  $files = @($files | Select-Object -First $Limit)
}

$items = @()
$index = 1
foreach ($file in $files) {
  $relativeRepoPath = Convert-ToRepoRelativePath $file.FullName
  $warnings = @()

  $yearFromPath = Get-YearDetected $relativeRepoPath
  $year = if ($yearFromPath) { $yearFromPath } elseif ($AnoContexto -gt 0) { $AnoContexto } else { $null }
  $yearSource = if ($yearFromPath) { 'caminho' } elseif ($AnoContexto -gt 0) { 'contexto_importacao' } else { $null }
  $farmInfo = Get-FarmDetected $relativeRepoPath $FazendaNome
  $farm = $farmInfo.nome
  $warnings += @($farmInfo.avisos)
  $category = Get-CategoryDetected $file $relativeRepoPath
  $depthInfo = Get-DepthDetected $relativeRepoPath $warnings
  $warnings = @($depthInfo.avisos)
  $talhaoInfo = Get-TalhoesDetected $relativeRepoPath $category $warnings
  $warnings = @($talhaoInfo.avisos)
  $elementInfo = Get-ElementDetected $relativeRepoPath $category $lookup $warnings
  $warnings = @($elementInfo.avisos)
  $role = Get-FileRole $file $category $elementInfo.codigo_original_elemento
  $warnings = @(Get-ShapefileWarnings $file $warnings)

  if ($depthInfo.profundidade -eq 'nao_informada' -and $category -in @('fertilidade', 'correcao')) {
    $warnings += 'profundidade nao informada; nao assumir 0-10 sem revisao'
  }
  if (-not $year) { $warnings += 'ano nao detectado no caminho, nome ou contexto informado' }
  if (-not $farm) { $warnings += 'fazenda nao detectada no caminho, nome ou contexto informado' }

  $confidence = Get-ConfidenceAndStatus $category $year $farm $elementInfo.codigo_original_elemento $role $warnings
  $hash = if ($SkipHash) { $null } else { (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }

  $items += [ordered]@{
    id_temporario = ('tmp_panorama_{0:D4}' -f $index)
    caminho_original_arquivo = $relativeRepoPath
    nome_original_arquivo = $file.Name
    extensao = $file.Extension.TrimStart('.').ToLowerInvariant()
    tamanho = [int64]$file.Length
    hash_sha256 = $hash
    ano_detectado = $year
    ano_origem_deteccao = $yearSource
    fazenda_id_sugerido = if ($farm) { $FazendaId } else { $null }
    fazenda_detectada = $farm
    fazenda_origem_deteccao = $farmInfo.origem
    categoria_detectada = $category
    escopo_espacial_detectado = $talhaoInfo.escopo_espacial_detectado
    talhao_detectado = $talhaoInfo.talhao_detectado
    talhoes_detectados = @($talhaoInfo.talhoes_detectados)
    profundidade_detectada = $depthInfo.profundidade
    elemento_ou_produto_detectado = $elementInfo.elemento_ou_produto_detectado
    codigo_original_elemento = $elementInfo.codigo_original_elemento
    papel_arquivo = $role
    confianca_classificacao = $confidence.confianca_classificacao
    status_revisao = $confidence.status_revisao
    avisos_encontrados = @($warnings | Sort-Object -Unique)
  }

  $index++
}

$manifest = [ordered]@{
  schema_version = 1
  tipo = 'manifesto_importacao_mapas'
  gerado_em = (Get-Date).ToString('o')
  origem = [ordered]@{
    pasta = Convert-ToRepoRelativePath $rootPath
    total_arquivos_lidos = $items.Count
    hash_calculado = -not $SkipHash
  }
  contexto_sugerido = [ordered]@{
    fazenda_id = $FazendaId
    fazenda_nome = $FazendaNome
  }
  dicionario_normalizacao = $dictionary
  arquivos = $items
}

$json = $manifest | ConvertTo-Json -Depth 100
if ($OutputPath) {
  $outFull = [System.IO.Path]::GetFullPath($OutputPath)
  New-Item -ItemType Directory -Path (Split-Path $outFull) -Force | Out-Null
  Set-Content -LiteralPath $outFull -Value $json -Encoding UTF8
  Write-Host "Manifesto gerado: $outFull"
  Write-Host "Arquivos classificados: $($items.Count)"
} else {
  $json
}
