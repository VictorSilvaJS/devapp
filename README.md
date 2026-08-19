# Tchê Agro Mobile

Aplicativo Android em React Native e Expo para consultoria agrícola, com foco
em Produtores, Propriedades, Talhões, Visitas, Caderno de Campo, Materiais
técnicos e mapas.

## Situação atual

O frontend local está funcional e demonstrável com dataset v2, persistência no
aparelho e três perfis. A última rodada física do mock não deixou bug aberto no
recorte executado.

O aplicativo ainda não está conectado ao backend e continua usando login,
sessão, persistência e dados locais. A MP-33A estabeleceu a fundação isolada do
backend e do banco. A MP-33B implementa autenticação/sessão, ações de conta,
outbox e auditoria no backend e está `CONCLUÍDA TECNICAMENTE`, mas
`NÃO LIBERADA PARA PRODUÇÃO`; ela não altera nem conecta o aplicativo. A
integração HTTP permanece reservada à MP-33C e o RBAC completo dos recursos de
negócio, à MP-35.

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
