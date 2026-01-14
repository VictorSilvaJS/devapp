import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import InputField from '../components/InputField';
import { Produtor } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { 
  validarNome, 
  validarArea, 
  validarUF, 
  validarObrigatorio,
  getMensagemErro
} from '../utils/validacoes';

export default function NovoProdutorScreen({ navigation }) {
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
    nome: '',
    fazenda: '',
    area_total: '',
    cultura_atual: '',
    cidade: '',
    estado: '',
    status: 'ativo'
  });

  // Validações em tempo real
  const erros = {
    nome: touched.nome && !validarNome(form.nome) ? getMensagemErro('Nome', 'minimo') : '',
    fazenda: touched.fazenda && !validarObrigatorio(form.fazenda) ? getMensagemErro('Fazenda', 'obrigatorio') : '',
    area_total: touched.area_total && !validarArea(form.area_total) ? getMensagemErro('Área', 'area') : '',
    estado: touched.estado && form.estado && !validarUF(form.estado) ? getMensagemErro('UF', 'uf') : '',
  };

  const handleBlur = (campo) => {
    setTouched(prev => ({ ...prev, [campo]: true }));
  };

  const updateForm = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handleSave = async () => {
    // Marca todos os campos como touched
    setTouched({
      nome: true,
      fazenda: true,
      area_total: true,
      estado: form.estado ? true : false,
    });

    // Validações
    if (!validarNome(form.nome)) {
      Alert.alert('Atenção', 'O nome do produtor deve ter pelo menos 3 caracteres');
      return;
    }
    if (!validarObrigatorio(form.fazenda)) {
      Alert.alert('Atenção', 'O nome da fazenda é obrigatório');
      return;
    }
    if (!validarArea(form.area_total)) {
      Alert.alert('Atenção', 'Informe uma área total válida');
      return;
    }
    if (form.estado && !validarUF(form.estado)) {
      Alert.alert('Atenção', 'UF inválida. Use a sigla do estado (Ex: RS, SP, GO)');
      return;
    }

    try {
      setSaving(true);
      const dataToSave = {
        ...form,
        area_total: parseFloat(form.area_total)
      };
      await Produtor.create(dataToSave);
      
      Alert.alert('Sucesso', 'Produtor cadastrado com sucesso!', [
        { text: 'OK', onPress: () => navigation.navigate('Produtores') }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível cadastrar o produtor. Tente novamente.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Cadastro',
      'Deseja descartar as informações?',
      [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim', onPress: () => navigation.goBack() }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Novo Produtor" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <Ionicons name="person-add" size={32} color={colors.primary} />
          <Text style={styles.description}>
            Adicione um novo produtor ao sistema preenchendo as informações abaixo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Dados Básicos</Text>
          
          <InputField
            label="Nome do Produtor"
            value={form.nome}
            onChangeText={(text) => updateForm('nome', text)}
            onBlur={() => handleBlur('nome')}
            placeholder="Nome completo"
            required
            icon="person-outline"
            error={erros.nome}
            valid={touched.nome && !erros.nome && form.nome.length > 0}
          />

          <InputField
            label="Nome da Fazenda"
            value={form.fazenda}
            onChangeText={(text) => updateForm('fazenda', text)}
            onBlur={() => handleBlur('fazenda')}
            placeholder="Nome da propriedade"
            required
            icon="home-outline"
            error={erros.fazenda}
            valid={touched.fazenda && !erros.fazenda && form.fazenda.length > 0}
          />

          <InputField
            label="Área Total (hectares)"
            value={form.area_total}
            onChangeText={(text) => updateForm('area_total', text)}
            onBlur={() => handleBlur('area_total')}
            placeholder="Ex: 850"
            keyboardType="numeric"
            required
            icon="resize-outline"
            error={erros.area_total}
            valid={touched.area_total && !erros.area_total && form.area_total.length > 0}
          />

          <InputField
            label="Cultura Principal"
            value={form.cultura_atual}
            onChangeText={(text) => updateForm('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
            icon="leaf-outline"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Localização</Text>
          
          <InputField
            label="Cidade"
            value={form.cidade}
            onChangeText={(text) => updateForm('cidade', text)}
            placeholder="Nome da cidade"
            icon="location-outline"
          />

          <InputField
            label="Estado (UF)"
            value={form.estado}
            onChangeText={(text) => updateForm('estado', text.toUpperCase())}
            onBlur={() => handleBlur('estado')}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            icon="map-outline"
            error={erros.estado}
            valid={touched.estado && !erros.estado && form.estado.length === 2}
          />
        </View>

        <View style={styles.requiredNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.requiredText}>* Campos obrigatórios</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.buttonSecondaryText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>💾 Salvar Produtor</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  headerBox: {
    alignItems: 'center',
    backgroundColor: colors.accent + '20',
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  description: {
    fontSize: typography.fontBody,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  requiredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  requiredText: {
    fontSize: typography.fontCaption + 1,
    color: colors.primaryDark,
    fontWeight: typography.weightSemibold,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
});
