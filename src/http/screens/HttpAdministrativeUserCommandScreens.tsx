import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import FormFooter from '../../components/FormFooter';
import InfoBox from '../../components/InfoBox';
import SectionCard from '../../components/SectionCard';
import SegmentedChips from '../../components/SegmentedChips';
import { colors, spacing, typography } from '../../theme';
import {
  AdministrativeUserCommandLifecycle,
} from '../administrativeUserCommandLifecycle';
import {
  AdministrativeUserConflictError,
  classifyAdministrativeUserCommandFailure,
  confirmedReconciliationFailure,
  createAdministrativeUserEditModel,
  rebaseAdministrativeUserEditModel,
  resolveAdministrativeUserEditConflict,
  updateAdministrativeUserEditField,
  type AdministrativeUserCommandFailure,
  type AdministrativeUserCommandResult,
  type AdministrativeUserCreateDraft,
  type AdministrativeUserEditField,
  type AdministrativeUserEditModel,
  type AdministrativeUserStatusDraft,
} from '../administrativeUserCommands';
import {
  administrativeUserNavigationCapabilities,
  administrativeUserSessionPartition,
} from '../administrativeUserAccess';
import type {
  AdministrativeReasonCode,
  AdministrativeUserDetail,
  ApiErrorDetailField,
} from '../contracts';
import { isCanonicalUuidV4 } from '../decoders';
import { HttpDetailHeader } from '../HttpAppHeader';
import { useHttpSession } from '../HttpSessionContext';
import { HttpButton, HttpFeedback } from '../ui';
import {
  useAdministrativeUserDetail,
} from './HttpAdministrativeUserScreens';

const PROFILE_LABELS = Object.freeze({
  admin: 'Administrador',
  colaborador: 'Colaborador',
  produtor: 'Produtor',
});

const STATUS_LABELS = Object.freeze({
  pendente: 'Pendente',
  ativo: 'Ativo',
  inativo: 'Inativo',
});

const REASON_OPTIONS: readonly Readonly<{
  value: AdministrativeReasonCode;
  label: string;
}>[] = Object.freeze([
  { value: 'fim_relacao', label: 'Fim da relação' },
  { value: 'mudanca_responsabilidade', label: 'Mudança de responsabilidade' },
  { value: 'cadastro_duplicado', label: 'Cadastro duplicado' },
  { value: 'correcao_administrativa', label: 'Correção administrativa' },
  { value: 'suspensao_operacional', label: 'Suspensão operacional' },
  { value: 'outro', label: 'Outro' },
]);

const EMPTY_CREATE_DRAFT: AdministrativeUserCreateDraft = Object.freeze({
  nome: '',
  email: '',
  perfil: 'produtor',
  telefone: '',
  documento: '',
  observacoes: '',
});

const EMPTY_STATUS_DRAFT: AdministrativeUserStatusDraft = Object.freeze({
  motivo: 'correcao_administrativa',
  motivo_detalhe: '',
});

function useCommandLifecycle() {
  const { runtime } = useHttpSession();
  const lifecycle = React.useMemo(() => new AdministrativeUserCommandLifecycle({
    boundary: runtime.administrativeUserData,
    discardIntent: (intentId) => (
      runtime.administrativeUserCommands.discardIntent(intentId)
    ),
  }), [runtime]);
  const subscribe = React.useCallback(
    (listener: () => void) => lifecycle.subscribe(listener),
    [lifecycle],
  );
  const getSnapshot = React.useCallback(() => lifecycle.snapshot, [lifecycle]);
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  React.useEffect(() => {
    lifecycle.start();
    return () => lifecycle.dispose();
  }, [lifecycle]);
  return { lifecycle, snapshot };
}

function useCommandTarget(userId: string) {
  const { runtime, snapshot, sessionEpoch } = useHttpSession();
  const partitionKey = administrativeUserSessionPartition(snapshot, sessionEpoch);
  return useAdministrativeUserDetail(
    runtime.administrativeUserControllers,
    runtime.administrativeUsers,
    runtime.administrativeUserData,
    partitionKey,
    true,
    userId,
  );
}

