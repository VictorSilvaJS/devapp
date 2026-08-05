const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const gradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');

const definitionsMarker = '// TCHE_RELEASE_SIGNING_DEFINITIONS';
const configMarker = '// TCHE_RELEASE_SIGNING_CONFIG';
const releaseMarker = '// TCHE_RELEASE_SIGNING_SELECTION';

const configureAndroidReleaseSigning = () => {
  if (!fs.existsSync(gradlePath)) {
    throw new Error('Projeto Android ausente. Gere android/ antes de montar o release.');
  }

  let source = fs.readFileSync(gradlePath, 'utf8');
  const definitions = [
    definitionsMarker,
    "def productionStoreFile = findProperty('TCHE_RELEASE_STORE_FILE') ?: System.getenv('TCHE_RELEASE_STORE_FILE')",
    "def productionStorePassword = findProperty('TCHE_RELEASE_STORE_PASSWORD') ?: System.getenv('TCHE_RELEASE_STORE_PASSWORD')",
    "def productionKeyAlias = findProperty('TCHE_RELEASE_KEY_ALIAS') ?: System.getenv('TCHE_RELEASE_KEY_ALIAS')",
    "def productionKeyPassword = findProperty('TCHE_RELEASE_KEY_PASSWORD') ?: System.getenv('TCHE_RELEASE_KEY_PASSWORD')",
    'def productionSigningValues = [',
    '    productionStoreFile,',
    '    productionStorePassword,',
    '    productionKeyAlias,',
    '    productionKeyPassword,',
    ']',
    'def hasAnyProductionSigning = productionSigningValues.any { value -> value != null && !value.toString().isBlank() }',
    'def hasProductionSigning = productionSigningValues.every { value -> value != null && !value.toString().isBlank() }',
    'if (hasAnyProductionSigning && !hasProductionSigning) {',
    "    throw new GradleException('Assinatura de produção incompleta; configure as quatro propriedades TCHE_RELEASE_*')",
    '}',
  ].join('\n');
  const markers = [definitionsMarker, configMarker, releaseMarker];
  const appliedMarkers = markers.filter((marker) => source.includes(marker));

  if (appliedMarkers.length === markers.length) {
    if (!source.includes('hasAnyProductionSigning && !hasProductionSigning')) {
      const definitionsPattern = new RegExp(
        `${definitionsMarker}[\\s\\S]*?\\r?\\n\\r?\\nandroid \\{`
      );

      if (!definitionsPattern.test(source)) {
        throw new Error('Definições antigas de assinatura não puderam ser atualizadas.');
      }

      source = source.replace(definitionsPattern, `${definitions}\n\nandroid {`);
      fs.writeFileSync(gradlePath, source, 'utf8');
      console.log('Configuração segura de assinatura Android atualizada.');
      return;
    }

    console.log('Configuração segura de assinatura Android já aplicada.');
    return;
  }

  if (appliedMarkers.length > 0) {
    throw new Error('Configuração de assinatura Android está parcialmente aplicada; revise o build.gradle.');
  }

  const flavorPattern = /^def jscFlavor = ['"][^'"\r\n]+['"]$/m;
  if (!flavorPattern.test(source)) {
    throw new Error('Âncora jscFlavor não encontrada no build.gradle; configuração não aplicada.');
  }

  source = source.replace(flavorPattern, (match) => `${match}\n\n${definitions}`);

  const debugConfig = [
    '        debug {',
    "            storeFile file('debug.keystore')",
    "            storePassword 'android'",
    "            keyAlias 'androiddebugkey'",
    "            keyPassword 'android'",
    '        }',
  ].join('\n');
  if (!source.includes(debugConfig)) {
    throw new Error('Bloco debug de assinatura não encontrado no build.gradle; configuração não aplicada.');
  }

  const productionConfig = [
    configMarker,
    '        if (hasProductionSigning) {',
    '            production {',
    '                storeFile rootProject.file(productionStoreFile)',
    '                storePassword productionStorePassword',
    '                keyAlias productionKeyAlias',
    '                keyPassword productionKeyPassword',
    '            }',
    '        }',
  ].join('\n');
  source = source.replace(debugConfig, `${debugConfig}\n        ${productionConfig}`);

  const originalReleaseSigning = [
    '            // Caution! In production, you need to generate your own keystore file.',
    '            // see https://reactnative.dev/docs/signed-apk-android.',
    '            signingConfig signingConfigs.debug',
  ].join('\n');
  if (!source.includes(originalReleaseSigning)) {
    throw new Error('Seleção original de assinatura release não encontrada; configuração não aplicada.');
  }

  const releaseSelection = [
    `            ${releaseMarker}`,
    '            if (hasProductionSigning) {',
    '                signingConfig signingConfigs.production',
    '            } else {',
    '                // Mantém o fluxo local de QA, sem apresentar esta APK como produção.',
    "                signingConfig signingConfigs.getByName('debug')",
    "                logger.warn('APK demonstrativo assinado com a chave debug; configure TCHE_RELEASE_* para produção.')",
    '            }',
  ].join('\n');
  source = source.replace(originalReleaseSigning, releaseSelection);

  fs.writeFileSync(gradlePath, source, 'utf8');
  console.log('Configuração segura de assinatura Android aplicada.');
};

if (require.main === module) {
  configureAndroidReleaseSigning();
}

module.exports = { configureAndroidReleaseSigning };
