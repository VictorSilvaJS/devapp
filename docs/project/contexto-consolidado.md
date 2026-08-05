# Contexto Consolidado do Projeto

Este documento resume o contexto funcional do projeto sem depender de materiais historicos, propostas antigas ou hipoteses tecnicas. Seu papel e explicar por que o sistema existe, para quem ele existe e qual e a unidade principal do dominio.

## Problema Central

As informacoes operacionais da lavoura tendem a ficar espalhadas entre arquivos, relatorios, conversas e rotinas manuais. Isso dificulta localizar mapas, acompanhar visitas, entender o historico de uma propriedade e disponibilizar materiais de forma controlada para quem precisa consultar.

O projeto existe para reduzir essa dispersao e organizar o acesso a essas informacoes em um unico fluxo de uso.

## Proposito do Sistema

O sistema busca centralizar informacoes ligadas ao trabalho tecnico e ao acompanhamento da propriedade, com foco em:

- consulta organizada por produtor e por propriedade
- acesso a mapas e arquivos tecnicos
- apoio ao trabalho da equipe de campo
- historico de visitas e registros operacionais
- uso em contexto com conectividade limitada

## Usuarios Principais

### Administracao Geral

Perfil com visao ampla da operacao. Precisa navegar entre regioes, produtores e propriedades sem perder o panorama consolidado do sistema.

### Colaborador

Perfil operacional da Tche Fertilidade. Atua na consulta e manutencao dos
dados somente nas Propriedades atribuidas diretamente, conforme permissao por
acao.

### Produtor

Perfil final ligado a uma ou mais propriedades. Seu foco principal e consultar materiais, visualizar historico e acessar dados autorizados da sua propria realidade operacional.

## Unidade Central do Dominio

Na linguagem de produto, `Propriedade` e a unidade principal vista pelo usuario final. `Produtor` e o perfil final, `Titular` e o responsavel cadastral ou vinculo principal, e `Talhao` e a subdivisao interna da propriedade.

No codigo e em documentos tecnicos, nomes como `fazenda`, `fazenda_id` e rotas ou arquivos historicos permanecem temporariamente por compatibilidade.

O dominio deve ser entendido a partir desta relacao central:

- um produtor pode estar vinculado a uma ou mais propriedades
- cada propriedade concentra mapas, arquivos, visitas e registros associados
- o acesso aos dados deve respeitar o contexto da propriedade e o perfil do usuario

Isso significa que mapas, arquivos e historicos nao devem ser tratados como elementos soltos. Eles fazem sentido dentro do contexto do produtor e da propriedade a que pertencem.

## Restricoes Operacionais Relevantes

O projeto precisa considerar algumas restricoes reais do contexto de uso:

- internet instavel ou inexistente em campo
- necessidade de clareza de acesso por perfil sem UX excessivamente burocratica
- necessidade de localizar e filtrar Propriedades por Municipio/UF e atribuir
  explicitamente o escopo de cada Colaborador
- necessidade de preservar contexto de propriedade ao navegar entre dados

## Relacao com o MVP

O nucleo do MVP gira em torno de:

- acesso por perfil
- consulta por produtor e propriedade
- mapas e arquivos
- visitas tecnicas
- caderno de campo enxuto
- visualizacao em contexto de operacao rural

Este documento nao define detalhes finais de escopo, regras fechadas de permissao ou taxonomia completa. Esses pontos devem ser tratados nos documentos especificos de escopo, regras e pendencias.

## Como Usar Este Documento

Use este arquivo para responder, antes de qualquer decisao de implementacao:

- qual problema o sistema tenta resolver
- quem sao os usuarios principais
- qual e a unidade central do dominio
- quais restricoes do mundo real precisam ser respeitadas

Quando houver conflito entre historico e direcao atual, este documento deve ser lido em conjunto com `estado-atual.md`, `escopo-mvp.md` e `regras-de-negocio.md`.
