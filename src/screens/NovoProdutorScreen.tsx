import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { useToast } from '../components/Toast';
import { Produtor } from '../api/mock';
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

const getScopeErrorMessage = (reason?: string) => {
  switch (reason) {
    case 'perfil_sem_permissao':
      return 'Seu perfil não permite cadastrar propriedades.';
    case 'regiao_fora_escopo':
      return 'A região informada está fora do seu escopo.';
    case 'microregiao_fora_escopo':
      return 'Selecione uma microrregião dentro do seu escopo.';
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
      const fazendas = await Produtor.list();
      const options = buildCadastroTitularOptions(fazendas);
      setTitulares(options);

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
      newErrors.microregiao = 'Microrregião é obrigatória';
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Cadastre a propriedade com um produtor titular vinculado.
          </Text>
        </View>

        {errors.escopo && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
            <Text style={styles.errorBoxText}>{errors.escopo}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Produtor titular</Text>
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              titularMode === 'existente' && styles.modeButtonActive,
              titulares.length === 0 && styles.modeButtonDisabled
            ]}
            onPress={() => handleTitularModeChange('existente')}
            disabled={titulares.length === 0}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={titularMode === 'existente' ? theme.colors.white : theme.colors.primary}
            />
            <Text style={[styles.modeButtonText, titularMode === 'existente' && styles.modeButtonTextActive]}>
              Existente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, titularMode === 'novo' && styles.modeButtonActive]}
            onPress={() => handleTitularModeChange('novo')}
          >
            <Ionicons
              name="person-add-outline"
              size={18}
              color={titularMode === 'novo' ? theme.colors.white : theme.colors.primary}
            />
            <Text style={[styles.modeButtonText, titularMode === 'novo' && styles.modeButtonTextActive]}>
              Novo titular
            </Text>
          </TouchableOpacity>
        </View>

        {titularMode === 'existente' ? (
          <>
            {renderTitularExistente()}
            {errors.titular && <Text style={styles.errorText}>{errors.titular}</Text>}
          </>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>Nome do Produtor Titular *</Text>
            <TextInput
              style={[styles.input, errors.nome && styles.inputError]}
              value={form.nome}
              onChangeText={(text) => handleChange('nome', text)}
              placeholder="Digite o nome completo"
              placeholderTextColor={theme.colors.textSecondary}
            />
            {errors.nome && <Text style={styles.errorText}>{errors.nome}</Text>}
          </View>
        )}

        <Text style={styles.sectionTitle}>Dados da propriedade</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Propriedade *</Text>
          <TextInput
            style={[styles.input, errors.fazenda && styles.inputError]}
            value={form.fazenda}
            onChangeText={(text) => handleChange('fazenda', text)}
            placeholder="Nome da propriedade"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.fazenda && <Text style={styles.errorText}>{errors.fazenda}</Text>}
        </View>

        <View style={styles.field}>
        <Text style={styles.label}>Área Total (ha) *</Text>
          <TextInput
            style={[styles.input, errors.area_total && styles.inputError]}
            value={form.area_total}
            onChangeText={(text) => handleChange('area_total', text)}
            placeholder="Ex: 500"
            keyboardType="numeric"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.area_total && <Text style={styles.errorText}>{errors.area_total}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Cultura Principal</Text>
          <TextInput
            style={styles.input}
            value={form.cultura_atual}
            onChangeText={(text) => handleChange('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            value={form.cidade}
            onChangeText={(text) => handleChange('cidade', text)}
            placeholder="Nome da cidade"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Estado (UF)</Text>
          <TextInput
            style={[styles.input, errors.estado && styles.inputError]}
            value={form.estado}
            onChangeText={(text) => handleChange('estado', text.toUpperCase())}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.estado && <Text style={styles.errorText}>{errors.estado}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Escopo operacional</Text>
        <View style={styles.field}>
        <Text style={styles.label}>Região *</Text>
          <TextInput
            style={[
              styles.input,
              user?.perfil === 'colaborador' && styles.inputDisabled,
              errors.regiao && styles.inputError
            ]}
            value={user?.perfil === 'colaborador' ? (user.regiao || '') : form.regiao}
            onChangeText={(text) => handleChange('regiao', text)}
            editable={user?.perfil !== 'colaborador'}
            placeholder="Ex: Sul, Goiás, Mato Grosso"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.regiao && <Text style={styles.errorText}>{errors.regiao}</Text>}
        </View>

        {user?.perfil === 'colaborador' ? (
          <View style={styles.field}>
            <Text style={styles.label}>Microrregião *</Text>
            {microregioesPermitidas.length === 0 ? (
              <Text style={styles.helperText}>Nenhuma microrregião vinculada ao seu usuário.</Text>
            ) : (
              <View style={styles.microChips}>
                {microregioesPermitidas.map((microregiao) => {
                  const selected = form.microregiao === microregiao;
                  return (
                    <TouchableOpacity
                      key={microregiao}
                      style={[styles.microChip, selected && styles.microChipActive]}
                      onPress={() => handleChange('microregiao', microregiao)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={selected ? theme.colors.white : theme.colors.primary}
                      />
                      <Text style={[styles.microChipText, selected && styles.microChipTextActive]}>
                        {microregiao}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {errors.microregiao && <Text style={styles.errorText}>{errors.microregiao}</Text>}
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>Microrregião *</Text>
            <TextInput
              style={[styles.input, errors.microregiao && styles.inputError]}
              value={form.microregiao}
              onChangeText={(text) => handleChange('microregiao', text)}
              placeholder="Ex: RS - Norte, Rio Verde, Sorriso"
              placeholderTextColor={theme.colors.textSecondary}
            />
            {errors.microregiao && <Text style={styles.errorText}>{errors.microregiao}</Text>}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={theme.colors.white} />
              <Text style={styles.saveButtonText}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.radius,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: theme.typography.fontBody,
    color: theme.colors.text,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.radius,
    backgroundColor: theme.colors.errorBgLight,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    marginBottom: theme.spacing.md,
  },
  errorBoxText: {
    flex: 1,
    color: theme.colors.error,
    fontSize: theme.typography.fontCaption + 1,
    fontWeight: theme.typography.weightSemibold,
  },
  sectionTitle: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.spacing.radius,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.sm,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  modeButtonDisabled: {
    opacity: 0.45,
  },
  modeButtonText: {
    fontSize: theme.typography.fontCaption + 1,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.primary,
  },
  modeButtonTextActive: {
    color: theme.colors.white,
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
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radius,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontBody,
    color: theme.colors.text,
  },
  inputDisabled: {
    backgroundColor: theme.colors.backgroundSoft,
    color: theme.colors.textLight,
  },
  inputError: {
    borderColor: theme.colors.error,
    borderWidth: 2,
  },
  errorText: {
    fontSize: theme.typography.fontCaption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  microChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  microChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
  },
  microChipActive: {
    backgroundColor: theme.colors.primary,
  },
  microChipText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontCaption + 1,
    fontWeight: theme.typography.weightSemibold,
  },
  microChipTextActive: {
    color: theme.colors.white,
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.radius,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    color: theme.colors.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.radius,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.white,
  },
});