function userIdFromRoute(route: any): string {
  return typeof route.params?.id === 'string' ? route.params.id : '';
}

function CommandAccessGuard({
  title,
  children,
}: React.PropsWithChildren<{ readonly title: string }>) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).userDetail) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Acesso restrito</Text>
          <HttpFeedback message={`Somente Administradores podem acessar ${title}.`} />
        </View>
      </View>
    );
  }
  return <>{children}</>;
}

function TargetLoading({ title, navigation }: Readonly<{
  title: string;
  navigation: any;
}>) {
  return (
    <View style={styles.container}>
      <HttpDetailHeader title={title} navigation={navigation} />
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Carregando detalhe autoritativo...</Text>
      </View>
    </View>
  );
}

function InvalidTarget({ title, navigation, message }: Readonly<{
  title: string;
  navigation: any;
  message: string;
}>) {
  return (
    <View style={styles.container}>
      <HttpDetailHeader title={title} navigation={navigation} />
      <View style={styles.centered}>
        <HttpFeedback message={message} />
      </View>
    </View>
  );
}

function fieldError(
  fieldErrors: Readonly<Partial<Record<ApiErrorDetailField, string>>>,
  field: ApiErrorDetailField,
): string | undefined {
  return fieldErrors[field];
}

function ReviewGate({
  failure,
  onReview,
}: Readonly<{
  failure: AdministrativeUserCommandFailure | null;
  onReview: () => void;
}>) {
  if (!failure?.reviewRequired) return null;
  return (
    <HttpButton
      title={failure.reloadRequired
        ? 'Tentar carregar versão atual'
        : 'Revisar e preparar nova intenção'}
      variant="secondary"
      onPress={onReview}
    />
  );
}

function CommandFeedback({
  failure,
}: Readonly<{ readonly failure: AdministrativeUserCommandFailure | null }>) {
  if (failure === null) return null;
  return <HttpFeedback message={failure.message} />;
}

export function HttpAdministrativeUserCreateScreen({ navigation }: any) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).usersTab) {
    return (
      <CommandAccessGuard title="Novo Usuário">
        <View />
      </CommandAccessGuard>
    );
  }
  return <HttpAdministrativeUserCreateAdminSurface navigation={navigation} />;
}

