const assert = require('node:assert/strict');
const test = require('node:test');
// Reuse the native-primitives harness; its 11 navigation tests also run.
const { React, TestRenderer, act, unmount } = require('./mp35d2RenderedNavigation.test');
const native = require('react-native');
const load = file => require(`../.tmp-mp35d2-navigation/src/components/${file}`);
const Viewport = load('SelectFieldViewport').default;
const { selectViewportInset } = load('SelectFieldViewport');
const SelectField = load('SelectField').default;
const { VisualPrivacyBoundary, VisualPrivacyContext } = load('VisualPrivacyBoundary');
const keyboardAt = (screenY, height = 300) => ({ screenX: 0, screenY, width: 500, height });

// These tests exercise layout arithmetic and rendered interactions with supplied
// native measurements. They do not simulate Yoga, Android IME or pixel visibility.
function keyboard(t, initial) {
  let metrics = initial;
  const listeners = new Map();
  t.mock.method(native.Keyboard, 'metrics', () => metrics);
  t.mock.method(native.Keyboard, 'addListener', (event, callback) => {
    const callbacks = listeners.get(event) ?? new Set();
    callbacks.add(callback); listeners.set(event, callbacks);
    return { remove: () => callbacks.delete(callback) };
  });
  return {
    async emit(event, value) {
      metrics = event === 'keyboardDidHide' ? undefined : value;
      await act(async () => { for (const listener of listeners.get(event) ?? []) listener({ endCoordinates: value }); });
    },
    count: () => [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0),
  };
}
function layout(renderer) {
  return renderer.root.findByType(Viewport).findAllByType('View').find(node => node.props.onLayout);
}
function padding(renderer) {
  return renderer.root.findByType(Viewport).findAllByType('View')
    .map(node => native.StyleSheet.flatten(node.props.style)).find(style => 'paddingBottom' in style).paddingBottom;
}
async function measure(renderer) { await act(async () => layout(renderer).props.onLayout()); }

test('select viewport: intersection avoids double resize and clears missing/invalid keyboard metrics', () => {
  assert.equal(selectViewportInset({ y: 0, height: 850 }, undefined), 0);
  assert.equal(selectViewportInset(null, keyboardAt(510)), 0);
  assert.equal(selectViewportInset({ y: 0, height: 850 }, keyboardAt(510)), 340);
  assert.equal(selectViewportInset({ y: 24, height: 486 }, keyboardAt(510)), 0);
  assert.equal(selectViewportInset({ y: 24, height: 800 }, keyboardAt(510)), 314);
  assert.equal(selectViewportInset({ y: 0, height: 500 }, keyboardAt(510)), 0);
  assert.equal(selectViewportInset({ y: 0, height: 500 }, keyboardAt(510, -24)), 0);
});

test('select viewport: already visible keyboard, resize/orientation, hide and reopen use current measurements', async t => {
  const control = keyboard(t, keyboardAt(510));
  let frame = { y: 0, height: 850 }; let renderer;
  const mount = async () => {
    await act(async () => { renderer = TestRenderer.create(React.createElement(Viewport, null, 'content'), {
      createNodeMock: () => ({ measureInWindow: callback => callback(0, frame.y, 500, frame.height) }),
    }); });
    await measure(renderer);
  };
  await mount();
  assert.equal(padding(renderer), 340);
  frame = { y: 0, height: 510 }; await measure(renderer);
  assert.equal(padding(renderer), 0);
  frame = { y: 0, height: 530 }; await measure(renderer);
  await control.emit('keyboardDidChangeFrame', keyboardAt(260, 270));
  assert.equal(padding(renderer), 270);
  await control.emit('keyboardDidHide', keyboardAt(480, 0));
  assert.equal(padding(renderer), 0, 'hide must not leave system-bar compensation');
  await unmount(renderer); assert.equal(control.count(), 0);
  frame = { y: 0, height: 850 }; await mount();
  assert.equal(padding(renderer), 0);
  await control.emit('keyboardDidShow', keyboardAt(490, 360));
  assert.equal(padding(renderer), 360);
  await unmount(renderer); assert.equal(control.count(), 0);
});

