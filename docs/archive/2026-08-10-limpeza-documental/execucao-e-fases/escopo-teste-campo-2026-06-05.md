# Escopo Fechado Do Teste De Campo - 05/06/2026

Este documento define o escopo fechado do teste de campo previsto para
05/06/2026. Ele deve orientar a revisao final antes do teste e evitar
expansao de escopo em cima da data.

## 1. Objetivo Do Teste De Campo

Validar em campo se o app permite consultar, de forma simples e confiavel, a
realidade operacional de uma propriedade:

- acesso por perfil
- abertura da propriedade
- visualizacao de talhoes e mapa
- consulta de anexos tecnicos de fertilidade
- consulta de visitas tecnicas
- consulta e registro simples no caderno de campo

O teste deve validar a experiencia minima de uso em campo, nao a infraestrutura
definitiva do produto.

## 2. Data Do Teste

Data prevista: 05/06/2026.

## 3. Natureza Do App Neste Teste

O app deve ser tratado como:

- MVP mockado
- com dados reais/parciais
- sem backend real
- sem banco real
- sem upload real
- sem download real garantido
- sem autenticacao real
- sem convite, reset de senha ou gestao real de sessao
- sem pipeline produtivo de importacao de arquivos

Os dados reais/parciais servem para validar a experiencia de consulta e a
organizacao por propriedade. Eles nao representam uma operacao produtiva
completa.

## 4. Perfis Testados

Perfis obrigatorios no teste:

- produtor
- colaborador
- admin

O teste deve confirmar que cada perfil enxerga uma experiencia coerente com seu
papel no MVP:

- produtor consulta a propria realidade operacional
- colaborador opera dentro do escopo regional/sub-regional permitido
- admin confere a visao ampla e os cadastros mockados

## 5. Fluxo Obrigatorio Do Produtor

1. Fazer login como produtor.
2. Entrar em `Minhas Propriedades`.
3. Abrir a propriedade principal de teste.
4. Conferir resumo da propriedade.
5. Abrir mapa/talhoes.
6. Tocar em talhoes e conferir identificacao.
7. Abrir materiais/anexos de fertilidade.
8. Abrir visitas da propriedade.
9. Abrir caderno da propriedade.
10. Criar um registro simples no caderno, se fizer parte da validacao operacional.

## 6. Fluxo Obrigatorio Do Colaborador

1. Fazer login como colaborador.
2. Conferir dashboard/listagem filtrada pelo escopo.
3. Abrir propriedades do escopo.
4. Abrir a propriedade principal de teste.
5. Consultar mapa/talhoes.
6. Consultar anexos tecnicos.
7. Abrir visitas.
8. Criar uma visita simples para a propriedade.
9. Abrir caderno.
10. Criar um registro simples de caderno.

## 7. Fluxo Obrigatorio Do Admin

1. Fazer login como admin.
2. Ver a listagem de propriedades.
3. Abrir a propriedade principal de teste.
4. Conferir mapas, talhoes e anexos.
5. Conferir visitas e caderno.
6. Abrir `Usuarios`.
7. Conferir usuario produtor vinculado a propriedade.
8. Conferir colaborador e escopo territorial mockado.
9. Nao usar o cadastro complexo como fluxo principal do teste, salvo conferencia
   visual interna.

## 8. Funcionalidades Obrigatorias Para O Teste

- login mock por perfil
- navegacao por perfil
- listagem e abertura de propriedade
- exibicao correta de nome da propriedade, titular, localizacao e area
- mapa/talhoes carregando
- toque em talhao com identificacao
- consulta de anexos/mapas de fertilidade
- consulta de visitas
- criacao basica de visita pelo colaborador
- consulta de caderno
- criacao basica de registro de caderno
- restricoes basicas de acesso por perfil
- linguagem visivel priorizando `Propriedade`, salvo nomes proprios ou legado
  tecnico interno

## 9. Funcionalidades Fora Do Escopo

Nao fazem parte deste teste:

- backend real
- banco real
- migrations
- API real
- login real
- convite de usuario
- reset de senha
- upload real de arquivos
- download real garantido
- cadastro administrativo definitivo de materiais tecnicos
- storage local ou remoto definitivo
- sincronizacao offline real
- cache produtivo de tiles
- pipeline produtivo de GeoJSON, SHP, KML ou KMZ
- importacao automatica do acervo
- refatoracao de nomenclatura interna `fazenda`
- CRUD real de regioes e microregioes
- permissoes granulares completas por acao
- teste completo de todos os cadastros administrativos como produto final

## 10. Telas Que Devem Estar Acessiveis

- `LoginScreen`
- `ClienteDashboardScreen`
- `PropriedadesScreen`
- `ProdutorScreen`
- `MapasScreen`
- `FazendaMapaScreen`
- `VisitasScreen`
- `NovaVisitaScreen`
- `VisitaDetailScreen`
- `CadernoCampoScreen`
- `NovoCadernoScreen`
- `CadernoDetailScreen`
- `UsuariosScreen`
- `UsuarioDetailScreen`
- `PerfilScreen`

## 11. Telas Que Podem Ficar Como Estao

Podem ficar como estao por enquanto, desde que passem no fluxo basico do teste:

