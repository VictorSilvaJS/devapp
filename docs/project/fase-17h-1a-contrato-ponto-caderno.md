# Fase 17H.1A - Contrato Do Ponto Opcional No Caderno

Status em 2026-07-21: `IMPLEMENTADO_VALIDADO_EMULADOR`.

Esta microfase implementa somente o contrato tecnico opcional do primeiro
ponto geografico associado a um registro de Caderno. Nao existe UI de
localizacao, captura, botao novo, marcador persistido ou navegacao nova. A
aprovacao para uso em campo continua bloqueada ate smoke em Android fisico
autorizado.

## Shape Canonico

O ponto usa apenas seis campos planos e opcionais no Caderno:

```ts
localizacao_latitude?: number;
localizacao_longitude?: number;
localizacao_accuracy?: number | null;
localizacao_captured_at?: string;
localizacao_captured_by?: string;
localizacao_origem?: 'foreground_explicit';
```

Nao existe objeto persistido `localizacao` ou `coords`, nem alias camelCase.
Os campos obrigatorios quando o grupo existe sao latitude, longitude,
`captured_at` e `origem`. `accuracy` e `captured_by` sao opcionais. A ausencia
dos seis campos representa um Caderno sem localizacao e preserva a
compatibilidade dos registros antigos.

## Validacao E Normalizacao

O helper puro `src/utils/cadernoLocalizacaoCompat.ts` centraliza as regras:

- latitude e longitude devem existir juntas, ser finitas e respeitar
  `-90..90` e `-180..180`;
- `accuracy` aceita ausencia, `null` ou numero finito maior ou igual a zero;
- `captured_at` exige ISO string valida;
- `captured_by`, quando fornecido, deve continuar nao vazio depois de `trim`;
- `origem` aceita somente `foreground_explicit`;
- grupo parcial ou invalido e rejeitado na escrita;
- campos extras, `coords`, altitude, `altitudeAccuracy`, velocidade, direcao e
  arrays nao sao copiados.

O helper nao importa React Native, Expo Location, AsyncStorage, filesystem,
API mock, telas ou navegacao. Ele nao registra coordenadas em log e nao gera
timestamp. O horario sempre deve vir de uma futura captura explicita.

Na leitura, Caderno antigo retorna ausencia controlada. Um registro legado ou
corrompido com grupo parcial nao derruba a normalizacao e nao propaga o grupo
incompleto para a UI. Na escrita, `validateCadernoCampo` rejeita o mesmo grupo
parcial em vez de salva-lo silenciosamente.

## Intencao De Edicao E Persistencia

O tipo `CadernoLocalizacaoChange` explicita tres operacoes:

- `preserve`: mantem integralmente o ponto existente e nao altera
  `captured_at`;
- `replace`: limpa o grupo anterior e aplica integralmente o novo ponto
  validado;
- `remove`: elimina os seis campos.

A borda de compatibilidade em `src/api/mockCompat.ts` aplica a mesma semantica
ao merge atual do Caderno sem alterar `src/api/mock.ts`. Um update comum, sem
qualquer campo `localizacao_*`, preserva o ponto. Uma substituicao explicita
valida o novo grupo isoladamente, evitando que campos opcionais antigos vazem
para o novo ponto.

Para remocao, `buildCadernoLocalizacaoRemovalPatch` produz um patch transitorio
com os seis campos em `undefined`. A borda reconhece essa intencao, remove o
grupo antes da normalizacao e persiste o registro final sem os campos. O JSON
nao recebe sentinel, flag tecnica, `null` residual ou chave de remocao.

Create, get, list, update e restauracao continuam usando somente o snapshot
existente `@tche:mock-mvp:v1`. Nenhuma chave `@tche:` foi criada e nao existe
storage separado de localizacao.

## Cobertura Automatizada

`tests/cadernoLocalizacaoCompat.test.js` contem 51 cenarios. A cobertura
inclui:

- ausencia, normalizacao, limites, numeros nao finitos e pareamento;
- accuracy ausente/nula/zero/positiva e rejeicao de valor negativo;
- timestamp, autoria opcional e origem;
- descarte de campos extras e shapes proibidos;
- `preserve`, `replace` e `remove` no helper;
- leitura defensiva de registro antigo e parcial;
- Caderno comum, grupo valido e rejeicao de escrita parcial;
- create/get/list e updates de preservacao, substituicao e remocao;
- serializacao/restauracao do ponto e nao ressurreicao depois da remocao;
- preservacao de Propriedade, Talhao e Safra/Safrinha;
- payload atual de formulario sem qualquer `localizacao_*`;
- uso exclusivo da chave de snapshot existente e pureza do helper.

O teste foi incluido em `test:domain-compat` e no recorte do
`tsconfig.domain-compat.json`. `validatorsCompat` e `cadernoFormCompat` tambem
receberam assercoes focadas, sem mudar o payload das telas.

## Validacoes Executadas

Passaram:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests\cadernoLocalizacaoCompat.test.js` com 51 cenarios;
- `node tests\cadernoFormCompat.test.js`;
- `node tests\acessoControleCompat.test.js`;
- `node tests\validatorsCompat.test.js`;
- `node tests\periodoProdutivoService.test.js`;
- `node tests\talhaoConsultaCompat.test.js`;
- `npx expo install --check`, com `Dependencies are up to date`;
- auditorias textuais de campos, storage, APIs de localizacao e rotinas de
  background/tracking.

O build padrao chegou a `packageRelease`, mas o empacotamento incremental
falhou. O fallback previsto, `:app:assembleRelease --no-daemon
--max-workers=1 --no-parallel`, passou. O APK final possui 91.899.152 bytes e
SHA-256
`08BD45C2AF986B00B3591AE2CBEF5979B97DD2AA6410F57F7EB9EB8E0F27DEEC`.
`adb install -r` e `monkey` passaram no AVD Pixel Tablet, Android 15/API 35,
sem `pm clear`, desinstalacao ou `Wipe Data`.

## Smoke Minimo

No APK release instalado por cima:

- a sessao Admin e os dados anteriores foram restaurados;
- Caderno comum, Novo Caderno, detalhe e edicao abriram sem secao de
  localizacao;
- Propriedade, Talhao e Safra/Safrinha anteriores permaneceram visiveis;
- a Sela preservou 6200 ha informados, 1888,6 ha mapeados e 15 Talhoes;
- `Mostrar minha posicao` permaneceu transitorio; o provider do AVD falhou e o
  app exibiu a mensagem controlada sem criar ponto;
- Material tecnico exibiu Todos, Fertilidade, Correcao de solo e Prescricao;
- Nova Visita permaneceu sem Camera/Galeria e mostrou o aviso do MVP local.

## Limites Mantidos

Esta fase nao criou UI, captura, consentimento visual, marcador persistido,
coordenada automatica, foto real, backend ou sincronizacao. Nao alterou PNG,
ZIP, GeoJSON, Visita, Mapa, Propriedade, Talhao, Periodo Produtivo, Usuario,
seeds/assets, dependencias ou permissoes nativas. `Mostrar minha posicao` nao
persiste. Background, tracking, watch continuo, TaskManager, geofencing,
trilha, rota, historico e point-in-polygon continuam ausentes.

Android fisico segue pendente e nao aprovado.
