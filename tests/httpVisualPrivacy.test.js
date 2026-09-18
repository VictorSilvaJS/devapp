const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const nav = require('./mp35d2RenderedNavigation.test');
const { React, TestRenderer, act, flush, renderedFixture, mountFixture, unmount, appStateControl } = nav;
const load = file => require(`../.tmp-mp35d2-navigation/src/${file}`);
const { VisualPrivacyBoundary, VisualPrivacyContext } = load('components/VisualPrivacyBoundary');
const native = renderer => renderer.root.findAllByType('HttpPrivacyView')[0];
const focus = (renderer, generation, focused = true) => native(renderer).props.onPrivacyFocus({ nativeEvent: { generation, focused } });
const read = file => fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');

async function mount(t, strict = false) {
  appStateControl.currentState = 'active';
  const f = renderedFixture();
  const renderer = await mountFixture(f, strict);
  t.after(async () => { await unmount(renderer); appStateControl.currentState = 'active'; });
  return { f, renderer };
}
async function accept(f, index = 0) {
  await act(async () => { f.pendingRevalidations[index].resolve({ status: 200, body: f.sessionIdentityWire() }); });
  await flush();
}

test('privacy: Demo presentation does not create an HTTP native boundary', async () => {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(VisualPrivacyBoundary, null, React.createElement('Text', null, 'Demo'))); });
  assert.equal(renderer.root.findAllByType('HttpPrivacyView').length, 0);
  await unmount(renderer);
});

for (const strict of [false, true]) test(`privacy: pending return is covered; authorized return works (StrictMode=${strict})`, async t => {
  const { f, renderer } = await mount(t, strict);
  const before = nav.rootState();
  await act(async () => { focus(renderer, 7); });
  assert.equal(f.calls.me, 1);
  assert.equal(native(renderer).props.releasedGeneration, -1);
  await accept(f);
  assert.equal(native(renderer).props.releasedGeneration, 7);
  assert.equal(f.sessionUi.status, 'authenticated');
  assert.deepEqual(nav.rootState(), before);
  assert.equal(f.commandRequests.length, 0);
});

test('privacy: AppState and native focus share the pending return without early release', async t => {
  const { f, renderer } = await mount(t);
  await act(async () => appStateControl.emit('background'));
  await act(async () => { appStateControl.emit('active'); focus(renderer, 9); });
  assert.equal(f.calls.me, 1);
  await act(async () => appStateControl.emit('active'));
  assert.equal(native(renderer).props.releasedGeneration, -1);
  assert.equal(f.calls.me, 1);
  await accept(f);
  assert.equal(native(renderer).props.releasedGeneration, 9);
});

test('privacy: a new background invalidates a pending callback; subsequent return recovers', async t => {
  const { f, renderer } = await mount(t);
  await act(async () => focus(renderer, 2));
  await act(async () => { appStateControl.emit('background'); focus(renderer, 3, false); });
  await accept(f);
  assert.equal(native(renderer).props.releasedGeneration, -1);
  await act(async () => { appStateControl.emit('active'); focus(renderer, 4); });
  assert.equal(f.calls.me, 2);
  await accept(f, 1);
  assert.equal(native(renderer).props.releasedGeneration, 4);
});

for (const status of [429, 503]) test(`privacy: /me ${status} displays unavailable without business data and recovers`, async t => {
  const { f, renderer } = await mount(t);
  const snapshot = f.runtime.session.snapshot;
  await act(async () => focus(renderer, 5));
  await act(async () => f.pendingRevalidations[0].resolve({ status, body: { error: { code: 'service_unavailable' } } }));
  await flush();
  assert.equal(f.sessionUi.status, 'unavailable');
  assert.equal(f.runtime.session.snapshot, snapshot);
  assert.equal(nav.currentRouteName(), 'Unavailable');
  assert.equal(native(renderer).props.releasedGeneration, 5); // neutral error surface, after commit
  await act(async () => focus(renderer, 6));
  await accept(f, 1);
  assert.equal(f.sessionUi.status, 'authenticated');
  assert.equal(native(renderer).props.releasedGeneration, 6);
});

test('privacy: transport error retains identity under the unavailable surface', async t => {
  const { f, renderer } = await mount(t);
  await act(async () => focus(renderer, 1));
  const { ApiTransportError } = load('http/httpTransport');
  await act(async () => f.pendingRevalidations[0].reject(new ApiTransportError('network')));
  await flush();
  assert.equal(f.sessionUi.status, 'unavailable');
  assert.equal(nav.currentRouteName(), 'Unavailable');
  assert.equal(f.commandRequests.length, 0);
});

