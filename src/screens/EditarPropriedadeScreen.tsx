import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import MultiSelectField from '../components/MultiSelectField';
import SectionCard from '../components/SectionCard';
import SelectField from '../components/SelectField';
import SegmentedChips from '../components/SegmentedChips';
import { useToast } from '../components/Toast';
import { Produtor, User } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import { colors, spacing, typography } from '../theme';
import { validarArea, validarObrigatorio } from '../utils/validacoes';
import {
  getTitularIdFazenda,
  podeEditarCadastroPropriedade,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { buildEdicaoFazendaPayload } from '../utils/fazendaCadastroCompat';
import {
  getMunicipioIdPropriedade,
  getUfPropriedade,
  listarMunicipios,
  listarUfsParaCadastro,
} from '../utils/filtroTerritorial';
import {
  getUsuarioNome,
  getUsuarioProdutorId,
  getUsuarioStatusInfo,
} from '../utils/usuarioAdminCompat';

const PROPRIEDADE_FORM_ERROR_ORDER = [
  'escopo',
  'propriedade',
  'titular',
  'uf',
  'municipio',
  'area_total',
] as const;

const STATUS_PROPRIEDADE = [
  { value: 'ativo', label: 'Ativa', icon: 'checkmark-circle-outline' as const },
  { value: 'inativo', label: 'Inativa', icon: 'pause-circle-outline' as const },
];

const TIPOS_VINCULO_COLABORADOR = new Set([
  'colaborador',
  'responsavel',
  'colaborador_atribuido',
]);
const TIPO_VINCULO_PRODUTOR_AUTORIZADO = 'usuario_autorizado';

export default function EditarPropriedadeScreen({ route, navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const { recarregarOpcoes } = useFiltros();
  const formValidation = useFormValidationFocus(PROPRIEDADE_FORM_ERROR_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [propriedadeAtual, setPropriedadeAtual] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [propriedadesReferencia, setPropriedadesReferencia] = useState<any[]>([]);
  const [produtorAutorizadoIds, setProdutorAutorizadoIds] = useState<string[]>([]);
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState({
    propriedade_nome: '',
    area_total: '',
    cultura_principal: '',
    uf_sigla: '',
    municipio_id: '',
    status: 'ativo',
  });

  const colaboradores = useMemo(
    () => usuarios
      .filter((usuario) => (
        usuario?.perfil === 'colaborador' && getUsuarioStatusInfo(usuario).key === 'ativo'
      ))
      .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b), 'pt-BR')),
    [usuarios],
  );
  const produtoresAutorizaveis = useMemo(
    () => usuarios
      .filter((usuario) => (
        usuario?.perfil === 'produtor'
        && getUsuarioStatusInfo(usuario).key === 'ativo'
        && getUsuarioProdutorId(usuario) !== getTitularIdFazenda(propriedadeAtual)
      ))
      .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b), 'pt-BR')),
    [propriedadeAtual, usuarios],
  );
  const produtoresAutorizadosOptions = useMemo(
    () => produtoresAutorizaveis.map((produtor) => ({
      value: produtor.id,
      label: getUsuarioNome(produtor),
      description: produtor.email,
    })),
    [produtoresAutorizaveis],
  );
  const ufs = useMemo(
    () => listarUfsParaCadastro(propriedadesReferencia),
    [propriedadesReferencia],
  );
  const municipios = useMemo(
    () => listarMunicipios(propriedadesReferencia, form.uf_sigla || 'todas'),
    [form.uf_sigla, propriedadesReferencia],
  );
  const ufSelecionada = ufs.find((uf) => uf.sigla === form.uf_sigla);
  const municipioSelecionado = municipios.find((municipio) => municipio.id === form.municipio_id);
  const titularId = getTitularIdFazenda(propriedadeAtual);
  const titularNome = getFazendaUiInfo(propriedadeAtual).titularNome || 'Titular não informado';

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const propriedadeId = route?.params?.id;
      if (!propriedadeId) {
        toast.showError('ID da Propriedade não fornecido');
        navigation.goBack();
        return;
      }

      try {
        setLoading(true);
        setAccessDenied(false);
        const [propriedade, propriedades, usuariosCadastrados] = await Promise.all([
          Produtor.get(propriedadeId),
          Produtor.list(),
          User.list(),
        ]);
        if (!ativo) return;

        if (!podeEditarCadastroPropriedade(user, propriedade)) {
          setAccessDenied(true);
          setPropriedadeAtual(null);
          return;
        }

        setPropriedadeAtual(propriedade);
        setPropriedadesReferencia(propriedades);
        setUsuarios(usuariosCadastrados);
        setProdutorAutorizadoIds(
          usuariosCadastrados
            .filter((usuario) => (
              usuario?.perfil === 'produtor'
              && getUsuarioStatusInfo(usuario).key === 'ativo'
              && getUsuarioProdutorId(usuario) !== getTitularIdFazenda(propriedade)
            ))
            .filter((usuario) => (usuario.vinculos_propriedades || []).some((vinculo) => (
              vinculo?.propriedade_id === propriedadeId
              && vinculo?.status !== 'inativo'
              && vinculo?.tipo_vinculo === TIPO_VINCULO_PRODUTOR_AUTORIZADO
            )))
            .map((usuario) => usuario.id),
        );
        setColaboradorIds(
          usuariosCadastrados
            .filter((usuario) => usuario?.perfil === 'colaborador')
            .filter((usuario) => (usuario.vinculos_propriedades || []).some((vinculo) => (
              vinculo?.propriedade_id === propriedadeId
              && vinculo?.status !== 'inativo'
              && TIPOS_VINCULO_COLABORADOR.has(vinculo?.tipo_vinculo)
            )))
            .map((usuario) => usuario.id),
        );
        setForm({
          propriedade_nome: propriedade.propriedade_nome || propriedade.fazenda_nome || propriedade.fazenda || '',
          area_total: propriedade.area_total ? String(propriedade.area_total) : '',
          cultura_principal: propriedade.cultura_principal || propriedade.cultura_atual || '',
          uf_sigla: getUfPropriedade(propriedade),
          municipio_id: getMunicipioIdPropriedade(propriedade),
          status: propriedade.status === 'inativo' || propriedade.status === 'inativa'
            ? 'inativo'
            : 'ativo',
        });
      } catch (error) {
        console.error(error);
        toast.showError('Não foi possível carregar os dados da Propriedade');
        navigation.goBack();
      } finally {
        if (ativo) setLoading(false);
      }
    };

    carregar();
    return () => { ativo = false; };
  }, [route?.params?.id, user?.id, user?.perfil]);

  const handleChange = (campo: string, valor: string) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErrors((atual) => ({ ...atual, [campo]: null }));
  };

  const handleUfChange = (ufSigla: string) => {
    setForm((atual) => ({ ...atual, uf_sigla: ufSigla, municipio_id: '' }));
    setErrors((atual) => ({ ...atual, uf: null, municipio: null }));
  };

  const toggleColaborador = (usuarioId: string) => {
    setColaboradorIds((atuais) => (
      atuais.includes(usuarioId)
        ? atuais.filter((id) => id !== usuarioId)
        : [...atuais, usuarioId]
    ));
  };

  const buildPayload = () => buildEdicaoFazendaPayload({
    propriedadeAtual,
    propriedadeNome: form.propriedade_nome,
    areaTotal: form.area_total,
    culturaPrincipal: form.cultura_principal,
    municipioId: municipioSelecionado?.id,
    municipioNome: municipioSelecionado?.nome,
    ufId: ufSelecionada?.id || municipioSelecionado?.ufId,
    ufSigla: form.uf_sigla,
    status: form.status,
  });

  const validateForm = () => {
    const nextErrors: any = {};
    if (!podeEditarCadastroPropriedade(user, propriedadeAtual)) {
      nextErrors.escopo = 'Somente Administradores podem editar o cadastro da Propriedade.';
    }
    if (!validarObrigatorio(form.propriedade_nome)) {
      nextErrors.propriedade = 'Informe o nome da Propriedade.';
    }
    if (!titularId) nextErrors.titular = 'A Propriedade precisa manter um Titular válido.';
    if (!ufSelecionada) nextErrors.uf = 'Selecione uma UF válida.';
    if (!municipioSelecionado) nextErrors.municipio = 'Selecione um Município válido.';
    if (form.area_total.trim() && !validarArea(form.area_total)) {
      nextErrors.area_total = 'Informe uma área válida ou deixe o campo vazio.';
    }

    setErrors(nextErrors);
    formValidation.focusFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning('Revise os campos obrigatórios da edição');
      return;
    }

    try {
      setSaving(true);
      await Produtor.updateWithLinks(route.params.id, buildPayload(), {
        produtorAutorizadoIds,
        colaboradorIds,
      });
      await recarregarOpcoes();
      toast.showSuccess('Propriedade e vínculos atualizados localmente!');
      navigation.goBack();
    } catch (error: any) {
      console.error(error);
      toast.showError(
        error?.message
        || 'Não foi possível atualizar a Propriedade. Nenhuma alteração parcial foi mantida.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Propriedade" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied || !propriedadeAtual) {
    return (
      <View style={styles.container}>
        <Header title="Editar Propriedade" showBack />
        <View style={styles.deniedContent}>
          <InfoBox
            variant="warning"
            title="Edição administrativa"
            message="Somente Administradores podem alterar o cadastro e os vínculos diretos de uma Propriedade."
          />
        </View>
        <FormFooter
          showCancel={false}
          onSubmit={() => navigation.goBack()}
          submitLabel="Voltar"
          submitIcon="arrow-back-outline"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Editar Propriedade" showBack />
      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <InfoBox
          title="Edição local v2"
          message="Os dados canônicos e os vínculos de Produtores autorizados e Colaboradores serão atualizados juntos. Município e UF identificam a localização, mas não concedem acesso."
        />

        <View ref={formValidation.registerField('escopo')} collapsable={false}>
          {errors.escopo ? <InfoBox variant="error" message={errors.escopo} /> : null}
        </View>

        <SectionCard title="Titular" subtitle="O Titular atual é preservado nesta edição cadastral.">
          <View ref={formValidation.registerField('titular')} collapsable={false}>
            <SelectField
              label="Produtor Titular"
              required
              value={titularId}
              options={[{
                value: titularId,
                label: titularNome,
                description: 'Titular principal atual',
              }]}
              onChange={() => undefined}
              disabled
              error={errors.titular}
              helperText="A troca de Titular exige um fluxo transacional e auditado próprio."
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Produtores autorizados"
          subtitle="Vincule ou desvincule usuários Produtores sem alterar o Titular atual."
        >
          <MultiSelectField
            label="Usuários Produtores com acesso"
            values={produtorAutorizadoIds}
            options={produtoresAutorizadosOptions}
            onChange={setProdutorAutorizadoIds}
            placeholder="Nenhum Produtor autorizado"
            searchPlaceholder="Buscar Produtor por nome ou e-mail..."
            emptyText="Nenhum outro Produtor ativo disponível."
            helperText="Desmarcar um usuário inativará o vínculo dele com esta Propriedade ao salvar."
            disabled={produtoresAutorizadosOptions.length === 0}
          />
          <InfoBox
            message="O Titular não aparece nesta seleção. Remover o último acesso de um Produtor ativo será bloqueado; vincule outra Propriedade ou inative o usuário antes."
            style={styles.inlineInfo}
          />
        </SectionCard>

        <SectionCard title="Propriedade" subtitle="Atualize a identificação cadastral da unidade operacional.">
          <View ref={formValidation.registerField('propriedade')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('propriedade')}
              label="Nome da Propriedade"
              required
              value={form.propriedade_nome}
              onChangeText={(value) => {
                handleChange('propriedade_nome', value);
                setErrors((atual) => ({ ...atual, propriedade: null }));
              }}
              placeholder="Nome da propriedade"
              error={errors.propriedade}
            />
          </View>
          <View ref={formValidation.registerField('area_total')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('area_total')}
              label="Área cadastral em hectares (opcional)"
              value={form.area_total}
              onChangeText={(value) => handleChange('area_total', value)}
              placeholder="Ex: 500"
              keyboardType="numeric"
              error={errors.area_total}
              helperText="A área cadastrada pode ser diferente da soma das áreas mapeadas dos Talhões."
            />
          </View>
          <FormField
            label="Cultura principal (opcional)"
            value={form.cultura_principal}
            onChangeText={(value) => handleChange('cultura_principal', value)}
            placeholder="Ex: Soja"
          />
        </SectionCard>

        <SectionCard title="Localização" subtitle="Selecione Município e UF oficiais disponíveis no conjunto local.">
          <View ref={formValidation.registerField('uf')} collapsable={false}>
            <SelectField
              label="UF"
              required
              value={form.uf_sigla}
              options={ufs.map((uf) => ({ value: uf.sigla, label: uf.sigla }))}
              onChange={handleUfChange}
              placeholder="Selecione a UF"
              error={errors.uf}
            />
          </View>
          <View ref={formValidation.registerField('municipio')} collapsable={false}>
            <SelectField
              label="Município"
              required
              value={form.municipio_id}
              options={municipios.map((municipio) => ({
                value: municipio.id,
                label: municipio.nome,
                description: `${municipio.uf} • IBGE ${municipio.id}`,
              }))}
              onChange={(value) => {
                handleChange('municipio_id', value);
                setErrors((atual) => ({ ...atual, municipio: null }));
              }}
              placeholder={form.uf_sigla ? 'Selecione o Município' : 'Selecione primeiro a UF'}
              error={errors.municipio}
              disabled={!form.uf_sigla}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Colaboradores vinculados"
          subtitle="A seleção representa os vínculos diretos ativos desta Propriedade."
        >
          {colaboradores.length === 0 ? (
            <Text style={styles.helperText}>Nenhum Colaborador ativo disponível.</Text>
          ) : colaboradores.map((colaborador) => {
            const selected = colaboradorIds.includes(colaborador.id);
            return (
              <TouchableOpacity
                key={colaborador.id}
                style={[styles.userOption, selected && styles.userOptionSelected]}
                onPress={() => toggleColaborador(colaborador.id)}
                activeOpacity={0.78}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Ionicons
                  name={selected ? 'checkbox-outline' : 'square-outline'}
                  size={22}
                  color={selected ? colors.primary : colors.muted}
                />
                <View style={styles.userOptionText}>
                  <Text style={styles.userOptionTitle}>{getUsuarioNome(colaborador)}</Text>
                  <Text style={styles.userOptionSubtitle}>{colaborador.email}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <InfoBox
            message="Remover o último vínculo de um Colaborador ativo será bloqueado. Vincule outra Propriedade ou inative o usuário antes."
            style={styles.inlineInfo}
          />
        </SectionCard>

        <SectionCard title="Status" subtitle="Situação cadastral da Propriedade.">
          <Text style={styles.label}>Status <Text style={styles.required}>*</Text></Text>
          <SegmentedChips
            options={STATUS_PROPRIEDADE}
            value={form.status}
            onChange={(value) => handleChange('status', value)}
          />
        </SectionCard>

        <View style={styles.footerSpace} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar alterações"
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screen,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.fontBody,
  },
  deniedContent: { flex: 1, padding: spacing.screen, justifyContent: 'center' },
  helperText: { color: colors.textLight, fontSize: typography.fontCaption, flex: 1 },
  label: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.sm,
  },
  required: { color: colors.error },
  userOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  userOptionSelected: { borderColor: colors.primary, backgroundColor: colors.borderLight },
  userOptionText: { flex: 1 },
  userOptionTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
  userOptionSubtitle: { color: colors.textLight, fontSize: typography.fontCaption, marginTop: 2 },
  inlineInfo: { marginTop: spacing.sm, marginBottom: 0 },
  footerSpace: { height: spacing.xl * 2 },
});
