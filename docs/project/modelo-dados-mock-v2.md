# Modelo De Dados Canônico V2

> Status: `APROVADO_PARA_IMPLEMENTACAO`
>
> Definido em: 2026-08-05
>
> Escopo: substituição integral dos dados demonstrativos e preparação do
> frontend para o futuro backend.

## Objetivo

Definir um único vocabulário técnico para reconstruir o mock sem carregar os
aliases históricos de Fazenda, Produtor usado como Propriedade ou escopo por
texto territorial.

Este contrato orienta primeiro a persistência local demonstrativa v2. O futuro
backend deve partir dos mesmos identificadores e relações, acrescentando
autenticação, autorização, auditoria, transações e integridade no servidor.

## Decisões De Base

1. A Tchê Fertilidade é a única organização operadora do aplicativo.
2. Cada Propriedade possui exatamente um Produtor como Titular principal
   ativo.
3. Um Produtor pode ser Titular de uma ou mais Propriedades.
4. Outros usuários acessam uma Propriedade somente por vínculo explícito e
   ativo em `usuario_propriedade`.
5. O perfil define quais ações o usuário pode executar; o vínculo define em
   quais Propriedades essas ações podem ser executadas.
6. Admin possui visão global dentro da organização.
7. Colaborador acessa somente as Propriedades atribuídas diretamente.
8. Município e UF representam localização e filtro. Eles não concedem acesso.
9. Regional, Área Operacional, Região, Microregião e aliases equivalentes não
   fazem parte do contrato v2 inicial.
10. Entidades operacionais usam `propriedade_id`; `fazenda_id` não faz parte do
    contrato v2.

## Identificadores

- IDs são técnicos, imutáveis e independentes de nomes.
- O identificador inicial da organização é `org_tche_fertilidade`.
- Nomes, e-mails, Município, UF, códigos de Talhão e nomes de arquivo não são
  chaves de relacionamento.
- IDs do mock novo não devem reutilizar um ID antigo com outro significado.
- `talhao_id` identifica o Talhão lógico; versão de geometria possui ID
  próprio quando aplicável.

## Entidades Canônicas

### `organizacoes`

```ts
interface OrganizacaoV2 {
  id: 'org_tche_fertilidade';
  nome: 'Tchê Fertilidade';
  status: 'ativa';
}
```

O contexto permanece interno. O usuário não seleciona organização no primeiro
corte.

### `usuarios`

```ts
type PerfilUsuarioV2 = 'admin' | 'colaborador' | 'produtor';
type StatusUsuarioV2 = 'ativo' | 'inativo' | 'pendente';

interface UsuarioV2 {
  id: string;
  organizacao_id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuarioV2;
  status: StatusUsuarioV2;
  telefone?: string;
  documento?: string;
  observacoes?: string;
}
```

Usuário representa a conta/pessoa de acesso. Senha e token não pertencem ao
registro cadastral e continuam fora do contrato produtivo até a implementação
de autenticação real.

### `produtores`

```ts
interface ProdutorV2 {
  id: string;
  organizacao_id: string;
  usuario_id: string;
  nome: string;
  status: 'ativo' | 'inativo';
}
```

Produtor é o perfil cadastral do titular. No primeiro corte, cada Produtor
possui um usuário principal. Um Produtor pode titularizar várias Propriedades.

### `propriedades`

```ts
interface PropriedadeV2 {
  id: string;
  organizacao_id: string;
  titular_id: string;
  nome: string;
  municipio_id: string;
  municipio_nome: string;
  uf_id: string;
  uf_sigla: string;
  area_total?: number;
  cultura_principal?: string;
  status: 'ativa' | 'inativa';
}
```

`titular_id` referencia `produtores.id`. Cada Propriedade possui exatamente um
Titular principal ativo. Troca futura de titularidade deve ser transacional e
auditada; uma edição cadastral comum não altera o Titular.

### `usuarios_propriedades`

```ts
type TipoVinculoPropriedadeV2 =
  | 'titular'
  | 'usuario_autorizado'
  | 'colaborador';

interface UsuarioPropriedadeV2 {
  id: string;
  organizacao_id: string;
  usuario_id: string;
  propriedade_id: string;
  tipo_vinculo: TipoVinculoPropriedadeV2;
  status: 'ativo' | 'inativo';
}
```

O usuário principal do Produtor Titular também recebe vínculo `titular`. Os
demais usuários recebem vínculo conforme seu papel. Vínculo não muda o perfil
do usuário nem transfere titularidade.

Deve existir no máximo um vínculo ativo equivalente para a mesma combinação
de usuário, Propriedade e tipo. Uma Propriedade referenciada precisa existir e
pertencer à mesma organização.

### Localização oficial

O mock pode carregar uma lista controlada de UF e Município ou validar os
respectivos códigos na carga de dados.

Campos canônicos:

- `uf_id` e `uf_sigla`;
- `municipio_id` e `municipio_nome`.

Município/UF podem filtrar e agrupar a interface administrativa. Uma ação em
lote pode selecionar várias Propriedades por esses filtros e criar vínculos
diretos para um Colaborador. A localização nunca concede acesso por si só.

### `talhoes`

