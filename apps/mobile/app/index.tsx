import React,{useState} from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { Page,Button,Icon,Notice,Heading } from '../src/components/ui';
import { LessonList,useOpenLesson } from '../src/components/LessonList';
import { StudyAvatar } from '../src/components/StudyIllustrations';
import { colors,fonts,offsetShadow,styles } from '../src/theme';
import { useAppState } from '../src/context/AppState';

export default function HomePage(){
  const router=useRouter(),openLesson=useOpenLesson();
  const {sessions,cards,storageError,saveSession}=useAppState();
  const [weekOffset,setWeekOffset]=useState(0);
  const all=Object.values(sessions),today=new Date(),todayKey=today.toDateString();
  const todaySessions=all.filter(item=>new Date(item.updatedAt).toDateString()===todayKey);
  const done=[todaySessions.length>0,todaySessions.some(item=>Boolean(item.explanation.trim())),cards.some(card=>card.lastReviewedAt&&new Date(card.lastReviewedAt).toDateString()===todayKey)];
  const percent=Math.round(done.filter(Boolean).length/3*100);
  const completed=all.filter(item=>item.completedSteps?.length===4).length;
  const recent=[...all].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  const monday=new Date(today);monday.setDate(today.getDate()-(today.getDay()+6)%7+weekOffset*7);
  const days=Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);return day;});
  function explain(){if(recent){saveSession(recent.id,{step:2,updatedAt:new Date().toISOString()});router.push(`/lab/${recent.id}`);}else openLesson('ohm-current');}
  const quests=[{label:'Khám phá một bài vật lý',action:()=>router.push('/scan')},{label:'Giải thích điều vừa học',action:explain},{label:'Ôn lại kiến thức',action:()=>router.push('/review')}];
  return <Page>
    <View style={s.profile}><View style={s.profileBand}><Text style={s.brand}>Study Buddy</Text></View><View style={s.profileBody}><View style={s.profileTop}><StudyAvatar size={66}/><View style={{flex:1,paddingBottom:3}}><Text accessibilityRole="header" style={s.profileName}>Bạn học</Text><Text style={[styles.label,{fontSize:9}]}>Góc học tập nhỏ của bạn</Text></View></View>
      <View style={s.metrics}>{[['Phiên học',all.length],['Đã hoàn thành',completed],['Thẻ ôn',cards.length]].map(([label,value],i)=><View key={label} style={[s.tile,i===1&&s.darkTile]}><Text style={[styles.label,{fontSize:9,textAlign:'center'},i===1&&{color:colors.paper}]}>{label}</Text><Text style={[styles.number,{fontSize:24},i===1&&{color:colors.white}]}>{value}</Text></View>)}</View>
      <View style={[styles.row,{gap:9}]}><Text style={[styles.label,{fontSize:9}]}>Hôm nay</Text><View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:percent}} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={s.progress}><View style={{width:`${percent}%`,height:'100%',backgroundColor:'#FF8EC7'}}/></View><Text style={s.percent}>{percent}%</Text></View>
    </View></View>
    {storageError?<Notice tone="error">{storageError}</Notice>:null}
    <View style={styles.card}><View style={[styles.between,{gap:8}]}><View style={{flex:1,gap:3}}><Text style={[styles.label,{fontSize:9}]}>{monday.getFullYear()} · Mỗi ngày một chút</Text><Heading style={{fontSize:24,lineHeight:31}}>Tháng {monday.getMonth()+1}</Heading></View><View style={[styles.row,{gap:8}]}><Pressable accessibilityRole="button" accessibilityLabel="Tuần trước" onPress={()=>setWeekOffset(value=>value-1)} style={s.weekButton}><Icon name="chevron-left" size={22}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Tuần sau" onPress={()=>setWeekOffset(value=>value+1)} style={s.weekButton}><Icon name="chevron-right" size={22}/></Pressable></View></View><View style={s.week}>{days.map((day,i)=>{const current=day.toDateString()===todayKey;return <View key={i} style={{flex:1,gap:5,alignItems:'center'}}><Text style={[styles.label,{fontSize:9}]}>{['T2','T3','T4','T5','T6','T7','CN'][i]}</Text><View accessibilityLabel={`${day.toLocaleDateString('vi-VN')}${current?', hôm nay':''}`} style={[s.day,current&&s.darkTile]}><Text style={[styles.number,{fontSize:19},current&&{color:colors.white}]}>{day.getDate()}</Text></View></View>;})}</View></View>
    <View style={styles.card}><View style={[styles.row,{gap:10}]}><View style={s.questIcon}><Icon name="check"/></View><View style={{flex:1}}><Text accessibilityRole="header" style={styles.subtitle}>Việc nhỏ hôm nay</Text><Text style={[styles.label,{fontSize:9}]}>Còn {3-done.filter(Boolean).length} hoạt động</Text></View></View>{quests.map((quest,i)=><Pressable key={quest.label} accessibilityRole="button" onPress={quest.action} style={s.quest}><View style={[s.checkbox,done[i]&&{backgroundColor:colors.pink}]}>{done[i]?<Icon name="check" size={14}/>:null}</View><Text style={[styles.body,{flex:1,fontSize:14},done[i]&&{color:colors.muted}]}>{quest.label}</Text><Icon name="chevron-right" size={17}/></Pressable>)}</View>
    <Button icon="camera" onPress={()=>router.push('/scan')}>Chụp đề bài</Button>
    <Text style={[styles.small,{textAlign:'center'}]}>Bước nhỏ hôm nay. Khám phá lớn ngày mai. ✦</Text>
    <LessonList/>
    {recent?<Button variant="mint" icon="play" onPress={()=>router.push(`/lab/${recent.id}`)}>Tiếp tục bài đang học</Button>:null}
  </Page>;
}
const s=StyleSheet.create({
  profile:{borderWidth:3,borderColor:colors.ink,borderRadius:20,backgroundColor:colors.paper,overflow:'hidden',...offsetShadow},profileBand:{height:61,backgroundColor:'#FFC4E4',borderBottomWidth:3,borderBottomColor:colors.ink,alignItems:'center',paddingTop:11},brand:{fontFamily:fonts.display,fontSize:14,color:colors.white,backgroundColor:colors.ink,borderRadius:20,paddingHorizontal:16,paddingVertical:6},profileBody:{padding:14,gap:12},profileTop:{marginTop:-31,flexDirection:'row',gap:12,alignItems:'flex-end'},profileName:{fontFamily:fonts.bold,fontSize:23,lineHeight:29,color:colors.ink},metrics:{flexDirection:'row',gap:9},tile:{flex:1,minWidth:0,backgroundColor:colors.white,borderWidth:3,borderColor:colors.ink,borderRadius:14,paddingHorizontal:3,paddingVertical:8,alignItems:'center',justifyContent:'center',minHeight:64,boxShadow:'2px 2px 0px #3B2849'},darkTile:{backgroundColor:colors.ink},progress:{height:20,flex:1,backgroundColor:colors.white,borderWidth:3,borderColor:colors.ink,borderRadius:12,overflow:'hidden'},percent:{fontFamily:fonts.bold,fontSize:10,color:colors.white,backgroundColor:colors.ink,borderRadius:15,paddingHorizontal:9,paddingVertical:6},weekButton:{width:42,height:44,borderWidth:3,borderColor:colors.ink,borderRadius:14,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',boxShadow:'2px 2px 0px #3B2849'},week:{flexDirection:'row',gap:5,paddingTop:2},day:{width:'100%',minHeight:39,borderWidth:2.5,borderColor:colors.ink,borderRadius:10,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',boxShadow:'2px 2px 0px #3B2849'},questIcon:{width:42,height:42,borderWidth:3,borderColor:colors.ink,borderRadius:14,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',boxShadow:'2px 2px 0px #3B2849'},quest:{flexDirection:'row',alignItems:'center',gap:10,paddingTop:12,borderTopWidth:2,borderStyle:'dashed',borderTopColor:colors.dash,minHeight:43},checkbox:{width:23,height:23,borderWidth:3,borderColor:colors.ink,borderRadius:7,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},
});
