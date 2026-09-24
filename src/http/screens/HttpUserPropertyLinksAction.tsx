import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
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
import { AdministrativeUserPropertyController } from '../administrativeUserPropertyController';
import { userPropertyAccessLabel } from '../administrativeUserPropertyModels';
import { PROPERTY_REASON_CODES } from '../administrativePropertyModels';
import type { AdministrativeReasonCode, AdministrativeUserPropertyFilters } from '../contracts';
import { HttpButton } from '../ui';

const REASONS: Record<AdministrativeReasonCode, string> = {
  fim_relacao: 'Fim da relação', mudanca_responsabilidade: 'Mudança de responsabilidade',
  cadastro_duplicado: 'Cadastro duplicado', correcao_administrativa: 'Correção administrativa',
  suspensao_operacional: 'Suspensão operacional', outro: 'Outro',
};

/** Local to the existing detail; no new route, tab or public deep link. */
export function HttpUserPropertyLinksAction({ userId, available }: { userId: string; available: boolean }) {
  const { runtime } = useHttpSession();
  const navigation = useNavigation(); const route = useRoute(); const focused = useIsFocused();
  const alive = React.useRef(false); const token = React.useRef<object | null>(null);
  const [opened, setOpened] = React.useState<{ id: string; token: object } | null>(null);
  const [, render] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; token.current = null; }; }, []);
  React.useEffect(() => {
    const a = runtime.administrativeUserData.subscribe(render), b = runtime.administrativePropertyData.subscribe(render);
    return () => { a(); b(); };
  }, [runtime]);
  const allowed = canAdministerProperties(runtime);
  React.useEffect(() => { token.current = null; setOpened(null); }, [userId, focused, allowed]);
  const current = () => {
    const state = navigation.getState();
    return alive.current && canAdministerProperties(runtime) && state.routes[state.index]?.key === route.key;
  };
  return <>
    {available && allowed ? <View style={{ padding: spacing.md }}><HttpButton title="Acessos a Propriedades" variant="secondary" onPress={() => {
      if (!current() || token.current) return;
      const next = {}; token.current = next; setOpened({ id: userId, token: next });
    }} /></View> : null}
    {opened && focused && allowed ? <LinksDialog key={opened.id} userId={opened.id}
      isCurrent={() => current() && token.current === opened.token} onClose={() => {
        if (!current() || token.current !== opened.token) return;
        token.current = null; setOpened(null);
      }} /> : null}
  </>;
}

