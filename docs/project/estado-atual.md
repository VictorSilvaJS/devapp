# Estado Atual do Projeto

> Revisão documental: 2026-08-12
>
> Última rodada funcional completa registrada: 2026-08-07

## Resumo executivo

O projeto é um aplicativo Android em React Native com Expo SDK 56. O frontend
está funcional como MVP local e demonstrável, com dados persistidos no
aparelho, três perfis, Propriedades, Talhões, Visitas, Caderno de Campo,
Materiais técnicos e mapas.

O aplicativo ainda não é um produto conectado à produção. Não existem backend,
banco, autenticação real, storage remoto, sincronização produtiva nem RBAC
validado no servidor. A fundação necessária para iniciar essa transição já foi
decidida e a próxima entrega é MP-33.

## Estado por camada

| Camada | Situação atual |
|---|---|
| Aplicativo Android | Funcional e validado no recorte local demonstrativo |
| Dados | Dataset demonstrativo v2 e persistências locais |
| Autenticação | Login e sessão locais; não são segurança produtiva |
| Autorização | Regras e guardas locais; servidor ainda inexistente |
| API | Fachada e mocks locais; sem serviço HTTP produtivo |
| Banco | Inexistente |
| Arquivos | Importação, consulta e exportação locais; sem storage remoto |
| Offline | Consulta/local demonstrativa por fluxo; sem fila geral de sincronização |
| Notificações | In-app local; sem persistência produtiva ou push |
| Testes | Typecheck, contratos de domínio e smoke Android; sem suíte E2E de backend |

## Fonte de dados ativa

O dataset demonstrativo v2 é a fonte estruturada principal instalada pelo
bootstrap. A complementação de QA foi feita no mesmo modelo e no mesmo
snapshot, preservando dados locais existentes.

O runtime ainda projeta dados v2 para adaptadores de compatibilidade usados por
partes da interface. Novos contratos usam propriedade_id. Nomes como
fazenda_id permanecem somente em bordas legadas que ainda precisam ser
removidas gradualmente.

Na última evidência física, o Dashboard mostrou 73 Propriedades, 39 Produtores,
3 Colaboradores, 77 Visitas, 76 Cadernos e 8 Materiais. Esses números são
evidência do dataset local, não volume produtivo.

## Perfis e acesso

- Administrador: visão global dentro da única organização do primeiro contrato.
- Colaborador: acessa somente Propriedades com vínculo direto e ativo.
- Produtor: consulta sua realidade operacional por Titularidade ou vínculo
  autorizado e pode enviar o próprio rascunho de Caderno conforme o contrato.
- Município e UF são localização e filtro; não concedem acesso.
- Regional, Área Operacional, Região e Microrregião não fazem parte do contrato
  canônico v2.

## Fluxos disponíveis no corte local

- login demonstrativo e restauração de sessão local;
- dashboards e navegação para os três perfis;
- consulta e administração mockada de Usuários e Propriedades;
- Propriedades com Talhões, limites e estados vazios controlados;
- Visitas com estados, fotos locais, exportação explícita e telas dedicadas para
  conclusão e correção auditada;
- Caderno com tipos, ciclo local, ponto opcional e controle de visibilidade;
- listas extensas de Propriedades, Visitas e Caderno com renderização
  virtualizada e estado das abas preservado;
- Períodos produtivos, Plantio e Colheita no recorte local;
- Materiais técnicos PNG, PDF e ZIP com tratamento honesto de indisponibilidade;
- GeoJSON local e mapa de Talhões com localização foreground;
- rotas diretas protegidas pelas regras locais e testes de compatibilidade.

## Limites que não podem ser confundidos com produto pronto

- O cliente ainda pode ser inspecionado ou alterado; segurança exige servidor.
- Tokens, refresh, revogação e expiração produtivos ainda não existem.
- Mutação offline geral e resolução de conflitos ainda não existem.
- Arquivos não têm upload, criptografia, retenção ou storage remoto definidos em
  execução.
