import React from 'react';
import { ActivityIndicator, Modal, ScrollView, Text } from 'react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormField from '../../components/FormField';
import InfoBox from '../../components/InfoBox';
import SectionCard from '../../components/SectionCard';
import SelectField from '../../components/SelectField';
import { VisualPrivacyBoundary } from '../../components/VisualPrivacyBoundary';
import { colors, spacing } from '../../theme';
import { useHttpSession } from '../HttpSessionContext';
import { canAdministerProperties } from '../administrativePropertyFormAccess';
import { AdministrativePropertyStatusController } from '../administrativePropertyStatusController';
import { PROPERTY_REASON_CODES } from '../administrativePropertyModels';
import type { AdministrativePropertyProjection, AdministrativeReasonCode } from '../contracts';
import { isCanonicalUuidV4 } from '../decoders';
import { HttpButton } from '../ui';

const REASON_LABELS: Record<AdministrativeReasonCode, string> = {
  fim_relacao: 'Fim da relação', mudanca_responsabilidade: 'Mudança de responsabilidade',
  cadastro_duplicado: 'Cadastro duplicado', correcao_administrativa: 'Correção administrativa',
  suspensao_operacional: 'Suspensão operacional', outro: 'Outro',
};

/** Local to the existing detail: no status route, deep link or replacement detail. */
export function HttpPropertyStatusAction({ property }: { property: AdministrativePropertyProjection | null }) {
  const { runtime } = useHttpSession();
  const route = useRoute(); const navigation = useNavigation(); const focused = useIsFocused();
  const alive = React.useRef(false); const token = React.useRef<object | null>(null);
  const [opened, setOpened] = React.useState<{ property: AdministrativePropertyProjection; token: object } | null>(null);
  const [success, setSuccess] = React.useState(false);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; token.current = null; }; }, []);
  React.useEffect(() => { if (!focused) { token.current = null; setOpened(null); setSuccess(false); } }, [focused]);
  const current = () => {
    const state = navigation.getState();
    return alive.current && canAdministerProperties(runtime) && state.routes[state.index]?.key === route.key;
  };
  const open = () => {
    if (!current() || token.current || !property || !isCanonicalUuidV4(property.id)) return;
    const canonical = runtime.administrativePropertyData.current.details[property.id];
    if (!canonical) return;
    const next = {}; token.current = next; setSuccess(false); setOpened({ property: canonical, token: next });
  };
  return <>
    {property ? <HttpButton title={property.status === 'ativa' ? 'Inativar Propriedade' : 'Reativar Propriedade'}
      variant="secondary" onPress={open} /> : null}
    {success ? <InfoBox message="Status da Propriedade atualizado." /> : null}
    {opened && focused ? <StatusDialog property={opened.property} isCurrent={() => current() && token.current === opened.token}
      onClose={completed => {
        if (!current() || token.current !== opened.token) return;
        token.current = null; setOpened(null); setSuccess(completed);
      }} /> : null}
  </>;
}

function StatusDialog({ property, isCurrent, onClose }: { property: AdministrativePropertyProjection;
  isCurrent: () => boolean; onClose: (completed: boolean) => void }) {
  const { runtime } = useHttpSession();
  const instance = React.useRef<AdministrativePropertyStatusController | null>(null);
  const callbacks = React.useRef({ isCurrent, onClose }); callbacks.current = { isCurrent, onClose };
  const [controller, setController] = React.useState<AdministrativePropertyStatusController | null>(null);
  const [, render] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    const next = new AdministrativePropertyStatusController(runtime, property, () => {
      if (instance.current === next && next.current && callbacks.current.isCurrent()) callbacks.current.onClose(true);
    });
    instance.current = next; const stop = next.subscribe(render); next.start(); setController(next);
    return () => { instance.current = null; stop(); next.dispose(); };
  }, [runtime, property]);
  const current = () => controller !== null && instance.current === controller && controller.current && callbacks.current.isCurrent();
  const run = (action: () => unknown) => () => { if (current()) void action(); };
  const state = controller?.snapshot; const command = state?.command;
  const close = run(() => { controller!.dispose(); onClose(false); });
  const reactivating = state?.target === 'ativa';
  const title = reactivating ? 'Reativar Propriedade' : 'Inativar Propriedade';
  const confirmed = !!command?.mutationConfirmed;
  const disabled = !state?.active || state.busy || confirmed || state.review || command?.phase === 'ambiguous';
  return <Modal visible transparent={false} animationType="slide" onRequestClose={close}>
    <VisualPrivacyBoundary style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header">{title}</Text>
        <Text>{state?.property?.nome}</Text>
        <Text>Status atual: {state?.property?.status === 'ativa' ? 'Ativa' : 'Inativa'}</Text>
        <InfoBox message={reactivating ? 'A reativação depende da habilitação do Titular e das regras do servidor.'
          : 'A Propriedade deixará de ficar disponível aos perfis finais, conforme a autorização do servidor.'} />
        {state?.message ? <InfoBox variant="warning" message={state.message} /> : null}
        {state?.busy ? <ActivityIndicator /> : null}
        {command?.phase === 'submitting' ? <InfoBox message="Enviando alteração de status..." /> : null}
        {command?.phase === 'confirmed_reconciling' ? <InfoBox message="Alteração confirmada. Atualizando os dados..." /> : null}
        {command?.phase === 'confirmed_reconciliation_failed' ? <>
          <InfoBox variant="warning" message="Alteração confirmada, mas não foi possível atualizar os dados." />
          <HttpButton title="Tentar atualizar" disabled={state?.busy} onPress={run(() => controller!.retryReconciliation())} />
        </> : null}
        {!confirmed && !state?.review ? <SectionCard title="Motivo administrativo">
          <SelectField label="Motivo" value={state?.reason ?? ''} required disabled={disabled || state?.confirmation}
            options={PROPERTY_REASON_CODES.map(value => ({ value, label: REASON_LABELS[value] }))}
            onChange={value => { if (current()) controller!.update('reason', value); }} />
          <FormField label="Detalhe do motivo" accessibilityLabel="Detalhe do motivo" required={state?.reason === 'outro'}
            helperText="Até 300 caracteres. Obrigatório quando o motivo for Outro." multiline
            value={state?.detail ?? ''} disabled={disabled || state?.confirmation}
            onChangeText={value => { if (current()) controller!.update('detail', value); }} />
          {state?.confirmation ? <>
            <Text>Confirme {reactivating ? 'a reativação' : 'a inativação'} desta Propriedade.</Text>
            <HttpButton title={reactivating ? 'Confirmar reativação' : 'Confirmar inativação'} disabled={disabled}
              onPress={run(() => controller!.confirm())} />
          </> : <HttpButton title="Revisar alteração" disabled={disabled} onPress={run(() => controller!.requestConfirmation())} />}
        </SectionCard> : null}
        {command?.phase === 'ambiguous' ? <HttpButton title="Tentar enviar novamente" disabled={state?.busy}
          onPress={run(() => controller!.confirm())} /> : null}
        {state?.review ? <>
          <HttpButton title="Atualizar dados" disabled={state.busy} onPress={run(() => controller!.reload())} />
          <HttpButton title="Nova decisão de status" disabled={state.busy || state.reloadRequired}
            onPress={run(() => controller!.newDecision())} />
        </> : null}
        <HttpButton title={confirmed || state?.busy ? 'Fechar' : 'Cancelar'} variant="secondary" onPress={close} />
      </ScrollView>
    </SafeAreaView>
    </VisualPrivacyBoundary>
  </Modal>;
}