function HttpAdministrativeUserCreateAdminSurface({ navigation }: any) {
  const { runtime } = useHttpSession();
  const { lifecycle, snapshot: lifecycleState } = useCommandLifecycle();
  const [draft, setDraft] = React.useState<AdministrativeUserCreateDraft>(
    EMPTY_CREATE_DRAFT,
  );
  const [failure, setFailure] = React.useState<AdministrativeUserCommandFailure | null>(null);
  const [pendingReconciliation, setPendingReconciliation] = React.useState<
    Extract<AdministrativeUserCommandResult, {
      kind: 'mutation_confirmed_reconciliation_failed';
    }> | null
  >(null);
  const lastReset = React.useRef(lifecycleState.resetVersion);

  React.useEffect(() => {
    if (lastReset.current === lifecycleState.resetVersion) return;
    lastReset.current = lifecycleState.resetVersion;
    setDraft(EMPTY_CREATE_DRAFT);
    setFailure(null);
    setPendingReconciliation(null);
  }, [lifecycleState.resetVersion]);

  const update = <K extends keyof AdministrativeUserCreateDraft,>(
    field: K,
    value: AdministrativeUserCreateDraft[K],
  ) => {
    if (lifecycleState.submitting || failure?.reloadRequired) return;
    lifecycle.restartIntent();
    setFailure(null);
    setDraft((current) => Object.freeze({ ...current, [field]: value }));
  };

  const submit = async () => {
    const outcome = await lifecycle.run((intentId, context) => (
      runtime.administrativeUserCommands.create(intentId, draft, context)
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) {
      setFailure(classifyAdministrativeUserCommandFailure('create', outcome.error));
      return;
    }
    if (outcome.value.kind === 'mutation_confirmed_reconciliation_failed') {
      setPendingReconciliation(outcome.value);
      setFailure(confirmedReconciliationFailure());
      return;
    }
    navigation.replace('AdministrativeUserDetail', { id: outcome.value.user.id });
  };
  const reload = async () => {
    if (pendingReconciliation === null) return;
    const outcome = await lifecycle.runRead((context) => (
      runtime.administrativeUserCommands.reloadAdministrativeUser(
        context,
        pendingReconciliation.expectedUserId,
        pendingReconciliation.minimumVersion,
      )
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) {
      setFailure(confirmedReconciliationFailure());
      return;
    }
    setPendingReconciliation(null);
    setFailure(null);
    navigation.replace('AdministrativeUserDetail', { id: outcome.value.id });
  };

  return (
    <View style={styles.container}>
      <HttpDetailHeader title="Novo Usuário" navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <InfoBox
          title="Cadastro conectado"
          message="O Usuário nasce Pendente e recebe convite para definir a própria credencial. A confirmação usa uma releitura autoritativa do servidor."
        />
        <SectionCard title="Dados do Usuário">
          <FormField
            label="Nome"
            required
            value={draft.nome}
            onChangeText={(value) => update('nome', value)}
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'nome')}
          />
          <FormField
            label="E-mail"
            required
            value={draft.email}
            onChangeText={(value) => update('email', value)}
            autoCapitalize="none"
            keyboardType="email-address"
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'email')}
          />
          <FormField
            label="Telefone (opcional)"
            value={draft.telefone ?? ''}
            onChangeText={(value) => update('telefone', value)}
            keyboardType="phone-pad"
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'telefone')}
          />
          <FormField
            label="Documento (opcional)"
            value={draft.documento ?? ''}
            onChangeText={(value) => update('documento', value)}
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'documento')}
          />
          <FormField
            label="Observações (opcional)"
            value={draft.observacoes ?? ''}
            onChangeText={(value) => update('observacoes', value)}
            textarea
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'observacoes')}
          />
        </SectionCard>
        <SectionCard
          title="Perfil"
          subtitle="A criação conectada está limitada a Produtor e Colaborador enquanto MFA for portão produtivo."
        >
          <SegmentedChips<AdministrativeUserCreateDraft['perfil']>
            options={[
              { value: 'produtor', label: 'Produtor', icon: 'leaf-outline' },
              { value: 'colaborador', label: 'Colaborador', icon: 'briefcase-outline' },
            ]}
            value={draft.perfil}
            onChange={(value) => update('perfil', value)}
          />
          {fieldError(failure?.fieldErrors ?? {}, 'perfil') ? (
            <Text style={styles.fieldError}>
              {fieldError(failure?.fieldErrors ?? {}, 'perfil')}
            </Text>
          ) : null}
        </SectionCard>
        <CommandFeedback failure={failure} />
        <ReviewGate
          failure={failure}
          onReview={() => {
            if (failure?.reloadRequired) {
              void reload();
              return;
            }
            lifecycle.restartIntent();
            setFailure(null);
          }}
        />
      </ScrollView>
      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={() => { void submit(); }}
        submitLabel={failure?.retrySameIntent
          ? 'Tentar novamente com a mesma intenção'
          : 'Criar Usuário'}
        submitIcon="person-add-outline"
        loading={lifecycleState.submitting}
        disabled={!lifecycleState.active || failure?.reviewRequired === true}
      />
    </View>
  );
}

