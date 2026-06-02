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

Usuario com atuacao operacional restrita por territorio e/ou propriedades
atribuidas. No MVP visual/mockado, seus vinculos territoriais ajudam a
representar Regiao -> Microregiao -> Propriedade, mas ainda nao substituem o
motor efetivo de permissoes.

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
`usuario_microregiao` e campos legados equivalentes.

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
- microregiao, regiao ou propriedade atribuida quando ativo

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
- `produtor_id`
- `proprietario_id`
- `produtores` no mock representando propriedades/fazendas legadas
- rotas internas `NovoProdutor` e `EditarProdutor`
- rotas internas `Produtores` e `Meus Produtores`

## Riscos Conhecidos

- misturar nome de usuario com nome de propriedade
- trocar `produtor_id`/`proprietario_id` sem plano
- quebrar vinculo de titular
- quebrar colaborador por regiao/microregiao
- quebrar permissoes de acesso
- duplicar cadastro rapido de propriedade

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

As rotas internas ainda permanecem legadas temporariamente:

- `Produtores`
- `Meus Produtores`
- `NovoProdutor`
- `EditarProdutor`

Motivo: rotas sao contratos de navegacao por string e ainda aparecem em
`RootParamList` e `navigation.navigate(...)`. A migracao de rotas deve ocorrer
em fase propria, com aliases e smoke completo.

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
- integridade referencial real fica para backend;
- campos como `fazenda_id`, `produtor_id` e `proprietario_id` permanecem por compatibilidade.