test('select viewport: late native measurements cannot overwrite a newer frame or update after unmount', async t => {
  const control = keyboard(t, keyboardAt(510));
  const pending = []; let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Viewport), {
    createNodeMock: () => ({ measureInWindow: callback => pending.push(callback) }),
  }); });
  await measure(renderer); await measure(renderer);
  await act(async () => pending[1](0, 0, 500, 510));
  await act(async () => pending[0](0, 0, 500, 850));
  assert.equal(padding(renderer), 0);
  await measure(renderer); await unmount(renderer);
  await act(async () => pending[2](0, 0, 500, 850));
  assert.equal(control.count(), 0);
});

test('select field: remote query, selected option and draft survive close/reopen; one press selects inside privacy boundary', async t => {
  const control = keyboard(t, keyboardAt(510));
  const previousModal = native.Modal;
  native.Modal = ({ visible, children, ...props }) => visible ? React.createElement('Modal', props, children) : null;
  t.after(() => { native.Modal = previousModal; });
  const option = { value: 'producer-id', label: 'Produtor', description: 'qa@qa.invalid' };
  let calls = 0, renderer;
  function Form() {
    const [query, setQuery] = React.useState(''); const [selected, setSelected] = React.useState('');
    const [draft, setDraft] = React.useState('Nome / 12.34 / Soja');
    return React.createElement(VisualPrivacyContext.Provider, { value: { covered: false, validateReturn: async () => {} } },
      React.createElement('TextInput', { testID: 'draft', value: draft, onChangeText: setDraft }),
      React.createElement(SelectField, { label: 'Titular', value: selected, selectedOption: option,
        options: query === 'sem resultado' ? [] : [option], onChange: value => { calls++; setSelected(value); },
        remote: { loading: false, search: query, onSearch: setQuery } }));
  }
  await act(async () => { renderer = TestRenderer.create(React.createElement(Form), {
    createNodeMock: () => ({ measureInWindow: callback => callback(0, 0, 500, 850) }),
  }); });
  const press = async label => { await act(async () => renderer.root.findAllByType('TouchableOpacity')
    .find(node => node.props.accessibilityLabel === label).props.onPress()); };
  await press('Titular'); await measure(renderer);
  assert.equal(padding(renderer), 340, 'opening with the keyboard already visible');
  const modal = renderer.root.findByType('Modal');
  assert.equal(modal.findAllByType(VisualPrivacyBoundary).length, 1);
  const scroll = modal.findByType('ScrollView');
  assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
  assert.equal(scroll.props.keyboardDismissMode, 'none');
  const search = () => renderer.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === 'Buscar Titular');
  await act(async () => search().props.onChangeText('Produtor'));
  await press('Produtor');
  assert.equal(calls, 1); assert.equal(renderer.root.findAllByType('Modal').length, 0);
  await press('Titular'); await measure(renderer);
  assert.equal(search().props.value, 'Produtor');
  await act(async () => search().props.onChangeText('sem resultado'));
  await control.emit('keyboardDidHide', keyboardAt(800, 0));
  assert.equal(padding(renderer), 0);
  await press('Fechar opções'); await press('Titular');
  assert.equal(search().props.value, 'sem resultado');
  assert.equal(renderer.root.findByType(SelectField).props.value, option.value);
  assert.equal(renderer.root.findAllByType('TextInput').find(n => n.props.testID === 'draft').props.value, 'Nome / 12.34 / Soja');
  await unmount(renderer); assert.equal(control.count(), 0);
});

test('select field: local consumer keeps optional props and disabled selections remain inert', async t => {
  keyboard(t); let renderer; let calls = 0;
  await act(async () => { renderer = TestRenderer.create(React.createElement(SelectField, {
    label: 'Local', value: '', disabled: true, options: [{ value: 'a', label: 'A' }], onChange: () => calls++,
  })); });
  assert.equal(renderer.root.findAllByType('TextInput').length, 0);
  const option = renderer.root.findAllByType('TouchableOpacity').find(n => n.props.accessibilityLabel === 'A');
  await act(async () => option.props.onPress());
  assert.equal(option.props.disabled, true); assert.equal(calls, 0);
  await unmount(renderer);
});
