# Pendencias de Definicao

Este documento lista pontos reais ainda abertos no projeto. Seu papel e registrar o que precisa de definicao adicional sem transformar o tema em backlog automatico, decisao consolidada ou hipotese solta.

## Como Usar Este Documento

- Use este arquivo para identificar o que ainda precisa ser fechado antes de estabilizar dominio, contratos e regras.
- Se um ponto ja estiver decidido, ele deve ir para `decisoes-consolidadas.md`, nao permanecer aqui.
- Se um ponto for apenas possibilidade futura sem necessidade atual, ele deve permanecer fora deste documento.

## Pendencias de Dominio

### 1. Limpeza tecnica futura da nomenclatura interna

A nomenclatura de produto foi consolidada em `decisoes-consolidadas.md`: `Propriedade`, `Produtor`, `Titular` e `Talhao` sao os termos oficiais de superficie.

Nao permanece pendente a definicao da linguagem de produto. O que ainda fica para uma fase futura separada e a limpeza tecnica interna de nomes legados como `fazenda`, `fazenda_id`, `getFazendaId`, rotas, arquivos, contratos e campos internos, caso o projeto decida reduzir essa compatibilidade.

Termos tecnicos legados atualmente permitidos por compatibilidade incluem `fazenda_id`, `fazendaId`, `fazendaNome`, `FazendaMapa`, `FazendaMapaScreen`, `MapaFazendaView`, `getFazenda*`, `fazendaUiCompat`, `fazendaCadastroCompat`, `FazendaCanonica` e `FazendaLegada`.

Esses termos permanecem porque ainda estao ligados a rotas, mocks, contratos, helpers de compatibilidade, filtros, visitas, caderno, mapas e regras de acesso. Uma migracao tecnica deve planejar leitura dupla quando necessario, preferindo `propriedade_id` para modelos novos sem remover `fazenda_id` antes de validar todos os fluxos afetados.

**Por que importa**

- evita refatoracao ampla e arriscada durante o MVP
- preserva compatibilidade com fluxos e contratos existentes
- separa decisao de linguagem de produto de renomeacao tecnica interna
- reduz risco de quebrar navegacao, permissoes, filtros e dados mockados

**Pendencia futura**

- planejar migracao tecnica controlada de `fazenda_id` para `propriedade_id`
- criar compatibilidade de leitura dupla se necessario
- testar fluxos de produtor, colaborador, admin, mapas, visitas, caderno e filtros antes de remover legado
- manter `fazenda*` apenas para compatibilidade existente ate a migracao estar validada

### 2. Contratos centrais do dominio

Ainda falta fechar a forma final de alguns contratos que hoje aparecem com variacoes no repositorio e na documentacao, como:

- nomes de campos pessoais e cadastrais
- contratos de disponibilidade de download
- relacao entre produtor, propriedade e identificadores tecnicos associados, incluindo `fazenda_id` enquanto a compatibilidade for mantida

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

O corte atual do MVP ja define que limite/shape e camada tecnica de demarcacao dentro do panorama da propriedade, nao uma experiencia separada para o usuario. Tambem ja define, para a primeira versao de testes, que os materiais tecnicos liberaveis devem ser organizados por propriedade, campo/talhao, recorte temporal e elemento/camada quando aplicavel, priorizando diagnosticos como fertilidade por argila, fosforo, pH, potassio e materia organica.

O que permanece pendente e a taxonomia final das categorias de materiais tecnicos alem desse corte inicial, os nomes finais de todos os elementos/camadas e a forma de evoluir panoramas alem da demarcacao basica.

### 5. Experiencia detalhada do produtor

O papel do produtor esta claro em nivel alto, mas ainda faltam definicoes mais finas sobre:

- como navegar entre uma ou mais propriedades
- como acessar historico, mapas e arquivos de modo simples
- onde termina consulta e onde comecam operacoes que exigem permissao da equipe

### 6. Revisao do fluxo de cadastro de Propriedade e Produtor

Ainda falta avaliar se a tela de Nova Propriedade deve permitir criar novo titular/produtor dentro do proprio cadastro.

A tendencia para o MVP e centralizar o cadastro de novos usuarios/produtores em `NovoUsuarioScreen` e deixar `NovoProdutorScreen`/Nova Propriedade apenas para selecionar um produtor/titular ja existente.

Status em 2026-05-30: esta pendencia permanece aberta apos a microfase de padronizacao visual. A padronizacao nao alterou fluxo, regra, mock, rota ou payload de cadastro. A recomendacao operacional para o MVP continua sendo manter o cadastro de usuario/produtor centralizado em `Admin -> Usuarios` e usar Nova Propriedade apenas para vincular produtor/titular ja cadastrado, ate haver decisao especifica em uma fase de revisao de fluxos.

Essa decisao deve ser tratada em uma fase separada de Revisao de Fluxos e Regras de Cadastro, junto com outros fluxos necessarios para padronizar conceitos, responsabilidades e nomenclatura.

## Pendencias de Regra e Permissao

### 7. Fechamento completo das regras de permissao por acao

As diretrizes principais de acesso ja estao claras, mas ainda falta consolidar o detalhamento de permissao por acao em todo o dominio, especialmente quando houver diferenca entre:

