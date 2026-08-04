const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packagePath = path.join(projectRoot, 'node_modules', 'react-native-webview', 'package.json');
const managerPath = path.join(
  projectRoot,
  'node_modules',
  'react-native-webview',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativecommunity',
  'webview',
  'RNCWebViewManagerImpl.kt'
);

if (!fs.existsSync(packagePath) || !fs.existsSync(managerPath)) {
  throw new Error('react-native-webview não está instalado; não foi possível aplicar o patch de ciclo de vida.');
}

const installedPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (installedPackage.version !== '13.16.1') {
  throw new Error(
    `Versão de react-native-webview não revisada: ${installedPackage.version}. `
    + 'Reavalie o patch de ciclo de vida antes de instalar.'
  );
}

const source = fs.readFileSync(managerPath, 'utf8');
const original = [
  '        webView.themedReactContext.removeLifecycleEventListener(webView)',
  '        webView.cleanupCallbacksAndDestroy()',
  '        webView.mWebChromeClient = null',
].join('\n');
const synchronousPatch = [
  '        webView.themedReactContext.removeLifecycleEventListener(webView)',
  '        viewWrapper.removeView(webView)',
  '        webView.cleanupCallbacksAndDestroy()',
  '        webView.mWebChromeClient = null',
].join('\n');
const nextLoopPatch = [
  '        webView.themedReactContext.removeLifecycleEventListener(webView)',
  '        viewWrapper.removeView(webView)',
  '        webView.post {',
  '            webView.cleanupCallbacksAndDestroy()',
  '            webView.mWebChromeClient = null',
  '        }',
].join('\n');
const delayedPatch = [
  '        webView.themedReactContext.removeLifecycleEventListener(webView)',
  '        viewWrapper.removeView(webView)',
  '        webView.postDelayed({',
  '            webView.cleanupCallbacksAndDestroy()',
  '            webView.mWebChromeClient = null',
  '        }, 100L)',
].join('\n');
const patched = [
  '        webView.themedReactContext.removeLifecycleEventListener(webView)',
  '        val cleanup = {',
  '            if (webView.parent === viewWrapper) {',
  '                viewWrapper.removeView(webView)',
  '            }',
  '            webView.post {',
  '                webView.cleanupCallbacksAndDestroy()',
  '                webView.mWebChromeClient = null',
  '            }',
  '        }',
  '',
  '        if (viewWrapper.isAttachedToWindow) {',
  '            viewWrapper.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {',
  '                override fun onViewAttachedToWindow(view: View) = Unit',
  '',
  '                override fun onViewDetachedFromWindow(view: View) {',
  '                    view.removeOnAttachStateChangeListener(this)',
  '                    cleanup()',
  '                }',
  '            })',
  '        } else {',
  '            cleanup()',
  '        }',
].join('\n');

if (source.includes(patched)) {
  console.log('Patch de ciclo de vida do react-native-webview já aplicado.');
  process.exit(0);
}

const patchTarget = source.includes(original)
  ? original
  : source.includes(synchronousPatch)
    ? synchronousPatch
    : source.includes(nextLoopPatch)
      ? nextLoopPatch
      : source.includes(delayedPatch)
        ? delayedPatch
        : null;

if (!patchTarget) {
  throw new Error('Trecho esperado do RNCWebViewManagerImpl.kt não foi encontrado; patch não aplicado.');
}

fs.writeFileSync(managerPath, source.replace(patchTarget, patched), 'utf8');
console.log('Patch de ciclo de vida do react-native-webview aplicado.');