export function HttpAdministrativeUserEditScreen({ route, navigation }: any) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).userDetail) {
    return (
      <CommandAccessGuard title="Editar Usuário">
        <View />
      </CommandAccessGuard>
    );
  }
  const id = userIdFromRoute(route);
  if (!isCanonicalUuidV4(id)) {
    return <InvalidTarget title="Editar Usuário" navigation={navigation} message="O ID do Usuário é inválido." />;
  }
  return <HttpAdministrativeUserEditAdminSurface id={id} navigation={navigation} />;
}

function HttpAdministrativeUserEditAdminSurface({ id, navigation }: Readonly<{
  id: string;
  navigation: any;
}>) {
  const { runtime } = useHttpSession();
  const { current } = useCommandTarget(id);
  const { lifecycle, snapshot: lifecycleState } = useCommandLifecycle();
  const [model, setModel] = React.useState<AdministrativeUserEditModel | null>(null);
  const [failure, setFailure] = React.useState<AdministrativeUserCommandFailure | null>(null);
  const [pendingReconciliation, setPendingReconciliation] = React.useState<
    Extract<AdministrativeUserCommandResult, {
      kind: 'mutation_confirmed_reconciliation_failed';
    }> | null
  >(null);
  const [targetUser, setTargetUser] = React.useState<AdministrativeUserDetail | null>(null);
  const lastReset = React.useRef(lifecycleState.resetVersion);

  React.useEffect(() => {
    if (current.user === null) return;
    setTargetUser(current.user);
    setModel((existing) => {
      if (existing === null || existing.userId !== current.user?.id) {
        return createAdministrativeUserEditModel(current.user!);
      }
      if (current.user.versao < existing.baselineVersion) return existing;
      if (
        current.user.versao === existing.baselineVersion &&
        current.user.status === existing.baselineStatus
      ) return existing;
      return rebaseAdministrativeUserEditModel(existing, current.user);
    });
  }, [current.user]);
  React.useEffect(() => {
    if (lastReset.current === lifecycleState.resetVersion) return;
    lastReset.current = lifecycleState.resetVersion;
    setModel(null);
    setTargetUser(null);
    setFailure(null);
    setPendingReconciliation(null);
  }, [lifecycleState.resetVersion]);

  const availableUser = current.user ?? (
    pendingReconciliation === null ? null : targetUser
  );
  if (current.loading || (availableUser !== null && model === null)) {
    return <TargetLoading title="Editar Usuário" navigation={navigation} />;
  }
  if (current.failure || availableUser === null) {
    return (
      <InvalidTarget
        title="Editar Usuário"
        navigation={navigation}
        message={current.failure?.message ?? 'O Usuário não foi encontrado.'}
      />
    );
  }
  const user = availableUser;
  if (model === null) {
    return <TargetLoading title="Editar Usuário" navigation={navigation} />;
  }
  const update = (
    field: AdministrativeUserEditField,
    value: string,
  ) => {
    if (lifecycleState.submitting) return;
    lifecycle.restartIntent();
    if (!failure?.reloadRequired) setFailure(null);
    setModel((currentModel) => currentModel === null
      ? currentModel
      : updateAdministrativeUserEditField(currentModel, field, value));
  };
  const submit = async () => {
    const outcome = await lifecycle.run((intentId, context) => (
      runtime.administrativeUserCommands.update(intentId, user, model, context)
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) {
      if (
        outcome.error instanceof AdministrativeUserConflictError &&
        outcome.error.reloadedUser !== undefined
      ) {
        const reloadedUser = outcome.error.reloadedUser;
        setModel((currentModel) => currentModel === null
          ? currentModel
          : rebaseAdministrativeUserEditModel(
              currentModel,
              reloadedUser,
            ));
      }
      setFailure(classifyAdministrativeUserCommandFailure('edit', outcome.error));
      return;
    }
    if (outcome.value.kind === 'mutation_confirmed_reconciliation_failed') {
      setPendingReconciliation(outcome.value);
      setFailure(confirmedReconciliationFailure());
      return;
    }
    navigation.goBack();
  };
  const reload = async () => {
    const outcome = await lifecycle.runRead((context) => (
      runtime.administrativeUserCommands.reloadAdministrativeUser(
        context,
        pendingReconciliation?.expectedUserId ?? model.userId,
        pendingReconciliation?.minimumVersion ??
          failure?.currentVersion ??
          model.baselineVersion,
      )
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) return;
    setModel((currentModel) => currentModel === null
      ? currentModel
      : rebaseAdministrativeUserEditModel(currentModel, outcome.value));
    setFailure(null);
    setPendingReconciliation(null);
  };

  return (
    <View style={styles.container}>
      <HttpDetailHeader title="Editar Usuário" navigation={navigation} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <InfoBox message="O detalhe autoritativo foi carregado antes da edição. Perfil e status não pertencem a este formulário." />
        <SectionCard title="Dados cadastrais">
          <FormField
            label="Nome"
            required
            value={model.draftValues.nome}
            onChangeText={(value) => update('nome', value)}
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'nome')}
          />
          <FormField
            label="E-mail"
            required
            value={model.draftValues.email}
            onChangeText={(value) => update('email', value)}
            disabled={lifecycleState.submitting || model.baselineStatus !== 'pendente'}
            autoCapitalize="none"
            keyboardType="email-address"
            helperText={model.baselineStatus === 'pendente'
              ? 'Alterar o e-mail substitui o convite pendente no servidor.'
              : 'Conta habilitada: a própria pessoa usa Conta > Trocar e-mail principal.'}
            error={fieldError(failure?.fieldErrors ?? {}, 'email')}
          />
          <FormField
            label="Telefone (opcional)"
            value={model.draftValues.telefone}
            onChangeText={(value) => update('telefone', value)}
            keyboardType="phone-pad"
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'telefone')}
          />
          <FormField
            label="Documento (opcional)"
            value={model.draftValues.documento}
            onChangeText={(value) => update('documento', value)}
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'documento')}
          />
          <FormField
            label="Observações (opcional)"
            value={model.draftValues.observacoes}
            onChangeText={(value) => update('observacoes', value)}
            textarea
            disabled={lifecycleState.submitting}
            error={fieldError(failure?.fieldErrors ?? {}, 'observacoes')}
          />
        </SectionCard>
        <SectionCard title="Estrutura preservada">
          <FormField label="Perfil" value={PROFILE_LABELS[user.perfil]} disabled />
          <FormField label="Versão autoritativa" value={String(model.baselineVersion)} disabled />
        </SectionCard>
        {Object.entries(model.fieldConflicts).map(([field, conflict]) => (
          <SectionCard key={field} title={`Conflito em ${field}`}>
            <Text style={styles.muted}>Servidor: {conflict?.serverValue ?? ''}</Text>
            <Text style={styles.muted}>Operador: {conflict?.operatorValue ?? ''}</Text>
            <HttpButton
              title="Usar valor do servidor"
              variant="secondary"
              onPress={() => setModel((currentModel) => currentModel === null
                ? currentModel
                : resolveAdministrativeUserEditConflict(
                    currentModel,
                    field as AdministrativeUserEditField,
                    'server',
                  ))}
            />
            <HttpButton
              title="Manter valor do operador"
              variant="secondary"
              onPress={() => setModel((currentModel) => currentModel === null
                ? currentModel
                : resolveAdministrativeUserEditConflict(
                    currentModel,
                    field as AdministrativeUserEditField,
                    'operator',
                  ))}
            />
          </SectionCard>
        ))}
        <CommandFeedback failure={failure} />
        <ReviewGate
          failure={failure}
          onReview={() => {
            if (failure?.reloadRequired) {
              void reload();
              return;
            }
            lifecycle.restartIntent();
            setFailure(null);
          }}
        />
      </ScrollView>
      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={() => { void submit(); }}
        submitLabel={failure?.retrySameIntent
          ? 'Tentar novamente com a mesma intenção'
          : 'Salvar alterações'}
        loading={lifecycleState.submitting}
        disabled={
          !lifecycleState.active ||
          failure?.reviewRequired === true ||
          Object.keys(model.fieldConflicts).length > 0
        }
      />
    </View>
  );
}

