import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { color, focusRing, font, spacing } from './theme';

export function useLayout() {
  const { width } = useWindowDimensions();
  return { wide: width >= spacing.split, compact: width < 420 };
}

type IconName = 'right' | 'diagonal' | 'camera' | 'image' | 'plus' | 'minus' | 'search' | 'check' | 'back' | 'reset' | 'up' | 'down';
const icons: Record<IconName, string> = {
  right: 'M4 12h15m-6-6 6 6-6 6',
  diagonal: 'M6 18 18 6M8 6h10v10',
  camera: 'M4 6h4l2-2h4l2 2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
  image: 'M4 4h16v16H4ZM4 17l5-5 4 4 2-2 5 4',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  search: 'm15.5 15.5 5 5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  check: 'm4 12 5 5L20 6',
  back: 'M20 12H5m6-6-6 6 6 6',
  reset: 'M4 7v5h5m-5 0a8 8 0 1 1 3 6',
  up: 'M12 20V5m-6 6 6-6 6 6',
  down: 'M12 4v15m-6-6 6 6 6-6',
};

export function Icon({ name, tint = color.navy, size = 18 }: { name: IconName; tint?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <Path d={icons[name]} stroke={tint} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
      {name === 'camera' && <Circle cx={12} cy={13} r={3.4} stroke={tint} strokeWidth={1.65} />}
      {name === 'image' && <Circle cx={15.5} cy={8.5} r={1.2} fill={tint} />}
    </Svg>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.page}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pageContent}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Frame({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { wide } = useLayout();
  return <View style={[styles.frame, { paddingHorizontal: wide ? spacing.wide : spacing.compact }, style]}>{children}</View>;
}

export function Heading({ children, level = 1, inverse = false, style }: {
  children: ReactNode; level?: 1 | 2 | 3; inverse?: boolean; style?: StyleProp<TextStyle>;
}) {
  const { wide } = useLayout();
  const size = level === 1 ? (wide ? 52 : 36) : level === 2 ? (wide ? 34 : 27) : 22;
  return (
    <Text accessibilityRole="header" aria-level={level} style={[{
      color: inverse ? color.white : color.navy,
      fontFamily: level === 1 ? font.display : font.heading,
      fontSize: size,
      lineHeight: Math.ceil(size * 1.18),
      letterSpacing: -size * (level === 1 ? 0.035 : 0.022),
    }, style]}>{children}</Text>
  );
}

export function Copy({ children, inverse = false, muted = false, style }: {
  children: ReactNode; inverse?: boolean; muted?: boolean; style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.copy, { color: inverse ? color.lightOnNavy : muted ? color.body : color.navy }, style]}>{children}</Text>;
}

export function Small({ children, tint = color.body, style }: {
  children: ReactNode; tint?: string; style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.small, { color: tint }, style]}>{children}</Text>;
}

export function Rule() {
  return <View style={styles.rule} accessible={false} />;
}

export function Action({
  label, accessibilityLabel, onPress, icon, kind = 'primary', disabled = false, busy = false, style,
}: {
  label: string; accessibilityLabel?: string; onPress: () => void;
  icon?: IconName; kind?: 'primary' | 'secondary' | 'inverse' | 'quiet';
  disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tint = kind === 'inverse' ? color.white : color.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.action,
        kind === 'primary' && { backgroundColor: hovered || pressed ? color.goldHover : color.gold },
        kind === 'secondary' && { backgroundColor: hovered || pressed ? color.paper : color.white, borderColor: color.hairline },
        kind === 'inverse' && { backgroundColor: hovered || pressed ? color.navyActive : color.navy, borderColor: color.darkRule },
        kind === 'quiet' && { backgroundColor: hovered || pressed ? color.paper : 'transparent', paddingHorizontal: 8 },
        (disabled || busy) && { opacity: 0.62 },
        style,
        focused && focusRing,
        focused && kind === 'inverse' && { outlineColor: color.gold },
      ]}
    >
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
      {busy ? <ActivityIndicator color={tint} size="small" /> : icon && <Icon name={icon} tint={tint} />}
    </Pressable>
  );
}

export function Row({
  children, onPress, label, trailing = 'right', selected = false, index,
}: {
  children: ReactNode; onPress: () => void; label: string;
  trailing?: IconName; selected?: boolean; index?: number;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.row,
        (hovered || pressed) && { backgroundColor: color.white },
        selected && { backgroundColor: color.white },
        focused && focusRing,
      ]}
    >
      {typeof index === 'number' && <Small tint={color.goldInteractive} style={styles.rowNumber}>{String(index).padStart(2, '0')}</Small>}
      <View style={styles.rowBody}>{children}</View>
      <Icon name={trailing} tint={selected ? color.goldInteractive : color.navy} />
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Small tint={color.navy}>{label}</Small>
      <TextInput
        {...props}
        accessibilityLabel={label}
        selectionColor={color.gold}
        placeholderTextColor={color.body}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        style={[styles.input, focused && { borderColor: color.goldInteractive }, focused && focusRing, style]}
      />
    </View>
  );
}

export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'error' | 'success' }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.notice, {
      color: tone === 'error' ? color.error : tone === 'success' ? color.success : color.body,
    }]}>{children}</Text>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.paper },
  pageContent: { flexGrow: 1, paddingBottom: 32 },
  frame: { width: '100%', maxWidth: spacing.max, alignSelf: 'center' },
  copy: { fontFamily: font.regular, fontSize: 16, lineHeight: 26 },
  small: { fontFamily: font.medium, fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  rule: { borderBottomWidth: 1, borderColor: color.hairline },
  action: { minHeight: 48, borderRadius: 3, borderWidth: 1, borderColor: 'transparent',
    paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actionLabel: { fontFamily: font.strong, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11,
    paddingHorizontal: 3, borderBottomWidth: 1, borderColor: color.hairline },
  rowNumber: { minWidth: 23 },
  rowBody: { flex: 1, gap: 2 },
  input: { color: color.navy, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 11,
    minHeight: 48, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.white,
    fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  field: { gap: 6 },
  notice: { fontFamily: font.medium, fontSize: 14, lineHeight: 22 },
});
