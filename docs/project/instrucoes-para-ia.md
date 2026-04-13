# Instruções para IA e Agentes de Código

## Objetivo
Este arquivo define como assistentes de IA, agentes de código e ferramentas como Codex devem interpretar a documentação deste projeto.

O objetivo é evitar que materiais históricos, ideias antigas, protótipos ou hipóteses técnicas sejam tratados como estado atual do sistema.

---

## Hierarquia de fontes

Ao analisar este projeto, siga esta ordem de prioridade:

1. `docs/project/`
2. `docs/architecture/`
3. `docs/guides/`
4. `docs/testing/`
5. `docs/reviews/`
6. `docs/archive/` apenas como histórico

Se houver conflito entre documentos, priorize sempre os documentos em `docs/project/`.

Dentro de `docs/project/`, use esta ordem de leitura:

1. `estado-atual.md`
2. `contexto-consolidado.md`
3. `escopo-mvp.md`
4. `regras-de-negocio.md`
5. `decisoes-consolidadas.md`
6. `pendencias-de-definicao.md`
7. `plano-reorganizacao.md`
8. `roadmap-futuro.md`

---

## Regra de interpretação por pasta

### `docs/project/`
Contém o núcleo documental ativo e prioritário do projeto.

Papéis dos documentos ativos:

- `estado-atual.md`: retrato do repositório e do que existe hoje
- `contexto-consolidado.md`: problema, propósito, usuários e contexto do domínio
- `escopo-mvp.md`: limite do MVP atual
- `regras-de-negocio.md`: regras de domínio e acesso
- `decisoes-consolidadas.md`: decisões já assumidas pelo projeto
- `pendencias-de-definicao.md`: pontos reais ainda em aberto
- `plano-reorganizacao.md`: ordem técnica de reorganização
- `roadmap-futuro.md`: backlog de evolução, subordinado ao escopo e às decisões ativas

**Esta é a fonte principal de verdade do projeto.**

### `docs/architecture/`
Contém visão técnica, decisões arquiteturais, integrações, estratégias técnicas e estrutura do sistema.

Usar como apoio técnico, sempre subordinado ao estado atual definido em `docs/project/`.

### `docs/guides/`
Contém guias operacionais, padrões de uso e instruções práticas.

### `docs/testing/`
Contém guias e critérios relacionados a testes.

### `docs/reviews/`
Contém análises, auditorias, revisões e verificações.  
Podem ser úteis para contexto, mas não substituem o estado atual.

### `docs/archive/`
Contém histórico do projeto: propostas antigas, reuniões, protótipos, reorganizações anteriores, resumos históricos e materiais que ajudaram na evolução do projeto.

**Não tratar como verdade atual sem confirmação explícita em documentos ativos.**

Ideias, hipóteses e explorações futuras não pertencem à fonte principal de verdade a menos que sejam promovidas explicitamente para documentos ativos em `docs/project/`.

---

## Regras obrigatórias

### 1. Não assumir implementação a partir de histórico
Não considerar como implementado algo que apareça apenas em:
- histórico
- proposta antiga
- mockup
- transcrição de reunião
- protótipo
- ideia técnica

### 2. Não assumir escopo atual a partir de ideias antigas
Módulos futuros, hipóteses e explorações técnicas não devem ser tratados como parte obrigatória do escopo atual.

### 3. Apontar inconsistências em vez de inventar
Quando houver conflito entre histórico e documentos ativos:
- priorize os documentos ativos
- registre a inconsistência
- não invente uma síntese não documentada

### 4. Respeitar o domínio do projeto
As seguintes regras de domínio devem ser preservadas:

- produtor, cliente e proprietário representam o mesmo papel de negócio, salvo documentação ativa em contrário
- um produtor pode possuir várias fazendas
- colaboradores possuem escopo regional
- administradores possuem visão global
- cliente/produtor visualiza e baixa dados da sua propriedade, mas não gerencia dados estruturais do sistema
- mapas devem ser tratados no contexto da propriedade/fazenda
- o MVP prioriza consulta simples, mapas, arquivos e operação offline ao menos para visualização

### 5. Antes de sugerir código
Sempre validar se a proposta:
- respeita o escopo atual do MVP
- respeita os perfis de acesso
- respeita a modelagem de produtor e fazenda
- está sustentada por documentação ativa
- não depende apenas de conteúdo histórico

---

## Comportamento esperado do agente

Antes de propor mudanças relevantes:
1. citar quais documentos ativos sustentam a proposta
2. apontar lacunas ou conflitos relevantes
3. classificar o que é:
   - estado atual
   - histórico
   - hipótese
4. só então propor alteração de código ou documentação

---

## Objetivo final
O projeto deve evoluir com documentação consistente, sem misturar:
- estado atual
- histórico
- roadmap antigo
- protótipos
- hipóteses técnicas
