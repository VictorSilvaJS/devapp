# Decisões Consolidadas

> Revisão documental: 2026-08-10

Este arquivo contém somente decisões vigentes. A cronologia detalhada das
decisões 1 a 38 foi preservada no snapshot arquivado.

## Produto e domínio

1. O produto possui três perfis no primeiro contrato: Administrador,
   Colaborador e Produtor.
2. Propriedade é a unidade operacional e o termo oficial da interface.
3. Produtor é o perfil final; Titular é o responsável principal pela
   Propriedade; Talhão é sua subdivisão interna.
4. Um Produtor pode ser Titular de mais de uma Propriedade.
5. Dados operacionais pertencem ao contexto de uma Propriedade.
6. O MVP prioriza consulta organizada, mapas, Materiais técnicos, Visitas,
   Caderno e uso em campo.
7. O Produtor não administra a estrutura geral do sistema.
8. Internet instável é uma premissa, mas o primeiro offline produtivo é
   conservador e definido por fluxo.

## Acesso e território

- Administrador possui visão global dentro da organização.
- Colaborador depende de vínculo direto e ativo com cada Propriedade.
- Produtor depende de Titularidade ou vínculo autorizado.
- Município e UF servem para localização, busca e filtro.
- Município, UF, Região ou Microrregião não concedem acesso.
- Recurso por identificador fora do escopo deve responder como não encontrado
  no backend; ação negada sobre recurso dentro do escopo deve responder como
  proibida.

Esta decisão substitui a antiga regra territorial do colaborador que usava
sub-regiões ou microrregiões como fonte de autorização.

## Cadastros

- Usuário, Produtor, Propriedade e vínculo são conceitos separados.
- O Administrador cria primeiro o Usuário Produtor.
- Um Produtor sem Propriedade permanece pendente.
- A primeira Propriedade é criada em etapa própria, seleciona o Titular e ativa
  o vínculo em uma operação atômica.
- Troca de perfil, troca de Titular e inativação de vínculo são operações
  estruturais e auditáveis.

## Operação local

- Visita usa estados explícitos e não oferece transição inválida em estados
  terminais.
- Caderno nasce enxuto, usa ciclo de vida explícito e preserva autoria e
  histórico.
- Área informada, área mapeada e perímetro são conceitos diferentes.
- O celular consome mapas preparados; não realiza processamento agronômico
  produtivo.
- Foto simulada nunca deve ser apresentada como captura real.
- Visita aceita foto local por câmera ou galeria, por ação explícita.
- Exportação Android só confirma sucesso depois da gravação em destino
  escolhido pelo usuário.
- Localização é foreground e opcional; não há rastreamento em background.

## Decisões de fundação do backend

### 31. Organização única

A Tchê Fertilidade é a única organização do primeiro contrato, identificada
internamente por org_tche_fertilidade. Multiempresa fica fora do primeiro
backend.

### 32. Titular principal

Cada Propriedade possui exatamente um Produtor Titular principal ativo. Outros
usuários podem ter vínculo sem se tornarem Titulares.

### 33. Colaborador por vínculo direto

Colaborador acessa somente Propriedades atribuídas por vínculo
usuario_propriedade ativo. Campos territoriais não fazem parte da autorização
canônica.

### 34. Produtor e primeira Propriedade em duas etapas

O cadastro do Usuário Produtor e a criação da primeira Propriedade são
operações separadas. A segunda operação cria Propriedade, Titularidade e
ativação de forma transacional.

### 35. Mídia local explícita

Cada Visita admite até oito fotos locais de no máximo 20 MB por arquivo.
Captura, seleção, persistência e exportação exigem ação explícita. Não há EXIF,
geotag, upload ou sincronização produtiva.

### 36. Arquitetura do backend v1

O backend será um serviço modular único em Node.js e TypeScript, com REST JSON
versionado, OpenAPI, PostgreSQL/PostGIS, migrations SQL e object storage
privado compatível com S3. IDs são opacos e gerados no servidor. Contratos
novos usam propriedade_id.

### 37. RBAC fixo do primeiro backend

O primeiro backend possui somente Administrador global da organização,
Colaborador por vínculo direto e Produtor por Titularidade ou vínculo.
Permissão é revalidada no servidor por perfil, organização, vínculo, ação e
Propriedade.

### 38. Offline conservador e Android primeiro

Não haverá fila geral de mutações offline no primeiro corte. Consulta
autorizada pode usar cache; Caderno admite rascunho local próprio. Transições,
publicações e envios sensíveis exigem conexão. Notificações iniciais são
in-app, e Android é a primeira plataforma produtiva.

## Contratos que detalham as decisões

- [Baseline do backend v1](baseline-backend-v1-2026-08.md)
- [Modelo de dados v2](modelo-dados-mock-v2.md)
- [Modelo territorial](modelo-territorial.md)
- [Matriz de RBAC](matriz-rbac-backend.md)
- [Política de sessão](politica-sessao.md)
- [Ciclo do Caderno](ciclo-vida-caderno.md)
- [Estados de Visita](estados-visita.md)
- [Versionamento de GeoJSON](versionamento-geojson-talhoes.md)

## Como alterar uma decisão

Uma decisão só deve ser modificada com evidência nova, impacto registrado nos
contratos relacionados e atualização simultânea de estado, pendências e
testes aplicáveis.
