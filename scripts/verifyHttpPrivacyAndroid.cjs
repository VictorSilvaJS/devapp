#!/usr/bin/env node
// Real-device regression probe. Open a fresh authorized surface before each invocation;
// do not cycle focus. This runner never authenticates, changes app data or repairs focus.
// See docs/project/http-privacy-android-regression.md for the repeatable matrix.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inflateSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, v, i, all) => {
  if (v.startsWith('--')) pairs.push([v.slice(2), all[i + 1]]);
  return pairs;
}, []));
if (!args.serial || !args.out || !args.name || !args.windows || !args.text || !/^[\w-]+$/.test(args.name)) {
  throw new Error('Required: --serial SERIAL --out DIR --name UNIQUE --windows COUNT --text VISIBLE_TEXT');
}
if (!Number.isInteger(Number(args.windows)) || Number(args.windows) < 1) throw new Error('Invalid window count');
const adb = process.env.ADB || path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const dir = path.resolve(args.out, args.name);
fs.mkdirSync(dir, { recursive: false });
function run(...a) {
  const r = spawnSync(adb, ['-s', args.serial, ...a], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`ADB failed: ${a.slice(0, 3).join(' ')} (${r.error?.code || r.status})`);
  return r.stdout;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function write(name, data) { fs.writeFileSync(path.join(dir, name), data, { flag: 'wx' }); }
function pngStats(file) {
  const data = fs.readFileSync(file), chunks = [];
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG');
  let w, h, channels;
  for (let p = 8; p < data.length;) {
    const n = data.readUInt32BE(p), type = data.toString('ascii', p + 4, p + 8), b = data.subarray(p + 8, p + 8 + n);
    if (type === 'IHDR') {
      w = b.readUInt32BE(0); h = b.readUInt32BE(4);
      channels = b[9] === 6 ? 4 : b[9] === 2 ? 3 : 0;
      if (b[8] !== 8 || !channels || b[12] !== 0) throw new Error('Unsupported PNG format; inspect manually');
    }
    if (type === 'IDAT') chunks.push(b);
    p += n + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = w * channels;
  let previous = Buffer.alloc(stride), offset = 0, bright = 0, total = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[offset++], row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      if (predictor === undefined) throw new Error('Invalid PNG filter');
      row[x] = (raw[offset++] + predictor) & 255;
    }
    // Exclude status/navigation bars. Both an all-black capture and our opaque
    // dark green cover fail; actual contents must also be inspected in the PNG.
    if (y > h * .15 && y < h * .85) for (let x = Math.floor(w * .15); x < w * .85; x++) {
      const p = x * channels; total++;
      if (Math.min(row[p], row[p + 1], row[p + 2]) > 100) bright++;
    }
    previous = row;
  }
  return { width: w, height: h, brightFraction: bright / total, sha256: createHash('sha256').update(data).digest('hex') };
}
(async () => {
  const api = Number(run('shell', 'getprop', 'ro.build.version.sdk').trim());
  if (api < 24) throw new Error('Unsupported API');
  const xmlPath = `/sdcard/f01-${args.name}.xml`;
  const dumped = run('shell', 'uiautomator', 'dump', xmlPath);
  if (!dumped.includes('UI hierchary dumped to')) throw new Error('Fresh UI dump not produced');
  const xml = run('shell', 'cat', xmlPath);
  if (/password="true"/.test(xml)) throw new Error('Do not capture authentication or password fields');
  write('ui.xml', xml);
  const contentVisible = xml.includes(args.text);
  if (args.serial.startsWith('emulator-')) {
    const display = path.join(dir, 'display'); fs.mkdirSync(display);
    run('emu', 'screenrecord', 'screenshot', display);
  }
  // Capture flags BEFORE KEYCODE_SYSRQ, whose overlay itself can cause a focus cycle.
  const rawWindows = run('shell', 'dumpsys', 'window', 'windows');
  const blocks = rawWindows.split(/(?=  Window #\d+ Window\{)/).filter(b =>
    /^  Window #\d+ Window\{[^\n]*com\.tcheagro\.mobile\//.test(b) && /isVisible=true/.test(b));
  const windows = blocks.map(b => ({ id: b.match(/Window\{(\w+)/)[1], type: b.match(/\bty=(\w+)/)?.[1], secure: /\bSECURE\b/.test(b.match(/\bfl=[^\n]*/)?.[0] || '') }));
  write('windows-before.txt', blocks.join('\n'));
  const before = run('shell', 'ls', '/sdcard/Pictures/Screenshots').trim().split(/\r?\n/);
  run('shell', 'input', 'keyevent', '120');
  let fresh = [];
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    fresh = run('shell', 'ls', '/sdcard/Pictures/Screenshots').trim().split(/\r?\n/).filter(f => f.endsWith('.png') && !before.includes(f));
    if (fresh.length) break;
  }
  if (fresh.length !== 1) throw new Error(`Expected exactly one new SystemUI screenshot, received ${fresh.length}`);
  run('pull', `/sdcard/Pictures/Screenshots/${fresh[0]}`, path.join(dir, 'system.png'));
  const png = pngStats(path.join(dir, 'system.png'));
  const flagsPass = windows.length === Number(args.windows) && windows[0]?.secure === false &&
    (api >= 33 || windows.slice(1).every(w => w.secure));
  const result = { at: new Date().toISOString(), serial: args.serial, api, name: args.name,
    method: 'first SystemUI KEYCODE_SYSRQ; window flags recorded before capture',
    contentVisible, windows, deviceFile: fresh[0], png, passed: contentVisible && flagsPass && png.brightFraction > .05 };
  write('result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exitCode = result.passed ? 0 : 1;
})().catch(e => { write('error.txt', e.stack); console.error(e.message); process.exitCode = 1; });
