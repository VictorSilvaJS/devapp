# Matriz De Cadastros Do MVP

Este documento consolida a separacao oficial dos cadastros do MVP atual. Ele
nao altera codigo, mock, rotas, permissoes, contratos ou nomes tecnicos
legados. Seu objetivo e orientar proximas revisoes sem misturar pessoa,
perfil, propriedade e vinculo cadastral.

## Definicoes

### Usuario

Pessoa cadastrada para acesso presente ou futuro ao sistema. No MVP
visual/mockado, o cadastro administrativo de usuario concentra dados comuns de
pessoa/acesso e o perfil operacional associado.

### Produtor

Perfil de usuario final que consulta sua propria realidade operacional. O
produtor pode estar vinculado a uma ou mais propriedades. Produtor nao e a
propriedade.

### Colaborador

Usuario com atuacao operacional restrita por territorio. No MVP
visual/mockado, `sub_regioes` define o escopo regional efetivo e
`vinculos_microregioes` e fallback quando `sub_regioes` estiver ausente ou
vazio. `propriedades_atribuidas` representa vinculo direto visual/admin
preparatorio, mas ainda nao substitui nem altera o motor efetivo de
permissoes.

### Administrador

Usuario gestor com visao ampla da operacao. No MVP visual/mockado, administra
usuarios, vinculos e propriedades sem criar autenticacao real, convite, reset
ou sessao real.

### Propriedade

Unidade rural/operacional central do dominio. Mapas, visitas, caderno,
arquivos e materiais tecnicos devem ser entendidos no contexto da propriedade.

### Titular

Produtor vinculado como responsavel cadastral ou vinculo principal da
propriedade. O titular nao deve ser alterado acidentalmente em edicoes simples
da propriedade.

### Vinculo

Relacao entre usuario e propriedade ou entre usuario e territorio. No MVP
visual/mockado, o vinculo de produtor com propriedade aparece em
`usuario_propriedade`; o vinculo territorial do colaborador aparece em
`usuario_microregiao`, `vinculos_microregioes` e campos legados equivalentes.
Vinculos diretos em `propriedades_atribuidas` sao preparatorios para backend,
sem efeito de RBAC por propriedade no MVP atual.

## Regra Principal

- Usuario e pessoa/acesso.
- Produtor e perfil de usuario.
- Propriedade e unidade rural.
- Titular e o produtor vinculado a propriedade.
- Colaborador e usuario com escopo territorial/propriedades.
- Administrador e usuario gestor.

## Matriz De Campos Obrigatorios No MVP

### Usuario

- nome
- e-mail
- perfil
- status

### Produtor

- usuario com perfil produtor
- vinculo com ao menos uma propriedade quando ativo

### Colaborador

- usuario com perfil colaborador
- microregiao, regiao ou propriedade atribuida quando ativo no mock
  administrativo
- acesso efetivo por `sub_regioes` ou, se ausente/vazio, por
  `vinculos_microregioes`

### Administrador

- usuario com perfil admin
- status

### Propriedade

- titular
- nome da propriedade
- area total
- regiao
- microregiao
- status

### Cadastro Rapido De Propriedade

- nome da propriedade
- regiao
- microregiao
- area total
- status
- titular inferido pelo usuario produtor em edicao/cadastro

## Campos Opcionais Ou Mockados

- telefone
- documento
- observacoes
- cargo
- nivel administrativo
- cidade
- UF
- cultura atual/principal
- senha
- convite
- reset
- autenticacao real
- colaboradores sugeridos

## Campos Legados E Compatibilidade Preservada

Os itens abaixo nao devem ser alterados agora. Eles sustentam compatibilidade
com mocks, rotas, helpers, filtros, visitas, caderno, mapas, permissoes e
payloads existentes.

- `fazenda_id`
- `fazendaId`
- `fazenda_nome`
- `fazendaNome`
- `produtor_id`
- `proprietario_id`
- `produtor_nome`
- `produtores` no mock representando propriedades/fazendas legadas
- rota tecnica de tab `Propriedades`
- rota tecnica de tab `PropriedadesColaborador`

Status em 2026-06-03: a migração aditiva de Propriedade/Titular adicionou
compatibilidade dupla sem remover os legados acima. Os 11 registros estaticos
de produtores/propriedades em `src/api/mock.ts` foram enriquecidos com:

- `propriedade_id`
- `propriedadeId`
- `propriedade_nome`
- `propriedadeNome`
- `titular_id`
- `titularId`
- `titular_nome`

