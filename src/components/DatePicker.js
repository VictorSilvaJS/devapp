import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform,
  Modal,
  Pressable,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../theme';

/**
 * DatePicker Component
 * 
 * Componente reutilizável para seleção de datas
 * Usa DateTimePicker nativo quando disponível, ou fallback web
 * 
 * Props:
 * - value: Date - data selecionada
 * - onChange: (date) => void - callback ao selecionar data
 * - label: string - label do campo
 * - placeholder: string - texto placeholder
 * - error: string - mensagem de erro
 * - minimumDate: Date - data mínima permitida
 * - maximumDate: Date - data máxima permitida
 * - mode: 'date' | 'time' | 'datetime' - modo de seleção
 */
export default function DatePicker({ 
  value, 
  onChange, 
  label,
  placeholder = 'Selecione uma data',
  error,
  minimumDate,
  maximumDate,
  mode = 'date',
  disabled = false
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());

  const formatDate = (date) => {
    if (!date) return '';
    
    if (mode === 'time') {
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    if (mode === 'datetime') {
      return date.toLocaleString('pt-BR', { 
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return date.toLocaleDateString('pt-BR');
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setTempDate(value || new Date());
    setShowPicker(false);
  };

  const getIcon = () => {
    if (mode === 'time') return 'time-outline';
    return 'calendar-outline';
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={[
          styles.input,
          error && styles.inputError,
          disabled && styles.inputDisabled
        ]}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        <Ionicons 
          name={getIcon()} 
          size={20} 
          color={value ? colors.primary : colors.muted} 
        />
        <Text style={[
          styles.inputText,
          !value && styles.placeholder,
          disabled && styles.textDisabled
        ]}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Modal com picker customizado para web ou fallback */}
      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCancel}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === 'time' ? 'Selecionar Hora' : 'Selecionar Data'}
              </Text>
            </View>

            {/* Picker Nativo ou Custom */}
            {Platform.OS === 'web' ? (
              <View style={styles.webPickerContainer}>
                <input
                  type={mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date'}
                  value={
                    mode === 'time' 
                      ? tempDate.toTimeString().slice(0, 5)
                      : mode === 'datetime'
                      ? tempDate.toISOString().slice(0, 16)
                      : tempDate.toISOString().slice(0, 10)
                  }
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setTempDate(newDate);
                    }
                  }}
                  style={{
                    fontSize: 16,
                    padding: 12,
                    borderRadius: 8,
                    border: `2px solid ${colors.border}`,
                    width: '100%'
                  }}
                />
              </View>
            ) : (
              <SimpleDateSelector
                date={tempDate}
                onChange={setTempDate}
                mode={mode}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Componente simples de seleção de data para mobile (fallback)
function SimpleDateSelector({ date, onChange, mode, minimumDate, maximumDate }) {
  const [selectedDate, setSelectedDate] = useState(date);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handleDayChange = (day) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(day);
    setSelectedDate(newDate);
    onChange(newDate);
  };

  const handleMonthChange = (monthIndex) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(monthIndex);
    setSelectedDate(newDate);
    onChange(newDate);
  };

  const handleYearChange = (year) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(year);
    setSelectedDate(newDate);
    onChange(newDate);
  };

  if (mode === 'time') {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    // Minutos em incrementos de 5 para facilitar a seleção
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

    return (
      <View style={styles.timeSelector}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Hora</Text>
          <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
            {hours.map(h => (
              <TouchableOpacity
                key={h}
                style={[
                  styles.timeOption,
                  selectedDate.getHours() === h && styles.timeOptionSelected
                ]}
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setHours(h);
                  setSelectedDate(newDate);
                  onChange(newDate);
                }}
              >
                <Text style={[
                  styles.timeOptionText,
                  selectedDate.getHours() === h && styles.timeOptionTextSelected
                ]}>
                  {h.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Minuto</Text>
          <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
            {minutes.map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.timeOption,
                  selectedDate.getMinutes() === m && styles.timeOptionSelected
                ]}
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setMinutes(m);
                  setSelectedDate(newDate);
                  onChange(newDate);
                }}
              >
                <Text style={[
                  styles.timeOptionText,
                  selectedDate.getMinutes() === m && styles.timeOptionTextSelected
                ]}>
                  {m.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dateSelector}>
      <View style={styles.dateColumn}>
        <Text style={styles.dateLabel}>Dia</Text>
        <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
          {days.map(d => (
            <TouchableOpacity
              key={d}
              style={[
                styles.dateOption,
                selectedDate.getDate() === d && styles.dateOptionSelected
              ]}
              onPress={() => handleDayChange(d)}
            >
              <Text style={[
                styles.dateOptionText,
                selectedDate.getDate() === d && styles.dateOptionTextSelected
              ]}>
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.dateColumn}>
        <Text style={styles.dateLabel}>Mês</Text>
        <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
          {months.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.dateOption,
                selectedDate.getMonth() === i && styles.dateOptionSelected
              ]}
              onPress={() => handleMonthChange(i)}
            >
              <Text style={[
                styles.dateOptionText,
                selectedDate.getMonth() === i && styles.dateOptionTextSelected
              ]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.dateColumn}>
        <Text style={styles.dateLabel}>Ano</Text>
        <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
          {years.map(y => (
            <TouchableOpacity
              key={y}
              style={[
                styles.dateOption,
                selectedDate.getFullYear() === y && styles.dateOptionSelected
              ]}
              onPress={() => handleYearChange(y)}
            >
              <Text style={[
                styles.dateOptionText,
                selectedDate.getFullYear() === y && styles.dateOptionTextSelected
              ]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.backgroundAlt,
    opacity: 0.6,
  },
  inputText: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
  },
  placeholder: {
    color: colors.muted,
  },
  textDisabled: {
    color: colors.mutedLight,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSmall,
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...shadows.lg,
  },
  modalHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    textAlign: 'center',
  },
  webPickerContainer: {
    padding: spacing.lg,
  },
  dateSelector: {
    flexDirection: 'row',
    height: 300,
    padding: spacing.md,
  },
  dateColumn: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  scrollColumn: {
    flex: 1,
  },
  dateLabel: {
    fontSize: typography.fontSmall,
    fontWeight: typography.weightSemibold,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: spacing.radiusSm,
  },
  dateOption: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderRadius: spacing.radiusSm,
    marginBottom: 4,
  },
  dateOptionSelected: {
    backgroundColor: colors.primary,
  },
  dateOptionText: {
    fontSize: typography.fontBody,
    color: colors.text,
  },
  dateOptionTextSelected: {
    color: colors.white,
    fontWeight: typography.weightBold,
  },
  timeSelector: {
    flexDirection: 'row',
    height: 300,
    padding: spacing.md,
  },
  timeColumn: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  timeLabel: {
    fontSize: typography.fontSmall,
    fontWeight: typography.weightSemibold,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: spacing.radiusSm,
  },
  timeOption: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderRadius: spacing.radiusSm,
    marginBottom: 4,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary,
  },
  timeOptionText: {
    fontSize: typography.fontBody,
    color: colors.text,
  },
  timeOptionTextSelected: {
    color: colors.white,
    fontWeight: typography.weightBold,
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: spacing.radius,
    alignItems: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
});