export function HttpAdministrativeUserStatusScreen({ route, navigation }: any) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).userDetail) {
    return (
      <CommandAccessGuard title="Alterar status">
        <View />
      </CommandAccessGuard>
    );
  }
  const id = userIdFromRoute(route);
  if (!isCanonicalUuidV4(id)) {
    return <InvalidTarget title="Alterar status" navigation={navigation} message="O ID do Usuário é inválido." />;
  }
  return <HttpAdministrativeUserStatusAdminSurface id={id} navigation={navigation} />;
}

function HttpAdministrativeUserStatusAdminSurface({ id, navigation }: Readonly<{
  id: string;
  navigation: any;
}>) {
  const { runtime } = useHttpSession();
  const { current } = useCommandTarget(id);
  const { lifecycle, snapshot: lifecycleState } = useCommandLifecycle();
  const [draft, setDraft] = React.useState<AdministrativeUserStatusDraft>(EMPTY_STATUS_DRAFT);
  const [failure, setFailure] = React.useState<AdministrativeUserCommandFailure | null>(null);
  const [pendingReconciliation, setPendingReconciliation] = React.useState<
    Extract<AdministrativeUserCommandResult, {
      kind: 'mutation_confirmed_reconciliation_failed';
    }> | null
  >(null);
  const [targetUser, setTargetUser] = React.useState<AdministrativeUserDetail | null>(null);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const lastReset = React.useRef(lifecycleState.resetVersion);

  React.useEffect(() => {
    if (lastReset.current === lifecycleState.resetVersion) return;
    lastReset.current = lifecycleState.resetVersion;
    setDraft(EMPTY_STATUS_DRAFT);
    setFailure(null);
    setPendingReconciliation(null);
    setConfirmVisible(false);
  }, [lifecycleState.resetVersion]);

  React.useEffect(() => {
    if (current.user !== null) setTargetUser(current.user);
  }, [current.user]);

  if (current.loading) return <TargetLoading title="Alterar status" navigation={navigation} />;
  const availableUser = current.user ?? (
    pendingReconciliation === null ? null : targetUser
  );
  if (current.failure || availableUser === null) {
    return <InvalidTarget title="Alterar status" navigation={navigation} message={current.failure?.message ?? 'O Usuário não foi encontrado.'} />;
  }
  const user = availableUser;
  if (user.status === 'pendente') {
    return <InvalidTarget title="Alterar status" navigation={navigation} message="Usuário pendente não participa desta ação." />;
  }
  const targetStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
  const updateDraft = (next: AdministrativeUserStatusDraft) => {
    if (lifecycleState.submitting || failure?.reloadRequired) return;
    lifecycle.restartIntent();
    setFailure(null);
    setDraft(Object.freeze(next));
  };
  const submit = async () => {
    setConfirmVisible(false);
    const outcome = await lifecycle.run((intentId, context) => (
      runtime.administrativeUserCommands.changeStatus(intentId, user, draft, context)
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) {
      setFailure(classifyAdministrativeUserCommandFailure('status', outcome.error));
      return;
    }
    if (outcome.value.kind === 'mutation_confirmed_reconciliation_failed') {
      setPendingReconciliation(outcome.value);
      setFailure(confirmedReconciliationFailure());
      return;
    }
    navigation.goBack();
  };
  const reload = async () => {
    const expected = pendingReconciliation;
    const outcome = await lifecycle.runRead((context) => (
      runtime.administrativeUserCommands.reloadAdministrativeUser(
        context,
        expected?.expectedUserId ?? user.id,
        expected?.minimumVersion ?? failure?.currentVersion ?? user.versao,
      )
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) return;
    setPendingReconciliation(null);
    setFailure(null);
  };

  return (
    <View style={styles.container}>
      <HttpDetailHeader title="Alterar status" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <InfoBox message={`A única transição disponível é ${STATUS_LABELS[user.status]} → ${STATUS_LABELS[targetStatus]}. Sessões afetadas seguem a revogação aplicada pelo servidor.`} />
        <SectionCard title="Motivo administrativo">
          <SegmentedChips<AdministrativeReasonCode>
            options={[...REASON_OPTIONS]}
            value={draft.motivo}
            onChange={(motivo) => updateDraft({ ...draft, motivo })}
          />
          {fieldError(failure?.fieldErrors ?? {}, 'motivo') ? (
            <Text style={styles.fieldError}>{fieldError(failure?.fieldErrors ?? {}, 'motivo')}</Text>
          ) : null}
          {draft.motivo === 'outro' ? (
            <FormField
              label="Detalhe do motivo"
              required
              value={draft.motivo_detalhe ?? ''}
              onChangeText={(motivo_detalhe) => updateDraft({
                ...draft,
                motivo_detalhe,
              })}
              textarea
              disabled={lifecycleState.submitting}
              error={fieldError(failure?.fieldErrors ?? {}, 'motivo_detalhe')}
            />
          ) : null}
        </SectionCard>
        <CommandFeedback failure={failure} />
        <ReviewGate
          failure={failure}
          onReview={() => {
            if (failure?.reloadRequired) {
              void reload();
              return;
            }
            lifecycle.restartIntent();
            setFailure(null);
          }}
        />
        <HttpButton
          title={failure?.retrySameIntent
            ? 'Confirmar retry da mesma intenção'
            : `${targetStatus === 'inativo' ? 'Inativar' : 'Reativar'} Usuário`}
          variant={targetStatus === 'inativo' ? 'danger' : 'primary'}
          disabled={
            !lifecycleState.active ||
            lifecycleState.submitting ||
            failure?.reviewRequired === true
          }
          onPress={() => setConfirmVisible(true)}
        />
      </ScrollView>
      <ConfirmDialog
        visible={confirmVisible}
        title={`${targetStatus === 'inativo' ? 'Inativar' : 'Reativar'} Usuário`}
        message={`Confirma a alteração de ${user.nome} para ${STATUS_LABELS[targetStatus]}? Esta é uma transição explícita e auditável.`}
        type={targetStatus === 'inativo' ? 'danger' : 'warning'}
        confirmText="Confirmar alteração"
        onConfirm={() => { void submit(); }}
        onCancel={() => setConfirmVisible(false)}
        loading={lifecycleState.submitting}
      />
    </View>
  );
}

export function HttpAdministrativeUserInvitationScreen({ route, navigation }: any) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).userDetail) {
    return (
      <CommandAccessGuard title="Reemitir convite">
        <View />
      </CommandAccessGuard>
    );
  }
  const id = userIdFromRoute(route);
  if (!isCanonicalUuidV4(id)) {
    return <InvalidTarget title="Reemitir convite" navigation={navigation} message="O ID do Usuário é inválido." />;
  }
  return <HttpAdministrativeUserInvitationAdminSurface id={id} navigation={navigation} />;
}