- `FazendaMapaScreen`, se mapa e talhoes carregarem corretamente
- `VisitasScreen`
- `VisitaDetailScreen`
- `NovaVisitaScreen`
- `CadernoCampoScreen`
- `NovoCadernoScreen`
- `CadernoDetailScreen`
- `UsuariosScreen`
- `UsuarioDetailScreen`
- `EditarPropriedadeScreen`
- `EditarVisitaScreen`
- `EditarCadernoScreen`

Essas telas nao devem receber ampliacao funcional antes do teste, salvo ajuste
pontual necessario para viabilizar o fluxo obrigatorio.

## 12. Telas Que Devem Ser Simplificadas Antes Do Teste

As telas abaixo concentram maior risco de confusao em campo:

1. `MapasScreen`
   - deixar claro que material tecnico, upload, download e associacao de URL
     continuam mockados
   - evitar que botoes parecam promessa de upload real ou download real
   - priorizar consulta de talhoes e anexos de fertilidade

2. `ProdutorScreen`
   - priorizar propriedade, mapa/talhoes, anexos, visitas e caderno
   - reduzir ruido de gestao ou vinculos mockados quando o perfil for produtor
   - manter a tela como hub de consulta da propriedade

3. `ClienteDashboardScreen`
   - garantir entrada clara para a propriedade principal
   - evitar redundancia visual desnecessaria antes do primeiro clique do produtor

4. `NovoUsuarioScreen`
   - manter fora do fluxo principal do campo
   - usar apenas para conferencia/admin interno
   - nao tratar cadastro rapido ou vinculos visuais como backend real

5. `PerfilScreen`
   - garantir que `Smoke Dev` nao apareca em qualquer build usada com pessoa
     externa ou teste formal de campo

## 13. Dados Reais Minimos Necessarios

Dados minimos para o teste:

- propriedade principal de teste, preferencialmente `Sela de Prata I`
- talhoes reais identificaveis por nome/codigo
- GeoJSON final normalizado carregando no app
- mapas/anexos de fertilidade, no minimo:
  - pH
  - argila
  - materia organica
  - fosforo
  - potassio
- visitas mockadas, com pelo menos:
  - uma visita realizada
  - uma visita agendada, se houver necessidade de validar status
- caderno mockado, com pelo menos:
  - um registro visivel ao produtor
  - um registro editavel/criavel no fluxo permitido
- usuarios mockados:
  - um produtor vinculado a propriedade principal
  - um colaborador com escopo que inclua a propriedade principal
  - um admin com visao ampla

## 14. Criterios De Pronto Para Campo

O app esta pronto para o teste de campo quando:

- produtor completa o fluxo obrigatorio sem ajuda tecnica
- colaborador abre a propriedade e cria visita/caderno simples
- admin confere propriedade, usuarios e vinculos mockados
- mapa de talhoes abre em tempo aceitavel
- talhoes aparecem e sao tocaveis
- anexos de fertilidade abrem
- nenhum botao central promete upload real ou download real
- textos visiveis usam `Propriedade` quando aplicavel
- `Smoke Dev` nao aparece no ambiente usado em campo formal
- falhas conhecidas estao entendidas como limite do MVP mockado
- nao ha regressao aparente de acesso por perfil

## 15. Riscos De Implementar Alem Do Necessario Agora

Tentar ampliar o escopo antes de 05/06/2026 pode:

- quebrar fluxo ja validado de produtor/propriedade
- introduzir regressao em permissao por perfil
- misturar mock com promessa de produto real
- criar upload/download parcial que pareca funcional, mas falhe em campo
- desestabilizar mapas/talhoes perto do teste
- aumentar a complexidade visual das telas centrais
- consumir tempo em admin/cadastro quando o valor do campo esta na consulta
  operacional
- gerar inconsistencia entre dados mockados e dados reais/parciais

## 16. Ordem De Prioridade De Revisao

1. `ClienteDashboardScreen`
2. `ProdutorScreen`
3. `MapasScreen`
4. `FazendaMapaScreen`
5. `PerfilScreen`
6. `NovaVisitaScreen`
7. `NovoCadernoScreen`
8. `UsuariosScreen`
9. `UsuarioDetailScreen`
10. `NovoUsuarioScreen`

`NovoUsuarioScreen` deve ser revisada com cuidado, mas deve ficar fora do fluxo
principal de campo sempre que possivel.

## 17. Checklist Resumido De Validacao

Antes do teste:

- [ ] login produtor funciona
- [ ] login colaborador funciona
- [ ] login admin funciona
- [ ] produtor entra em `Minhas Propriedades`
- [ ] produtor abre a propriedade principal
- [ ] mapa de talhoes abre
- [ ] toque em talhao exibe identificacao
- [ ] anexos de fertilidade abrem
- [ ] visitas da propriedade aparecem
- [ ] caderno da propriedade aparece
- [ ] produtor consegue criar registro simples de caderno, se previsto
- [ ] colaborador ve apenas propriedade dentro do escopo esperado
- [ ] colaborador cria visita simples
- [ ] colaborador cria registro simples de caderno
- [ ] admin abre propriedade principal
- [ ] admin confere usuarios e vinculos mockados
- [ ] `Cadastrar material tecnico (mock)` nao e tratado como upload real
- [ ] qualquer mencao a download real esta controlada ou explicada
- [ ] `Smoke Dev` nao aparece no ambiente de campo formal
- [ ] nao ha texto visivel indevido usando `fazenda` quando deveria ser
      `Propriedade`, exceto nomes proprios
- [ ] `git diff --check` passa
- [ ] `npm run typecheck` passa ou a impossibilidade e registrada