```ts
interface TalhaoV2 {
  id: string;
  organizacao_id: string;
  propriedade_id: string;
  nome: string;
  codigo?: string;
  status: 'ativo' | 'inativo';
}
```

Geometria, importação e versão publicada continuam separadas conforme
`versionamento-geojson-talhoes.md`.

### Entidades operacionais

Visita, Caderno, Safra/Safrinha, Material, mapa, arquivo, GeoJSON e qualquer
outro recurso pertencente à Propriedade devem usar:

```ts
interface ContextoPropriedadeV2 {
  propriedade_id: string;
  talhao_id?: string;
}
```

`talhao_id` é opcional somente quando o registro pertence à Propriedade
inteira. Quando informado, o Talhão precisa pertencer à mesma Propriedade.

## Regras De Acesso V2

### Admin

- acessa todas as Propriedades da Tchê Fertilidade;
- administra usuários, Propriedades e vínculos conforme a permissão da ação;
- vínculo individual não é necessário para o escopo global.

### Produtor

- acessa Propriedades com vínculo ativo `titular` ou
  `usuario_autorizado`;
- o Produtor Titular pode possuir várias Propriedades;
- permanece sem administração da estrutura geral;
- visibilidade e ações específicas continuam sujeitas às regras de Caderno,
  Visita e Material.

### Colaborador

- acessa somente Propriedades com vínculo ativo `colaborador`;
- Município, UF ou texto territorial não ampliam o acesso;
- atribuição e remoção de vínculo cabem ao Admin autorizado;
- filtros em lote são ferramenta administrativa, não fonte implícita de
  permissão.

### Regra comum

Abrir uma rota, receber um ID pelo cliente ou esconder um botão não concede
permissão. O frontend aplica a regra local no mock; o backend futuro deve
revalidar usuário, perfil, organização, vínculo, ação e recurso.

## Contrato Da Persistência Local V2

O snapshot estruturado novo deve usar uma chave distinta, por exemplo:

```text
@tche:mock-mvp:v2
```

O snapshot v2 deve conter, no mínimo:

- organização;
- usuários;
- produtores;
- Propriedades;
- vínculos usuário–Propriedade;
- Visitas;
- Cadernos;
- metadados de Materiais.

Os registros leves de Talhão pertencem ao snapshot v2. Geometrias e arquivos
grandes continuam fora do `AsyncStorage` e são relacionados por
`propriedade_id` e `talhao_id`.

Como os dados v1 são exclusivamente demonstrativos, a entrada no v2 será uma
substituição integral, não uma conversão de conteúdo. Uma rotina executada uma
única vez deve descartar os snapshots/índices demonstrativos v1 e arquivos
associados aos IDs antigos antes de instalar o novo seed aprovado.

Sessão e credenciais demonstrativas também precisam ser recriadas para os IDs
v2. Nenhuma senha real deve ser incorporada ao seed cadastral.

## Mock, Fixture E Dados Operacionais

- Seed técnico mínimo e conjunto demonstrativo devem ser arquivos separados.
- Dados fornecidos para a nova carga devem ser validados antes de gerar o
  seed.
- Nomes, contatos, documentos, limites e anexos exigem autorização de uso.
- Nenhum dado ausente pode ser completado por inferência silenciosa.
- O repositório não deve receber dados pessoais reais sem necessidade e
  autorização explícita.

## Compatibilidade V1

Durante a implementação, os adapters v1 podem existir apenas para manter a
baseline verde enquanto cada consumidor é migrado. Eles não devem escrever
aliases antigos em registros v2.

Campos que deixam de fazer parte do contrato v2:

- `fazenda_id`, `fazendaId`, `fazenda_nome`, `fazendaNome`;
- `proprietario_id` como alias de Titular;
- `produtor_id` usado como Propriedade;
- `regiao`, `microregiao`, `sub_regioes`, `vinculos_microregioes` e
  `propriedades_atribuidas` como fontes de autorização.

A compatibilidade pode ser removida somente depois que contratos, validação,
acesso, rotas, telas, serviços, storage e testes tiverem migrado para v2.

## Critérios De Aceite Da Implementação

1. Nenhum registro v2 usa `fazenda_id` ou identificador textual como relação.
2. Um Produtor pode titularizar várias Propriedades.
3. Cada Propriedade possui um único Titular principal ativo.
4. Usuários adicionais não se tornam Titulares por receber acesso.
5. Colaborador acessa apenas Propriedades com vínculo direto ativo.
6. Município/UF filtram, mas não autorizam.
7. Todo `talhao_id` pertence à `propriedade_id` do registro.
8. Instalação nova recebe somente o seed v2.
9. Atualização sobre instalação antiga descarta o pacote demonstrativo v1.
10. Admin, Colaborador e Produtor passam por testes positivos e negativos de
    acesso, inclusive em rota direta.
11. `npm run typecheck`, `npm run test:domain-compat` e o smoke aplicável
    passam antes do fechamento.

## Fora Do Escopo Deste Contrato

- backend e banco produtivos;
- autenticação, token, convite e recuperação de senha reais;
- múltiplas organizações;
- Regional ou Área Operacional;
- inferência de acesso por Município/UF;
- migração de dados operacionais reais;
- criação de dados que ainda não foram fornecidos e aprovados.
