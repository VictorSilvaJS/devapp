import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import FormField from './FormField';
import SectionCard from './SectionCard';
import { colors, spacing } from '../theme';
import type { useFormValidationFocus } from '../hooks/useFormValidationFocus';

type Focus = ReturnType<typeof useFormValidationFocus<string>>;

/** Presentation slots preserve the Demo order and its optional capabilities. */
export function PropertyFormLayout({ header, footer, focus, children }: React.PropsWithChildren<{
  header: React.ReactNode; footer: React.ReactNode; focus: Focus;
}>) {
  return <View style={styles.container}>
    {header}
    <ScrollView ref={focus.scrollViewRef} style={styles.scroll} contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false} onScroll={focus.onScroll} scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      {children}
      <View style={styles.footerSpace} />
    </ScrollView>
    {footer}
  </View>;
}

export function PropertyCadastralFields({ nome, area, cultura, onName, onArea, onCulture,
  focus, errors = {}, disabled = false, subtitle = 'Identificação cadastral da unidade operacional.',
  areaHelper = 'A área cadastrada pode ser diferente da soma das áreas mapeadas dos Talhões.',
}: {
  nome: string; area: string; cultura: string;
  onName: (value: string) => void; onArea: (value: string) => void; onCulture: (value: string) => void;
  focus: Focus; errors?: Readonly<Record<string, string | undefined>>; disabled?: boolean;
  subtitle?: string; areaHelper?: string;
}) {
  return <SectionCard title="Propriedade" subtitle={subtitle}>
    <View ref={focus.registerField('propriedade')} collapsable={false}>
      <FormField ref={focus.registerFocusable('propriedade')} label="Nome da Propriedade"
        accessibilityLabel="Nome da Propriedade" required value={nome} onChangeText={onName}
        placeholder="Nome da propriedade" error={errors.propriedade} disabled={disabled} />
    </View>
    <View ref={focus.registerField('area_total')} collapsable={false}>
      <FormField ref={focus.registerFocusable('area_total')} label="Área cadastral em hectares (opcional)"
        accessibilityLabel="Área cadastral em hectares" value={area} onChangeText={onArea}
        placeholder="Ex: 500" keyboardType="numeric" error={errors.area_total} disabled={disabled}
        helperText={areaHelper} />
    </View>
    <FormField label="Cultura principal (opcional)" accessibilityLabel="Cultura principal"
      value={cultura} onChangeText={onCulture} placeholder="Ex: Soja"
      error={errors.cultura_principal} disabled={disabled} />
  </SectionCard>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, scroll: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md }, footerSpace: { height: spacing.xl * 2 },
});
