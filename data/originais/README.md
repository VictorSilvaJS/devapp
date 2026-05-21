# Originais geoespaciais

Esta pasta reserva o padrao para arquivos brutos recebidos antes da conversao.

Padrao:

```text
data/originais/{fazenda_id}/{ano}/{importacao_id}/
```

Exemplo para a amostra atual:

```text
data/originais/p_sela1/2025/p_sela1-2025-limites-talhoes-shp/
```

Os pacotes brutos (`.shp`, `.dbf`, `.shx`, `.prj`, `.kml`, `.kmz` e
auxiliares) nao devem ser consumidos pelo app. Eles tambem ficam ignorados pelo
Git por padrao. O app consome apenas saidas finais normalizadas em
`data/processados/{fazenda_id}/{ano}/` ou assets equivalentes gerados para o
mock.