for (const elapsed of [899_999, 900_000]) test(`privacy: background threshold remains 15 minutes (${elapsed} ms)`, async t => {
  let now = 1_000;
  t.mock.method(performance, 'now', () => now);
  const { f, renderer } = await mount(t);
  await act(async () => appStateControl.emit('background'));
  now += elapsed;
  await act(async () => { appStateControl.emit('active'); focus(renderer, 20); });
  if (elapsed < 900_000) {
    assert.equal(f.calls.me, 1);
    assert.equal(native(renderer).props.releasedGeneration, -1);
    await accept(f);
    assert.equal(f.sessionUi.status, 'authenticated');
  } else {
    await flush();
    assert.equal(f.calls.me, 0);
    assert.equal(f.runtime.session.snapshot, null);
    assert.equal(f.sessionUi.status, 'anonymous');
    assert.match(f.sessionUi.message, /15 minutos/);
  }
  assert.equal(f.commandRequests.length, 0);
});

test('privacy: 15-minute foreground inactivity locks locally; native focus cannot unlock', async t => {
  let now = 1_000;
  t.mock.method(performance, 'now', () => now);
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { f, renderer } = await mount(t);
  const snapshot = f.runtime.session.snapshot;
  now += 900_000;
  await act(async () => t.mock.timers.tick(5_000));
  assert.equal(f.sessionUi.status, 'locked');
  await act(async () => focus(renderer, 21));
  await flush();
  assert.equal(f.sessionUi.status, 'locked');
  assert.equal(f.runtime.session.snapshot, snapshot);
  assert.equal(f.calls.me, 0);
  assert.equal(native(renderer).props.releasedGeneration, 21); // only the password lock surface
});

test('privacy: detached boundary ignores a saved focus callback and disposes AppState listeners', async () => {
  appStateControl.currentState = 'active';
  const f = renderedFixture(); const renderer = await mountFixture(f);
  const oldCallback = native(renderer).props.onPrivacyFocus;
  await act(async () => focus(renderer, 11));
  const listeners = appStateControl.listenerCount(); assert.ok(listeners > 0);
  await unmount(renderer);
  assert.equal(appStateControl.listenerCount(), 0);
  await act(async () => { oldCallback({ nativeEvent: { generation: 12, focused: true } }); });
  await act(async () => f.pendingRevalidations[0].resolve({ status: 200, body: f.sessionIdentityWire() }));
  assert.equal(f.calls.me, 1);
});

test('privacy: windows and generation are native, with scoped API compatibility', () => {
  const source = read('plugins/http-privacy/HttpPrivacyPackage.kt');
  assert.match(source, /override fun onHostPause\(\)[\s\S]*?protect\(\)/);
  assert.match(source, /if \(!hasWindowFocus\) protect\(\)/);
  assert.match(source, /value != generation \|\| !resumed \|\| !hasWindowFocus\(\)/);
  assert.match(source, /removeLifecycleEventListener\(this\)/);
  assert.match(source, /Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU/);
  assert.match(source, /findDialogWindow\(activityRoot, root\)/);
  assert.match(source, /window\.clearFlags\(flag\)/);
  assert.match(source, /!protect && ownsSecureFlag/);
  assert.doesNotMatch(source, /Log\.|postDelayed|finish\(|excludeFromRecents/);
  for (const file of ['src/components/SelectField.tsx', 'src/http/screens/HttpPropertyStatusAction.tsx']) {
    assert.match(read(file), /<Modal[^>]*>\s*<VisualPrivacyBoundary/);
  }
});

test('privacy: plugin refuses Demo and inserts each native registration once', () => {
  const plugin = require('../plugins/withHttpPrivacy');
  assert.throws(() => plugin({ android: { package: 'com.tcheagro.mobile.demo' }, extra: { appVariant: 'demo' } }));
  const first = plugin.insertOnce('before\nanchor\nafter', 'anchor', 'marker code', 'marker');
  assert.equal(plugin.insertOnce(first, 'anchor', 'marker code', 'marker'), first);
  assert.throws(() => plugin.insertOnce('changed template', 'anchor', 'code', 'marker'));
  const demo = require('../demo/app.json').expo;
  assert.ok(!JSON.stringify(demo).includes('withHttpPrivacy'));
  assert.match(read('plugins/withHttpPrivacy.js'), /SDK_INT >= Build.VERSION_CODES.TIRAMISU/);
});