- GeoJSON não possui publicação, versionamento e reconciliação produtivos.
- Notificações não possuem entrega persistida, isolamento real ou push.
- Observabilidade, backup, restauração, segredos e CI ainda precisam ser
  implementados.
- iOS não faz parte da primeira entrega produtiva.

## Resultado da última rodada de QA

Os cenários principais do mock v2 passaram sem bug aberto no Android físico.
Foram corrigidos:

- Talhão lógico sem geometria exibido sem polígono inventado;
- PDF local ausente tratado com mensagem honesta;
- estado terminal do Caderno destacado;
- exclusão estrutural de Propriedade restrita ao Administrador;
- nome físico de exportação alinhado ao nome informado pela interface.
- conclusão e correção de Visita reorganizadas em telas dedicadas;
- carga duplicada de Propriedades removida e listas operacionais virtualizadas.
- exclusão administrativa de outro Usuário exposta no detalhe com confirmação,
  remoção da credencial local e dos vínculos diretos, sem apagar Propriedades
  ou registros operacionais.
- acesso do Produtor por vínculo ativo `usuario_autorizado` alinhado entre
  listagem, detalhe da Propriedade, Visitas, Caderno e Materiais liberados.
- criação e edição administrativa de Propriedade com seleção pesquisável de
  Produtores autorizados; vínculo, desvínculo por inativação e reativação são
  salvos atomicamente sem alterar o Titular.
- projeções de vínculo atual alinhadas no Perfil, detalhe de Usuário e detalhe
  de Propriedade: vínculo inativo permanece no histórico local, mas não aparece
  em listas ou contadores atuais. O Perfil também prioriza o cadastro persistido
  mais recente sobre o snapshot restaurado da sessão.

A revalidação física das listas passou. Depois do percurso completo, o processo
manteve 1.629 views, contra 4.386 antes da otimização. Não houve fatal, ANR,
falta de memória nem bloqueio longo novo da thread JavaScript. O mapa deixou uma
WebView residente e elevou temporariamente o PSS a cerca de 408 MB; após
reinício controlado, sem apagar sessão ou dados, o Dashboard foi restaurado com
171 views, nenhuma WebView e cerca de 178 MB.

Continuam como evidência pendente:

- teste real de localização dentro, fora e próximo de Talhão;
- leitor de tela;
- repetição offline completa;
- matriz final de aparelhos, orientação e acessibilidade;
- regressão integral depois da implementação produtiva.

O gerenciamento de Produtores autorizados foi revalidado no Android físico:
vínculo, desvínculo, sessão restaurada, Perfil e reativação passaram sem
duplicidade ou ampliação indevida de escopo.

O roteiro atual está em [smoke.md](smoke.md).

## Próxima etapa

MP-33 está pronta para começar. O primeiro corte deve criar a fundação do
backend, banco e migrations, autenticação e sessão reais, OpenAPI, fronteira de
repositórios no aplicativo e uma vertical mínima de Propriedades.

As decisões de fundação estão em
[baseline-backend-v1-2026-08.md](baseline-backend-v1-2026-08.md), e a sequência
está em [proximos-passos.md](proximos-passos.md).

## Onde olhar no código

| Área | Pasta principal |
|---|---|
| Telas e fluxos visuais | src/screens |
| Componentes reutilizáveis | src/components e src/layout |
| Rotas e navegação | src/navigation |
| Regras e contratos | src/domain, src/types e src/utils |
| Dados, mocks e integrações | src/api e src/services |
| Login, sessão e contexto | src/auth e src/contexts |
| Imagens e recursos visuais | src/assets |
| Testes e verificações | tests e scripts |
| Projeto Android nativo | android |

## Fontes complementares

- [Contexto consolidado](contexto-consolidado.md)
- [Escopo do MVP](escopo-mvp.md)
- [Regras de negócio](regras-de-negocio.md)
- [Decisões consolidadas](decisoes-consolidadas.md)
- [Pendências reais](pendencias-de-definicao.md)

Relatórios completos das fases, auditorias e rodadas anteriores foram
preservados em docs/archive e não representam o estado atual isoladamente.
