import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { AppStateProvider } from '../src/context/AppState';
import { colors } from '../src/theme';

export default function RootLayout(){
  const [loaded,error]=useFonts({
    Fredoka_600SemiBold:require('../assets/fonts/Fredoka_600SemiBold.ttf'),
    Nunito_400Regular:require('../assets/fonts/Nunito_400Regular.ttf'),
    Nunito_700Bold:require('../assets/fonts/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold:require('../assets/fonts/Nunito_800ExtraBold.ttf'),
  });
  if(!loaded&&!error)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.paper}}><ActivityIndicator color={colors.navy}/></View>;
  return <SafeAreaProvider><AppStateProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,animation:'none',contentStyle:{backgroundColor:colors.paper}}}/></AppStateProvider></SafeAreaProvider>;
}
