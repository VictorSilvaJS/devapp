# 🐛 Como Debugar o APK

## ✅ Agora você tem 3 formas de ver erros:

### **1. APK Debug (Recomendado para testes)**
**Localização:** `android\app\build\outputs\apk\debug\app-debug.apk`

- ✅ Mantém `console.log()`
- ✅ Logs detalhados
- ✅ Error Boundary mostra erros na tela
- ❌ Arquivo maior (não use em produção)

### **2. Error Boundary**
Agora qualquer erro JS mostra uma tela vermelha com:
- Mensagem de erro
- Stack trace completo
- Dica para ver no Logcat

### **3. Logcat (Logs em tempo real)**

#### Instalar Platform Tools (ADB)
1. Baixe: https://developer.android.com/tools/releases/platform-tools
2. Extraia em `C:\platform-tools`
3. Adicione ao PATH ou use o caminho completo

#### Ver logs do app:
```powershell
# Limpar logs antigos
adb logcat -c

# Ver logs em tempo real (filtrado)
adb logcat | Select-String -Pattern "ReactNative|AndroidRuntime|tcheagromobile"

# Salvar logs em arquivo
adb logcat > logs.txt
```

#### Comandos úteis:
```powershell
# Ver dispositivos conectados
adb devices

# Instalar APK
adb install app-debug.apk

# Desinstalar app
adb uninstall com.anonymous.tcheagromobile

# Reiniciar app
adb shell am force-stop com.anonymous.tcheagromobile
adb shell am start -n com.anonymous.tcheagromobile/.MainActivity
```

---

## 📦 Tipos de APK

### APK Debug (Para testes)
```bash
cd android
.\gradlew assembleDebug
```
- Arquivo: `app-debug.apk`
- Tamanho: ~30 MB
- Logs: ✅ Habilitados

### APK Release (Para distribuição)
```bash
cd android
.\gradlew assembleRelease
```
- Arquivo: `app-release.apk`
- Tamanho: ~24 MB
- Logs: ❌ Desabilitados
- Error Boundary: ✅ Funciona

---

## 🔍 Testando Erros

Para testar o Error Boundary, adicione um erro proposital:

```javascript
// Em qualquer componente
throw new Error('Teste de erro!');
```

O app mostrará a tela de erro em vez de tela branca.

---

## 💡 Dicas

1. **Sempre teste com APK Debug primeiro** antes de gerar Release
2. **Use `console.log()` liberalmente** durante o desenvolvimento
3. **O Error Boundary captura erros de renderização**, mas não:
   - Erros em event handlers (use try/catch)
   - Erros assíncronos (use `.catch()`)
   - Erros no próprio Error Boundary

---

## 🚀 Workflow Recomendado

1. **Desenvolvimento:** Use `npx expo start` com Expo Go (erros aparecem na tela)
2. **Testes:** Gere APK Debug e teste no dispositivo
3. **Produção:** Gere APK Release assinado
