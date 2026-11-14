import { Slot, usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, focusRing, font } from '../../src/shared/theme';
import { Frame, useLayout } from '../../src/shared/ui';

const destinations = [
  { path: '/', label: 'Quét đề' },
  { path: '/library', label: 'Thư viện' },
  { path: '/review', label: 'Ôn tập' },
  { path: '/settings', label: 'Cài đặt' },
] as const;

function NavigationItem({ item, selected }: { item: (typeof destinations)[number]; selected: boolean }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  return <Pressable
    accessibilityRole="tab"
    accessibilityState={{ selected }}
    onPress={() => { if (!selected) router.replace(item.path); }}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    onHoverIn={() => setHovered(true)}
    onHoverOut={() => setHovered(false)}
    style={({ pressed }) => [
      styles.link,
      (hovered || pressed) && { backgroundColor: color.paper },
      selected && { backgroundColor: color.navy },
      focused && focusRing,
    ]}
  >
    <Text numberOfLines={1} style={[styles.linkText, selected && { color: color.white }]}>{item.label}</Text>
  </Pressable>;
}

export default function TabLayout() {
  const pathname = usePathname();
  const { wide } = useLayout();
  return <View style={styles.layout}>
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
      <Frame style={[styles.headerContent, wide && styles.desktopHeader]}>
        <View style={styles.identity}>
          <Text style={styles.brand}>Physim<Text style={styles.brandAccent}>-AI</Text></Text>
          {wide && <Text style={styles.descriptor}>Vật lý trung học phổ thông</Text>}
        </View>
        <View accessibilityRole="tablist" style={styles.nav}>
          {destinations.map((item) => <NavigationItem key={item.path} item={item} selected={pathname === item.path} />)}
        </View>
      </Frame>
    </SafeAreaView>
    <Slot />
  </View>;
}

const styles = StyleSheet.create({
  layout: { flex: 1, backgroundColor: color.paper },
  header: { backgroundColor: color.white, borderBottomWidth: 1, borderColor: color.hairline },
  headerContent: { minHeight: 64, justifyContent: 'center', gap: 8, paddingVertical: 10 },
  desktopHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  brand: { color: color.navy, fontFamily: font.heading, fontSize: 25, lineHeight: 30, letterSpacing: -1.04 },
  brandAccent: { color: color.goldInteractive },
  descriptor: { color: color.body, fontFamily: font.regular, fontSize: 13 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  link: { minHeight: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  linkText: { color: color.navy, fontFamily: font.strong, fontSize: 13 },
});
