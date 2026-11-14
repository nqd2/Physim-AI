import { StyleSheet } from 'react-native';

export const colors = {
  ink:'#3B2849', pink:'#FFB3DA', purple:'#AEA5D6', mint:'#7EE5C8', yellow:'#FFE27A',
  navy:'#3B2849', gold:'#9A437C', goldLight:'#FFD0EA', paper:'#FFEAF5',
  white:'#FFFFFF', muted:'#6F5A75', line:'#3B2849', green:'#28694F',
  greenLight:'#D5F6E9', red:'#973D63', redLight:'#FFE0E9', blueLight:'#E6DDFB',
  dash:'#E3B3D3', backdrop:'#FFD2EC',
};
// Fredoka's upstream font lacks Vietnamese tone letters; Nunito keeps those headings complete.
export const fonts = { body:'Nunito_700Bold', medium:'Nunito_800ExtraBold', bold:'Nunito_800ExtraBold', heading:'Nunito_800ExtraBold', display:'Fredoka_600SemiBold' };
export const offsetShadow = { boxShadow:'4px 4px 0px #3B2849' } as const;
export const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, color: colors.navy, fontSize:15, lineHeight:23 },
  small: { fontFamily: fonts.body, color:colors.muted, fontSize:12, lineHeight:19 },
  label: { fontFamily:fonts.bold, color:colors.muted, fontSize:10, lineHeight:15, letterSpacing:.7, textTransform:'uppercase' },
  title: { fontFamily:fonts.heading, color:colors.navy, fontSize:28, lineHeight:35 },
  subtitle: { fontFamily:fonts.heading, color:colors.navy, fontSize:21, lineHeight:27 },
  section: { gap:14, paddingVertical:12 },
  row: { flexDirection:'row', alignItems:'center', gap:12 },
  between: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12 },
  card: { backgroundColor:colors.paper, borderWidth:3, borderColor:colors.ink, borderRadius:20, padding:14, gap:12,...offsetShadow },
  input: { backgroundColor:colors.white, borderWidth:3, borderColor:colors.line, borderRadius:12, padding:12, color:colors.navy, fontFamily:fonts.body, fontSize:16, minHeight:48 },
  number: { fontFamily:fonts.display, fontVariant:['tabular-nums'], color:colors.navy },
});
