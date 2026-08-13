import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, semanticColors, spacing, typography, shadows } from '../theme';

type DatePickerProps = {
  value?: Date | null;
  onChange: (value: Date) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
  disabled?: boolean;
};

type MobileSelectorProps = {
  date: Date;
  onChange: (value: Date) => void;
  mode: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const TIME_ROW_HEIGHT = 44;

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const startOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const clampDate = (value: Date, minimumDate?: Date, maximumDate?: Date): Date => {
  const timestamp = value.getTime();
  if (isValidDate(minimumDate) && timestamp < minimumDate.getTime()) return new Date(minimumDate);
  if (isValidDate(maximumDate) && timestamp > maximumDate.getTime()) return new Date(maximumDate);
  return new Date(value);
};

const toLocalInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalInputDateTime = (value: Date): string =>
  `${toLocalInputDate(value)}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

const parseLocalInput = (raw: string, mode: DatePickerProps['mode'], fallback: Date): Date | null => {
  if (mode === 'time') {
    const [hours, minutes] = raw.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const next = new Date(fallback);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }
  const [datePart, timePart] = raw.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const next = new Date(fallback);
  next.setFullYear(year, month - 1, day);
  if (timePart) {
    const [hours, minutes] = timePart.split(':').map(Number);
    next.setHours(hours || 0, minutes || 0, 0, 0);
  }
  return Number.isNaN(next.getTime()) ? null : next;
};

export default function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Selecione uma data',
  error,
  required = false,
  minimumDate,
  maximumDate,
  mode = 'date',
  disabled = false,
}: DatePickerProps) {
  const initialValue = clampDate(isValidDate(value) ? value : new Date(), minimumDate, maximumDate);
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(initialValue);

  useEffect(() => {
    if (!showPicker) {
      setTempDate(clampDate(isValidDate(value) ? value : new Date(), minimumDate, maximumDate));
    }
  }, [maximumDate?.getTime(), minimumDate?.getTime(), showPicker, value?.getTime()]);

  const formatDate = (date: Date): string => {
    if (mode === 'time') {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (mode === 'datetime') {
      return date.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    }
    return date.toLocaleDateString('pt-BR');
  };

  const openPicker = () => {
    if (disabled) return;
    setTempDate(clampDate(isValidDate(value) ? value : new Date(), minimumDate, maximumDate));
    setShowPicker(true);
  };

  const handleConfirm = () => {
    onChange(clampDate(tempDate, minimumDate, maximumDate));
    setShowPicker(false);
  };

  const handleCancel = () => {
    setTempDate(clampDate(isValidDate(value) ? value : new Date(), minimumDate, maximumDate));
    setShowPicker(false);
  };

  const webValue = mode === 'time'
    ? `${String(tempDate.getHours()).padStart(2, '0')}:${String(tempDate.getMinutes()).padStart(2, '0')}`
    : mode === 'datetime'
      ? toLocalInputDateTime(tempDate)
      : toLocalInputDate(tempDate);

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}{required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.input, error ? styles.inputError : null, disabled ? styles.inputDisabled : null]}
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        accessibilityValue={{ text: value ? formatDate(value) : placeholder }}
      >
        <Ionicons
          name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
          size={20}
          color={disabled ? semanticColors.disabled.text : value ? colors.primary : colors.muted}
        />
        <Text style={[styles.inputText, !value ? styles.placeholder : null, disabled ? styles.textDisabled : null]}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={colors.error} />
          <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text>
        </View>
      ) : null}

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={handleCancel}>
        <Pressable style={styles.modalOverlay} onPress={handleCancel}>
          <Pressable style={styles.modalContent} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === 'time' ? 'Selecionar horário' : mode === 'datetime' ? 'Selecionar data e hora' : 'Selecionar data'}
              </Text>
              {mode === 'time' ? <Text style={styles.modalSubtitle}>O horário atual já está destacado.</Text> : null}
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.webPickerContainer}>
                <input
                  type={mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date'}
                  value={webValue}
                  min={mode === 'time' || !minimumDate ? undefined : mode === 'datetime' ? toLocalInputDateTime(minimumDate) : toLocalInputDate(minimumDate)}
                  max={mode === 'time' || !maximumDate ? undefined : mode === 'datetime' ? toLocalInputDateTime(maximumDate) : toLocalInputDate(maximumDate)}
                  onChange={(event) => {
                    const next = parseLocalInput(event.target.value, mode, tempDate);
                    if (next) setTempDate(clampDate(next, minimumDate, maximumDate));
                  }}
                  style={{
                    fontSize: 16,
                    padding: 12,
                    borderRadius: 8,
                    border: `2px solid ${colors.border}`,
                    width: '100%',
                  }}
                />
              </View>
            ) : (
              <MobileDateTimeSelector
                date={tempDate}
                onChange={setTempDate}
                mode={mode}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MobileDateTimeSelector(props: MobileSelectorProps) {
  if (props.mode === 'time') return <TimeSelector {...props} />;
  if (props.mode === 'datetime') {
    return (
      <ScrollView style={styles.dateTimeScroll} persistentScrollbar>
        <CalendarSelector {...props} />
        <View style={styles.dateTimeDivider} />
        <TimeSelector {...props} />
      </ScrollView>
    );
  }
  return <CalendarSelector {...props} />;
}

function TimeSelector({ date, onChange }: MobileSelectorProps) {
  const hoursRef = useRef<ScrollView>(null);
  const minutesRef = useRef<ScrollView>(null);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      hoursRef.current?.scrollTo({ y: Math.max(0, date.getHours() * TIME_ROW_HEIGHT - TIME_ROW_HEIGHT * 2), animated: false });
      minutesRef.current?.scrollTo({ y: Math.max(0, date.getMinutes() * TIME_ROW_HEIGHT - TIME_ROW_HEIGHT * 2), animated: false });
    }, 0);
    return () => clearTimeout(timeout);
  }, [date.getHours(), date.getMinutes()]);

  const setTimePart = (part: 'hour' | 'minute', value: number) => {
    const next = new Date(date);
    if (part === 'hour') next.setHours(value);
    else next.setMinutes(value);
    next.setSeconds(0, 0);
    onChange(next);
  };

  return (
    <View style={styles.timeSelector}>
      <TimeColumn label="Hora" values={hours} selected={date.getHours()} scrollRef={hoursRef} onSelect={(value) => setTimePart('hour', value)} />
      <Text style={styles.timeSeparator}>:</Text>
      <TimeColumn label="Minuto" values={minutes} selected={date.getMinutes()} scrollRef={minutesRef} onSelect={(value) => setTimePart('minute', value)} />
    </View>
  );
}

function TimeColumn({ label, values, selected, scrollRef, onSelect }: {
  label: string;
  values: number[];
  selected: number;
  scrollRef: React.RefObject<ScrollView | null>;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={styles.timeColumn}>
      <Text style={styles.timeLabel}>{label}</Text>
      <ScrollView ref={scrollRef} style={styles.scrollColumn} showsVerticalScrollIndicator persistentScrollbar>
        {values.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.timeOption, selected === item ? styles.timeOptionSelected : null]}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === item }}
          >
            <Text style={[styles.timeOptionText, selected === item ? styles.timeOptionTextSelected : null]}>
              {String(item).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function CalendarSelector({ date, onChange, minimumDate, maximumDate }: MobileSelectorProps) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  const [showYears, setShowYears] = useState(false);
  const yearScrollRef = useRef<ScrollView>(null);
  const today = startOfDay(new Date()).getTime();
  const minimumDay = minimumDate ? startOfDay(minimumDate).getTime() : undefined;
  const maximumDay = maximumDate ? startOfDay(maximumDate).getTime() : undefined;
  const currentYear = new Date().getFullYear();
  const minimumYear = minimumDate?.getFullYear() ?? currentYear - 80;
  const maximumYear = maximumDate?.getFullYear() ?? currentYear + 20;
  const years = useMemo(
    () => Array.from({ length: Math.max(1, maximumYear - minimumYear + 1) }, (_, index) => minimumYear + index),
    [maximumYear, minimumYear],
  );

  useEffect(() => {
    setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [date.getFullYear(), date.getMonth()]);

  useEffect(() => {
    if (!showYears) return;
    const timeout = setTimeout(() => {
      const row = Math.floor(Math.max(0, date.getFullYear() - minimumYear) / 3);
      yearScrollRef.current?.scrollTo({ y: Math.max(0, row * 48 - 96), animated: false });
    }, 0);
    return () => clearTimeout(timeout);
  }, [date, minimumYear, showYears]);

  const monthFirstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const monthLastDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
  const leadingEmpty = monthFirstDay.getDay();
  const calendarCells = [
    ...Array.from({ length: leadingEmpty }, () => null),
    ...Array.from({ length: monthLastDay.getDate() }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const monthCanBeShown = (offset: number): boolean => {
    const nextStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
    return !(minimumDay != null && startOfDay(nextEnd).getTime() < minimumDay)
      && !(maximumDay != null && startOfDay(nextStart).getTime() > maximumDay);
  };

  const selectDay = (day: number) => {
    const next = new Date(date);
    next.setFullYear(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    onChange(clampDate(next, minimumDate, maximumDate));
  };

  const selectYear = (year: number) => {
    const safeDay = Math.min(date.getDate(), new Date(year, date.getMonth() + 1, 0).getDate());
    const next = new Date(date);
    next.setFullYear(year, date.getMonth(), safeDay);
    const clamped = clampDate(next, minimumDate, maximumDate);
    onChange(clamped);
    setDisplayMonth(new Date(clamped.getFullYear(), clamped.getMonth(), 1));
    setShowYears(false);
  };

  if (showYears) {
    return (
      <View style={styles.calendarContainer}>
        <View style={styles.yearHeader}>
          <Text style={styles.yearTitle}>Selecione o ano</Text>
          <TouchableOpacity style={styles.closeYearButton} onPress={() => setShowYears(false)}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView ref={yearScrollRef} style={styles.yearScroll} persistentScrollbar>
          <View style={styles.yearGrid}>
            {years.map((year) => (
              <TouchableOpacity
                key={year}
                style={[styles.yearOption, year === date.getFullYear() ? styles.yearOptionSelected : null]}
                onPress={() => selectYear(year)}
                accessibilityState={{ selected: year === date.getFullYear() }}
              >
                <Text style={[styles.yearOptionText, year === date.getFullYear() ? styles.yearOptionTextSelected : null]}>{year}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          style={styles.monthNavButton}
          disabled={!monthCanBeShown(-1)}
          onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
        >
          <Ionicons name="chevron-back" size={23} color={monthCanBeShown(-1) ? colors.primary : semanticColors.disabled.text} />
        </TouchableOpacity>
        <View style={styles.monthTitleGroup}>
          <Text style={styles.monthTitle}>{MONTHS[displayMonth.getMonth()]}</Text>
          <TouchableOpacity style={styles.yearPickerButton} onPress={() => setShowYears(true)} accessibilityHint="Abre a lista de anos">
            <Text style={styles.yearPickerText}>{displayMonth.getFullYear()}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.monthNavButton}
          disabled={!monthCanBeShown(1)}
          onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
        >
          <Ionicons name="chevron-forward" size={23} color={monthCanBeShown(1) ? colors.primary : semanticColors.disabled.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday, index) => <Text key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Text>)}
      </View>
      <View style={styles.daysGrid}>
        {calendarCells.map((day, index) => {
          if (day == null) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const cellDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
          const cellTimestamp = startOfDay(cellDate).getTime();
          const unavailable = (minimumDay != null && cellTimestamp < minimumDay)
            || (maximumDay != null && cellTimestamp > maximumDay);
          const selected = date.getFullYear() === cellDate.getFullYear()
            && date.getMonth() === cellDate.getMonth()
            && date.getDate() === day;
          const isToday = cellTimestamp === today;
          return (
            <TouchableOpacity
              key={`${displayMonth.getFullYear()}-${displayMonth.getMonth()}-${day}`}
              style={[styles.dayCell, selected ? styles.dayCellSelected : null, isToday && !selected ? styles.dayCellToday : null]}
              disabled={unavailable}
              onPress={() => selectDay(day)}
              accessibilityRole="button"
              accessibilityState={{ disabled: unavailable, selected }}
              accessibilityLabel={cellDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            >
              <Text style={[styles.dayText, selected ? styles.dayTextSelected : null, unavailable ? styles.dayTextDisabled : null]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.calendarHint}>Toque no ano para navegar mais rapidamente.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: typography.fontBody, fontWeight: typography.weightSemibold, color: colors.text, marginBottom: spacing.sm },
  required: { color: colors.error },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: spacing.radius, paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm, minHeight: 48 },
  inputError: { borderColor: colors.error },
  inputDisabled: { backgroundColor: semanticColors.disabled.surface, borderColor: semanticColors.disabled.border },
  inputText: { flex: 1, fontSize: typography.fontBody, color: colors.text },
  placeholder: { color: colors.muted },
  textDisabled: { color: semanticColors.disabled.text },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs },
  errorText: { fontSize: typography.fontSmall, color: colors.error },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.card, borderRadius: spacing.radiusLg, width: '100%', maxWidth: 430, maxHeight: '92%', overflow: 'hidden', ...shadows.lg },
  modalHeader: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.text, textAlign: 'center' },
  modalSubtitle: { color: colors.muted, fontSize: typography.fontSmall, textAlign: 'center', marginTop: spacing.xs },
  webPickerContainer: { padding: spacing.lg },
  modalActions: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  modalButton: { flex: 1, paddingVertical: spacing.md + 2, borderRadius: spacing.radius, alignItems: 'center', minHeight: 48 },
  cancelButton: { backgroundColor: colors.backgroundAlt, borderWidth: 1.5, borderColor: colors.border },
  cancelButtonText: { fontSize: typography.fontBody, fontWeight: typography.weightSemibold, color: colors.text },
  confirmButton: { backgroundColor: colors.primary },
  confirmButtonText: { fontSize: typography.fontBody, fontWeight: typography.weightBold, color: colors.white },
  timeSelector: { flexDirection: 'row', alignItems: 'center', height: 310, padding: spacing.md },
  dateTimeScroll: { maxHeight: 560 },
  dateTimeDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  timeColumn: { flex: 1, height: '100%', marginHorizontal: spacing.xs },
  timeLabel: { fontSize: typography.fontSmall, fontWeight: typography.weightSemibold, color: colors.muted, textAlign: 'center', marginBottom: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: spacing.radiusSm },
  scrollColumn: { flex: 1 },
  timeSeparator: { color: colors.text, fontSize: 28, fontWeight: typography.weightBold, paddingTop: spacing.xl },
  timeOption: { height: TIME_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: spacing.radiusSm },
  timeOptionSelected: { backgroundColor: colors.primary },
  timeOptionText: { fontSize: typography.fontBody, color: colors.text },
  timeOptionTextSelected: { color: colors.white, fontWeight: typography.weightBold },
  calendarContainer: { padding: spacing.lg, minHeight: 350 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthNavButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: semanticColors.primary.surface },
  monthTitleGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs },
  monthTitle: { color: colors.text, fontSize: typography.fontSubtitle, fontWeight: typography.weightBold },
  yearPickerButton: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: spacing.radiusSm, backgroundColor: semanticColors.primary.surface },
  yearPickerText: { color: colors.primary, fontSize: typography.fontBody, fontWeight: typography.weightBold },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekday: { width: '14.2857%', textAlign: 'center', color: colors.muted, fontSize: typography.fontSmall, fontWeight: typography.weightSemibold },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayCellToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { color: colors.text, fontSize: typography.fontBody },
  dayTextSelected: { color: colors.white, fontWeight: typography.weightBold },
  dayTextDisabled: { color: semanticColors.disabled.text },
  calendarHint: { color: colors.muted, fontSize: typography.fontSmall, textAlign: 'center', marginTop: spacing.md },
  yearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  yearTitle: { color: colors.text, fontSize: typography.fontSubtitle, fontWeight: typography.weightBold },
  closeYearButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  yearScroll: { maxHeight: 310 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: spacing.md },
  yearOption: { width: '33.333%', height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: spacing.radiusSm },
  yearOptionSelected: { backgroundColor: colors.primary },
  yearOptionText: { color: colors.text, fontSize: typography.fontBody },
  yearOptionTextSelected: { color: colors.white, fontWeight: typography.weightBold },
});
