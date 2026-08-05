# Localização E Escopo De Propriedade

> Status: `ATIVO`
>
> Revisado em: 2026-08-05
>
> Substitui o contrato de Regional/Área Operacional definido originalmente em
> `MP-02`.

## Objetivo

Separar a localização oficial da Propriedade do escopo de acesso dos usuários.

No contrato v2, Município e UF descrevem onde a Propriedade está. Colaborador
recebe acesso somente por vínculo direto e ativo com cada Propriedade. Não há
Regional ou Área Operacional no primeiro modelo canônico.

## Decisão Atual

1. A Tchê Fertilidade é a única organização operadora.
2. Propriedade referencia Município e UF por identificadores estáveis.
3. Município e UF servem para cadastro, busca, filtro, agrupamento e seleção
   administrativa em lote.
4. Município, UF, nome de Região ou proximidade geográfica não concedem
   acesso.
5. Colaborador acessa somente Propriedades com vínculo direto ativo em
   `usuario_propriedade`.
6. Somente Admin autorizado cria, altera ou encerra esses vínculos.

O contrato completo das entidades e relações está em
`modelo-dados-mock-v2.md`.

## Localização Oficial

| Conceito | Identificador | Regra |
|---|---|---|
| UF | código IBGE da UF e sigla | lista oficial controlada |
| Município | código IBGE do Município | pertence a uma UF |
| Propriedade | `propriedade_id` | referencia Município e UF |

Campos canônicos:

- `uf_id`;
- `uf_sigla`;
- `municipio_id`;
- `municipio_nome` como snapshot de apresentação;
- `propriedade_id`.

Uma Propriedade rural pertence ao Município mesmo quando estiver fora da área
urbana. Nome de cidade e sigla de estado não devem ser usados como chave.

## Escopo Operacional

O escopo operacional v2 é explícito por Propriedade:

```ts
interface UsuarioPropriedadeV2 {
  id: string;
  organizacao_id: string;
  usuario_id: string;
  propriedade_id: string;
  tipo_vinculo: 'titular' | 'usuario_autorizado' | 'colaborador';
  status: 'ativo' | 'inativo';
}
```

O perfil define as ações; o vínculo define o conjunto de Propriedades.

- Admin possui visão global dentro da Tchê Fertilidade.
- Produtor acessa por vínculo de Titular ou usuário autorizado.
- Colaborador acessa por vínculo direto `colaborador`.
- Usuário sem vínculo ativo não acessa a Propriedade.

## Administração Em Lote

Para evitar cadastro manual repetitivo, o Admin pode:

1. filtrar Propriedades por UF;
2. filtrar por Município;
3. selecionar uma ou várias Propriedades;
4. criar vínculos diretos para um Colaborador.

O resultado continua sendo uma lista explícita de vínculos. Uma Propriedade
nova no mesmo Município não fica automaticamente acessível, a menos que um
Admin a atribua.

## Autoridade E Auditoria Futura

- Colaborador consulta seus vínculos, mas não os altera.
- Produtor não altera titularidade nem vínculos estruturais pelo Perfil.
- Somente Admin com permissão explícita gerencia vínculos.
- Alteração futura deve registrar autor, usuário afetado, Propriedade, valor
  anterior, valor novo, justificativa, horário e correlação da requisição.
- Redução de escopo deve revalidar ou revogar a sessão e limpar dados locais
  que deixaram de ser autorizados.

O frontend local pode aplicar essas regras para coerência do mock, mas a
garantia produtiva pertence ao backend.

## Compatibilidade Do Mock V1

O código atual ainda usa:

- `regiao`;
- `microregiao`;
- `sub_regioes`;
- `vinculos_microregioes`;
- `propriedades_atribuidas`;
- `regioes_acesso`;
- `territorioCompat`.

Esses campos descrevem somente o comportamento legado do mock v1. Eles não
devem ser copiados para registros v2 nem convertidos automaticamente para
Município, UF ou vínculo direto.

A implementação deve migrar o motor de acesso para `usuario_propriedade`,
comparar os casos dos três perfis e, depois da regressão, remover a leitura
territorial antiga.

## Critérios De Aceite

1. Propriedade v2 possui Município e UF canônicos.
2. Município/UF não concedem acesso.
3. Colaborador acessa somente Propriedades diretamente vinculadas.
4. Admin pode atribuir e encerrar vínculos.
5. Filtros geográficos não alteram permissão sem confirmação administrativa.
6. Rotas diretas revalidam o vínculo com a Propriedade.
7. Campos territoriais v1 não são gravados no snapshot v2.
8. Testes cobrem vínculo ativo, inativo, ausente e mudança de escopo.

## Fora Do Escopo

- Regional;
- Área Operacional;
- autorização automática por Município ou UF;
- múltiplas organizações;
- auditoria e revogação produtivas sem backend.
