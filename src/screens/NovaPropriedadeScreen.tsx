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
import { podeCriarProdutor } from '../utils/acessoControle';
import {
  buildCadastroFazendaPayload,
  buildCadastroTitularOptionsFromUsers,
  validateCadastroFazendaScope,
} from '../utils/fazendaCadastroCompat';
import {
  listarMunicipios,
  listarUfsParaCadastro,
} from '../utils/filtroTerritorial';
import { getUsuarioNome, getUsuarioStatusInfo } from '../utils/usuarioAdminCompat';

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

export default function NovaPropriedadeScreen({ navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const { recarregarOpcoes } = useFiltros();
  const formValidation = useFormValidationFocus(PROPRIEDADE_FORM_ERROR_ORDER);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [titulares, setTitulares] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [propriedadesReferencia, setPropriedadesReferencia] = useState<any[]>([]);
  const [titularSelecionadoId, setTitularSelecionadoId] = useState('');
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState({
    propriedade_nome: '',
    area_total: '',
    cultura_principal: '',
    uf_sigla: '',
    municipio_id: '',
    status: 'ativo',
  });

  const titularesElegiveis = useMemo(
    () => titulares.filter((titular) => (
      ['ativo', 'pendente'].includes(titular.status) && titular.usuario_id
    )),
    [titulares],
  );
  const titularSelecionado = useMemo(
    () => titularesElegiveis.find((titular) => titular.id === titularSelecionadoId),
    [titularSelecionadoId, titularesElegiveis],
  );
  const colaboradores = useMemo(
    () => usuarios
      .filter((usuario) => (
        usuario?.perfil === 'colaborador' && getUsuarioStatusInfo(usuario).key === 'ativo'
      ))
      .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b), 'pt-BR')),
    [usuarios],
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

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      if (!podeCriarProdutor(user)) {
        if (ativo) setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [propriedades, usuariosCadastrados] = await Promise.all([
          Produtor.list(),
          User.list(),
        ]);
        if (!ativo) return;
        const opcoesTitulares = buildCadastroTitularOptionsFromUsers(
          usuariosCadastrados,
          propriedades,
        );
        setTitulares(opcoesTitulares);
        setUsuarios(usuariosCadastrados);
        setPropriedadesReferencia(propriedades);

        const ufsDisponiveis = listarUfsParaCadastro(propriedades);
        if (ufsDisponiveis.length === 1) {
          setForm((atual) => ({ ...atual, uf_sigla: ufsDisponiveis[0].sigla }));
        }
      } catch (error) {
        console.error(error);
        toast.showError('Não foi possível carregar os dados necessários ao cadastro');
      } finally {
        if (ativo) setLoading(false);
      }
    };
    carregar();
    return () => { ativo = false; };
  }, [user?.id, user?.perfil]);

  const handleChange = (campo: string, valor: string) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    if (errors[campo]) setErrors((atual) => ({ ...atual, [campo]: null }));
  };

  const handleUfChange = (uf: string) => {
    setForm((atual) => ({ ...atual, uf_sigla: uf, municipio_id: '' }));
    setErrors((atual) => ({ ...atual, uf: null, municipio: null }));
  };

  const toggleColaborador = (usuarioId: string) => {
    setColaboradorIds((atuais) => (
      atuais.includes(usuarioId)
        ? atuais.filter((id) => id !== usuarioId)
        : [...atuais, usuarioId]
    ));
  };

  const buildPayload = () => buildCadastroFazendaPayload({
    mode: 'existente',
    titularId: titularSelecionadoId,
    fazendaNome: form.propriedade_nome,
    areaTotal: form.area_total,
    culturaAtual: form.cultura_principal,
    municipioId: municipioSelecionado?.id,
    municipioNome: municipioSelecionado?.nome,
    ufId: ufSelecionada?.id || municipioSelecionado?.ufId,
    ufSigla: form.uf_sigla,
    status: form.status,
    titulares: titularesElegiveis,
  });

  const validateForm = () => {
    const nextErrors: any = {};
    if (!podeCriarProdutor(user)) nextErrors.escopo = 'Somente Administradores podem cadastrar Propriedades.';
    if (!validarObrigatorio(form.propriedade_nome)) nextErrors.propriedade = 'Informe o nome da Propriedade.';
    if (!titularSelecionado) nextErrors.titular = 'Selecione um Produtor ativo ou pendente como Titular.';
    if (!ufSelecionada) nextErrors.uf = 'Selecione uma UF válida.';
    if (!municipioSelecionado) nextErrors.municipio = 'Selecione um município válido.';
    if (form.area_total.trim() && !validarArea(form.area_total)) {
      nextErrors.area_total = 'Informe uma área válida ou deixe o campo vazio.';
    }

    const scope = validateCadastroFazendaScope(user, buildPayload());
    if (!scope.ok) nextErrors.escopo = 'Somente Administradores podem cadastrar Propriedades.';

    setErrors(nextErrors);
    formValidation.focusFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning('Revise os campos obrigatórios do cadastro');
      return;
    }

    try {
      setSaving(true);
      await Produtor.createWithLinks(buildPayload(), {
        titularUsuarioId: titularSelecionado.usuario_id,
        colaboradorIds,
      });
      await recarregarOpcoes();
      toast.showSuccess('Propriedade e vínculos cadastrados localmente!');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      toast.showError('Não foi possível salvar a Propriedade e seus vínculos. Nenhuma alteração parcial foi mantida.');
    } finally {
      setSaving(false);
    }
  };

  if (!podeCriarProdutor(user)) {
    return (
      <View style={styles.container}>
        <Header title="Nova Propriedade" showBack />
        <View style={styles.deniedContent}>
          <InfoBox
            variant="warning"
            title="Cadastro administrativo"
            message="Somente Administradores podem criar Propriedades e definir vínculos. Colaboradores atuam apenas nas Propriedades já atribuídas diretamente."
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
      <Header title="Nova Propriedade" showBack />
      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <InfoBox
          title="Cadastro local v2"
          message="A Propriedade, o vínculo do Titular e os vínculos dos Colaboradores serão salvos juntos neste aparelho. Município e UF identificam a localização, mas não concedem acesso."
        />

        <View ref={formValidation.registerField('escopo')} collapsable={false}>
          {errors.escopo ? <InfoBox variant="error" message={errors.escopo} /> : null}
        </View>

        <SectionCard
          title="Propriedade"
          subtitle="Identificação cadastral da unidade operacional."
        >
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

        <SectionCard
          title="Titular"
          subtitle="Uma Propriedade possui um Produtor Titular principal. O mesmo Produtor pode possuir várias Propriedades."
        >
          <View ref={formValidation.registerField('titular')} collapsable={false}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.helperText}>Carregando Produtores...</Text>
              </View>
            ) : (
              <SelectField
                label="Produtor Titular"
                required
                value={titularSelecionadoId}
                options={titularesElegiveis.map((titular) => ({
                  value: titular.id,
                  label: titular.nome,
                  description: titular.fazendas_nomes?.length
                    ? `${titular.fazendas_nomes.length} Propriedade(s) já cadastrada(s)`
                    : titular.status === 'pendente'
                      ? 'Pendente • será ativado ao criar a primeira Propriedade'
                      : 'Produtor ativo sem Propriedade',
                }))}
                onChange={(value) => {
                  setTitularSelecionadoId(value);
                  setErrors((atual) => ({ ...atual, titular: null }));
                }}
                placeholder="Selecione um Produtor"
                error={errors.titular}
                helperText="Cadastre primeiro o Produtor como Pendente. Ao criar sua primeira Propriedade, ele será ativado na mesma operação."
              />
            )}
          </View>
        </SectionCard>

        <SectionCard
          title="Localização"
          subtitle="Selecione Município e UF oficiais já disponíveis no conjunto local."
        >
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
              placeholder={form.uf_sigla ? 'Selecione o município' : 'Selecione primeiro a UF'}
              error={errors.municipio}
              disabled={!form.uf_sigla}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Colaboradores vinculados"
          subtitle="Opcional. Cada seleção cria um vínculo direto ativo com esta Propriedade."
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
            message="Uma nova Propriedade no mesmo Município não será liberada automaticamente para outros Colaboradores."
            style={styles.inlineInfo}
          />
        </SectionCard>

        <SectionCard title="Status" subtitle="Situação cadastral inicial da Propriedade.">
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
        submitLabel="Salvar Propriedade"
        loading={saving}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md },
  deniedContent: { flex: 1, padding: spacing.screen, justifyContent: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  helperText: { color: colors.textLight, fontSize: typography.fontCaption, flex: 1 },
  label: { color: colors.text, fontSize: typography.fontBody, fontWeight: typography.weightSemibold, marginBottom: spacing.sm },
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
  userOptionTitle: { color: colors.text, fontSize: typography.fontBody, fontWeight: typography.weightSemibold },
  userOptionSubtitle: { color: colors.textLight, fontSize: typography.fontCaption, marginTop: 2 },
  inlineInfo: { marginTop: spacing.sm, marginBottom: 0 },
  footerSpace: { height: spacing.xl * 2 },
});
