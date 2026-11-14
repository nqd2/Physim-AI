import React,{useState} from 'react';
import { ActivityIndicator,Pressable,StyleSheet,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { isReviewDue } from '@physim/shared';
import { Page,Button,Icon,Notice,Tag } from '../src/components/ui';
import { fonts } from '../src/theme';
import { useAppState } from '../src/context/AppState';
import { createId,type ReviewCard } from '../src/lib/storage';

const palette={ink:'#3B2849',pink:'#FFB3DA',paper:'#FFEAF5',purple:'#AEA5D6',mint:'#7EE5C8',muted:'#6F5A75',white:'#FFFFFF'};
const ratings=[
  {label:'Quên',color:'#FFFFFF'},
  {label:'Mơ hồ',color:'#FFF1BC'},
  {label:'Khó nhớ',color:'#FFD0EA'},
  {label:'Nhớ',color:'#DCCBF5'},
  {label:'Khá rõ',color:'#CFF5E9'},
  {label:'Rất rõ',color:'#7EE5C8'},
];

export default function ReviewPage(){
  const {cards,reviewCard,saveSession,hydrated}=useAppState(),router=useRouter();
  const [opened,setOpened]=useState<Record<string,boolean>>({}),[message,setMessage]=useState('');
  const now=new Date().toISOString(),due=cards.filter(card=>isReviewDue(card,now));
  const ordered=[...cards].sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
  const reviewed=cards.filter(card=>Boolean(card.lastReviewedAt)||card.repetitions>0).length;
  const progress=cards.length?Math.round(reviewed/cards.length*100):0;
  function reopen(card:ReviewCard){const id=createId('review'),date=new Date().toISOString();saveSession({id,lessonId:card.lessonId,title:card.title,slug:card.slug,version:card.version,screenId:card.screenId,config:card.config,step:0,hintCount:0,causalOrder:[],explanation:'',createdAt:date,updatedAt:date});router.push(`/lab/${id}`);}
  function rate(card:ReviewCard,quality:number){reviewCard(card.id,quality);setOpened(value=>({...value,[card.id]:false}));setMessage('Đã cập nhật lịch ôn theo mức nhớ của bạn.');}

  return <Page title="Ôn lại để nhớ lâu" kicker="Một chút hôm nay, vững vàng ngày mai" subtitle="Tự trả lời trước khi xem đáp án. Sau đó cho biết bạn nhớ được đến đâu.">
    <View style={s.stack}>
      <View style={s.card}>
        <View style={s.summaryHeader}><View style={s.headerIcon}><Icon name="book-open" size={22} color={palette.ink}/></View><Tag dark>Góc ghi nhớ</Tag><Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.sparkle}>✦</Text></View>
        <View style={s.cardBody}>
          <View style={s.metrics}>
            <View style={s.metric}><Text style={s.eyebrow}>Đến hạn</Text><Text style={s.metricValue}>{hydrated?due.length.toString().padStart(2,'0'):'—'}</Text><Text style={s.metricCaption}>hôm nay</Text></View>
            <View style={[s.metric,s.darkTile]}><Text style={[s.eyebrow,s.lightText]}>Đã lưu</Text><Text style={[s.metricValue,s.whiteText]}>{hydrated?cards.length.toString().padStart(2,'0'):'—'}</Text><Text style={[s.metricCaption,s.lightText]}>thẻ ghi nhớ</Text></View>
            <View style={s.metric}><Text style={s.eyebrow}>Đã ôn</Text><Text style={s.metricValue}>{hydrated?reviewed.toString().padStart(2,'0'):'—'}</Text><Text style={s.metricCaption}>thẻ</Text></View>
          </View>
          <View style={s.progressRow}><Text style={s.eyebrow}>Thẻ đã ôn</Text><View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:progress}} accessibilityLabel="Tỷ lệ thẻ đã ôn" style={s.progressTrack}><View style={[s.progressFill,{width:`${progress}%`}]}/></View><Tag dark>{progress}%</Tag></View>
        </View>
      </View>

      {message?<Notice tone="success">{message}</Notice>:null}
      {!hydrated?<View style={[s.card,s.loading]}><ActivityIndicator color={palette.ink}/><Text style={s.body}>Đang mở các thẻ đã lưu…</Text></View>:null}

      {!cards.length&&hydrated?<View style={s.card}>
        <View style={s.emptyTop}><View style={s.bookTile}><Icon name="bookmark" size={36} color={palette.ink}/></View><View style={s.smallSticker}><Icon name="star" size={18} color={palette.ink}/></View></View>
        <View style={s.cardBody}><Text accessibilityRole="header" style={s.cardTitle}>Giữ lại điều vừa hiểu</Text><Text style={s.body}>Hoàn thành bước 04 trong phòng lab để tạo thẻ đầu tiên. Mỗi thẻ giữ cả câu hỏi và cấu hình mô phỏng để bạn mở lại.</Text><View style={s.dashedLine}/><Button onPress={()=>router.replace('/')} icon="arrow-right">Khám phá một bài mẫu</Button><Text style={s.encouragement}>Một lần hiểu. Nhiều lần nhớ. ✦</Text></View>
      </View>:ordered.map(card=><View key={card.id} style={s.card}>
        <View style={s.flashHeader}><View style={s.miniIcon}><Icon name="bookmark" size={17} color={palette.ink}/></View><Text style={s.cardName}>{card.title}</Text><Tag dark={isReviewDue(card,now)}>{isReviewDue(card,now)?'Đến hạn':new Date(card.dueAt).toLocaleDateString('vi-VN')}</Tag></View>
        <View style={s.cardBody}>
          <View style={s.questionPanel}><View style={s.between}><Text style={s.eyebrow}>Thử nhớ lại nhé</Text><View style={s.questionBadge}><Text style={s.questionMark}>?</Text></View></View><Text accessibilityRole="header" style={s.question}>{card.question}</Text></View>
          {opened[card.id]?<>
            <View style={s.answerPanel}><View style={s.answerHeading}><View style={s.answerCheck}><Icon name="check" size={15} color={palette.ink}/></View><Text style={s.eyebrow}>Câu trả lời</Text></View><Text style={s.body}>{card.answer}</Text></View>
            <View style={s.dashedLine}/>
            <View style={{gap:4}}><Text style={s.cardTitle}>Bạn nhớ được đến đâu?</Text><Text style={s.caption}>Chọn mức nhớ để lên lịch ôn lần tới.</Text></View>
            <View style={s.ratingGrid}>{ratings.map((rating,index)=><Pressable key={rating.label} accessibilityRole="button" accessibilityLabel={`Chấm mức nhớ ${index}`} onPress={()=>rate(card,index)} style={({pressed})=>[s.rating,{backgroundColor:rating.color},pressed&&s.pressed]}><Text style={s.ratingNumber}>{index}</Text><Text style={s.ratingText}>{rating.label}</Text></Pressable>)}</View>
          </>:<Button onPress={()=>setOpened(value=>({...value,[card.id]:true}))} variant="secondary" icon="eye">Hiện câu trả lời</Button>}
          <View style={s.dashedLine}/>
          <View style={s.footerMetrics}><View style={s.footerTile}><Text style={s.eyebrow}>Khoảng cách</Text><Text style={s.footerValue}>{card.intervalDays} ngày</Text></View><View style={[s.footerTile,{backgroundColor:'#E6DDFB'}]}><Text style={s.eyebrow}>Đã ôn</Text><Text style={s.footerValue}>{card.repetitions} lần</Text></View></View>
          <Button onPress={()=>reopen(card)} variant="secondary" icon="external-link">Mở lại cấu hình mô phỏng</Button>
          <Text style={s.scheduleNote}>Lịch ôn SM-2 · Đúng mô phỏng, đúng cấu hình đã lưu.</Text>
        </View>
      </View>)}
    </View>
  </Page>;
}

