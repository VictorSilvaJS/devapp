import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormFooter from '../../components/FormFooter';
import InfoBox from '../../components/InfoBox';
import SectionCard from '../../components/SectionCard';
import SelectField, { type SelectFieldProps } from '../../components/SelectField';
import SegmentedChips from '../../components/SegmentedChips';
import { PropertyFormLayout, PropertyCadastralFields } from '../../components/PropertyForm';
import { useFormValidationFocus } from '../../hooks/useFormValidationFocus';
import { AdministrativePropertyFormController } from '../administrativePropertyFormController';
import { useAdministrativePropertyAccess } from '../administrativePropertyFormAccess';
import type { AdministrativePropertyEditField } from '../administrativePropertyModels';
import { isCanonicalUuidV4 } from '../decoders';
import { HttpDetailHeader } from '../HttpAppHeader';
import { useHttpSession } from '../HttpSessionContext';
import { HttpButton } from '../ui';

const FIELD_LABELS = { nome: 'Nome', area_total: 'Área', municipio: 'Município', cultura_principal: 'Cultura' };
type PropertyEditOrigin = Readonly<{ routeKey: string; propertyId: string }>;
function conflictValue(value: unknown): string {
  if (value === null) return 'Não informado';
  if (typeof value === 'string') return value;
  const municipality = value as { municipio_nome: string; uf_sigla: string };
  return `${municipality.municipio_nome}/${municipality.uf_sigla}`;
}

function queryPresentation(query: { phase: string; loadingMore: boolean; failure: unknown; nextPageFailure: unknown;
  nextCursor: string | null }, retry: () => void, more?: () => void, restart = retry): NonNullable<SelectFieldProps['remote']> {
  const failure = (query.failure ?? query.nextPageFailure) as { restartRequired?: boolean } | null;
  return { loading: query.phase === 'loading', loadingMore: query.loadingMore,
    error: failure ? (failure.restartRequired ? 'A lista mudou. Atualize as opções.' : 'Não foi possível carregar as opções.') : undefined,
    onRetry: failure?.restartRequired ? restart : retry,
    onLoadMore: query.nextCursor && !failure?.restartRequired ? more : undefined };
}

export function HttpAdministrativePropertyCreateScreen(props: any) {
  return <PropertyFormGuard {...props} />;
}
export function HttpAdministrativePropertyEditScreen(props: any) {
  return <PropertyFormGuard {...props} editing />;
}
function PropertyFormGuard({ editing = false, route, navigation }: any) {
  const { allowed } = useAdministrativePropertyAccess();
  if (!allowed) return <InfoBox variant="warning" message="Somente Administradores ativos podem administrar Propriedades." />;
  if (editing && !isCanonicalUuidV4(route.params?.id)) return <InfoBox variant="error" message="Não foi possível identificar a Propriedade." />;
  return <PropertyFormSurface key={route.key} navigation={navigation} propertyId={editing ? route.params.id : undefined} />;
}

