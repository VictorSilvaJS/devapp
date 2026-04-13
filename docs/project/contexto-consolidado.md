# Contexto Consolidado do Projeto

Este documento resume o contexto funcional do projeto sem depender de materiais historicos, propostas antigas ou hipoteses tecnicas. Seu papel e explicar por que o sistema existe, para quem ele existe e qual e a unidade principal do dominio.

## Problema Central

As informacoes operacionais da lavoura tendem a ficar espalhadas entre arquivos, relatorios, conversas e rotinas manuais. Isso dificulta localizar mapas, acompanhar visitas, entender o historico de uma fazenda e disponibilizar materiais de forma controlada para quem precisa consultar.

O projeto existe para reduzir essa dispersao e organizar o acesso a essas informacoes em um unico fluxo de uso.

## Proposito do Sistema

O sistema busca centralizar informacoes ligadas ao trabalho tecnico e ao acompanhamento da fazenda, com foco em:

- consulta organizada por produtor e por fazenda
- acesso a mapas e arquivos tecnicos
- apoio ao trabalho da equipe de campo
- historico de visitas e registros operacionais
- uso em contexto com conectividade limitada

## Usuarios Principais

### Administracao Geral

Perfil com visao ampla da operacao. Precisa navegar entre regioes, produtores e fazendas sem perder o panorama consolidado do sistema.

### Colaborador Regional

Perfil operacional com escopo geografico restrito. Atua na consulta e manutencao dos dados dentro da sua regiao ou sub-regiao, conforme permissao.

### Produtor

Perfil final ligado a uma ou mais fazendas. Seu foco principal e consultar materiais, visualizar historico e acessar dados autorizados da sua propria realidade operacional.

## Unidade Central do Dominio

Na documentacao ativa, `produtor` e o termo provisório principal para o papel final ligado as fazendas.

O dominio deve ser entendido a partir desta relacao central:

- um produtor pode estar vinculado a uma ou mais fazendas
- cada fazenda concentra mapas, arquivos, visitas e registros associados
- o acesso aos dados deve respeitar o contexto da fazenda e o perfil do usuario

Isso significa que mapas, arquivos e historicos nao devem ser tratados como elementos soltos. Eles fazem sentido dentro do contexto do produtor e da fazenda a que pertencem.

## Restricoes Operacionais Relevantes

O projeto precisa considerar algumas restricoes reais do contexto de uso:

- internet instavel ou inexistente em campo
- necessidade de clareza de acesso por perfil sem UX excessivamente burocratica
- necessidade de organizacao por regiao para a operacao da equipe
- necessidade de preservar contexto de fazenda ao navegar entre dados

## Relacao com o MVP

O nucleo do MVP gira em torno de:

- acesso por perfil
- consulta por produtor e fazenda
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