const shadow={boxShadow:'4px 4px 0px #3B2849',shadowColor:palette.ink,shadowOffset:{width:4,height:4},shadowOpacity:1,shadowRadius:0,elevation:3};
const tileShadow={boxShadow:'2px 2px 0px #3B2849',shadowColor:palette.ink,shadowOffset:{width:2,height:2},shadowOpacity:1,shadowRadius:0,elevation:2};
const s=StyleSheet.create({
  stack:{gap:20,paddingTop:18,paddingBottom:8},
  card:{backgroundColor:palette.paper,borderWidth:3,borderColor:palette.ink,borderRadius:20,...shadow},
  cardBody:{padding:14,gap:14},
  summaryHeader:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,backgroundColor:'#FFC4E4',borderTopLeftRadius:16,borderTopRightRadius:16,borderBottomWidth:3,borderColor:palette.ink,padding:10},
  headerIcon:{height:37,width:37,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:palette.ink,borderRadius:11,backgroundColor:palette.white,...tileShadow},
  sparkle:{fontFamily:fonts.heading,fontSize:28,color:palette.ink},
  metrics:{flexDirection:'row',gap:8},
  metric:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',paddingHorizontal:4,paddingVertical:10,borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:palette.white,...tileShadow},
  darkTile:{backgroundColor:palette.ink},
  eyebrow:{fontFamily:fonts.heading,fontSize:10,lineHeight:15,color:palette.muted,letterSpacing:.5,textTransform:'uppercase'},
  metricValue:{fontFamily:fonts.heading,fontVariant:['tabular-nums'],fontSize:30,lineHeight:37,color:palette.ink},
  metricCaption:{fontFamily:fonts.body,fontSize:10,lineHeight:15,color:palette.muted},
  lightText:{color:'#E9D6F5'},
  whiteText:{color:palette.white},
  progressRow:{flexDirection:'row',alignItems:'center',gap:8},
  progressTrack:{flex:1,height:18,borderWidth:3,borderColor:palette.ink,borderRadius:20,overflow:'hidden',backgroundColor:palette.white},
  progressFill:{height:'100%',backgroundColor:'#FF8EC7'},
  loading:{padding:24,alignItems:'center',gap:12},
  emptyTop:{minHeight:120,backgroundColor:'#E6DDFB',borderTopLeftRadius:16,borderTopRightRadius:16,borderBottomWidth:3,borderColor:palette.ink,alignItems:'center',justifyContent:'center'},
  bookTile:{width:74,height:74,backgroundColor:palette.white,borderWidth:3,borderColor:palette.ink,borderRadius:17,alignItems:'center',justifyContent:'center',transform:[{rotate:'-7deg'}],...shadow},
  smallSticker:{position:'absolute',left:'61%',top:23,width:35,height:35,borderWidth:3,borderColor:palette.ink,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:palette.mint,transform:[{rotate:'12deg'}],...tileShadow},
  cardTitle:{fontFamily:fonts.heading,color:palette.ink,fontSize:20,lineHeight:27},
  body:{fontFamily:fonts.body,color:palette.ink,fontSize:15,lineHeight:23},
  encouragement:{fontFamily:fonts.body,fontSize:12,lineHeight:19,color:palette.muted,textAlign:'center'},
  dashedLine:{borderTopWidth:2,borderColor:'#E3B3D3',borderStyle:'dashed'},
  flashHeader:{flexDirection:'row',alignItems:'center',gap:8,padding:12,backgroundColor:'#FFC4E4',borderTopLeftRadius:16,borderTopRightRadius:16,borderBottomWidth:3,borderColor:palette.ink},
  miniIcon:{width:30,height:30,borderWidth:2.5,borderColor:palette.ink,borderRadius:9,backgroundColor:palette.white,alignItems:'center',justifyContent:'center'},
  cardName:{flex:1,minWidth:0,fontFamily:fonts.heading,fontSize:15,lineHeight:21,color:palette.ink},
  questionPanel:{gap:10,padding:13,backgroundColor:palette.white,borderWidth:3,borderColor:palette.ink,borderRadius:14,minHeight:125},
  between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  questionBadge:{width:28,height:28,borderWidth:2.5,borderColor:palette.ink,borderRadius:9,backgroundColor:'#DCCBF5',alignItems:'center',justifyContent:'center'},
  questionMark:{fontFamily:fonts.heading,fontSize:19,lineHeight:23,color:palette.ink},
  question:{fontFamily:fonts.heading,fontSize:21,lineHeight:29,color:palette.ink},
  answerPanel:{padding:13,gap:10,borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:'#D5F6E9'},
  answerHeading:{flexDirection:'row',alignItems:'center',gap:8},
  answerCheck:{width:24,height:24,borderWidth:2.5,borderColor:palette.ink,borderRadius:7,backgroundColor:palette.mint,alignItems:'center',justifyContent:'center'},
  caption:{fontFamily:fonts.body,fontSize:12,lineHeight:19,color:palette.muted},
  ratingGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingRight:2,paddingBottom:2},
  rating:{flexBasis:'30%',flexGrow:1,minWidth:64,minHeight:76,alignItems:'center',justifyContent:'center',gap:3,borderWidth:3,borderColor:palette.ink,borderRadius:12,paddingHorizontal:4,paddingVertical:8,...tileShadow},
  ratingNumber:{fontFamily:fonts.heading,fontSize:26,lineHeight:31,color:palette.ink,fontVariant:['tabular-nums']},
  ratingText:{fontFamily:fonts.bold,fontSize:11,lineHeight:17,color:palette.ink,textAlign:'center'},
  pressed:{transform:[{translateX:2},{translateY:2}],boxShadow:'none',shadowOpacity:0,elevation:0},
  footerMetrics:{flexDirection:'row',gap:10},
  footerTile:{flex:1,minWidth:0,gap:3,padding:10,borderWidth:3,borderColor:palette.ink,borderRadius:12,backgroundColor:palette.white,...tileShadow},
  footerValue:{fontFamily:fonts.heading,fontSize:19,lineHeight:25,color:palette.ink,fontVariant:['tabular-nums']},
  scheduleNote:{fontFamily:fonts.body,fontSize:11,lineHeight:17,color:palette.muted,textAlign:'center'},
});