function PropertyFormSurface({ navigation, propertyId }: { navigation: any; propertyId?: string }) {
  const { runtime } = useHttpSession();
  const route = useRoute();
  const instance = React.useRef<AdministrativePropertyFormController | null>(null);
  const [form, setForm] = React.useState<AdministrativePropertyFormController | null>(null);
  const [, render] = React.useReducer(value => value + 1, 0);
  const focus = useFormValidationFocus(['propriedade', 'titular', 'uf', 'municipio', 'area_total', 'cultura_principal']);
  const title = propertyId ? 'Editar Propriedade' : 'Nova Propriedade';
  React.useEffect(() => {
    // Each setup owns a fresh instance, including React StrictMode effect replay.
    const origin = (route.params as { origin?: PropertyEditOrigin } | undefined)?.origin;
    let completedNavigation = false;
    const controller = new AdministrativePropertyFormController(runtime, propertyId, property => {
      if (completedNavigation || !current(controller)) return;
      completedNavigation = true;
      if (!propertyId) {
        navigation.replace('PropertyDetail', { id: property.id });
        return;
      }
      const state = navigation.getState();
      const previous = state.routes[state.index - 1];
      if (origin?.propertyId === property.id && typeof origin.routeKey === 'string' &&
        previous?.key === origin.routeKey && previous.name === 'PropertyDetail' && previous.params?.id === property.id) {
        // The boundary already published the authoritative projection observed by this detail.
        navigation.goBack();
        return;
      }
      // Direct entry or retired origin: keep unrelated history, remove this property's old
      // detail/edit routes, then finish at one canonical detail without an arbitrary goBack.
      const routes = state.routes.slice(0, state.index).filter((entry: any) => !(entry.params?.id === property.id &&
        (entry.name === 'PropertyDetail' || entry.name === 'AdministrativePropertyEdit')));
      navigation.reset({ index: routes.length, routes: [...routes, { name: 'PropertyDetail', params: { id: property.id } }] });
    });
    function current(target: AdministrativePropertyFormController) {
      const state = navigation.getState();
      return instance.current === target && target.current && state.routes[state.index]?.key === route.key;
    }
    instance.current = controller;
    const stop = controller.subscribe(render);
    controller.start(); setForm(controller);
    return () => { instance.current = null; controller.dispose(); stop(); };
  }, [runtime, propertyId, navigation, route.key]);

  const current = () => {
    const state = navigation.getState();
    return form !== null && instance.current === form && form.current && state.routes[state.index]?.key === route.key;
  };
  const back = () => { if (current()) { form!.dispose(); navigation.goBack(); } };
  const run = (action: () => unknown) => () => { if (current()) void action(); };
  const state = form?.snapshot;
  const command = state?.command;
  const disabled = !state?.active || state.busy || !!command?.mutationConfirmed || command?.phase === 'ambiguous';
  const model = state?.model;
  const values = model?.draft ?? state?.inputs;
  const holder = state?.holder;
  const locality = state?.localities;
  const holderController = form?.holder;
  const localityController = form?.localities;

  return <PropertyFormLayout focus={focus}
    header={<HttpDetailHeader title={title} navigation={{ goBack: back }} />}
    footer={<SafeAreaView edges={['bottom']}><FormFooter onCancel={back} onSubmit={run(() => form?.submit())}
      submitLabel={command?.phase === 'ambiguous' ? 'Tentar salvar novamente' : propertyId ? 'Salvar alterações' : 'Salvar Propriedade'}
      loading={state?.busy} disabled={command?.phase === 'ambiguous' ? !state?.active : !state?.canSubmit} /></SafeAreaView>}>
    {!state || state.loading ? <><ActivityIndicator /><Text>Carregando Propriedade...</Text></> : null}
    {state && !state.active ? <InfoBox variant="warning" message="O acesso administrativo foi encerrado. Abra uma nova operação após validar a sessão." /> : null}
    {command?.phase === 'submitting' || (state?.busy && holder?.verification === 'validating') ? <InfoBox message="Enviando alteração..." /> : null}
    {command?.phase === 'confirmed_reconciling' ? <InfoBox message="A alteração foi confirmada. Atualizando os dados..." /> : null}
    {command?.phase === 'confirmed_reconciliation_failed' ? <>
      <InfoBox variant="warning" message="A alteração foi confirmada, mas não foi possível atualizar os dados." />
      <HttpButton title="Tentar atualizar" disabled={state?.busy} onPress={run(() => form?.retryReconciliation())} />
    </> : null}
    {command?.phase === 'reconciled' ? <InfoBox message="Propriedade salva e atualizada." /> : null}
    {state?.message ? <InfoBox variant="error" message={state.message} /> : null}
    {locality?.cancelled && !command?.mutationConfirmed ? <InfoBox variant="warning"
      message="As opções deste formulário foram encerradas. Volte e abra uma nova operação." /> : null}
    {propertyId && !state?.busy && !command?.mutationConfirmed ? <HttpButton title="Atualizar dados"
      variant="secondary" onPress={run(() => form?.reload())} /> : null}
    {values ? <PropertyCadastralFields nome={values.nome} area={values.area_total ?? ''} cultura={values.cultura_principal ?? ''}
      focus={focus} errors={state?.errors} disabled={disabled}
      areaHelper="Use ponto decimal, sem separador de milhar. Ex.: 500.25 hectares."
      onName={value => { if (current()) form!.update('nome', value); }}
      onArea={value => { if (current()) form!.update('area_total', value); }}
      onCulture={value => { if (current()) form!.update('cultura_principal', value); }} /> : null}
    {model ? <SectionCard title="Titular" subtitle="O Titular atual é preservado nesta edição cadastral.">
      <SelectField label="Produtor Titular" value="current" options={[{ value: 'current', label: model.baseline.titular.nome }]}
        onChange={() => {}} disabled />
      <Text>Status: {model.baseline.status === 'ativa' ? 'Ativa' : 'Inativa'}</Text>
    </SectionCard> : holder && holderController ? <SectionCard title="Titular" subtitle="Escolha o Produtor responsável pela Propriedade.">
      <SelectField label="Produtor Titular" required value={holder.selected?.usuario_id ?? ''}
        selectedOption={holder.selected ? { value: holder.selected.usuario_id, label: holder.selected.nome, description: holder.selected.email } : undefined}
        options={holder.items.map(item => ({ value: item.usuario_id, label: item.nome, description: item.email }))}
        onChange={(() => {
          const callbacks = new Map(holder.items.map(item => [item.usuario_id, holderController.selectionCallback(item)]));
          return value => { if (current() && callbacks.has(value)) form!.select(callbacks.get(value)!); };
        })()}
        disabled={disabled} placeholder="Selecione um Produtor"
        remote={{ ...queryPresentation(holder, run(() => holderController.retry()), run(() => holderController.loadMore()), run(() => holderController.refresh())),
          search: holder.query?.busca ?? '', onSearch: value => { if (current()) form!.select(() => holderController.search(value)); } }} />
      <Text accessibilityLiveRegion="polite">{holder.verification === 'confirmed' ? 'Titular confirmado.' : holder.verification === 'validating'
        ? 'Validando Titular...' : holder.verification === 'invalid' ? 'Titular não habilitado para o status inicial. Revalide ou escolha outro Produtor.'
        : holder.verification === 'error' ? 'Não foi possível validar o Titular. Tente novamente.' : 'Confirme o Titular antes de salvar.'}</Text>
      <HttpButton title="Confirmar Titular" variant="secondary" disabled={disabled || !holder.selected || holder.verification === 'validating'}
        onPress={run(() => form?.confirmHolder())} />
    </SectionCard> : null}
    {locality && localityController ? <SectionCard title="Localização" subtitle="Selecione UF e Município. A localização não concede acesso.">
      <SelectField label="UF" required value={locality.selectedUf?.id ?? ''} disabled={disabled}
        selectedOption={locality.selectedUf ? { value: locality.selectedUf.id, label: locality.selectedUf.sigla } : undefined}
        options={locality.ufs.items.map(uf => ({ value: uf.id, label: `${uf.nome} (${uf.sigla})` }))}
        onChange={(() => {
          const callbacks = new Map(locality.ufs.items.map(uf => [uf.id, localityController.ufSelectionCallback(uf)]));
          return value => { if (current() && callbacks.has(value)) form!.select(callbacks.get(value)!); };
        })()} remote={queryPresentation(locality.ufs, run(() => localityController.retryUfs()))} />
      <SelectField label="Município" required value={locality.selected?.municipio_id ?? ''}
        selectedOption={locality.selected ? { value: locality.selected.municipio_id, label: locality.selected.municipio_nome, description: locality.selected.uf_sigla } : undefined}
        disabled={disabled || !locality.selectedUf} placeholder={locality.selectedUf ? 'Selecione o Município' : 'Selecione primeiro a UF'}
        options={locality.municipalities.items.map(item => ({ value: item.id, label: item.nome }))}
        onChange={(() => {
          const callbacks = new Map(locality.municipalities.items.map(item => [item.id, localityController.municipalitySelectionCallback(item)]));
          return value => { if (current() && callbacks.has(value)) form!.select(callbacks.get(value)!, true); };
        })()} remote={{ ...queryPresentation(locality.municipalities, run(() => localityController.retry()), run(() => localityController.loadMore()), run(() => localityController.refresh())),
          search: locality.municipalities.query?.busca ?? '', onSearch: value => { if (current()) form!.select(() => localityController.search(value)); } }} />
    </SectionCard> : null}
    {state?.inputs ? <SectionCard title="Status inicial" subtitle="Situação cadastral inicial da Propriedade.">
      <SegmentedChips options={[{ value: 'ativa', label: 'Ativa', disabled }, { value: 'inativa', label: 'Inativa', disabled }]}
        value={state.inputs.status} onChange={value => { if (current() && !disabled) form!.setStatus(value); }} />
    </SectionCard> : null}
    {model ? (Object.keys(model.fieldConflicts) as AdministrativePropertyEditField[]).map(field => {
      const conflict = model.fieldConflicts[field]!;
      return <SectionCard key={field} title={`Conflito em ${FIELD_LABELS[field]}`}>
        <Text>Servidor: {conflictValue(conflict.serverValue)}</Text>
        <Text>Sua alteração: {conflictValue(conflict.operatorValue)}</Text>
        <HttpButton title={`Usar valor do servidor — ${FIELD_LABELS[field]}`} disabled={disabled}
          onPress={run(() => form?.resolve(field, 'server'))} />
        <HttpButton title={`Manter minha alteração — ${FIELD_LABELS[field]}`} variant="secondary" disabled={disabled}
          onPress={run(() => form?.resolve(field, 'operator'))} />
      </SectionCard>;
    }) : null}
  </PropertyFormLayout>;
}
