#!/usr/bin/env node
// Build/run instrumentation only in an already generated, isolated HTTP project.
// Requires the corresponding debug app already installed, Metro running, and an
// explicit API 24–32 device. Does not clear data, install the app or authenticate.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const option = key => argv[argv.indexOf(key) + 1];
if (!argv.includes('--project') || !argv.includes('--serial')) throw Error('Use --project ISOLATED_PROJECT --serial SERIAL');
const project = fs.realpathSync(option('--project'));
const serial = option('--serial');
if (project === fs.realpathSync(root)) throw Error('Refusing to modify the main project');
const android = path.join(project, 'android');
const adb = process.env.ADB || path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
function run(exe, args, cwd = root) {
  const r = spawnSync(exe, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw Error(`${path.basename(exe)} failed: ${r.error?.code || r.status}\n${r.stdout || ''}\n${r.stderr || ''}`);
  return r.stdout;
}
const api = Number(run(adb, ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']).trim());
if (api < 24 || api > 32) throw Error('This regression targets the legacy API 24–32 flag path');
const gradlePath = path.join(android, 'app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
if (!gradle.includes('com.tcheagro.mobile')) throw Error('Expected isolated HTTP Android project');
const marker = '// F01 instrumentation only';
if (!gradle.includes(marker)) {
  gradle += `\n${marker}\nandroid.defaultConfig.testInstrumentationRunner = "com.tcheagro.mobile.HttpPrivacyInstrumentation"\n`;
  fs.writeFileSync(gradlePath, gradle);
}
const dest = path.join(android, 'app/src/androidTest/java/com/tcheagro/mobile');
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(root, 'tests/native/HttpPrivacyInstrumentation.kt'), path.join(dest, 'HttpPrivacyInstrumentation.kt'));
console.log(run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat :app:assembleDebugAndroidTest -PreactNativeArchitectures=x86_64 --max-workers=1 -Pkotlin.incremental=false -Pkotlin.compiler.execution.strategy=in-process --console=plain'], android));
const apk = path.join(android, 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk');
console.log(run(adb, ['-s', serial, 'install', '-r', apk]));
run(adb, ['-s', serial, 'shell', 'am', 'force-stop', 'com.tcheagro.mobile']);
const output = run(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', 'com.tcheagro.mobile.test/com.tcheagro.mobile.HttpPrivacyInstrumentation']);
console.log(output);
if (!output.includes('f01.failed=0') || !output.includes('INSTRUMENTATION_CODE: -1')) process.exitCode = 1;
