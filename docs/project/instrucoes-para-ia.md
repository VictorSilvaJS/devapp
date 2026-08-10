# Instruções para IA e Agentes de Código

## Objetivo

Estas instruções impedem que histórico, mock, proposta ou hipótese sejam
tratados como estado atual ou segurança produtiva.

## Hierarquia de fontes

Use esta ordem:

1. código e testes relacionados à tarefa;
2. docs/project/estado-atual.md;
3. contexto, escopo, regras e decisões em docs/project;
4. contrato técnico vigente relacionado à tarefa;
5. pendências e próximos passos;
6. docs/archive somente como histórico ou evidência.

Em caso de conflito entre documento ativo e código, não invente uma síntese:
registre a divergência e trate o código como evidência do comportamento
existente. Decisões de produto continuam exigindo atualização documental.

## Leitura por tarefa

Leitura base:

1. docs/project/README.md
2. docs/project/estado-atual.md
3. docs/project/contexto-consolidado.md
4. docs/project/escopo-mvp.md
5. docs/project/regras-de-negocio.md
6. docs/project/decisoes-consolidadas.md
7. docs/project/pendencias-de-definicao.md
8. docs/project/proximos-passos.md

Abra somente os contratos técnicos relacionados à tarefa. Evite carregar o
arquivo histórico inteiro sem uma razão verificável.

## Regras de interpretação

### Estado atual

Uma capacidade só existe quando está comprovada no código e, quando aplicável,
em teste ou smoke. Contrato aprovado descreve o comportamento alvo e deve ser
apresentado como ainda não implementado quando esse for o caso.

### Mock

Proteção visual, login local, AsyncStorage, arquivo local e regra executada no
cliente não representam autenticação, autorização, auditoria, storage ou
sincronização produtivos.

### Arquivo

Documentos em docs/archive preservam contexto. Não podem autorizar feature,
reabrir escopo ou contradizer o núcleo ativo por conta própria.

## Domínio obrigatório

- Propriedade é a unidade operacional e o termo oficial de interface.
- Produtor é o perfil final.
- Titular é o responsável principal da Propriedade.
- Talhão é a subdivisão interna.
- Um Produtor pode titularizar várias Propriedades.
- Administrador é global dentro da organização.
- Colaborador depende de vínculo direto e ativo com cada Propriedade.
- Município e UF não concedem acesso.
- Regional, Área Operacional, Região e Microrregião não pertencem ao contrato
  canônico v2.
- Novos contratos e escritas usam propriedade_id.
- fazenda_id pode ser lido apenas onde a compatibilidade legada já exige.
- Produtor não administra estrutura geral.
- O primeiro produto é Android e o offline produtivo é conservador por fluxo.

## Protocolo de trabalho

### Planejar

Defina:

- contexto;
- objetivo;
- comportamento esperado;
- critérios de aceite;
- fora de escopo;
- arquivos e superfícies;
- decisões e contratos;
- pendências e riscos;
- validações.

### Executar

- Faça a menor mudança que cumpra o aceite.
- Preserve alterações do usuário e evite refatoração paralela sem necessidade.
- Não amplie escopo a partir de documento arquivado.
- Não grave alias legado em contrato novo.
- Não declare segurança produtiva com base em comportamento do cliente.

### Revisar

Procure:

- acesso ampliado;
- vazamento entre Propriedades;
- rota direta sem guarda;
- Município ou UF usados como permissão;
- Produtor recebendo ação estrutural;
- mock apresentado como backend;
- documentação e teste desatualizados.

### Validar

Mudança de código:

- npm run typecheck
- npm run test:domain-compat
- testes focados
- smoke proporcional ao risco

Mudança documental:

- git diff --check
- validação de links
- consistência contra código e contratos

## Atualização documental

- estado-atual.md recebe mudanças na fotografia.
- proximos-passos.md recebe mudanças na fila.
- decisoes-consolidadas.md recebe decisões fechadas.
- pendencias-de-definicao.md recebe somente itens realmente abertos.
- smoke.md recebe cenários ainda úteis e resultados atuais.
- relatórios concluídos vão para docs/archive.

Evite criar um novo documento quando uma seção curta no arquivo ativo for
suficiente.

## Fechamento esperado

Informe:

- o que mudou;
- onde mudou;
- como foi validado;
- quais riscos ou pendências permanecem.
