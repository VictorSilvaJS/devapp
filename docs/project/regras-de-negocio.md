# Regras de Negocio

Este documento registra regras de dominio e acesso que devem orientar modelagem, UX e implementacao. Quando um ponto ainda nao estiver fechado, ele nao deve ser transformado em regra aqui.

## Convencao de Linguagem

Na linguagem de produto, `Propriedade` e o termo oficial para a unidade operacional vista pelo usuario. `Produtor` e o usuario/perfil final, `Titular` e o responsavel cadastral ou vinculo principal da propriedade, e `Talhao` e a subdivisao interna.

No codigo legado e em documentos tecnicos, `fazenda`, `fazenda_id`, nomes de rotas, arquivos, contratos e campos internos podem permanecer temporariamente por compatibilidade. Alias historicos como `cliente` e `proprietario` podem aparecer ao explicar contexto antigo ou inconsistencias, mas nao devem conduzir a linguagem de produto.

## Regras de Dominio

### Produtor e propriedade

- O sistema deve considerar que um produtor pode estar vinculado a uma ou mais propriedades.
- A navegacao, os dados e as permissoes devem respeitar essa relacao.
- O contexto de propriedade e parte central da leitura do dominio, nao apenas um detalhe cadastral.

### Dados ligados ao contexto da propriedade

- Mapas, arquivos, visitas e registros de campo devem ser entendidos no contexto da propriedade a que pertencem.
- O sistema nao deve tratar mapas e materiais tecnicos como elementos soltos, desconectados do produtor e da propriedade.

## Regras de Acesso

### Administracao geral

- Possui visao ampla do sistema.
- Pode navegar entre regioes, produtores e propriedades.
- Seu fluxo deve privilegiar leitura consolidada e administracao dos dados autorizados.

### Colaborador regional

- Possui escopo regional ou sub-regional.
- Nao deve acessar dados fora do seu escopo.
- Atua na manutencao operacional dos dados conforme permissao.

### Produtor

- Acessa os dados da sua propria realidade operacional.
- Deve conseguir consultar materiais e historicos autorizados.
- Nao deve ser tratado como responsavel por gerenciar a estrutura geral do sistema.

## Regra de Visibilidade

- A visualizacao do produtor deve ser a mais restrita entre os perfis principais.
- A visualizacao do colaborador deve respeitar seu escopo geografico.
- A administracao geral deve conseguir enxergar o panorama consolidado da operacao.

## Regra sobre Mapas e Arquivos

- Mapas e arquivos pertencem ao contexto da propriedade.
- Na primeira versao de testes, cada material tecnico deve estar vinculado ao campo/talhao correspondente e, quando for diagnostico, ao elemento/camada representado, como argila, fosforo, pH ou outro atributo tecnico.
- A disponibilizacao desses materiais deve respeitar regra de perfil e liberacao.
- O produtor pode consultar e baixar materiais autorizados.
- Fluxos de ingestao, upload ou processamento interno devem ficar sob responsabilidade da equipe autorizada, quando existirem.

## Regra sobre Visitas Tecnicas

- Visitas devem estar associadas ao produtor e a propriedade atendida.
- Seu registro deve servir ao acompanhamento tecnico e ao historico operacional.
- Permissoes de criacao, edicao e consulta devem respeitar o perfil do usuario e o escopo de acesso.

## Regra sobre Caderno de Campo

- O caderno de campo deve registrar apenas o que for relevante para a operacao.
- Nao deve nascer como modulo excessivamente generico ou pesado.
- Seu nivel de visibilidade deve ser controlado por regra de perfil e contexto.

Este documento nao fecha ainda todos os campos, obrigatoriedades ou fluxos do caderno. Esses detalhes pertencem a consolidacao futura das pendencias.

## Regra sobre Offline

- O contexto de uso em campo exige cautela com dependencias de conectividade continua.
- A prioridade do offline deve comecar por consulta e visualizacao.
- Nao se deve prometer experiencia offline total sem definicao tecnica e funcional clara.

## Regra de Uso Deste Documento

Antes de propor mudanca de codigo, modelagem ou UX, use estas regras para verificar se a proposta:

- respeita a relacao entre produtor e propriedade
- respeita os perfis de acesso
- mantem mapas e arquivos no contexto correto
- evita transformar hipotese em regra consolidada

Se uma proposta depender de ponto ainda nao decidido, esse ponto deve ir para pendencia de definicao, e nao virar regra neste documento.
