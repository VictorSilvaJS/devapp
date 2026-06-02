import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import RadioCardGroup from '../components/RadioCardGroup';
import SectionCard from '../components/SectionCard';
import SegmentedChips from '../components/SegmentedChips';
import { useToast } from '../components/Toast';
import { Produtor, User } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import theme from '../theme';
import {
  validarNome,
  validarArea,
  validarUF,
  validarObrigatorio
} from '../utils/validacoes';
import { podeCriarProdutor } from '../utils/acessoControle';
import {
  buildCadastroFazendaPayload,
  buildCadastroTitularOptions,
  validateCadastroFazendaScope
} from '../utils/fazendaCadastroCompat';
import type { CadastroTitularMode } from '../utils/fazendaCadastroCompat';
import {
  listarMicroregioesPorRegiao,
  listarRegioes,
  sugerirColaboradoresParaMicroregiao,
} from '../utils/territorioCompat';
import { getUsuarioNome } from '../utils/usuarioAdminCompat';

const getScopeErrorMessage = (reason?: string) => {
  switch (reason) {
    case 'perfil_sem_permissao':
      return 'Seu perfil não permite cadastrar propriedades.';
    case 'regiao_fora_escopo':
      return 'A região informada está fora do seu escopo.';
    case 'microregiao_fora_escopo':
      return 'Selecione uma microregião dentro do seu escopo.';
    default:
      return 'Não foi possível validar seu escopo de criação.';
  }
};

