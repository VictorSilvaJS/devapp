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

Usuario da Tche Fertilidade com atuacao operacional restrita as Propriedades
atribuidas diretamente. O codigo v1 ainda calcula escopo por campos
territoriais, mas o contrato v2 usa somente vinculo ativo em
`usuario_propriedade`.

### Administrador

Usuario gestor com visao ampla da operacao. No MVP visual/mockado, administra
usuarios, vinculos e propriedades sem criar autenticacao real, convite, reset
ou sessao real.

### Propriedade

Unidade rural/operacional central do dominio. Mapas, visitas, caderno,
arquivos e materiais tecnicos devem ser entendidos no contexto da propriedade.

### Titular

Produtor dono e responsavel cadastral principal da Propriedade. Cada
Propriedade possui exatamente um Titular principal ativo; um mesmo Produtor
pode titularizar varias Propriedades. O Titular nao deve ser alterado em
edicoes simples da Propriedade.

### Vinculo

Relacao entre Usuario e Propriedade. No contrato v2, todos os acessos de
Produtor e Colaborador usam `usuario_propriedade`. Campos territoriais do v1
nao fazem parte do modelo novo.

## Regra Principal

- Usuario e pessoa/acesso.
- Produtor e perfil de usuario.
- Propriedade e unidade rural.
- Titular e o produtor vinculado a propriedade.
- Colaborador e usuario com Propriedades atribuidas diretamente.
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
- ao menos uma Propriedade vinculada diretamente quando ativo
- acesso efetivo somente pelos vinculos ativos

### Administrador

- usuario com perfil admin
- status

### Propriedade

- titular
- nome da propriedade
- area total
- Municipio
- UF
- status

### Cadastro Rapido De Propriedade

- nome da propriedade
- Municipio
- UF
- area total
- status
- titular inferido pelo usuario produtor em edicao/cadastro

## Campos Opcionais Ou Mockados

- telefone
- documento
- observacoes
- cargo
- nivel administrativo
- cultura atual/principal
- senha
- convite
- reset
- autenticacao real
- colaboradores sugeridos

## Campos Legados E Compatibilidade Preservada

Os itens abaixo pertencem ao mock v1. Permanecem somente durante a migracao do
codigo e nao podem ser gravados em registros v2.

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

Status do codigo v1: a implementacao ainda segue temporariamente:

- Administrador ve todas as Propriedades.
- Produtor ve Propriedades por vinculo de titular/produtor compativel.
- Colaborador ve Propriedades por `sub_regioes`.
- Colaborador sem `sub_regioes` usa `vinculos_microregioes` como fallback.
- `propriedades_atribuidas` nao restringe nem amplia acesso efetivo.

Esse comportamento foi substituido como decisao de produto em 2026-08-05. O
contrato v2 usa vinculo direto; a lista acima serve apenas para orientar a
refatoracao e a regressao.

## Contrato Futuro De RBAC/Backend

Status em 2026-08-05: a direcao futura de backend foi revisada para vinculo
direto por Propriedade.

Matriz futura de escopo:

| Perfil | Fonte de acesso futura | Regra recomendada |
|---|---|---|
| Administrador | Papel administrativo | Acesso global, limitado apenas por politica organizacional futura |
| Produtor | `usuario_propriedade` e titularidade | Acesso as Propriedades vinculadas ao usuario/produtor/titular |
| Colaborador | `usuario_propriedade` | Acesso somente a Propriedade atribuida diretamente |

Entidades minimas esperadas no backend:

- `usuarios`
- `propriedades`
- `usuario_propriedade`
- `perfis`/`papeis`

No backend, a Propriedade atribuida diretamente ao Colaborador e a fonte do
escopo. Municipio/UF nao substituem esse vinculo.

Leitura futura recomendada:

- listar e abrir detalhe de Propriedades usando os vinculos permitidos para o
  perfil;
- ver mapas/anexos apenas quando houver acesso a Propriedade e liberacao do
  material para o perfil/acao;
- criar visita apenas para Admin/Colaborador com permissao de acao e escopo da
  Propriedade;
- editar cadastro apenas para Admin ou papel explicitamente autorizado;
- manter Produtor como perfil de consulta da propria realidade operacional.

## Riscos Conhecidos

- misturar nome de usuario com nome de propriedade
- trocar `produtor_id`/`proprietario_id` sem plano
- quebrar vinculo de titular
- migrar o Colaborador sem criar os vinculos diretos correspondentes
- quebrar permissoes de acesso
- duplicar cadastro rapido de propriedade
- inferir permissao por Municipio/UF
- backend ignorar vinculo direto e manter o Admin visual sem efeito operacional

## Ordem Futura Recomendada

1. Padronizar rotulos e secoes visiveis.
2. Revisar validacoes visuais.
3. Revisar cadastro rapido de propriedade.
4. Migrar vinculos do colaborador para `usuario_propriedade`.
5. Implementar o contrato real de backend/RBAC para `usuario_propriedade`.
6. So depois planejar migracao tecnica dos nomes legados.

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
- o motor v1 ainda nao aplica os vinculos diretos como regra efetiva;
- integridade referencial real fica para backend;
- campos como `fazenda_id`, `produtor_id` e `proprietario_id` permanecem por compatibilidade.
- aliases futuros de Propriedade/Titular existem no mock e na borda de
  compatibilidade, mas nao substituem contratos, backend ou payloads legados.