function HttpAdministrativeUserInvitationAdminSurface({ id, navigation }: Readonly<{
  id: string;
  navigation: any;
}>) {
  const { runtime } = useHttpSession();
  const { current } = useCommandTarget(id);
  const { lifecycle, snapshot: lifecycleState } = useCommandLifecycle();
  const [failure, setFailure] = React.useState<AdministrativeUserCommandFailure | null>(null);
  const [pendingReconciliation, setPendingReconciliation] = React.useState<
    Extract<AdministrativeUserCommandResult, {
      kind: 'mutation_confirmed_reconciliation_failed';
    }> | null
  >(null);
  const [targetUser, setTargetUser] = React.useState<AdministrativeUserDetail | null>(null);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const lastReset = React.useRef(lifecycleState.resetVersion);

  React.useEffect(() => {
    if (lastReset.current === lifecycleState.resetVersion) return;
    lastReset.current = lifecycleState.resetVersion;
    setFailure(null);
    setPendingReconciliation(null);
    setConfirmVisible(false);
  }, [lifecycleState.resetVersion]);

  React.useEffect(() => {
    if (current.user !== null) setTargetUser(current.user);
  }, [current.user]);

  if (current.loading) return <TargetLoading title="Reemitir convite" navigation={navigation} />;
  const availableUser = current.user ?? (
    pendingReconciliation === null ? null : targetUser
  );
  if (current.failure || availableUser === null) {
    return <InvalidTarget title="Reemitir convite" navigation={navigation} message={current.failure?.message ?? 'O Usuário não foi encontrado.'} />;
  }
  const user = availableUser;
  if (user.status !== 'pendente') {
    return <InvalidTarget title="Reemitir convite" navigation={navigation} message="Somente Usuário pendente pode receber novo convite." />;
  }
  const submit = async () => {
    setConfirmVisible(false);
    const outcome = await lifecycle.run((intentId, context) => (
      runtime.administrativeUserCommands.issueInvitation(intentId, user, context)
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) {
      setFailure(classifyAdministrativeUserCommandFailure('invitation', outcome.error));
      return;
    }
    if (outcome.value.kind === 'mutation_confirmed_reconciliation_failed') {
      setPendingReconciliation(outcome.value);
      setFailure(confirmedReconciliationFailure());
      return;
    }
    navigation.goBack();
  };
  const reload = async () => {
    const expected = pendingReconciliation;
    const outcome = await lifecycle.runRead((context) => (
      runtime.administrativeUserCommands.reloadAdministrativeUser(
        context,
        expected?.expectedUserId ?? user.id,
        expected?.minimumVersion ?? failure?.currentVersion ?? user.versao,
      )
    ));
    if (!outcome.current || !outcome.leader) return;
    if (outcome.ok === false) return;
    setPendingReconciliation(null);
    setFailure(null);
  };

  return (
    <View style={styles.container}>
      <HttpDetailHeader title="Reemitir convite" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.content}>
            <InfoBox
              title="Ativação do Usuário"
              message="O modo é fixo em ativar_usuario. A emissão substitui o convite pendente conforme o servidor."
            />
        <SectionCard title="Destinatário">
          <Text style={styles.title}>{user.nome}</Text>
          <Text style={styles.muted}>{user.email}</Text>
          <Text style={styles.muted}>Status atual: Pendente</Text>
        </SectionCard>
        <CommandFeedback failure={failure} />
        <ReviewGate
          failure={failure}
          onReview={() => {
            if (failure?.reloadRequired) {
              void reload();
              return;
            }
            lifecycle.restartIntent();
            setFailure(null);
          }}
        />
        <HttpButton
          title={failure?.retrySameIntent
            ? 'Confirmar retry da mesma intenção'
            : 'Reemitir convite'}
          disabled={
            !lifecycleState.active ||
            lifecycleState.submitting ||
            failure?.reviewRequired === true
          }
          onPress={() => setConfirmVisible(true)}
        />
      </ScrollView>
      <ConfirmDialog
        visible={confirmVisible}
        title="Reemitir convite"
        message={`Confirma a reemissão para ${user.email}? Um replay idempotente não representa um novo convite.`}
        type="warning"
        confirmText="Confirmar reemissão"
        onConfirm={() => { void submit(); }}
        onCancel={() => setConfirmVisible(false)}
        loading={lifecycleState.submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
  },
  muted: {
    color: colors.muted,
    fontSize: typography.fontBody,
    lineHeight: 22,
  },
  fieldError: {
    color: colors.error,
    fontSize: typography.fontSmall,
    marginTop: spacing.sm,
  },
});
