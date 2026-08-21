# Documentação do Projeto

Esta documentação foi organizada para separar o presente do histórico.

## Por onde começar

Se você quer saber rapidamente como o projeto está:

1. [Estado atual](project/estado-atual.md)
2. [Próximos passos](project/proximos-passos.md)
3. [Pendências reais](project/pendencias-de-definicao.md)
4. [Smoke funcional](project/smoke.md)

Para entender produto e regras:

1. [Contexto consolidado](project/contexto-consolidado.md)
2. [Escopo do MVP](project/escopo-mvp.md)
3. [Regras de negócio](project/regras-de-negocio.md)
4. [Decisões consolidadas](project/decisoes-consolidadas.md)

O índice completo dos contratos vigentes está em
[docs/project/README.md](project/README.md).

## Pastas documentais

### project

Fonte de verdade atual. Contém estado, escopo, regras, decisões, pendências,
próximos passos, smoke e contratos aprovados.

### project/generated

Evidência gerada do dataset demonstrativo. Não substitui o seed executável nem
o código.

### archive

Fases, auditorias, propostas, revisões, planos concluídos e versões integrais
anteriores à síntese documental. Serve para rastreabilidade, não para definir o
presente.

As antigas pastas architecture, guides, testing e reviews foram arquivadas
porque misturavam propostas ou roteiros superados com a documentação atual.

## Onde visualizar e revisar o aplicativo

| Objetivo | Pasta |
|---|---|
| Ver as telas | ../src/screens |
| Rever componentes e padrão visual | ../src/components, ../src/layout e ../src/assets |
| Entender navegação | ../src/navigation |
| Entender regras e contratos | ../src/domain, ../src/types e ../src/utils |
| Rever mock, storage e integrações | ../src/api e ../src/services |
| Rever login e sessão | ../src/auth e ../src/contexts |
| Rever testes | ../tests e ../scripts |
| Rever configuração Android | ../android |
| Consultar evidências geradas | ../dist |

Para execução por agente de código, comece em [AGENTS.md](../AGENTS.md).
Para operar a fundação, a MP-33B e a integração HTTP da MP-33C concluídas
tecnicamente, consulte o
[README do backend](../backend/README.md).
Para revisar ou operar a conexão do aplicativo sem misturar Demo e HTTP,
consulte o
[contrato de integração da MP-33C](project/contrato-integracao-app-mp33c.md).

## Regra prática

- Mudou a fotografia do produto: atualize project/estado-atual.md.
- Mudou a fila: atualize project/proximos-passos.md.
- Surgiu uma decisão: atualize project/decisoes-consolidadas.md.
- Surgiu uma pendência real: atualize project/pendencias-de-definicao.md.
- Terminou uma fase ou revisão: mova o relatório para archive.
- Não crie novos relatórios soltos quando uma atualização no documento ativo
  resolver.
