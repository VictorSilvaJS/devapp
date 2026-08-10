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

## Próxima evolução

MP-33 deve introduzir interfaces de repositório e o primeiro adaptador HTTP.
As telas não devem trocar o mock diretamente por chamadas de rede espalhadas.

Os contratos vigentes estão em
[docs/project](../../docs/project/README.md), especialmente:

- baseline-backend-v1-2026-08.md;
- modelo-dados-mock-v2.md;
- contrato-api-rbac.md;
- matriz-rbac-backend.md.

Ao alterar esta pasta, execute npm run typecheck e
npm run test:domain-compat.