function LinksDialog({ userId, isCurrent, onClose }: { userId: string; isCurrent: () => boolean; onClose: () => void }) {
  const { runtime } = useHttpSession();
  const instance = React.useRef<AdministrativeUserPropertyController | null>(null);
  const [controller, setController] = React.useState<AdministrativeUserPropertyController | null>(null);
  const [, render] = React.useReducer(n => n + 1, 0);
  const [search, setSearch] = React.useState(''), [catalogSearch, setCatalogSearch] = React.useState('');
  const [type, setType] = React.useState('todos'), [status, setStatus] = React.useState('todos');
  React.useEffect(() => {
    const next = new AdministrativeUserPropertyController(runtime, userId);
    instance.current = next; const stop = next.subscribe(render); setController(next); void next.start();
    return () => { instance.current = null; stop(); next.dispose(); };
  }, [runtime, userId]);
  const current = () => controller !== null && instance.current === controller && controller.active && isCurrent();
  const run = (action: () => unknown) => () => { if (current()) void action(); };
  const state = controller?.snapshot, editing = state?.phase === 'editing' && !state.busy;
  React.useEffect(() => {
    // A local read can lose its lease while the shared projection stays authorized.
    // Disposal must also dismiss this instance, without letting old callbacks close a new one.
    if (state?.phase === 'disposed' && instance.current === controller && isCurrent()) onClose();
  }, [controller, state?.phase, isCurrent, onClose]);
  const close = run(() => { controller!.dispose(); onClose(); });
  const queryControls = (kind: 'relations' | 'catalog') => {
    const query = kind === 'relations' ? state?.relations : state?.catalog;
    const failure = query?.failure ?? query?.nextPageFailure;
    return <>
      {query?.phase === 'loading' || query?.loadingMore ? <ActivityIndicator /> : null}
      {failure ? <InfoBox variant="warning" message={query?.nextPageFailure
        ? 'Falha na próxima página. Os itens carregados foram preservados.' : 'Não foi possível carregar esta consulta.'} /> : null}
      {failure ? <HttpButton title={failure.restartRequired ? 'Reiniciar consulta' : 'Tentar consulta novamente'} disabled={!editing}
        onPress={run(() => failure.restartRequired ? controller!.restart(kind) : controller!.retry(kind))} /> : null}
      {query?.nextCursor && !failure ? <HttpButton title={kind === 'relations' ? 'Mais acessos' : 'Mais Propriedades'}
        disabled={!editing || query.loadingMore} onPress={run(() => controller!.more(kind))} /> : null}
      {query?.phase === 'ready' && !query.items.length ? <Text>Nenhum resultado nesta consulta.</Text> : null}
    </>;
  };
  const items = state?.phase === 'completed' || state?.phase === 'review' ? state.reconciled?.itens ?? [] : state?.relations.items ?? [];
  return <Modal visible transparent={false} animationType="slide" onRequestClose={close}>
    <VisualPrivacyBoundary style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header">Acessos a Propriedades</Text><Text>{state?.user?.nome}</Text>
      <InfoBox message="Titularidade é somente leitura. Vínculo cadastrado não garante acesso: os estados do Usuário, da Propriedade e as regras do servidor também se aplicam." />
      {state?.busy ? <ActivityIndicator /> : null}
      {state?.message ? <InfoBox variant={state.phase === 'completed' ? undefined : 'warning'} message={state.message} /> : null}
      {state?.phase === 'reconciling' ? <InfoBox message="Alteração confirmada. Atualizando os acessos..." /> : null}
      {state?.phase === 'submitting' ? <InfoBox message="Enviando alteração de vínculos..." /> : null}
      {state?.user?.perfil === 'admin' ? <InfoBox message="Administrador tem acesso global na organização e não recebe vínculos diretos." /> : null}
      {state?.phase === 'error' || state?.phase === 'review' ? <HttpButton title="Atualizar acessos" disabled={state.busy} onPress={run(() => controller!.reload())} /> : null}
      {state?.phase === 'review' ? <HttpButton title="Nova decisão de vínculos" disabled={state.busy || !state.reloadReady} onPress={run(() => controller!.newDecision())} /> : null}
      {state?.phase === 'reconciliation_failed' ? <HttpButton title="Tentar atualizar acessos" disabled={state.busy} onPress={run(() => controller!.retryReconciliation())} /> : null}
      {state?.phase === 'ambiguous' ? <HttpButton title="Tentar enviar novamente" disabled={state.busy} onPress={run(() => controller!.confirm())} /> : null}
      {state?.phase === 'editing' ? <SectionCard title="Consultar acessos cadastrados">
        <FormField label="Buscar acessos" accessibilityLabel="Buscar acessos" value={search} disabled={!editing} onChangeText={setSearch} />
        <SelectField label="Tipo de acesso" value={type} disabled={!editing} onChange={setType} options={[
          { value: 'todos', label: 'Todos' }, { value: 'titular', label: 'Titularidade' },
          { value: 'usuario_autorizado', label: 'Produtor autorizado' }, { value: 'colaborador', label: 'Colaborador' }]} />
        <SelectField label="Estado do vínculo" value={status} disabled={!editing} onChange={setStatus} options={[
          { value: 'todos', label: 'Todos, incluindo Titularidade' }, { value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }]} />
        <HttpButton title="Pesquisar acessos" disabled={!editing} onPress={run(() => controller!.searchRelations({
          ...(search.trim() ? { busca: search.trim() } : {}),
          ...(type !== 'todos' ? { tipo_acesso: type as AdministrativeUserPropertyFilters['tipo_acesso'] } : {}),
          ...(status !== 'todos' ? { status_vinculo: status as 'ativo' | 'inativo' } : {}), limite: 50 }))} />
      </SectionCard> : null}
      {items.map(item => <SectionCard key={item.id} title={item.propriedade_nome}>
        <Text>{item.origem_acesso === 'titularidade' ? 'Titularidade · somente leitura' : `Vínculo direto ${item.status_vinculo}`}</Text>
        <Text>Propriedade {item.propriedade_status}</Text>
        {state?.user ? <Text>{userPropertyAccessLabel(state.user, item)}</Text> : null}
        {editing && item.editavel && state?.user?.perfil !== 'admin' ? <HttpButton
          title={`${item.status_vinculo === 'ativo' ? 'Remover vínculo' : 'Reativar vínculo'}: ${item.propriedade_nome}`}
          onPress={run(() => controller!.selectRelation(item, item.status_vinculo !== 'ativo'))} /> : null}
      </SectionCard>)}
      {state?.phase === 'editing' ? queryControls('relations') : null}
      {state?.phase === 'completed' && state.reconciled?.paginacao.proximo_cursor ? <Text>Há mais acessos. Feche e reabra a consulta para continuar a paginação.</Text> : null}
      {state?.phase === 'editing' && state.user?.perfil !== 'admin' ? <SectionCard title="Adicionar acesso direto">
        <FormField label="Buscar Propriedades" accessibilityLabel="Buscar Propriedades" value={catalogSearch} disabled={!editing} onChangeText={setCatalogSearch} />
        <HttpButton title="Pesquisar Propriedades" disabled={!editing} onPress={run(() => controller!.searchProperties(catalogSearch))} />
        {state.catalog.items.map(item => <View key={item.id} style={{ marginVertical: spacing.sm }}>
          <Text>{item.nome} · {item.status}</Text>
          {state.user?.perfil === 'produtor' && item.titular_id === state.user.produtor_id ? <Text>Titularidade · somente leitura</Text>
            : <HttpButton title={`Adicionar acesso: ${item.nome}`} disabled={!editing} onPress={run(() => controller!.selectProperty(item))} />}
        </View>)}
        {queryControls('catalog')}
      </SectionCard> : null}
      {state?.count ? <SectionCard title="Alterações selecionadas" subtitle="Somente os itens abaixo serão alterados.">
        {[...state.additions.map(([id, name]) => [id, name, 'Adicionar/reativar']), ...state.removals.map(([id, name]) => [id, name, 'Remover vínculo'])].map(([id, name, action]) =>
          <View key={id}><Text>{action}: {name}</Text>{editing ? <HttpButton title={`Desfazer: ${name}`} variant="secondary" onPress={run(() => controller!.undo(id))} /> : null}</View>)}
      </SectionCard> : null}
      {state?.phase === 'editing' && state.user?.perfil !== 'admin' ? <SectionCard title="Motivo administrativo">
        <SelectField label="Motivo" value={state.reason} required disabled={!editing}
          options={PROPERTY_REASON_CODES.map(value => ({ value, label: REASONS[value] }))} onChange={value => { if (current()) controller!.update('reason', value); }} />
        <FormField label="Detalhe do motivo" accessibilityLabel="Detalhe do motivo" value={state.detail} disabled={!editing} required={state.reason === 'outro'}
          helperText="Até 300 caracteres; obrigatório para Outro." multiline onChangeText={value => { if (current()) controller!.update('detail', value); }} />
        <HttpButton title="Revisar vínculos" disabled={!editing || !state.count} onPress={run(() => controller!.review())} />
      </SectionCard> : null}
      {state?.phase === 'confirming' ? <SectionCard title="Confirmar alteração de acessos">
        <Text>Motivo: {REASONS[state.reason as AdministrativeReasonCode]}</Text><Text>{state.detail}</Text>
        <InfoBox message="As sessões do Usuário afetado serão revogadas, inclusive ao adicionar acesso. Ele precisará entrar novamente. Remover o último acesso não inativa a conta nem remove Titularidades." />
        <HttpButton title="Confirmar vínculos" disabled={state.busy} onPress={run(() => controller!.confirm())} />
        <HttpButton title="Voltar à seleção" variant="secondary" disabled={state.busy} onPress={run(() => controller!.backToEditing())} />
      </SectionCard> : null}
      {state?.mutationConfirmed ? <Text>A alteração já foi confirmada. Fechar não desfaz a operação.</Text> : null}
      {state?.phase === 'ambiguous' || state?.phase === 'submitting' ? <Text>O resultado do envio pode ainda ser desconhecido. Fechar não desfaz uma alteração aceita.</Text> : null}
      <HttpButton title={state?.mutationConfirmed || state?.phase === 'ambiguous' || state?.phase === 'submitting' ? 'Fechar' : 'Cancelar'} variant="secondary" onPress={close} />
    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
    </VisualPrivacyBoundary>
  </Modal>;
}