A borda `src/api/produtorCompat.ts` preserva e emite esses aliases em leitura
e persistencia mockada. Codigo novo deve preferir os resolvers de
`src/utils/propriedadeCompat.ts` em vez de acessar diretamente
`fazenda_id`, `produtor_id` ou `proprietario_id`, salvo compatibilidade
explicita. Payloads de visita, caderno e cadastro ainda podem continuar usando
`fazenda_id` enquanto a compatibilidade legada estiver ativa.

## Semantica Atual De Acesso Por Perfil

Status em 2026-06-03 (Fase 14D): para o MVP mockado, a leitura oficial da
matriz e:

- Administrador ve todas as Propriedades.
- Produtor ve Propriedades por vinculo de titular/produtor compativel.
- Colaborador ve Propriedades por `sub_regioes`.
- Colaborador sem `sub_regioes` usa `vinculos_microregioes` como fallback.
- `propriedades_atribuidas` nao restringe nem amplia acesso efetivo.

Escopo regional e diferente de propriedade atribuida. Escopo regional e a base
territorial usada pelo motor atual. Propriedade atribuida e um vinculo direto
visual/admin preparatorio, util para desenhar o futuro modelo de
usuario-propriedade, mas ainda sem efeito de permissao.

## Riscos Conhecidos

- misturar nome de usuario com nome de propriedade
- trocar `produtor_id`/`proprietario_id` sem plano
- quebrar vinculo de titular
- quebrar colaborador por regiao/microregiao
- quebrar permissoes de acesso
- duplicar cadastro rapido de propriedade
- assumir que `propriedades_atribuidas` no Admin altera acesso real do
  colaborador

## Ordem Futura Recomendada

1. Padronizar rotulos e secoes visiveis.
2. Revisar validacoes visuais.
3. Revisar cadastro rapido de propriedade.
4. Revisar vinculos do colaborador.
5. So depois planejar migracao tecnica dos nomes legados.

## Leitura Do Estado Atual Das Telas

- `NovoUsuarioScreen` representa cadastro de pessoa/usuario.
- `NovaPropriedadeScreen` representa Nova Propriedade.
- `EditarPropriedadeScreen` representa edicao de Propriedade.
- `PropriedadesScreen` representa listagem de Propriedades.
- Produtor como perfil e diferente de Titular da propriedade.
- Propriedade e a unidade rural/operacional.
- Titular e o produtor vinculado a propriedade.

## Transicao Tecnica De Telas E Rotas

Status em 2026-06-02: os arquivos/componentes das telas de Propriedade foram
renomeados para `PropriedadesScreen`, `NovaPropriedadeScreen` e
`EditarPropriedadeScreen`. Os arquivos legados `ProdutoresScreen.tsx`,
`NovoProdutorScreen.tsx` e `EditarProdutorScreen.tsx` foram
renomeados/removidos como arquivos atuais.

As rotas internas de stack para criacao/edicao foram migradas para:

- `NovaPropriedade`
- `EditarPropriedade`

As rotas internas de tabs foram migradas para:

- `Propriedades`
- `PropriedadesColaborador`

`PropriedadesColaborador` e a rota tecnica da tab de Propriedades no fluxo do
colaborador. O label visual das duas tabs permanece `Propriedades`. A migracao
nao alterou motor de permissoes, mocks, payloads, contratos de dados, helpers
tecnicos ou logica de listagem/filtro.

## Fechamento Do Estado Atual

Status em 2026-06-02: apos os Blocos 5A-5D e 6A-6B, os cadastros do MVP
estao padronizados visualmente conforme esta matriz. A interface diferencia
`Usuario`, `Produtor`, `Colaborador`, `Administrador`, `Propriedade` e
`Titular`, mas os fluxos continuam mockados e preservam payloads, contratos,
rotas, permissoes e campos legados.

Limitacoes conhecidas que permanecem fora do escopo desta matriz:

- fluxo combinado `Usuario + Propriedade` ainda nao e transacional;
- novo titular minimo nao cria login real;
- `Propriedades atribuidas` ao colaborador ainda nao representam RBAC final por propriedade;
- `propriedades_atribuidas` e visual/admin preparatorio e nao altera acesso
  efetivo no MVP mockado;
- integridade referencial real fica para backend;
- campos como `fazenda_id`, `produtor_id` e `proprietario_id` permanecem por compatibilidade.
- aliases futuros de Propriedade/Titular existem no mock e na borda de
  compatibilidade, mas nao substituem contratos, backend ou payloads legados.
