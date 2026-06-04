import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator
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
import { buildFazendaUpdatePayload } from '../api/produtorCompat';
import { useAuth } from '../auth/AuthContext';
import theme from '../theme';
import { 
  validarArea, 
  validarUF, 
  validarObrigatorio
} from '../utils/validacoes';
import { getTitularIdFazenda, podeEditarProdutor } from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { getUsuarioNome, getUsuarioProdutorId } from '../utils/usuarioAdminCompat';

const STATUS_PROPRIEDADE = [
  { value: 'ativo', label: 'Ativo', icon: 'checkmark-circle-outline' as const },
  { value: 'pendente', label: 'Pendente', icon: 'time-outline' as const },
  { value: 'inativo', label: 'Inativo', icon: 'pause-circle-outline' as const },
];

export default function EditarPropriedadeScreen({ route, navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtorAtual, setProdutorAtual] = useState(null);
  const [usuariosMock, setUsuariosMock] = useState<any[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState({
    fazenda_nome: '',
    area_total: '',
    documento: '',
    cultura_atual: '',
    cidade: '',
    estado: '',
    regiao: '',
    microregiao: '',
    colaborador_responsavel_id: '',
    colaborador_responsavel: '',
    status: 'ativo',
  });

  const produtoresUsuarios = useMemo(
    () => usuariosMock
      .filter((usuario) => usuario?.perfil === 'produtor' && getUsuarioProdutorId(usuario))
      .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b))),
    [usuariosMock]
  );

  const colaboradores = useMemo(
    () => usuariosMock
      .filter((usuario) => usuario?.perfil === 'colaborador')
      .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b))),
    [usuariosMock]
  );

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Limpa erro do campo quando o usuário começa a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!validarObrigatorio(form.fazenda_nome)) {
      newErrors.fazenda_nome = 'Propriedade é obrigatória';
    }
    if (!validarArea(form.area_total)) {
      newErrors.area_total = 'Informe uma área válida';
    }
    if (form.estado && !validarUF(form.estado)) {
      newErrors.estado = 'UF inválida (Ex: RS, SP)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const loadProdutor = async () => {
      const id = route?.params?.id;
      if (!id) {
        toast.showError('ID da propriedade não fornecido');
        navigation.goBack();
        return;
      }

      try {
        setLoading(true);
        setAccessDenied(false);
        const [produtor, usuarios] = await Promise.all([
          Produtor.get(id),
          User.list(),
        ]);

        if (!podeEditarProdutor(user, produtor)) {
          setProdutorAtual(null);
          setAccessDenied(true);
          toast.showWarning('Você não tem permissão para editar esta propriedade.');
          return;
        }

        setProdutorAtual(produtor);
        setUsuariosMock(usuarios);
        const fazendaInfo = getFazendaUiInfo(produtor);
        setForm({
          fazenda_nome: fazendaInfo.fazendaNome || '',
          area_total: String(produtor.area_total || ''),
          documento: produtor.documento || '',
          cultura_atual: produtor.cultura_atual || '',
          cidade: produtor.cidade || '',
          estado: produtor.estado || '',
          regiao: produtor.regiao || '',
          microregiao: produtor.microregiao || '',
          colaborador_responsavel_id: produtor.colaborador_responsavel_id || '',
          colaborador_responsavel: produtor.colaborador_responsavel || '',
          status: produtor.status || 'ativo',
        });
      } catch (error) {
        toast.showError('Não foi possível carregar os dados da propriedade');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadProdutor();
  }, [route?.params?.id, user]);

  const handleSave = async () => {
    if (!podeEditarProdutor(user, produtorAtual)) {
      toast.showWarning('Você não tem permissão para editar esta propriedade.');
      return;
    }

    if (!validateForm()) {
      toast.showWarning('Preencha todos os campos obrigatórios corretamente');
      return;
    }

    try {
      setSaving(true);
      const payload = buildFazendaUpdatePayload(produtorAtual, form);
      await Produtor.update(route.params.id, payload);
      
      toast.showSuccess('Alterações salvas localmente!');
      navigation.goBack();
    } catch (error) {
      toast.showError('Não foi possível salvar as alterações. Tente novamente.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Propriedade" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.container}>
        <Header title="Editar Propriedade" showBackButton />
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={42} color={theme.colors.muted} />
          <Text style={styles.loadingText}>Você não tem permissão para editar esta propriedade.</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = getFazendaUiInfo(produtorAtual);
  const titularNome = fazendaInfo.titularNome || 'Titular não informado';
  const titularId = getTitularIdFazenda(produtorAtual);
  const titularOptions = produtoresUsuarios.some((usuario) => getUsuarioProdutorId(usuario) === titularId)
    ? produtoresUsuarios.map((usuario) => ({
        value: getUsuarioProdutorId(usuario),
        label: getUsuarioNome(usuario),
        description: usuario.email,
      }))
    : [
        {
          value: titularId,
          label: titularNome,
          description: 'Titular preservado por compatibilidade local',
        },
        ...produtoresUsuarios.map((usuario) => ({
          value: getUsuarioProdutorId(usuario),
          label: getUsuarioNome(usuario),
          description: usuario.email,
        })),
      ];
  const colaboradorOptions = colaboradores.some(
    (colaborador) => colaborador.id === form.colaborador_responsavel_id
  )
    ? colaboradores.map((colaborador) => ({
        value: colaborador.id,
        label: getUsuarioNome(colaborador),
        description: [colaborador.regiao, colaborador.email].filter(Boolean).join(' • '),
      }))
    : [
        ...(form.colaborador_responsavel_id
          ? [{
              value: form.colaborador_responsavel_id,
              label: form.colaborador_responsavel || 'Colaborador preservado',
              description: 'Vínculo local preservado por compatibilidade',
            }]
          : []),
        ...colaboradores.map((colaborador) => ({
          value: colaborador.id,
          label: getUsuarioNome(colaborador),
          description: [colaborador.regiao, colaborador.email].filter(Boolean).join(' • '),
        })),
      ];

  return (
    <View style={styles.container}>
      <Header title="Editar Propriedade" showBackButton />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InfoBox
          title="Edição local demonstrativa"
          message="As alterações ficam salvas somente neste aparelho. Titular, Região e Microregião permanecem vinculados para evitar reassociação acidental."
        />

        <SectionCard title="Responsáveis" subtitle="O Titular permanece preservado; o Colaborador responsável é um vínculo cadastral local sem efeito em permissões.">
          <SelectField
            label="Titular / Produtor"
            value={titularId}
            options={titularOptions}
            onChange={() => undefined}
            disabled
            helperText="Para evitar troca acidental de titular, este vínculo permanece somente leitura na edição."
          />

          <SelectField
            label="Colaborador responsável"
            value={form.colaborador_responsavel_id}
            options={[
              { value: '', label: 'Nenhum colaborador selecionado' },
              ...colaboradorOptions,
            ]}
            onChange={(value) => {
              const colaborador = colaboradores.find((item) => item.id === value);
              setForm(prev => ({
                ...prev,
                colaborador_responsavel_id: value,
                colaborador_responsavel: colaborador ? getUsuarioNome(colaborador) : '',
              }));
            }}
            helperText="A seleção não altera o escopo regional nem o RBAC."
          />
        </SectionCard>

        <SectionCard title="Dados da Propriedade" subtitle="Atualize a identificação e a Área total informada no cadastro local.">
          <FormField
            label="Nome da Propriedade"
            required
            value={form.fazenda_nome}
            onChangeText={(text) => handleChange('fazenda_nome', text)}
            placeholder="Nome da propriedade"
            error={errors.fazenda_nome}
          />

          <FormField
            label="Área em hectares"
            required
            value={form.area_total}
            onChangeText={(text) => handleChange('area_total', text)}
            placeholder="Ex: 500"
            keyboardType="numeric"
            error={errors.area_total}
            helperText="Valor cadastral informado; não representa necessariamente a área coberta pelos talhões."
          />

          <FormField
            label="CNPJ ou inscrição"
            value={form.documento}
            onChangeText={(text) => handleChange('documento', text)}
            placeholder="CNPJ, inscrição estadual ou cadastro equivalente"
          />
        </SectionCard>

        <SectionCard title="Dados produtivos" subtitle="Campo opcional para facilitar a identificação durante o teste.">
          <FormField
            label="Cultura principal"
            value={form.cultura_atual}
            onChangeText={(text) => handleChange('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
          />
        </SectionCard>

        <SectionCard title="Localização preservada" subtitle="Cidade e UF podem ser atualizadas. Região e Microregião vinculadas permanecem bloqueadas nesta fase.">
          <FormField
            label="Cidade (opcional)"
            value={form.cidade}
            onChangeText={(text) => handleChange('cidade', text)}
            placeholder="Nome da cidade"
          />

          <FormField
            label="UF (opcional)"
            value={form.estado}
            onChangeText={(text) => handleChange('estado', text.toUpperCase())}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            error={errors.estado}
          />

          <FormField label="Região" value={form.regiao} disabled />
          <FormField label="Microrregião" value={form.microregiao} disabled />
        </SectionCard>

        <SectionCard title="Status" subtitle="Atualize como a Propriedade aparece nas listagens locais.">
          <View style={styles.statusField}>
            <Text style={styles.statusLabel}>Status da propriedade <Text style={styles.required}>*</Text></Text>
            <SegmentedChips
              options={STATUS_PROPRIEDADE}
              value={form.status}
              onChange={(value) => handleChange('status', value)}
            />
          </View>
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar localmente"
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontBody,
  },
  statusField: {
    marginBottom: theme.spacing.md,
  },
  statusLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    marginBottom: theme.spacing.xs,
  },
  required: {
    color: theme.colors.error,
  },
});