- visualizacao
- criacao
- edicao
- download
- visibilidade de registros

### 8. Relacao final entre regra de negocio e comportamento efetivo da implementacao atual

Ainda e necessario revisar e fechar, de forma mais precisa, onde a implementacao atual:

- ja segue a regra consolidada
- ainda depende de comportamento mock
- ainda possui duplicacao ou divergencia em telas especificas

Esse ponto nao e backlog tecnico generico. Ele e uma pendencia de alinhamento entre regra e repositorio atual.

## Pendencias de Escopo Tecnico-Funcional

### 9. Remocao do painel temporario `Smoke Dev`

Durante o fechamento da frente de visitas tecnicas por propriedade e caderno de campo por propriedade, foi criado um painel temporario `Smoke Dev` em `src/screens/PerfilScreen.tsx`.

**Status atual**

- manter enquanto a estabilizacao do MVP estiver em andamento
- remover antes de uma entrega formal, build de demonstracao externa ou publicacao

**O que remover**

- constante `smokeRoutes`
- bloco visual `Smoke Dev`
- estilos usados exclusivamente por esse painel

**Por que importa**

O painel esta protegido por `__DEV__`, mas ainda e uma ferramenta interna de teste manual. Ele nao deve ser confundido com funcionalidade do produto.

### 10. Capacidade offline declarada por fluxo

Ja existe a diretriz de priorizar uso em contexto de internet ruim, mas ainda falta declarar com clareza:

- o que deve funcionar apenas para consulta
- o que pode depender de sincronizacao posterior
- o que exige conexao

Sem esse fechamento, o projeto corre risco de descrever offline de forma mais ampla do que a capacidade real.

### 11. Estrategia funcional para ingestao e disponibilizacao de mapas e arquivos

O produto ja depende de mapas e arquivos no contexto da propriedade. Para a primeira versao de testes, ficou definido que a biblioteca deve priorizar arquivos tecnicos acessiveis por produtor/equipe, anexados por campo/talhao e elemento/camada quando aplicavel.

Ainda faltam definicoes sobre:

- qual o nivel minimo de tratamento desses materiais no MVP
- como separar consulta simples de manutencao operacional do acervo
- pipeline produtivo para receber arquivos do acervo/drive, validar, armazenar, liberar e manter historico

Decisao ja assumida para o MVP: o app deve consumir uma demarcacao final normalizada, preferencialmente GeoJSON ou JSON equivalente, e nao carregar o pacote bruto de origem no dispositivo. Ainda falta definir o pipeline de producao para conversao, validacao, armazenamento, permissao e publicacao desses arquivos finais.

Estado atual do teste local: existe uma amostragem da propriedade Sela de Prata I convertida a partir de shapefile para validar a exibicao dos talhoes no mock. Essa amostra possui manifesto em `data/processados/p_sela1/2025/manifesto.json`, mas o conversor local nao fecha a estrategia produtiva; ele apenas prova o formato de entrada esperado pelo app e o registro minimo de revisao.

Estado atual dos anexos visuais: existe uma amostra pequena de PNGs de fertilidade da propriedade Sela de Prata I cadastrada manualmente no mock como registros da entidade `Mapa`. Esses PNGs sao assets internos do app apenas para validacao visual do MVP. Eles nao representam upload real, cadastro administrativo completo, persistencia em banco/storage, API de anexos, importacao automatica ou gestao completa do acervo.

Atualizacao em 2026-06-01: os cinco PNGs da Sela de Prata I foram enriquecidos de forma aditiva no mock com metadados conceituais do futuro `AnexoFertilidade`, preservando campos legados como `fazenda_id`, `produtor_id`, `talhao`, `subcategoria`, `data_criacao` e `disponivel_download`. Tambem existe o tipo isolado `src/types/anexoFertilidade.ts`, ainda nao integrado ao dominio real.

Permanece pendente definir e implementar:

- integracao futura de `AnexoFertilidade` ao dominio real, sem quebrar a compatibilidade atual
- fluxo administrativo real para cadastrar/liberar PNGs e outros anexos
- estrategia de armazenamento persistente dos arquivos
- backend/storage/upload para anexos e materiais tecnicos
- API/backend para anexos de mapas
- fluxo de confirmacao manual dos metadados antes da publicacao
- status real de publicacao/liberacao dos anexos
- regras de permissao por acao para criacao, edicao, remocao, liberacao e download
- tratamento de versoes, historico e revisao dos materiais
- pipeline produtivo para receber, validar, armazenar e publicar materiais tecnicos
- migracao futura de `fazenda_id` para `propriedade_id`, preservando compatibilidade durante a transicao
- separacao clara entre amostras mockadas e acervo operacional real

## Regra de Governanca

Uma pendencia deve sair deste documento quando ocorrer uma destas situacoes:

- foi consolidada como decisao do projeto
- foi removida do escopo atual por definicao explicita
- foi desmembrada em detalhe tecnico subordinado a um documento mais especifico

Enquanto isso nao acontecer, o tema deve permanecer aqui, e nao ser tratado como verdade fechada.
