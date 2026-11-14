import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStore, useStore } from '../src/shared/store';
import { font, color } from '../src/shared/theme';
import { Notice } from '../src/shared/ui';

function Routes() {
  const { hydrated, storageError } = useStore();
  return <>
    <StatusBar style="dark" />
    {hydrated ? <>
      {storageError ? <View style={{ padding: 8, backgroundColor: color.white }}><Notice tone="error">{storageError}</Notice></View> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper }, animation: 'none' }} />
    </> : <Waiting />}
  </>;
}

function Waiting() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.paper }}>
    <ActivityIndicator accessibilityLabel="Đang mở Physim-AI" color={color.navy} />
  </View>;
}

export default function Layout() {
  const [loaded, error] = useFonts({
    [font.display]: PlusJakartaSans_500Medium,
    [font.heading]: PlusJakartaSans_600SemiBold,
    [font.regular]: Inter_400Regular,
    [font.medium]: Inter_500Medium,
    [font.strong]: Inter_600SemiBold,
  });
  if (!loaded && !error) return <Waiting />;
  return <SafeAreaProvider><AppStore><Routes /></AppStore></SafeAreaProvider>;
}
