# Originais Geoespaciais

Esta pasta recebe arquivos brutos antes da conversão. O aplicativo não deve
consumir diretamente SHP, DBF, SHX, PRJ, KML, KMZ ou pacotes auxiliares.

Para novas importações, use a organização:

    data/originais/{propriedade_id}/{ano}/{importacao_id}/

Saídas normalizadas devem ir para:

    data/processados/{propriedade_id}/{ano}/

Diretórios antigos podem continuar com identificadores legados enquanto forem
apenas evidência ou insumo. Não renomeie nem remova um conjunto existente sem
validar scripts, assets e o mock que o referenciam.

O contrato produtivo de identidade e versionamento está em
[Versionamento de GeoJSON e Talhões](../../docs/project/versionamento-geojson-talhoes.md).
