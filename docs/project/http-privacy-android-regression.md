# Regressão nativa de privacidade HTTP — F-01

Este roteiro complementa a suíte JS de privacidade. O mock de host dessa suíte
não verifica o WindowManager. Use um APK HTTP debug gerado do worktree completo,
o AVD API 32 existente e o QA sintético preservado. Não limpe armazenamento.
Informe o serial explicitamente; mantenha somente um executor de ADB/build.

## Aprovação independente — 2026-09-18

O [parecer final](../../dist/reaudit-f01-20260918/relatorio-reauditoria.md)
aprovou o Bug 2 para commit e encerrou F-01 sem correção obrigatória restante.
Executou a instrumentação 12/12, primeiras capturas e ciclo no AVD API 32,
além da amostra física no TCL 8483A/API 35 com o APK arm64 novo. O controle
negativo independente falhou na primeira assertion de divergência Window/decor;
não comprova negativamente a segunda causa, pois parou nessa assertion.
O percurso HTTP/provider foi verificado separadamente da liberação nativa
direta. O roteiro abaixo continua disponível para regressões futuras; não
significa que todos os cenários tenham sido repetidos neste fechamento Git.
Ver [escopo, histórico e qualificações](smoke.md#bug-2-e-f-01--aprovação-independente--2026-09-18).

## Instrumentação Android permanente

Após gerar Android em uma cópia isolada, compilar e instalar o APK correspondente,
com Metro disponível:

```powershell
node scripts/runHttpPrivacyNativeTests.cjs --project Q:\build --serial emulator-5580
```

Configure `JAVA_HOME`, `ANDROID_HOME` e Node conforme o ambiente Android existente.
`Q:\build` é exemplo de caminho curto da cópia, nunca a raiz do repositório. O
runner acrescenta somente a instrumentação à cópia, compila seu APK separado e
executa `am instrument`. Não instala o aplicativo principal nem autentica usuários.
Ele reinicia o processo HTTP; o armazenamento permanece intacto.

`tests/native/HttpPrivacyInstrumentation.kt` usa a Activity HTTP, o contexto RN
real, `ReactModalHostView`, `HttpPrivacyView` e janelas Android reais. Aplica
diretamente a autorização nativa em teste; a autorização HTTP é verificada pelo
smoke de telas, separadamente. Não usa um host que devolve flags predeterminadas.

A reprodução determinística protege a Activity durante a criação do Dialog e
entrega a liberação autorizada da Activity antes do attach do Dialog. Isso cobre
o intervalo entre `ReactModalHostView.showOrUpdate()` copiar `FLAG_SECURE` e a
nova boundary registrar sua propriedade. A primeira liberação deve retirar a
flag do Dialog e preservar a Activity inferior.

Inclui a troca real de `LayoutParams` por uma cópia no WindowManager, seguida de
liberação: o atributo da `Window` também deve perder a flag, pois o RN o lê ao
criar o próximo Dialog. Repete essa troca nas janelas dos Dialogs.

São três ciclos de primeira liberação, geração antiga e descarte/retorno, além
do controle de cópia na Activity e das flags externas: **12 verificações**.
Confere `Window.attributes` e os `LayoutParams` do decor, incluindo callback de
instância descartada após abrir nova janela. O resultado esperado contém
`f01.failed=0`, `f01.passed=12` e `INSTRUMENTATION_CODE: -1`.

## Primeira captura das telas reais

Abra a superfície e aguarde o conteúdo autorizado, sem Home/Recentes ou troca
de foco para reparar seu estado. Execute antes de qualquer captura desse Dialog:

```powershell
node scripts/verifyHttpPrivacyAndroid.cjs --serial emulator-5580 --out dist/rodada --name status-1 --windows 2 --text "Motivo administrativo"
```

O diretório de saída deve existir. Cada nome cria um subdiretório novo, sem
sobrescrita. O probe coleta UI, display emulado quando aplicável e flags **antes**
de `KEYCODE_SYSRQ/120`; exige um único PNG SystemUI recém-criado. Reprova janela
superior segura, quantidade incorreta de janelas, inferiores desprotegidas em
API 24–32, texto esperado ausente e captura preta/coberta. Inspecione também o
PNG: o limiar de pixels claros não substitui a revisão visual do conteúdo.

Não rode em telas de credenciais. O probe recusa campos de senha. Captura do
console do emulador comprova o display, não permissão de screenshot. Uma falha
isolada de `screencap` não substitui o PNG do SystemUI.

| Superfície | Janelas | Texto esperado | Repetições |
| --- | --- | --- | --- |
| Status | 2 | Motivo administrativo | 3 aberturas independentes |
| Titular | 2 | texto visível do seletor | 3 aberturas independentes |
| Filtros | 2 | Filtros e Ordenação | 3 aberturas independentes |
| Confirmação | 2 | título visível da confirmação | 3 aberturas independentes |
| Seletor sobre status | 3 | opção visível do motivo | 3 ciclos aninhados |
| Status após fechar seletor | 2 | Motivo administrativo | 3 ciclos aninhados |
| Raiz após fechar status | 1 | texto visível do detalhe | 3 ciclos aninhados |

Conserve sempre a primeira captura, mesmo reprovada. A prévia do SystemUI pode
mudar o foco; uma captura posterior não corrige o resultado anterior. Aguarde
o encerramento natural da prévia antes da próxima interação.

## Matriz complementar e descarte

- Nova, Editar, Titular, status, seletor sobre status, filtros e confirmação:
  Recentes direto e Home → Recentes, retorno autorizado e rascunhos preservados.
- API indisponível: comprovar `/me` efetivamente afetado; conexões persistentes
  podem continuar usando o destino anterior após alterar `adb reverse`.
- Registrar cobertura durante pendência, remover Dialog durante a pendência,
  erro neutro e recuperação. Não alterar o timeout do produto.
- Conferir orientação suportada e force-stop/reabertura sem limpar dados.
- Geração antiga e instância descartada: instrumentação acima verifica as
  guardas nativas; a suíte JS verifica callbacks/promessas e descarte do contexto.
  Não apresentar esses testes como entrega de uma resposta HTTP atrasada real.
- API 35 física: usar APK arm64 novo da mesma fonte, com foreground, Recentes,
  Home → Recentes e retorno em amostra Nova/Editar, status, seletor e filtros ou
  confirmação. Se indisponível, registrar pendência do novo binário.

Registre SHA-256 do Kotlin fonte/gerado, APK produzido/instalado e bundle realmente
carregado, resultados e incidentes. Preserve as evidências anteriores e execute
os gates do [smoke ativo](smoke.md). Nenhum comando de Propriedade é necessário.
