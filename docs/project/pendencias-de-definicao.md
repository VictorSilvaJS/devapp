# Pendencias de Definicao

Este documento lista pontos reais ainda abertos no projeto. Seu papel e registrar o que precisa de definicao adicional sem transformar o tema em backlog automatico, decisao consolidada ou hipotese solta.

## Como Usar Este Documento

- Use este arquivo para identificar o que ainda precisa ser fechado antes de estabilizar dominio, contratos e regras.
- Se um ponto ja estiver decidido, ele deve ir para `decisoes-consolidadas.md`, nao permanecer aqui.
- Se um ponto for apenas possibilidade futura sem necessidade atual, ele deve permanecer fora deste documento.

## Pendencias de Dominio

### 1. Nomenclatura final do papel hoje tratado como `produtor`

A documentacao ativa usa `produtor` como termo provisório, mas ainda falta consolidar formalmente a relacao final entre os alias historicos `produtor`, `cliente` e `proprietario`.

**Por que importa**

- afeta contratos
- afeta nomes de campos
- afeta linguagem de interface
- afeta leitura correta das regras de acesso

### 2. Contratos centrais do dominio

Ainda falta fechar a forma final de alguns contratos que hoje aparecem com variacoes no repositorio e na documentacao, como:

- nomes de campos pessoais e cadastrais
- contratos de disponibilidade de download
- relacao entre produtor, fazenda e identificadores associados

**Por que importa**

Esse fechamento e base da Fase 2 e reduz ambiguidade entre schemas, mocks, telas e regras.

## Pendencias Funcionais

### 3. Escopo final do caderno de campo

O caderno ja esta definido como modulo enxuto e operacional, mas ainda faltam definicoes sobre:

- campos minimos obrigatorios
- campos opcionais
- nivel de detalhe esperado
- criterios de visibilidade por perfil

### 4. Taxonomia final de mapas

Mapas e arquivos sao parte central do produto, mas a classificacao final ainda precisa de consolidacao adicional, especialmente em temas como:

- categorias base
- tratamento de panorama
- recorte temporal por safra, ano ou periodo

O corte atual do MVP ja define que limite/shape e camada tecnica de demarcacao dentro do panorama da fazenda, nao uma experiencia separada para o usuario. O que permanece pendente e a taxonomia final das categorias de materiais tecnicos e a forma de evoluir panoramas alem da demarcacao basica.

### 5. Experiencia detalhada do produtor

O papel do produtor esta claro em nivel alto, mas ainda faltam definicoes mais finas sobre:

- como navegar entre uma ou mais fazendas
- como acessar historico, mapas e arquivos de modo simples
- onde termina consulta e onde comecam operacoes que exigem permissao da equipe

## Pendencias de Regra e Permissao

### 6. Fechamento completo das regras de permissao por acao

As diretrizes principais de acesso ja estao claras, mas ainda falta consolidar o detalhamento de permissao por acao em todo o dominio, especialmente quando houver diferenca entre:

- visualizacao
- criacao
- edicao
- download
- visibilidade de registros

### 7. Relacao final entre regra de negocio e comportamento efetivo da implementacao atual

Ainda e necessario revisar e fechar, de forma mais precisa, onde a implementacao atual:

- ja segue a regra consolidada
- ainda depende de comportamento mock
- ainda possui duplicacao ou divergencia em telas especificas

Esse ponto nao e backlog tecnico generico. Ele e uma pendencia de alinhamento entre regra e repositorio atual.

## Pendencias de Escopo Tecnico-Funcional

### 8. Remocao do painel temporario `Smoke Dev`

Durante o fechamento da frente de visitas tecnicas por fazenda e caderno de campo por fazenda, foi criado um painel temporario `Smoke Dev` em `src/screens/PerfilScreen.tsx`.

**Status atual**

- manter enquanto a estabilizacao do MVP estiver em andamento
- remover antes de uma entrega formal, build de demonstracao externa ou publicacao

**O que remover**

- constante `smokeRoutes`
- bloco visual `Smoke Dev`
- estilos usados exclusivamente por esse painel

**Por que importa**

O painel esta protegido por `__DEV__`, mas ainda e uma ferramenta interna de teste manual. Ele nao deve ser confundido com funcionalidade do produto.

### 9. Capacidade offline declarada por fluxo

Ja existe a diretriz de priorizar uso em contexto de internet ruim, mas ainda falta declarar com clareza:

- o que deve funcionar apenas para consulta
- o que pode depender de sincronizacao posterior
- o que exige conexao

Sem esse fechamento, o projeto corre risco de descrever offline de forma mais ampla do que a capacidade real.

### 10. Estrategia funcional para ingestao e disponibilizacao de mapas e arquivos

O produto ja depende de mapas e arquivos no contexto da fazenda, mas ainda faltam definicoes sobre:

- quais tipos de material entram no fluxo principal
- qual o nivel minimo de tratamento desses materiais no MVP
- como separar consulta simples de manutencao operacional do acervo

Decisao ja assumida para o MVP: o app deve consumir uma demarcacao final normalizada, preferencialmente GeoJSON ou JSON equivalente, e nao carregar o pacote bruto de origem no dispositivo. Ainda falta definir o pipeline de producao para conversao, validacao, armazenamento, permissao e publicacao desses arquivos finais.

## Regra de Governanca

Uma pendencia deve sair deste documento quando ocorrer uma destas situacoes:

- foi consolidada como decisao do projeto
- foi removida do escopo atual por definicao explicita
- foi desmembrada em detalhe tecnico subordinado a um documento mais especifico

Enquanto isso nao acontecer, o tema deve permanecer aqui, e nao ser tratado como verdade fechada.
