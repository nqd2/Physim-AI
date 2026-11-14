import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, fonts, offsetShadow, styles } from '../theme';
import { StudyIcon } from './StudyIllustrations';

export function Icon({name,size=20,color=colors.ink}:{name:React.ComponentProps<typeof Feather>['name'];size?:number;color?:string}) {
  return <Feather accessible={false} aria-hidden name={name} size={size} color={color}/>;
}
export function Button({children,onPress,variant='primary',disabled,busy,icon,style,testID}:{children:React.ReactNode;onPress:()=>void;variant?:'primary'|'secondary'|'quiet'|'dark'|'mint';disabled?:boolean;busy?:boolean;icon?:React.ComponentProps<typeof Feather>['name'];style?:StyleProp<ViewStyle>;testID?:string}) {
  const dark=variant==='dark';
  const backgroundColor=dark?colors.ink:variant==='primary'?colors.pink:variant==='mint'?colors.mint:variant==='quiet'?colors.paper:colors.white;
  return <Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||busy,busy}} aria-disabled={disabled||busy} aria-busy={busy} testID={testID} disabled={disabled||busy} onPress={onPress} style={({pressed})=>[ui.button,{backgroundColor},(disabled||busy)&&{opacity:.5},pressed&&{transform:[{translateX:2},{translateY:2}],boxShadow:'1px 1px 0px #3B2849'},style]}>{busy?<ActivityIndicator size="small" color={dark?colors.white:colors.ink}/>:icon?<Icon name={icon} size={19} color={dark?colors.white:colors.ink}/>:null}<Text style={[ui.buttonText,dark&&{color:colors.white}]}>{children}</Text></Pressable>;
}
export function Notice({children,tone='info'}:{children:React.ReactNode;tone?:'info'|'error'|'success'}) {
  return <View accessibilityLiveRegion="polite" style={[ui.notice,{backgroundColor:tone==='error'?colors.redLight:tone==='success'?colors.greenLight:'#FFF3C9'}]}><Icon name={tone==='error'?'alert-circle':tone==='success'?'check-circle':'info'} size={19}/><Text style={[styles.small,{flex:1,color:colors.ink}]}>{children}</Text></View>;
}
export function Tag({children,dark=false}:{children:React.ReactNode;dark?:boolean}) {return <View style={[ui.tag,dark&&{backgroundColor:colors.ink}]}><Text style={[ui.tagText,dark&&{color:colors.white}]}>{children}</Text></View>;}
export function Heading({children,style}:{children:React.ReactNode;style?:StyleProp<TextStyle>}) {
  const outline=[[-2,-2],[0,-2],[2,-2],[-2,0],[2,0],[-2,2],[0,2],[2,2]] as const;
  return <View style={{position:'relative',minWidth:0}}>{outline.map(([x,y],index)=><Text key={index} accessible={false} aria-hidden style={[styles.title,style,{position:'absolute',top:y,left:x,right:-x,color:colors.ink}]}>{children}</Text>)}<Text accessibilityRole="header" style={[styles.title,style,{color:'#FFF0F8',textShadowColor:colors.ink,textShadowOffset:{width:2,height:3},textShadowRadius:0}]}>{children}</Text></View>;
}
export function Page({children,title,kicker,subtitle,scroll=true,nav=true,headerAction}:{children:React.ReactNode;title?:string;kicker?:string;subtitle?:string;scroll?:boolean;nav?:boolean;headerAction?:React.ReactNode}) {
  const {width}=useWindowDimensions(),pathname=usePathname();
  const wide=pathname.startsWith('/lab/')&&width>=1000;
  const body=<View style={[ui.content,{paddingHorizontal:width<360?14:20}]}>{title?<View style={{gap:8,marginBottom:0}}><View style={[styles.between,{alignItems:'flex-start'}]}><View style={{flex:1}}><Heading>{title}</Heading></View>{headerAction}</View>{kicker?<Text style={styles.label}>{kicker}</Text>:null}{subtitle?<Text style={styles.body}>{subtitle}</Text>:null}</View>:null}{children}</View>;
  return <View style={ui.outer}><View style={[ui.shell,wide&&{maxWidth:1120}]}><Image source={require('../../assets/study-background.png')} resizeMode="stretch" style={StyleSheet.absoluteFill} accessible={false} aria-hidden/><View pointerEvents="none" accessible={false} aria-hidden style={ui.decorationLayer}><View style={[ui.tape,{left:-25,transform:[{rotate:'-32deg'}]}]}>{Array.from({length:7},(_,i)=><View key={i} style={[ui.tapeStripe,{backgroundColor:colors.mint}]}/>)}</View><View style={[ui.tape,{right:-25,transform:[{rotate:'34deg'}]}]}>{Array.from({length:7},(_,i)=><View key={i} style={[ui.tapeStripe,{backgroundColor:colors.yellow}]}/>)}</View><Text style={[ui.heart,{right:-12,top:480}]}>♡</Text><Text style={[ui.heart,{left:-15,top:650}]}>✧</Text></View><SafeAreaView style={{flex:1}} edges={['top','left','right']}>{scroll?<ScrollView contentContainerStyle={{flexGrow:1,paddingTop:34,paddingBottom:nav?118:34}} keyboardShouldPersistTaps="handled">{body}</ScrollView>:body}</SafeAreaView>{nav?<Navigation/>:null}</View></View>;
}
export function Navigation() {
  const pathname=usePathname(),router=useRouter();
  const routes=[{path:'/',label:'Trang chủ',icon:'home'},{path:'/scan',label:'Quét đề',icon:'camera'},{path:'/library',label:'Thư viện',icon:'lab'},{path:'/review',label:'Ôn tập',icon:'book'},{path:'/settings',label:'Cài đặt',icon:'user'}] as const;
  return <SafeAreaView edges={['bottom']} style={ui.navSafe}><View accessibilityRole="tablist" accessibilityLabel="Điều hướng chính" style={ui.nav}>{routes.map(item=>{const selected=pathname===item.path;return <Pressable key={item.path} accessibilityRole="tab" accessibilityState={{selected}} aria-selected={selected} accessibilityLabel={item.label} onPress={()=>{if(!selected)router.replace(item.path);}} style={[ui.navItem,selected&&ui.navActive]}><StudyIcon name={item.icon} size={25} color={selected?colors.ink:colors.white}/></Pressable>;})}</View></SafeAreaView>;
}
export function Divider(){return <View style={{height:2,backgroundColor:colors.dash}}/>;}
const ui=StyleSheet.create({
  outer:{flex:1,backgroundColor:'#F5EFF8',alignItems:'center'},shell:{width:'100%',maxWidth:480,flex:1,backgroundColor:colors.backdrop,overflow:'hidden'},content:{width:'100%',flexGrow:1,gap:16},decorationLayer:{...StyleSheet.absoluteFill,overflow:'hidden'},tape:{position:'absolute',top:14,width:130,height:25,flexDirection:'row',gap:10},tapeStripe:{width:10,height:25,opacity:.85},heart:{position:'absolute',fontSize:85,color:'#FFFFFF99',transform:[{rotate:'12deg'}]},
  navSafe:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:24,paddingBottom:20,alignItems:'center'},nav:{backgroundColor:colors.ink,borderWidth:3,borderColor:colors.white,borderRadius:36,height:70,width:'100%',maxWidth:432,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-around',boxShadow:'4px 4px 0px #7D5C8F'},navItem:{width:46,height:46,borderRadius:24,alignItems:'center',justifyContent:'center'},navActive:{backgroundColor:colors.pink},
  button:{minHeight:50,borderRadius:14,paddingHorizontal:14,paddingVertical:11,borderWidth:3,borderColor:colors.ink,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,...offsetShadow},buttonText:{fontFamily:fonts.heading,fontSize:16,color:colors.ink,lineHeight:21,textAlign:'center',flexShrink:1},notice:{padding:12,borderWidth:2,borderColor:colors.ink,borderRadius:12,flexDirection:'row',alignItems:'flex-start',gap:9},tag:{borderWidth:2,borderColor:colors.ink,backgroundColor:'#FFD0EA',paddingHorizontal:9,paddingVertical:5,alignSelf:'flex-start',maxWidth:'100%',borderRadius:20},tagText:{fontFamily:fonts.heading,fontSize:10,color:colors.ink,lineHeight:14,textTransform:'uppercase'},
});
