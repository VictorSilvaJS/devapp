# Tchê Agro Mobile

Aplicativo Android em React Native e Expo para consultoria agrícola, com foco
em Produtores, Propriedades, Talhões, Visitas, Caderno de Campo, Materiais
técnicos e mapas.

## Situação atual

O frontend local está funcional e demonstrável com dataset v2, persistência no
aparelho e três perfis. A última rodada física do mock não deixou bug aberto no
recorte executado.

O projeto ainda não possui backend, banco, autenticação real, storage remoto,
sincronização produtiva ou RBAC no servidor. A fundação está aprovada e o
próximo passo é MP-33 — autenticação e sessão reais.

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
