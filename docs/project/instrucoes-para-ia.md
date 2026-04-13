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

---

## Regra de interpretação por pasta

### `docs/project/`
Contém o estado atual, decisões consolidadas, regras de negócio, escopo do MVP e direcionamento principal do projeto.

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