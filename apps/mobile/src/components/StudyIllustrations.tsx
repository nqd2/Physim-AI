import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const ink = '#3B2849';
const originalIcons = {
  home: require('../../assets/icons/home.png'),
  camera: require('../../assets/icons/camera.png'),
  lab: require('../../assets/icons/lab.png'),
  book: require('../../assets/icons/book.png'),
  user: require('../../assets/icons/user.png'),
};

/** Original UI.html navigation paths, rasterized at 4× for native and Web. */
export function StudyIcon({ name, color = ink, size = 24 }: {
  name: keyof typeof originalIcons;
  color?: string;
  size?: number;
}) {
  return <Image source={originalIcons[name]} accessible={false} aria-hidden
    style={{ width: size, height: size, tintColor: color, flexShrink: 0 }} />;
}

/** The placeholder portrait in UI.html; this does not imply a user profile photo. */
export function StudyAvatar({ size = 56 }: { size?: number }) {
  return <Image source={require('../../assets/study-avatar.png')} accessible={false} aria-hidden
    style={{ width: size, height: size, borderRadius: size * 10 / 84 }} />;
}

const heartRows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
export function PixelHeart({ size = 35, opacity = 0.6 }: { size?: number; opacity?: number }) {
  const unit = size / 7;
  return <View accessible={false} aria-hidden pointerEvents="none" style={{ width: size, height: unit * 6, opacity }}>
    {heartRows.map((row, y) => <View key={y} style={{ flexDirection: 'row', height: unit }}>
      {[...row].map((pixel, x) => <View key={x} style={{ width: unit, height: unit, backgroundColor: pixel === '1' ? '#FFFFFF' : 'transparent' }} />)}
    </View>)}
  </View>;
}

/** Sample paper adapted from the existing camera screen; always labelled as an example. */
export function SciencePaper({ compact = false }: { compact?: boolean }) {
  return <View style={[s.paper, compact && { padding: 15, gap: 9 }]}>
    <Text style={s.eyebrow}>Một thử thách vật lý nhỏ</Text>
    <Text style={[s.problem, compact && { fontSize: 14, lineHeight: 23 }]}>Một quả bóng được ném từ độ cao <Text style={s.emphasis}>2 m</Text>, với vận tốc <Text style={s.emphasis}>20 m/s</Text> và góc <Text style={s.emphasis}>40°</Text> so với phương ngang.</Text>
    <View style={s.rule} />
    <Text style={[s.problem, compact && { fontSize: 14, lineHeight: 23 }]}>Bóng rơi cách chân điểm ném bao xa?</Text>
    <Text style={s.caption}>Đề mẫu · Bỏ qua sức cản không khí</Text>
  </View>;
}

const s = StyleSheet.create({
  paper: { backgroundColor: '#FFFAF1', borderColor: ink, borderWidth: 2, borderRadius: 5, padding: 20, gap: 13, transform: [{ rotate: '-4deg' }], shadowColor: ink, shadowOffset: { width: 5, height: 5 }, shadowOpacity: 0.15, shadowRadius: 0, elevation: 3 },
  eyebrow: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, lineHeight: 16, letterSpacing: 1, color: '#7D6D88', textTransform: 'uppercase' },
  problem: { fontFamily: 'Nunito_700Bold', fontSize: 16, lineHeight: 27, color: ink },
  emphasis: { fontFamily: 'Nunito_800ExtraBold' },
  rule: { height: 1, backgroundColor: '#E3B3D3' },
  caption: { fontFamily: 'Nunito_700Bold', fontSize: 10, lineHeight: 16, color: '#7D6D88' },
});
