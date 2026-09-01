# Tchê Agro Mobile

Aplicativo Android em React Native e Expo para consultoria agrícola, com foco
em Produtores, Propriedades, Talhões, Visitas, Caderno de Campo, Materiais
técnicos e mapas.

## Situação atual

O Demo interno está funcional e demonstrável com dataset v2, persistência no
aparelho e três perfis. A última rodada física do mock não deixou bug aberto no
recorte executado.

A composição HTTP está conectada ao backend para autenticação, ações de conta
e leitura autorizada de lista/detalhe de Propriedades. A MP-34 acrescenta lista,
contador, leitura individual/em lote, descarte e resolução segura de destino de
notificações in-app persistidas da própria conta. A MP-33A estabeleceu a
fundação do backend e do banco; a MP-33B implementou autenticação/sessão, ações
de conta, outbox e auditoria; e a MP-33C separou Demo/HTTP e concluiu a primeira
integração. A MP-33C foi integrada à branch `backend` pelo PR #2 no commit
`cc78a9f`, e a CI pós-merge foi aprovada.

O mock permanece somente no Demo e nos testes, fora do aplicativo HTTP, que não
possui fallback para mock. A MP-34 está concluída tecnicamente e integrada
diretamente à branch `backend` no commit `e787707`, sem pull request; os três
jobs da CI pós-push foram aprovados. Não houve tag, deploy, release ou
publicação. Responsável/agendamento/alertas da purga, credencial e
segredo de manutenção, validação jurídica/de privacidade dos 90 dias,
observabilidade, backup/restauração, MFA de Administrador, domínio e associação
de links, SMTP/segredos, assinatura e validação em ambiente real continuam
portões produtivos. O smoke Android físico específico da MP-34 passou em
2026-08-24, sem representar release produtivo.

A MP-35A está integrada. A MP-35B, administração HTTP de Usuários e convites,
foi aprovada em reauditoria independente e integrada diretamente no commit
`60144c2`, com CI pós-push aprovada. Ela não acrescenta telas mobile. MP-35C e
MP-35D permanecem fora do aplicativo: a MP-35C foi concluída e integrada
diretamente à branch `backend` no commit `e6789bf`, com CI pós-push aprovada;
a auditoria independente pós-correção ainda não está registrada. A MP-35D não
foi iniciada. Não houve tag, deploy, release ou publicação da MP-35C.

Leia a fotografia completa em
[Estado atual](docs/project/estado-atual.md) e a fila em
[Próximos passos](docs/project/proximos-passos.md).

## Como executar

Requisitos:

- Node.js compatível com Expo SDK 56;
- npm;
- Android Studio, emulador ou aparelho autorizado quando houver teste Android.

Comandos principais:

- npm install
- npm start
- npm run android
- npm run typecheck
- npm run test:mp34
- npm run test:domain-compat

Os demais scripts ficam em [package.json](package.json).

O backend possui runtime e comandos independentes em
[backend/README.md](backend/README.md). Ele exige Node.js 24; o job do
aplicativo permanece em Node.js 22.

## Pastas importantes

| Pasta | Quando olhar |
|---|---|
| src/screens | Telas, formulários e fluxos visuais |
| src/components e src/layout | Componentes e padrões reutilizáveis |
| src/navigation | Rotas, pilhas e navegação por perfil |
| src/domain, src/types e src/utils | Contratos, regras e compatibilidade |
| src/api e src/services | Mock, persistência, arquivos e integrações |
| src/auth e src/contexts | Login, sessão e estado compartilhado |
| src/http | Composição HTTP real, sessão, Propriedades e notificações |
| src/assets | Imagens e recursos empacotados |
| tests e scripts | Testes de domínio e verificações |
| android | Configuração e build Android nativo |
| backend | API, autenticação, banco, migrations, worker e testes do backend |
| docs/project | Estado e contratos vigentes |
| docs/archive | Histórico, fases e revisões antigas |
| dist | Evidências geradas; não é fonte de verdade |

Pastas de dados agronômicos e amostras na raiz devem ser tratadas como insumo
ou evidência, não como documentação atual ou contrato executável.

## Documentação

O ponto de entrada para leitura humana é [docs/README.md](docs/README.md).

Para agentes de código, comece em [AGENTS.md](AGENTS.md).

Regras importantes:

- Propriedade, Produtor, Titular e Talhão são os termos oficiais.
- Novos contratos usam propriedade_id.
- fazenda_id existe apenas por compatibilidade temporária.
- Colaborador acessa somente Propriedades com vínculo direto e ativo.
- Município e UF não concedem permissão.
- Conteúdo de docs/archive não representa o estado atual sem confirmação.
