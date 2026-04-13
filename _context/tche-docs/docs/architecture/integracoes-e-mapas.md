# Integrações e Mapas

## Tema

O projeto depende fortemente da organização, ingestão e disponibilização de mapas e materiais associados.

## Diretrizes atuais

- o sistema deve receber e organizar materiais produzidos pela equipe;
- a experiência do usuário não deve depender de ele saber a origem técnica do mapa;
- mapas precisam estar contextualizados por produtor/fazenda/categoria/período.

## Possíveis frentes técnicas

Estas frentes são relevantes, mas não devem ser tratadas como fechadas sem validação:

- ingestão de arquivos de geoprocessamento;
- tratamento de panorama e limite/shape;
- categorização e indexação por safra/período;
- eventual integração com fontes externas de satélite;
- pipeline de conversão/preparação para consumo no app/plataforma.

## Regra operacional

O produto deve expor um fluxo simples para o usuário final, mesmo que o processamento interno seja complexo.

## Ponto de atenção

Arquitetura de mapas costuma crescer rápido em complexidade. Toda decisão aqui deve ser ancorada no que o MVP realmente precisa.
