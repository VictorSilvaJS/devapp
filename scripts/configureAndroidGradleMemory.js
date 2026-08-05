const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const gradlePropertiesPath = path.join(projectRoot, 'android', 'gradle.properties');
const expected = 'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m';

const configureAndroidGradleMemory = () => {
  if (!fs.existsSync(gradlePropertiesPath)) {
    throw new Error('android/gradle.properties ausente. Gere android/ antes de montar o release.');
  }

  const source = fs.readFileSync(gradlePropertiesPath, 'utf8');
  if (source.includes(expected)) {
    console.log('Memória do Gradle Android já configurada.');
    return;
  }

  const propertyPattern = /^org\.gradle\.jvmargs=.*$/m;
  if (!propertyPattern.test(source)) {
    throw new Error('Propriedade org.gradle.jvmargs não encontrada; configuração não aplicada.');
  }

  fs.writeFileSync(
    gradlePropertiesPath,
    source.replace(propertyPattern, expected),
    'utf8'
  );
  console.log('Memória do Gradle Android configurada.');
};

if (require.main === module) {
  configureAndroidGradleMemory();
}

module.exports = { configureAndroidGradleMemory };
