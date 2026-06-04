# Fase 16C - Build E Smoke Final Do APK

Status em 2026-06-04: o APK Android `release` foi gerado e inspecionado. A
instalacao e o smoke completo em Android fisico continuam pendentes porque
nenhum aparelho ou emulador estava conectado/autorizado no `adb`.

## Escopo Congelado

Esta rodada nao implementa feature, backend, login real, RBAC real,
sincronizacao, upload/storage ou migracao de `fazenda_id`/`fazendaId`.

Foi aplicada somente configuracao de empacotamento Android:

- pacote `com.tcheagro.mobile`;
- versao `1.0.0`, com `versionCode` 1;
- icone quadrado derivado do logo existente;
- splash branco minimo para corrigir o build Android.

## Fluxo De Build

O projeto usa Expo managed, SDK 48, sem `eas.json`. Para esta rodada foi usado
build Android local, gerando APK universal e nao AAB:

```powershell
npx expo prebuild --platform android --no-install
cd android
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
.\gradlew.bat assembleRelease --no-daemon
```

Artefato preservado:

- arquivo: `dist/tche-agro-mobile-1.0.0-android-release.apk`
- tamanho: `28416658` bytes
- SHA-256: `6E8908DFF2A6BC09687A82603E1050F9D96D1A0CAFAF92EF3D634420D6620D36`

Inspecao do APK:

- application id: `com.tcheagro.mobile`
- label: `Tchê Agro Mobile`
- version name/code: `1.0.0` / `1`
- min/target SDK: `21` / `33`
- arquiteturas: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`
- variante `release` nao debuggable; `__DEV__` fica desativado
- assinatura APK valida em v1/v2, usando certificado Android Debug

A assinatura de debug permite sideload demonstrativo controlado, mas nao deve
ser usada para publicacao.

## Credenciais Demonstrativas

- Admin Demonstracao: `admin.demonstracao@example.com` / `admin123`
- Colaborador de Campo: `colaborador.campo@example.com` / `colab123`
- Produtor Demonstracao: `produtor.demonstracao@example.com` / `prod123`

Usuarios criados no Admin continuam sem virar login real.

## Resultado Da Instalacao

Comando tentado:

```powershell
adb install -r dist/tche-agro-mobile-1.0.0-android-release.apk
```

Resultado: nao executado no aparelho. O `adb` respondeu
`no devices/emulators found`.

## Resultado Do Smoke

| Grupo | Status | Evidencia |
|---|---|---|
| Validacoes pre-build | Passou | `typecheck`, `test:domain-compat`, `git diff --check` e estado Git conferidos antes do build |
| Build APK release | Passou | `assembleRelease` concluiu e APK foi inspecionado |
| Build sem `__DEV__` | Passou | APK `release` nao debuggable |
| Instalacao e abertura | Reexecutar | Sem Android conectado/autorizado |
| Login manual e acesso rapido dos tres perfis | Reexecutar | Depende de aparelho |
| Cadastros e persistencia apos reinicio | Reexecutar | Depende de aparelho |
| Visita e Caderno com persistencia | Reexecutar | Depende de aparelho |
| Sela de Prata I, mapa, talhoes, arquivos e PNGs | Reexecutar | Depende de aparelho |
| Funcionamento sem internet | Reexecutar | Depende de aparelho |
| Usuario administrativo nao autentica | Reexecutar | Depende de aparelho |

## Bugs E Riscos

Bug bloqueante encontrado e corrigido:

- o primeiro build falhou porque `splashscreen_background` nao existia; a
  configuracao minima de splash branco no `app.json` corrigiu o empacotamento.

Bloqueio atual da rodada:

- nenhum Android fisico conectado/autorizado; instalacao e smoke completo nao
  podem ser considerados aprovados.

Riscos nao bloqueantes para a demonstracao controlada:

- APK usa assinatura Android Debug;
- Expo SDK 48/target SDK 33 exigem revisao antes de publicacao;
- mapa-base usa tiles online e precisa de validacao real sem internet;
- autorizacao do nome, localizacao, limites e PNGs da Sela de Prata I ainda
  precisa permanecer confirmada;
- diferenca entre `6200 ha` informados e `1888,6 ha` mapeados continua
  documentada como pendencia.

## Decisao

Nao liberar o APK para teste de campo ainda. O artefato esta pronto para
instalacao, mas a liberacao depende da execucao e aprovacao do smoke completo
em Android fisico.