export default function NovoProdutorScreen({ navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loadingTitulares, setLoadingTitulares] = useState(true);
  const [titulares, setTitulares] = useState<any[]>([]);
  const [fazendasTerritorio, setFazendasTerritorio] = useState<any[]>([]);
  const [usuariosMock, setUsuariosMock] = useState<any[]>([]);
  const [titularMode, setTitularMode] = useState<CadastroTitularMode>('existente');
  const [titularSelecionadoId, setTitularSelecionadoId] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState({
    nome: '',
    fazenda: '',
    area_total: '',
    cultura_atual: '',
    cidade: '',
    estado: '',
    regiao: '',
    microregiao: '',
    status: 'ativo'
  });

  const microregioesPermitidas = user?.perfil === 'colaborador' ? (user.sub_regioes || []) : [];
  const regiaoAtual = user?.perfil === 'colaborador' ? (user.regiao || '') : form.regiao;

  const regioesTerritorio = useMemo(
    () => listarRegioes(fazendasTerritorio),
    [fazendasTerritorio]
  );

  const microregioesTerritorio = useMemo(
    () => (regiaoAtual ? listarMicroregioesPorRegiao(fazendasTerritorio, regiaoAtual) : []),
    [fazendasTerritorio, regiaoAtual]
  );

  const microregioesDisponiveis = useMemo(() => {
    if (user?.perfil !== 'colaborador') return microregioesTerritorio;

    if (microregioesPermitidas.length === 0) return [];

    const permitidas = new Set(microregioesPermitidas);
    const filtradas = microregioesTerritorio.filter((microregiao) => permitidas.has(microregiao.nome));

    if (filtradas.length > 0) return filtradas;

    return microregioesPermitidas.map((microregiao) => ({
      id: `microregiao-legada-${microregiao}`,
      nome: microregiao,
      regiao: regiaoAtual,
      regiao_id: `regiao-legada-${regiaoAtual || 'sem-regiao'}`,
    }));
  }, [microregioesPermitidas, microregioesTerritorio, regiaoAtual, user?.perfil]);

  const colaboradoresSugeridos = useMemo(
    () =>
      form.microregiao
        ? sugerirColaboradoresParaMicroregiao(
            usuariosMock,
            form.microregiao,
            regiaoAtual,
            fazendasTerritorio
          )
        : [],
    [fazendasTerritorio, form.microregiao, regiaoAtual, usuariosMock]
  );

  useEffect(() => {
    loadTitulares();
  }, []);

  useEffect(() => {
    if (user?.perfil === 'colaborador') {
      setForm(prev => ({
        ...prev,
        regiao: user.regiao || '',
        microregiao: microregioesPermitidas.includes(prev.microregiao) ? prev.microregiao : ''
      }));
    }
  }, [user?.perfil, user?.regiao, user?.sub_regioes]);

  const loadTitulares = async () => {
    try {
      setLoadingTitulares(true);
      const [fazendas, usuarios] = await Promise.all([
        Produtor.list(),
        User.list(),
      ]);
      const options = buildCadastroTitularOptions(fazendas);
      setTitulares(options);
      setFazendasTerritorio(fazendas as any[]);
      setUsuariosMock(usuarios as any[]);

      if (options.length === 0) {
        setTitularMode('novo');
        setTitularSelecionadoId('');
      } else {
        setTitularSelecionadoId(prev => prev || options[0].id);
      }
    } catch (error) {
      toast.showError('Não foi possível carregar produtores titulares');
      console.error(error);
    } finally {
      setLoadingTitulares(false);
    }
  };

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (errors[campo]) {
      setErrors(prev => ({ ...prev, [campo]: null }));
    }
  };

  const handleRegiaoSelect = (regiao: string) => {
    setForm(prev => ({
      ...prev,
      regiao,
      microregiao: prev.regiao === regiao ? prev.microregiao : '',
    }));
    setErrors(prev => ({ ...prev, regiao: null, microregiao: null }));
  };

  const handleTitularModeChange = (mode: CadastroTitularMode) => {
    setTitularMode(mode);
    setErrors(prev => ({ ...prev, nome: null, titular: null }));
  };

  const buildPayload = () =>
    buildCadastroFazendaPayload({
      mode: titularMode,
      titularId: titularSelecionadoId,
      produtorNome: form.nome,
      fazendaNome: form.fazenda,
      areaTotal: form.area_total,
      culturaAtual: form.cultura_atual,
      cidade: form.cidade,
      estado: form.estado,
      regiao: user?.perfil === 'colaborador' ? user.regiao : form.regiao,
      microregiao: form.microregiao,
      status: form.status,
      titulares,
    });

  const validateForm = () => {
    const newErrors: any = {};

    if (!podeCriarProdutor(user)) {
      newErrors.escopo = 'Seu perfil não permite cadastrar propriedades.';
    }

    if (titularMode === 'existente') {
      if (!titularSelecionadoId) {
        newErrors.titular = 'Selecione um produtor titular';
      }
    } else if (!validarNome(form.nome)) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!validarObrigatorio(form.fazenda)) {
      newErrors.fazenda = 'Propriedade é obrigatória';
    }

    if (!validarArea(form.area_total)) {
      newErrors.area_total = 'Informe uma área válida';
    }

    if (form.estado && !validarUF(form.estado)) {
      newErrors.estado = 'UF inválida (Ex: RS, SP)';
    }

    const regiaoFinal = user?.perfil === 'colaborador' ? user.regiao : form.regiao;
    if (!validarObrigatorio(regiaoFinal)) {
      newErrors.regiao = 'Região é obrigatória';
    }

    if (!validarObrigatorio(form.microregiao)) {
      newErrors.microregiao = 'Microregião é obrigatória';
    }

    const payload = buildPayload();
    const scopeResult = validateCadastroFazendaScope(user, payload);
    if (!scopeResult.ok) {
      newErrors.escopo = getScopeErrorMessage(scopeResult.reason);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning('Preencha todos os campos obrigatórios corretamente');
      return;
    }

    try {
      setSaving(true);
      const dataToSave = buildPayload();
      await Produtor.create(dataToSave);

      toast.showSuccess('Propriedade cadastrada com vínculo do produtor titular!');
      navigation.goBack();
    } catch (error) {
      toast.showError('Não foi possível cadastrar a propriedade. Tente novamente.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const renderTitularExistente = () => {
    if (loadingTitulares) {
      return (
        <View style={styles.loadingTitulares}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.helperText}>Carregando produtores titulares...</Text>
        </View>
      );
    }

    if (titulares.length === 0) {
      return (
        <Text style={styles.helperText}>
          Nenhum produtor titular encontrado. Cadastre um novo titular mínimo.
        </Text>
      );
    }

    return (
      <View style={styles.titularesList}>
        {titulares.map((titular) => {
          const selected = titularSelecionadoId === titular.id;
          return (
            <TouchableOpacity
              key={titular.id}
              style={[styles.titularOption, selected && styles.titularOptionSelected]}
              onPress={() => {
                setTitularSelecionadoId(titular.id);
                setErrors(prev => ({ ...prev, titular: null }));
              }}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'person-outline'}
                  size={20}
                  color={selected ? theme.colors.white : theme.colors.primary}
                />
              </View>
              <View style={styles.optionTextContent}>
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                  {titular.nome}
                </Text>
                <Text style={[styles.optionSubtitle, selected && styles.optionSubtitleSelected]} numberOfLines={1}>
                  {(titular.fazendas_nomes || []).join(', ') || 'Sem propriedades vinculadas'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Nova Propriedade" showBackButton />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InfoBox message="Cadastre a Propriedade e vincule um Titular responsável. Titular é o produtor vinculado à Propriedade no mock." />

        {errors.escopo && (
          <InfoBox variant="error" message={errors.escopo} />
        )}

        <SectionCard title="Dados da Propriedade" subtitle="Informe a identificação e a área total da unidade rural.">
          <FormField
            label="Nome da Propriedade"
            required
            value={form.fazenda}
            onChangeText={(text) => handleChange('fazenda', text)}
            placeholder="Nome da propriedade"
            error={errors.fazenda}
          />

          <FormField
            label="Área total (ha)"
            required
            value={form.area_total}
            onChangeText={(text) => handleChange('area_total', text)}
            placeholder="Ex: 500"
            keyboardType="numeric"
            error={errors.area_total}
          />
        </SectionCard>

        <SectionCard title="Titular da Propriedade" subtitle="Vincule a Propriedade a um produtor existente ou cadastre um titular mínimo apenas para o vínculo mockado.">
          <View style={styles.field}>
            <RadioCardGroup
              options={[
                {
                  value: 'existente',
                  label: 'Existente',
                  description: 'Selecionar um Titular/produtor já cadastrado.',
                  icon: 'people-outline',
                  disabled: titulares.length === 0,
                },
                {
                  value: 'novo',
                  label: 'Novo Titular',
                  description: 'Cadastrar um Titular mínimo para vínculo mockado, sem criar login real.',
                  icon: 'person-add-outline',
                },
              ]}
              value={titularMode}
              onChange={handleTitularModeChange}
            />
          </View>

          {titularMode === 'existente' ? (
            <>
              {renderTitularExistente()}
              {errors.titular && <Text style={styles.errorText}>{errors.titular}</Text>}
            </>
          ) : (
            <FormField
              label="Nome do Titular"
              required
              value={form.nome}
              onChangeText={(text) => handleChange('nome', text)}
              placeholder="Digite o nome completo"
              error={errors.nome}
            />
          )}
        </SectionCard>

        <SectionCard title="Dados produtivos" subtitle="Registre a cultura principal da Propriedade.">
          <FormField
            label="Cultura principal"
            value={form.cultura_atual}
            onChangeText={(text) => handleChange('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
          />
        </SectionCard>

        <SectionCard title="Localização e Região" subtitle="Defina cidade, UF, Região e Microregião preservando os campos textuais do mock.">
          <FormField
            label="Cidade"
            value={form.cidade}
            onChangeText={(text) => handleChange('cidade', text)}
            placeholder="Nome da cidade"
          />

          <FormField
            label="UF"
            value={form.estado}
            onChangeText={(text) => handleChange('estado', text.toUpperCase())}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            error={errors.estado}
          />

          {user?.perfil === 'colaborador' ? (
            <FormField
              label="Região"
              required
              value={user.regiao || ''}
              disabled
              placeholder="Região do colaborador"
              error={errors.regiao}
            />
          ) : regioesTerritorio.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.label}>Região <Text style={styles.required}>*</Text></Text>
              <SegmentedChips
                options={regioesTerritorio.map((regiao) => ({
                  value: regiao.nome,
                  label: regiao.nome,
                  icon: 'map-outline',
                }))}
                value={form.regiao}
                onChange={handleRegiaoSelect}
              />
              {errors.regiao && <Text style={styles.errorText}>{errors.regiao}</Text>}
            </View>
          ) : (
            <FormField
              label="Região"
              required
              value={form.regiao}
              onChangeText={(text) => handleChange('regiao', text)}
              placeholder="Ex: Sul, Goiás, Mato Grosso"
              error={errors.regiao}
            />
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Microregião <Text style={styles.required}>*</Text></Text>
            {microregioesDisponiveis.length > 0 ? (
              <SegmentedChips
                options={microregioesDisponiveis.map((microregiao) => ({
                  value: microregiao.nome,
                  label: microregiao.nome,
                  icon: 'location-outline',
                }))}
                value={form.microregiao}
                onChange={(value) => handleChange('microregiao', value)}
              />
            ) : user?.perfil === 'colaborador' ? (
              <Text style={styles.helperText}>Nenhuma microregião vinculada ao seu usuário.</Text>
            ) : regiaoAtual ? (
              <FormField
                value={form.microregiao}
                onChangeText={(text) => handleChange('microregiao', text)}
                placeholder="Ex: RS - Norte, Rio Verde, Sorriso"
              />
            ) : (
              <Text style={styles.helperText}>Selecione uma região para carregar as microregiões do mock.</Text>
            )}
            {errors.microregiao && <Text style={styles.errorText}>{errors.microregiao}</Text>}
          </View>

          {form.microregiao && (
            <View style={styles.suggestionBox}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.suggestionTitle}>Colaboradores sugeridos para a microregião</Text>
              </View>
              {colaboradoresSugeridos.length === 0 ? (
                <Text style={styles.helperText}>Nenhum colaborador sugerido no mock para esta microregião.</Text>
              ) : (
                colaboradoresSugeridos.slice(0, 5).map((colaborador) => (
                  <Text key={colaborador.id} style={styles.suggestionItem}>
                    {getUsuarioNome(colaborador)}
                  </Text>
                ))
              )}
              <Text style={styles.suggestionNote}>
                Sugestão visual/mockada. O cadastro continua salvando região e microregião textuais para compatibilidade.
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar"
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  titularesList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  titularOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.radius,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    gap: theme.spacing.sm,
  },
  titularOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  optionIcon: {
    width: 28,
    alignItems: 'center',
  },
  optionTextContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
  },
  optionTitleSelected: {
    color: theme.colors.white,
  },
  optionSubtitle: {
    fontSize: theme.typography.fontCaption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  optionSubtitleSelected: {
    color: theme.colors.whiteTranslucent,
  },
  loadingTitulares: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontCaption + 1,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  required: {
    color: theme.colors.error,
  },
  errorText: {
    fontSize: theme.typography.fontCaption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  suggestionBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.spacing.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  suggestionTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.fontCaption + 1,
    fontWeight: theme.typography.weightBold,
  },
  suggestionItem: {
    color: theme.colors.text,
    fontSize: theme.typography.fontCaption + 1,
    marginBottom: theme.spacing.xs,
  },
  suggestionNote: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontCaption,
    lineHeight: 17,
    marginTop: theme.spacing.sm,
  },
});
