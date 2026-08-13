import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import DatePicker from '../components/DatePicker';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { Produtor, Visita } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import {
  avaliarAcessoVisita,
  podeEditarVisita,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import {
  VISITA_FOTOS_MVP_INFO,
  combineVisitaDateTime,
  getVisitaFotoUri,
  getVisitaObjetivoLabel,
} from '../utils/visitaFormCompat';
import {
  buildVisitaIdempotencyKey,
  getVisitaEstado,
  type VisitaActor,
} from '../utils/visitaLifecycleCompat';
import { buildVisitaConclusionDetails } from '../utils/visitaCommandFormCompat';
import {
  MAX_VISITA_PHOTOS,
  type VisitaPhotoLocal,
  captureVisitaPhoto,
  deleteVisitaPhotoLocal,
  selectVisitaPhotos,
} from '../services/VisitaPhotoService';
import { colors, spacing, typography } from '../theme';

const FORM_ERROR_ORDER = ['inicioData', 'inicioHora', 'responsavel', 'resumo', 'proximaVisita'] as const;

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: unknown): string => {
  const date = toValidDate(value);
  return date
    ? date.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'Não informado';
};

export default function ConcluirVisitaScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const formValidation = useFormValidationFocus(FORM_ERROR_ORDER);
  const visitaId = route.params?.visitaId || route.params?.id;

  const [visita, setVisita] = useState<any>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [inicioData, setInicioData] = useState<Date | null>(null);
  const [inicioHora, setInicioHora] = useState<Date | null>(null);
  const [responsavel, setResponsavel] = useState('');
  const [resumo, setResumo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [clima, setClima] = useState('');
  const [proximaVisita, setProximaVisita] = useState<Date | null>(null);
  const [fotos, setFotos] = useState<any[]>([]);
  const [photoAction, setPhotoAction] = useState<'camera' | 'galeria' | null>(null);
  const [removePhotoIndex, setRemovePhotoIndex] = useState<number | null>(null);
  const [showConclusionConfirm, setShowConclusionConfirm] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const newPhotoUrisRef = useRef<string[]>([]);
  const photosCommittedRef = useRef(false);
  const wide = width >= 720;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setBlockedReason('');
      try {
        if (!visitaId) throw new Error('Visita não informada');
        const [visitaData, propriedades] = await Promise.all([Visita.get(visitaId), Produtor.list()]);
        const acesso = avaliarAcessoVisita(user, visitaData, propriedades);
        if (acesso.status !== 'permitido' || !podeEditarVisita(user, visitaData, acesso.fazenda)) {
          if (active) setBlockedReason('Você não tem permissão para concluir esta Visita.');
          return;
        }
        if (getVisitaEstado(visitaData) !== 'agendada') {
          if (active) setBlockedReason('Somente uma Visita agendada pode ser concluída.');
          return;
        }
        if (!active) return;
        const now = new Date();
        setVisita(visitaData);
        setFazenda(acesso.fazenda);
        setInicioData(now);
        setInicioHora(now);
        setResponsavel(String(visitaData?.responsavel_executante_nome || visitaData?.tecnico_responsavel || '').trim());
        setResumo(String(visitaData?.resumo_conclusao || '').trim());
        setObservacoes(String(visitaData?.observacoes || ''));
        setRecomendacoes(String(visitaData?.recomendacoes || ''));
        setClima(String(visitaData?.clima || ''));
        setProximaVisita(toValidDate(visitaData?.proximaVisita));
        setFotos(Array.isArray(visitaData?.fotos) ? visitaData.fotos : []);
      } catch {
        if (active) setBlockedReason('Não foi possível carregar esta Visita.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, visitaId]);

  useEffect(() => () => {
    if (!photosCommittedRef.current) {
      newPhotoUrisRef.current.forEach((uri) => {
        void deleteVisitaPhotoLocal(uri).catch(() => undefined);
      });
    }
  }, []);

  const validate = () => {
    const nextErrors: any = {};
    const inicioReal = combineVisitaDateTime(inicioData, inicioHora);
    if (!inicioData) nextErrors.inicioData = 'Informe a data de início real.';
    if (!inicioHora) nextErrors.inicioHora = 'Informe o horário de início real.';
    if (inicioReal && inicioReal.getTime() > Date.now()) {
      nextErrors.inicioData = 'O início real não pode estar no futuro.';
    }
    if (!responsavel.trim()) nextErrors.responsavel = 'Informe o responsável executante.';
    if (!resumo.trim()) nextErrors.resumo = 'Informe o resumo operacional.';
    if (proximaVisita && proximaVisita.getTime() < new Date().setHours(0, 0, 0, 0)) {
      nextErrors.proximaVisita = 'A próxima Visita não pode estar no passado.';
    }
    setErrors(nextErrors);
    formValidation.focusFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const requestConclusion = () => {
    if (!validate()) {
      toast.showError('Revise os campos obrigatórios.');
      return;
    }
    setShowConclusionConfirm(true);
  };

  const executeConclusion = async () => {
    if (!visita || !fazenda || !podeEditarVisita(user, visita, fazenda)) {
      toast.showWarning('Você não tem permissão para concluir esta Visita.');
      return;
    }
    const inicioReal = combineVisitaDateTime(inicioData, inicioHora);
    if (!inicioReal) return;

    setShowConclusionConfirm(false);
    setSaving(true);
    try {
      const propriedadeId = String(getFazendaUiInfo(fazenda).id || '').trim();
      const actor: VisitaActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name,
        perfil: user?.perfil || '',
        propriedadeIds: [propriedadeId],
      };
      await Visita.command(visita.id, {
        tipo: 'concluir',
        versaoBase: Number(visita.versao_atual),
        chaveIdempotencia: buildVisitaIdempotencyKey(visita.id, 'concluir'),
        inicioRealEm: inicioReal.toISOString(),
        resumo: resumo.trim(),
        responsavelExecutanteNome: responsavel.trim(),
        detalhes: buildVisitaConclusionDetails(visita, {
          observacoes,
          recomendacoes,
          clima,
          proximaVisita,
          fotos,
        }),
      }, actor);
      photosCommittedRef.current = true;
      toast.showSuccess('Visita concluída e registrada no histórico.');
      navigation.goBack();
    } catch (error: any) {
      toast.showError(error?.message || 'Não foi possível concluir a Visita.');
    } finally {
      setSaving(false);
    }
  };

  const appendPhotos = (items: VisitaPhotoLocal[]) => {
    if (items.length === 0) return;
    newPhotoUrisRef.current = [...newPhotoUrisRef.current, ...items.map((item) => item.uri)];
    setFotos((current) => [...current, ...items].slice(0, MAX_VISITA_PHOTOS));
  };

  const capturePhoto = async () => {
    setPhotoAction('camera');
    try { appendPhotos(await captureVisitaPhoto(fotos.length)); }
    catch (error: any) { toast.showError(error?.message || 'Não foi possível registrar a foto.'); }
    finally { setPhotoAction(null); }
  };

  const selectPhotos = async () => {
    setPhotoAction('galeria');
    try { appendPhotos(await selectVisitaPhotos(fotos.length)); }
    catch (error: any) { toast.showError(error?.message || 'Não foi possível selecionar as fotos.'); }
    finally { setPhotoAction(null); }
  };

  const confirmRemovePhoto = () => {
    if (removePhotoIndex == null) return;
    const uri = getVisitaFotoUri(fotos[removePhotoIndex]);
    setFotos((current) => current.filter((_item, index) => index !== removePhotoIndex));
    if (uri && newPhotoUrisRef.current.includes(uri)) {
      newPhotoUrisRef.current = newPhotoUrisRef.current.filter((item) => item !== uri);
      void deleteVisitaPhotoLocal(uri).catch(() => undefined);
    }
    setRemovePhotoIndex(null);
  };

  if (loading) {
    return <View style={styles.container}><Header title="Concluir Visita" showBack /><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.centerText}>Carregando Visita...</Text></View></View>;
  }

  if (blockedReason || !visita || !fazenda) {
    return <View style={styles.container}><Header title="Concluir Visita" showBack /><View style={styles.center}><Ionicons name="lock-closed-outline" size={48} color={colors.muted} /><Text style={styles.centerText}>{blockedReason || 'Visita indisponível.'}</Text></View></View>;
  }

  const fazendaInfo = getFazendaUiInfo(fazenda);

  return (
    <View style={styles.container}>
      <Header title="Concluir Visita" showBack />
      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        persistentScrollbar
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.formWidth}>
          <SectionCard title="Contexto da Visita" subtitle="Revise o agendamento antes de registrar a realização." icon="home-outline">
            <Text style={styles.contextTitle}>{fazendaInfo.fazendaNome}</Text>
            <Text style={styles.contextText}>Agendada para {formatDateTime(visita.agendada_para || visita.data_visita)}</Text>
            <Text style={styles.contextText}>{getVisitaObjetivoLabel(visita.objetivo)} • {visita.tecnico_responsavel}</Text>
          </SectionCard>

          <SectionCard title="Execução" subtitle="Informe quando a atividade começou e quem a executou." icon="checkmark-circle-outline">
            <View style={wide ? styles.fieldRow : undefined}>
              <View ref={formValidation.registerField('inicioData')} collapsable={false} style={styles.flexField}>
                <DatePicker label="Data de início real" required value={inicioData} onChange={(value) => { setInicioData(value); setErrors((prev) => ({ ...prev, inicioData: null })); }} maximumDate={new Date()} error={errors.inicioData} />
              </View>
              <View ref={formValidation.registerField('inicioHora')} collapsable={false} style={styles.flexField}>
                <DatePicker label="Horário de início real" required value={inicioHora} onChange={(value) => { setInicioHora(value); setErrors((prev) => ({ ...prev, inicioHora: null })); }} mode="time" error={errors.inicioHora} />
              </View>
            </View>
            <View ref={formValidation.registerField('responsavel')} collapsable={false}>
              <FormField label="Responsável executante" required value={responsavel} onChangeText={(value) => { setResponsavel(value); setErrors((prev) => ({ ...prev, responsavel: null })); }} error={errors.responsavel} />
            </View>
          </SectionCard>

          <SectionCard title="Relato técnico" subtitle="O resumo é obrigatório; os demais dados complementam a conclusão." icon="document-text-outline">
            <View ref={formValidation.registerField('resumo')} collapsable={false}>
              <FormField label="Resumo operacional" required value={resumo} onChangeText={(value) => { setResumo(value); setErrors((prev) => ({ ...prev, resumo: null })); }} textarea numberOfLines={5} error={errors.resumo} placeholder="Descreva o que foi realizado na Visita" />
            </View>
            <FormField label="Observações" value={observacoes} onChangeText={setObservacoes} textarea numberOfLines={4} />
            <FormField label="Recomendações técnicas" value={recomendacoes} onChangeText={setRecomendacoes} textarea numberOfLines={4} />
            <FormField label="Condições climáticas" value={clima} onChangeText={setClima} />
            <View ref={formValidation.registerField('proximaVisita')} collapsable={false}>
              <DatePicker label="Sugestão de próxima Visita" value={proximaVisita} onChange={(value) => { setProximaVisita(value); setErrors((prev) => ({ ...prev, proximaVisita: null })); }} minimumDate={new Date()} error={errors.proximaVisita} />
            </View>
          </SectionCard>

          <SectionCard title="Fotos" subtitle="Preserve as imagens existentes ou acrescente registros da execução." icon="images-outline">
            <InfoBox title={VISITA_FOTOS_MVP_INFO.title} message={VISITA_FOTOS_MVP_INFO.message} />
            <View style={styles.photoActions}>
              <TouchableOpacity style={[styles.photoButton, (photoAction !== null || fotos.length >= MAX_VISITA_PHOTOS) && styles.disabled]} disabled={photoAction !== null || fotos.length >= MAX_VISITA_PHOTOS} onPress={() => void capturePhoto()}>
                {photoAction === 'camera' ? <ActivityIndicator color={colors.white} /> : <Ionicons name="camera-outline" size={20} color={colors.white} />}
                <Text style={styles.photoButtonText}>Câmera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoButton, styles.photoButtonSecondary, (photoAction !== null || fotos.length >= MAX_VISITA_PHOTOS) && styles.disabled]} disabled={photoAction !== null || fotos.length >= MAX_VISITA_PHOTOS} onPress={() => void selectPhotos()}>
                {photoAction === 'galeria' ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="images-outline" size={20} color={colors.primary} />}
                <Text style={[styles.photoButtonText, styles.photoButtonSecondaryText]}>Galeria</Text>
              </TouchableOpacity>
            </View>
            {fotos.length > 0 ? <View style={styles.photoGrid}>{fotos.map((foto, index) => {
              const uri = getVisitaFotoUri(foto);
              return <View key={`${uri || 'foto'}-${index}`} style={styles.photoItem}>{uri ? <Image source={{ uri }} style={styles.photo} /> : <View style={[styles.photo, styles.photoMissing]}><Ionicons name="image-outline" size={24} color={colors.muted} /></View>}<TouchableOpacity style={styles.photoRemove} onPress={() => setRemovePhotoIndex(index)} accessibilityLabel={`Remover foto ${index + 1}`}><Ionicons name="close-circle" size={24} color={colors.error} /></TouchableOpacity></View>;
            })}</View> : null}
            <Text style={styles.photoCount}>{fotos.length} de {MAX_VISITA_PHOTOS} fotos</Text>
          </SectionCard>

          <InfoBox title="Confirmação auditada" message="Ao concluir, a Visita passa para Realizada. Autor, horário, versão e alterações ficam registrados no histórico local." />
        </View>
      </ScrollView>
      <FormFooter onCancel={() => navigation.goBack()} onSubmit={requestConclusion} submitLabel="Revisar e concluir" submitIcon="checkmark-circle-outline" loading={saving} />
      <ConfirmDialog visible={showConclusionConfirm} title="Concluir esta Visita?" message={`A Visita em ${fazendaInfo.fazendaNome} será registrada como realizada. Essa mudança não pode ser desfeita por edição comum.`} confirmText="Concluir Visita" cancelText="Revisar" onConfirm={() => void executeConclusion()} onCancel={() => setShowConclusionConfirm(false)} />
      <ConfirmDialog visible={removePhotoIndex != null} title="Remover foto" message="Deseja retirar esta foto da conclusão?" type="danger" confirmText="Remover" cancelText="Manter" onConfirm={confirmRemovePhoto} onCancel={() => setRemovePhotoIndex(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.screen, paddingBottom: spacing.xl * 2 },
  formWidth: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { color: colors.muted, fontSize: typography.fontBody, textAlign: 'center' },
  contextTitle: { color: colors.text, fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, marginBottom: spacing.xs },
  contextText: { color: colors.muted, fontSize: typography.fontSmall, lineHeight: 20, marginTop: 2 },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  flexField: { flex: 1, minWidth: 0 },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoButton: { flex: 1, minWidth: 150, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: spacing.radiusSm, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  photoButtonSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  photoButtonText: { color: colors.white, fontWeight: typography.weightBold },
  photoButtonSecondaryText: { color: colors.primary },
  disabled: { opacity: 0.55 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoItem: { width: 92, height: 92, position: 'relative' },
  photo: { width: 92, height: 92, borderRadius: spacing.radiusSm, backgroundColor: colors.backgroundAlt },
  photoMissing: { alignItems: 'center', justifyContent: 'center' },
  photoRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.card, borderRadius: 14 },
  photoCount: { color: colors.muted, fontSize: typography.fontSmall, marginTop: spacing.sm },
});
