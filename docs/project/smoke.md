# Smoke Funcional Ativo

> Atualizado em: 2026-08-12
>
> Última execução física registrada: 2026-08-12

Este arquivo contém somente o roteiro ainda útil. Evidências detalhadas e
rodadas anteriores foram movidas para docs/archive.

## Matriz atual

| ID | Portão | Cenário | Estado |
|---|---|---|---|
| ATUAL-01 | Release | Perfil e logs sem painel Smoke Dev ou dado pessoal | PASSOU |
| ATUAL-02 | Mídia | Câmera, galeria, cancelamento, persistência e limites | PASSOU |
| ATUAL-03 | Exportação | Pasta, cancelamento e nome físico real | PASSOU |
| ATUAL-04 | Mapa e Caderno | Ponto salvo e três estados do painel | PASSOU |
| ATUAL-05 | Acesso v2 | Três perfis, vínculos e rotas diretas | PASSOU |
| ATUAL-06 | MP-38 | Dentro, fora e próximo de Talhão em campo | PENDENTE DE CAMPO |
| ATUAL-07 | Release | Orientação, teclado, TalkBack e matriz Android | PENDENTE DE RELEASE |
| ATUAL-08 | Visitas | Conclusão e correção em telas dedicadas | PASSOU |
| ATUAL-09 | Desempenho | Listas virtualizadas e abas suspensas fora de foco | PASSOU |
| ATUAL-10 | Usuários | Exclusão administrativa remove usuário, credencial e vínculos | PENDENTE DE REVALIDAÇÃO MANUAL |

## Rodada final do mock v2

Status: EXECUTADA PARCIALMENTE, SEM BUG ABERTO.

| Grupo | Resultado |
|---|---|
| Atualização sem limpar armazenamento | Passou |
| Usuários ativos, pendentes e inativos | Passou |
| Propriedade sem Talhões, inativa e vínculo inativo | Passou |
| Estados de Visita e comandos terminais | Passou |
| Tipos, estados e visibilidade do Caderno | Passou após correção |
| Períodos, Plantio e Colheita | Passou |
| PNG, PDF ou ZIP ausente e Material restrito | Passou após correção |
| Talhão lógico sem geometria | Passou após correção |
| Regressão principal ATUAL-01 a ATUAL-05 | Passou; mídia e exportação integrais não foram repetidas |
| Retrato, paisagem, teclado, reinício, TalkBack e offline | Parcial; TalkBack e offline continuam pendentes |

## Cenários que devem ser repetidos antes do release

1. atualizar o APK sem desinstalar e confirmar preservação do snapshot;
2. testar login e bloqueio dos três perfis e estados de usuário;
3. repetir câmera, galeria, limites, persistência e exportação;
4. abrir Propriedade, Visita, Caderno e Material por lista e rota direta;
5. testar recurso autorizado, fora de escopo, inativo e ausente;
6. testar estado vazio de Propriedade e Talhão sem geometria;
7. reiniciar sem rede e observar quais dados abrem e quais dependências são
   informadas;
8. testar retrato, paisagem, teclado aberto, fonte ampliada e TalkBack;
9. inspecionar logs para fatal, ANR, token, sessão ou dado pessoal;
10. registrar cada falha como BUG, LIMITAÇÃO DO MOCK ou EVIDÊNCIA PENDENTE.

Na revalidação de Visitas, concluir uma agendada pela tela completa, voltar ao
detalhe e conferir os dados; depois corrigir mais de um campo de uma realizada
com um único motivo e confirmar o antes/depois no histórico. Complementar,
cancelar e anular devem continuar como ações curtas.

Na revalidação de desempenho, percorrer do início ao fim Propriedades, Visitas
e Caderno; usar busca, filtros e atualização por gesto; abrir um item no meio
da lista e voltar; alternar entre as três abas e confirmar que filtros e
posição permanecem. Observar cartões em branco, saltos de rolagem, duplicidade
e demora perceptível na troca de abas.

Na execução física de 2026-08-12, esse roteiro passou. Após o percurso completo,
o processo manteve 1.629 views contra 4.386 na medição anterior à otimização.
Não houve fatal, ANR, falta de memória nem bloqueio longo novo da thread
JavaScript. A passagem pelo mapa manteve uma WebView e elevou temporariamente o
PSS a cerca de 408 MB; após reinício controlado, sem limpar sessão ou dados, o
app restaurou o Dashboard com 171 views, nenhuma WebView e cerca de 178 MB.

Na revalidação da exclusão administrativa, usar um Usuário temporário diferente
da sessão atual; cancelar a primeira confirmação e conferir que nada mudou;
confirmar na segunda tentativa; verificar a remoção da lista e a recusa do login
com a credencial anterior. Propriedades e registros operacionais devem
permanecer. No próprio Usuário administrador conectado, a exclusão deve estar
bloqueada.

## Cenários de campo de MP-38

- posição dentro de Talhão;
- posição fora de Talhão;
- posição próxima do limite;
- precisão boa e ruim;
- permissão negada;
- localização desligada;
- timeout e cancelamento;
- operação sem rede;
- confirmação de que não existe rastreamento em background.

## Regras de resultado

- PASSOU exige execução observável e resultado esperado.
- NÃO EXECUTADO nunca pode ser marcado como passou por inferência.
- LIMITAÇÃO DO MOCK descreve uma fronteira conhecida, não um bug corrigido.
- BUG exige reprodução, menor correção responsável e repetição do cenário.
- Mudança de backend exige testes de API e banco; este smoke local não comprova
  segurança produtiva.

## Baseline automatizada

Antes e depois de mudança de código:

- npm run typecheck
- npm run test:domain-compat

Acrescente testes focados da vertical. Para mudança somente documental, valide
links locais e execute git diff --check.
