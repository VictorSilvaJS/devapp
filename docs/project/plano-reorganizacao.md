# Plano de Reorganizacao Tecnica

> Status: Fase 1 encerrada no escopo documental e de organizacao do repositorio. A estabilizacao final de nomenclatura e dominio foi explicitamente movida para a Fase 2.

Este documento define a ordem recomendada para reorganizar o projeto sem misturar refatoracao estrutural com entrega de funcionalidade.

## Objetivo

Criar uma base previsivel para evolucao do app, reduzindo ambiguidade de dominio, duplicacao de regras e acoplamento entre telas, mocks e documentacao.

## Principios

- Uma unica fonte de verdade para regras de negocio.
- Documentacao curta, atualizada e facil de localizar.
- Separacao clara entre interface, dominio e acesso a dados.
- Refatoracao por etapas pequenas, com impacto controlado.
- Nenhuma feature nova importante antes de estabilizar contratos e estrutura.

## Convencao Provisoria de Linguagem

Enquanto a Fase 2 nao consolidar o dominio, a documentacao ativa usa `produtor` como termo provisório para o perfil final ligado a fazendas. Alias historicos como `cliente` e `proprietario` devem aparecer apenas quando forem necessarios para explicar inconsistencias existentes.

## Ordem Recomendada

### Fase 1 - Saneamento de Base

- Reorganizar a documentacao em `docs/`
- Reescrever o `README` para refletir o estado real do projeto
- Mapear inconsistencias de nomenclatura e explicitar que a consolidacao final ficara para a Fase 2
- Corrigir inconsistencias obvias de organizacao do repositorio

**Definicao de pronto**
- Raiz limpa
- Indice de documentacao claro
- Estado atual do projeto descrito sem promessas incorretas
- Pendencias de dominio registradas sem tentar resolve-las parcialmente nesta fase

### Fase 2 - Contratos e Dominio

- Consolidar o padrao oficial para alias hoje tratados provisoriamente como `produtor`, `cliente` e `proprietario`
- Padronizar campos como `nome` vs `full_name`
- Padronizar contratos como `disponivel_download` vs `disponivel_para_download`
- Revisar schemas, validadores e mocks para usar o mesmo idioma

**Definicao de pronto**
- Entidades, validadores e telas usam o mesmo vocabulario
- Nao ha mais alias contraditorios no dominio central

### Fase 3 - Camada de Dados

- Separar massa mock de acesso a dados
- Tirar importacoes diretas de `../api/mock` das telas
- Introduzir estrutura de `repositories` ou `services` por dominio
- Deixar o app preparado para trocar mock por backend real

**Definicao de pronto**
- Telas nao conhecem detalhes do mock
- Troca de fonte de dados deixa de exigir refatoracao em varias telas

### Fase 4 - Permissoes e Regras

- Centralizar regras de acesso por perfil
- Remover duplicacao de filtros regionais nas telas
- Garantir permissao tanto na navegacao quanto na acao

**Definicao de pronto**
- Uma mudanca de regra e feita em um lugar so
- Admin, colaborador e produtor seguem o mesmo criterio em toda a aplicacao

### Fase 5 - Componentizacao por Feature

- Quebrar telas grandes em componentes menores
- Extrair blocos de UI reutilizaveis por dominio
- Organizar `screen`, `components`, `hooks` e `types` por feature

**Definicao de pronto**
- `MapasScreen`, `VisitasScreen`, `ProdutoresScreen` e `DashboardScreen` deixam de concentrar muitas responsabilidades

### Fase 6 - Infra Real

- Backend real
- Autenticacao real
- Upload real
- Offline real
- Testes automatizados de verdade

**Definicao de pronto**
- O projeto deixa de depender de simulacoes para fluxos principais

## Estrutura Alvo de Codigo

```text
src/
  app/
    navigation/
    providers/
    theme/
  shared/
    components/
    hooks/
    types/
    utils/
  features/
    auth/
    produtores/
    visitas/
    caderno/
    mapas/
    perfil/
    notificacoes/
  data/
    mock/
    repositories/
    services/
```

## Regras de Componentizacao

- `screen` monta fluxo e estado da pagina
- `section` agrupa blocos maiores da mesma tela
- `component` resolve UI reutilizavel
- `hook` concentra comportamento repetido
- `repository/service` acessa dados
- `rule/permission` concentra regra de negocio

## Proxima Acao Recomendada

Depois desta reorganizacao documental, o melhor proximo passo e a Fase 2: padronizar o dominio e os contratos antes de mover codigo entre pastas.
