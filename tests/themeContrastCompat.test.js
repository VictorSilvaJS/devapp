const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const themeSource = readSource('src/theme.ts');

const getColor = (name) => {
  const match = themeSource.match(new RegExp(`\\b${name}:\\s*'(#[0-9a-fA-F]{6})'`));
  assert.ok(match, `token ${name} não encontrado`);
  return match[1];
};

const channelToLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const channels = [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ].map(channelToLinear);

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
};

const contrast = (foreground, background) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const assertContrast = (foregroundName, backgroundName, minimum) => {
  const ratio = contrast(getColor(foregroundName), getColor(backgroundName));
  assert.ok(
    ratio >= minimum,
    `${foregroundName}/${backgroundName}: ${ratio.toFixed(2)}:1; mínimo ${minimum}:1`,
  );
};

test('pares semânticos de texto normal atingem WCAG AA', () => {
  [
    ['white', 'primary'],
    ['primary', 'primaryLight'],
    ['primaryDark', 'accent'],
    ['primaryDark', 'accentDark'],
    ['success', 'successBg'],
    ['warning', 'amberLight'],
    ['error', 'errorBgLight'],
    ['info', 'infoLight'],
    ['purple', 'purpleLight'],
    ['amber', 'amberLight'],
    ['cyan', 'cyanLight'],
    ['orange', 'orangeLight'],
    ['muted', 'card'],
    ['mutedLight', 'card'],
    ['textLight', 'background'],
    ['disabledText', 'disabledSurface'],
  ].forEach(([foreground, background]) => assertContrast(foreground, background, 4.5));
});

test('ícones e bordas essenciais atingem contraste mínimo de 3:1', () => {
  [
    ['primary', 'card'],
    ['success', 'card'],
    ['warning', 'card'],
    ['error', 'card'],
    ['info', 'card'],
    ['disabledBorder', 'card'],
  ].forEach(([foreground, background]) => assertContrast(foreground, background, 3));
});

test('tema expõe pares explícitos para todos os estados semânticos', () => {
  ['primary', 'success', 'warning', 'info', 'error', 'disabled'].forEach((variant) => {
    assert.match(
      themeSource,
      new RegExp(`${variant}:\\s*\\{[^}]*surface:[^}]*text:[^}]*border:`),
      `par semântico ausente para ${variant}`,
    );
  });
});

test('exemplos reportados usam pares semânticos explícitos', () => {
  [
    'src/components/InfoBox.tsx',
    'src/screens/CadernoDetailScreen.tsx',
    'src/screens/ProdutorScreen.tsx',
    'src/screens/UsuarioDetailScreen.tsx',
    'src/screens/UsuariosScreen.tsx',
  ].forEach((relativePath) => {
    assert.match(
      readSource(relativePath),
      /semanticColors\./,
      `${relativePath} não usa par semântico`,
    );
  });
});

test('controles auditados não reduzem a opacidade inteira quando desabilitados', () => {
  [
    'src/theme.ts',
    'src/components/CadernoLocalizacaoSection.tsx',
    'src/components/ConfirmDialog.tsx',
    'src/components/DatePicker.tsx',
    'src/components/FormField.tsx',
    'src/components/FormFooter.tsx',
    'src/components/InputField.tsx',
    'src/components/RadioCardGroup.tsx',
    'src/components/SegmentedChips.tsx',
    'src/components/SelectField.tsx',
    'src/screens/FazendaMapaScreen.tsx',
    'src/screens/MapasScreen.tsx',
  ].forEach((relativePath) => {
    assert.doesNotMatch(
      readSource(relativePath),
      /(disabled|Disabled|Locked)\s*:\s*\{[^}]*\bopacity\s*:/,
      `${relativePath} ainda usa opacidade no controle desabilitado`,
    );
  });
});

if (failed > 0) {
  process.exitCode = 1;
}
