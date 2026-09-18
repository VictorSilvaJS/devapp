const fs = require('node:fs');
const path = require('node:path');
const { withMainActivity, withMainApplication, withDangerousMod } = require('expo/config-plugins');

// Expo 56 / React Native 0.85 Kotlin templates; changed anchors fail closed.
function insertOnce(source, anchor, code, marker) {
  if (source.includes(marker)) return source;
  if (source.split(anchor).length !== 2) throw new Error(`HTTP privacy: missing/ambiguous ${anchor}`);
  return source.replace(anchor, `${anchor}\n${code}`);
}

module.exports = function withHttpPrivacy(config) {
  if (config.android?.package !== 'com.tcheagro.mobile' || config.extra?.appVariant !== 'http') {
    throw new Error('HTTP privacy requires the HTTP package and composition.');
  }
  config = withMainActivity(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('HTTP privacy requires the Kotlin Activity.');
    mod.modResults.contents = insertOnce(mod.modResults.contents, 'super.onCreate(null)',
      '    // HTTP privacy: recents policy is independent of foreground screenshots.\n' +
      '    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {\n' +
      '      setRecentsScreenshotEnabled(false)\n    }', '// HTTP privacy: recents policy');
    return mod;
  });
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('HTTP privacy requires the Kotlin Application.');
    mod.modResults.contents = insertOnce(mod.modResults.contents, 'PackageList(this).packages.apply {',
      '          add(HttpPrivacyPackage()) // HTTP privacy: package', '// HTTP privacy: package');
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/com/tcheagro/mobile/HttpPrivacyPackage.kt');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'http-privacy/HttpPrivacyPackage.kt'), target);
    return mod;
  }]);
};
module.exports.insertOnce = insertOnce;
