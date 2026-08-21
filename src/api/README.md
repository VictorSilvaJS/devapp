# Camada de Dados Local

Esta pasta ainda é a fachada de dados do aplicativo demonstrativo. Ela não é
uma API HTTP nem comprova backend, autenticação ou autorização produtivos.

## Estado atual

- mock.ts e arquivos de compatibilidade preservam superfícies legadas;
- o bootstrap instala o dataset demonstrativo v2;
- mockV2RuntimeCompat.ts projeta o modelo canônico para telas que ainda usam a
  interface antiga;
- persistências locais mantêm o recorte demonstrativo no aparelho;
- novas escritas devem usar propriedade_id;
- fazenda_id pode ser lido somente nas bordas de compatibilidade existentes.

## Separação vigente

A MP-33C introduziu as interfaces de repositório e o primeiro adaptador HTTP em
uma composição separada sob `src/http`. As telas HTTP consomem essas portas em
vez de espalhar chamadas de rede ou importar esta fachada local.

Esta pasta continua exclusiva do Demo e dos testes. O mock não integra o grafo
da composição HTTP e nunca é usado como fallback para erro, indisponibilidade
ou configuração ausente.

Os contratos vigentes estão em
[docs/project](../../docs/project/README.md), especialmente:

- baseline-backend-v1-2026-08.md;
- modelo-dados-mock-v2.md;
- contrato-api-rbac.md;
- matriz-rbac-backend.md;
- contrato-integracao-app-mp33c.md.

Ao alterar esta pasta, execute npm run typecheck e
npm run test:domain-compat.
