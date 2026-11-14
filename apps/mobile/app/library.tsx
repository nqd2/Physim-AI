import React,{useEffect,useMemo,useState} from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CHAPTERS, type SimulationSummary } from '@physim/shared';
import { Page, Button, Icon, Notice, Tag } from '../src/components/ui';
import { colors,fonts,styles } from '../src/theme';
import { getCatalog } from '../src/lib/api';
import { useAppState } from '../src/context/AppState';
import { createId } from '../src/lib/storage';

export default function LibraryPage(){
  const {settings,saveSession}=useAppState(),router=useRouter();
  const [simulations,setSimulations]=useState<SimulationSummary[]>([]),[query,setQuery]=useState(''),[chapter,setChapter]=useState('all'),[error,setError]=useState(''),[busy,setBusy]=useState(true),[reload,setReload]=useState(0);
  useEffect(()=>{let active=true;setBusy(true);setError('');getCatalog(settings.serverUrl).then(data=>{if(active)setSimulations(data.simulations);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[settings.serverUrl,reload]);
  const visible=useMemo(()=>{const normalized=query.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'');return simulations.filter(sim=>(chapter==='all'||sim.chapter===chapter)&&`${sim.title} ${sim.titleEn} ${sim.slug}`.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(normalized));},[simulations,query,chapter]);
  function open(sim:SimulationSummary){const id=createId('explore'),now=new Date().toISOString();saveSession({id,title:sim.title,slug:sim.slug,version:sim.version,step:0,hintCount:0,causalOrder:[],explanation:'',createdAt:now,updatedAt:now});router.push(`/lab/${id}`);}
  const known=!busy&&!error;
  return <Page title="Thư viện mô phỏng" kicker="Chạm vào điều bạn tò mò" subtitle="Tự tay thay đổi một đại lượng. Quan sát điều xảy ra.">
    <View style={s.pageStack}>
      <View style={s.collectionCard}>
        <View style={s.collectionBand}><View style={s.sticker}><Icon name="compass" size={25}/></View><View style={{flex:1,minWidth:0,gap:2}}><Text style={s.collectionTitle}>Một thế giới để thử!</Text><Text style={s.caption}>Chọn một lab, bắt đầu khám phá</Text></View><Text accessible={false} style={s.sparkle}>✦</Text></View>
        <View style={s.metrics}>
          <View style={s.metric}><Text style={s.metricLabel}>Mô phỏng</Text><Text style={s.metricValue}>{known?simulations.length:'—'}</Text></View>
          <View style={[s.metric,s.metricDark]}><Text style={[s.metricLabel,s.lightText]}>Chương học</Text><Text style={[s.metricValue,{color:colors.white}]}>{known?new Set(simulations.map(item=>item.chapter)).size:'—'}</Text></View>
          <View style={s.metric}><Text style={s.metricLabel}>Có hướng dẫn</Text><Text style={s.metricValue}>{known?simulations.filter(item=>item.adapterVerified).length:'—'}</Text></View>
        </View>
      </View>
      <View style={s.searchCard}>
        <View style={s.search}><Icon name="search" size={20}/><TextInput value={query} onChangeText={setQuery} placeholder="Tìm mô phỏng, hiện tượng…" accessibilityLabel="Tìm mô phỏng" placeholderTextColor={colors.muted} style={s.searchInput}/>{query?<Pressable onPress={()=>setQuery('')} accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" style={s.clearButton}><Icon name="x" size={18}/></Pressable>:null}</View>
        <ScrollView accessibilityRole="radiogroup" accessibilityLabel="Chọn chương" horizontal showsHorizontalScrollIndicator={false} style={s.filterTrack} contentContainerStyle={s.filterContent}>
          <Pressable accessibilityRole="radio" accessibilityState={{checked:chapter==='all'}} aria-checked={chapter==='all'} onPress={()=>setChapter('all')} style={[s.filter,chapter==='all'&&s.selected]}><Text style={[s.filterText,chapter==='all'&&s.selectedText]}>Tất cả</Text></Pressable>
          {CHAPTERS.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{checked:chapter===item.id}} aria-checked={chapter===item.id} onPress={()=>setChapter(item.id)} style={[s.filter,chapter===item.id&&s.selected]}><Text style={[s.filterText,chapter===item.id&&s.selectedText]}>{item.title}</Text></Pressable>)}
        </ScrollView>
      </View>
      {busy?<View style={s.statusCard}><View style={s.statusIcon}><ActivityIndicator color={colors.navy}/></View><Text style={s.cardTitle}>Đang mở tủ đồ khám phá…</Text><Text style={styles.small}>Đang lấy danh mục từ server.</Text></View>:error?<View style={s.statusCard}><Notice tone="error">{error}</Notice><Button onPress={()=>setReload(value=>value+1)} icon="refresh-cw">Thử lại</Button><Button onPress={()=>router.push('/settings')} variant="quiet">Kiểm tra kết nối</Button></View>:<>
        <View style={styles.between}><Text style={s.resultCount}>{visible.length} mô phỏng phù hợp</Text><Tag dark>PhET · HTML5</Tag></View>
        {CHAPTERS.filter(item=>chapter==='all'||item.id===chapter).map(item=>{
          const group=visible.filter(sim=>sim.chapter===item.id);if(!group.length)return null;
          const tint=chapterTint[item.id]||'#DCCBF5';
          return <View key={item.id} style={s.chapterCard}>
            <View style={[s.chapterHeader,{backgroundColor:tint}]}><View style={s.chapterIcon}><Icon name={chapterIcon[item.id]||'circle'} size={25}/></View><View style={{flex:1,minWidth:0,gap:3}}><Text accessibilityRole="header" style={s.cardTitle}>{item.title}</Text><Text style={s.caption}>{item.description}</Text></View><View style={s.countBadge}><Text style={s.countText}>{group.length}</Text></View></View>
            <View style={s.simList}>{group.map(sim=><Pressable accessibilityRole="button" accessibilityLabel={`Mở mô phỏng ${sim.title}`} key={sim.slug} onPress={()=>open(sim)} style={({pressed})=>[s.simRow,pressed&&{backgroundColor:'#FFD0EA',transform:[{translateX:2},{translateY:2}]}]}>
              <View style={[s.simIcon,{backgroundColor:tint}]}><Icon name={sim.adapterVerified?'play':chapterIcon[item.id]||'circle'} size={20}/></View>
              <View style={{flex:1,minWidth:0,gap:7}}><Text style={s.name}>{sim.title}</Text><View style={s.simMeta}><Text style={s.locale}>{sim.locale==='vi'?'Tiếng Việt':'Tiếng Anh'}</Text>{sim.adapterVerified?<View style={s.guidedTag}><Icon name="check" size={10}/><Text style={s.guidedText}>Có hướng dẫn</Text></View>:null}</View></View><Icon name="chevron-right" size={20}/>
            </Pressable>)}</View>
          </View>;
        })}
        {!visible.length?<View style={s.statusCard}><View style={s.statusIcon}><Icon name="search" size={28}/></View><Text style={s.cardTitle}>Chưa tìm thấy mô phỏng</Text><Text style={[styles.body,{textAlign:'center'}]}>Thử tên khác hoặc chọn một chương. Danh mục chỉ xuất hiện khi server đã đồng bộ PhET thành công.</Text></View>:null}
      </>}
      <View style={s.attribution}><Icon name="heart" size={15}/><Text style={[styles.small,{flex:1}]}>Bản mô phỏng gốc của PhET, University of Colorado Boulder. Giữ nguyên logo và thông tin bản quyền; Physim bổ sung kết nối cho hoạt động học tập.</Text></View>
    </View>
  </Page>;
}
const chapterIcon:Record<string,React.ComponentProps<typeof Icon>['name']>={mechanics:'move',thermal:'thermometer',electricity:'zap',waves:'activity',optics:'sun',nuclear:'circle'};
const chapterTint:Record<string,string>={mechanics:'#FFC4E4',thermal:'#FFE27A',electricity:'#7EE5C8',waves:'#DCCBF5',optics:'#FFD1B7',nuclear:'#BFE4F8'};
const shadow={boxShadow:'4px 4px 0px #3B2849',shadowColor:'#3B2849',shadowOffset:{width:4,height:4},shadowOpacity:1,shadowRadius:0,elevation:4};
const smallShadow={boxShadow:'2px 2px 0px #3B2849',shadowColor:'#3B2849',shadowOffset:{width:2,height:2},shadowOpacity:1,shadowRadius:0,elevation:2};
const s=StyleSheet.create({
  pageStack:{gap:20,paddingTop:18,paddingBottom:8},
  collectionCard:{borderWidth:3,borderColor:colors.navy,borderRadius:20,backgroundColor:colors.paper,...shadow},
  collectionBand:{flexDirection:'row',alignItems:'center',gap:10,padding:13,borderBottomWidth:3,borderColor:colors.navy,borderTopLeftRadius:16,borderTopRightRadius:16,backgroundColor:'#FFC4E4'},
  sticker:{width:48,height:48,backgroundColor:colors.white,borderWidth:3,borderColor:colors.navy,borderRadius:13,alignItems:'center',justifyContent:'center',transform:[{rotate:'-5deg'}],...smallShadow},
  collectionTitle:{fontFamily:fonts.heading,fontSize:20,lineHeight:25,color:colors.navy},caption:{fontFamily:fonts.body,fontSize:12,lineHeight:17,color:colors.navy},sparkle:{fontFamily:fonts.heading,fontSize:25,color:colors.navy},
  metrics:{flexDirection:'row',gap:9,padding:13},metric:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',gap:4,borderWidth:3,borderColor:colors.navy,borderRadius:14,paddingHorizontal:4,paddingVertical:10,backgroundColor:colors.white,...smallShadow},metricDark:{backgroundColor:colors.navy},metricLabel:{fontFamily:fonts.heading,fontSize:10,lineHeight:14,textAlign:'center',color:colors.muted},metricValue:{fontFamily:fonts.heading,fontSize:27,lineHeight:32,color:colors.navy},lightText:{color:'#E9D6F5'},
  searchCard:{gap:12},search:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:3,borderColor:colors.navy,backgroundColor:colors.white,paddingLeft:13,borderRadius:14,...smallShadow},searchInput:{flex:1,minWidth:0,minHeight:49,fontFamily:fonts.body,fontSize:14,color:colors.navy,paddingVertical:12,paddingRight:8},clearButton:{width:44,minHeight:44,justifyContent:'center',alignItems:'center'},
  filterTrack:{backgroundColor:colors.navy,borderRadius:14},filterContent:{gap:4,padding:4},filter:{paddingVertical:12,paddingHorizontal:14,borderRadius:10,minHeight:44,justifyContent:'center'},filterText:{fontFamily:fonts.heading,fontSize:13,color:'#E9D6F5'},selected:{backgroundColor:'#FFB3DA'},selectedText:{color:colors.navy},
  resultCount:{fontFamily:fonts.heading,fontSize:16,color:colors.navy,flex:1},chapterCard:{backgroundColor:colors.paper,borderWidth:3,borderColor:colors.navy,borderRadius:20,...shadow},chapterHeader:{flexDirection:'row',alignItems:'center',gap:10,padding:13,borderBottomWidth:3,borderColor:colors.navy,borderTopLeftRadius:16,borderTopRightRadius:16},chapterIcon:{width:44,height:44,borderWidth:3,borderColor:colors.navy,borderRadius:12,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',...smallShadow},cardTitle:{fontFamily:fonts.heading,fontSize:20,lineHeight:25,color:colors.navy},countBadge:{minWidth:29,minHeight:29,paddingHorizontal:6,backgroundColor:colors.navy,borderRadius:20,justifyContent:'center',alignItems:'center'},countText:{fontFamily:fonts.heading,fontSize:13,color:colors.white},
  simList:{padding:12,gap:12},simRow:{flexDirection:'row',gap:10,alignItems:'center',borderWidth:3,borderColor:colors.navy,borderRadius:14,padding:10,backgroundColor:colors.white,...smallShadow},simIcon:{width:42,height:42,borderWidth:2.5,borderColor:colors.navy,borderRadius:10,alignItems:'center',justifyContent:'center'},name:{fontFamily:fonts.heading,fontSize:16,lineHeight:21,color:colors.navy},simMeta:{flexDirection:'row',gap:6,flexWrap:'wrap',alignItems:'center'},locale:{fontFamily:fonts.body,fontSize:11,lineHeight:15,color:colors.muted},guidedTag:{flexDirection:'row',gap:3,alignItems:'center',borderWidth:1.5,borderColor:colors.navy,borderRadius:20,backgroundColor:'#D5F6E9',paddingHorizontal:5,paddingVertical:2},guidedText:{fontFamily:fonts.heading,fontSize:10,lineHeight:13,color:colors.navy},
  statusCard:{gap:14,borderWidth:3,borderColor:colors.navy,borderRadius:20,backgroundColor:colors.paper,padding:18,...shadow},statusIcon:{width:58,height:58,borderWidth:3,borderColor:colors.navy,borderRadius:16,backgroundColor:'#DCCBF5',alignItems:'center',justifyContent:'center',alignSelf:'center',...smallShadow},attribution:{borderTopWidth:2.5,borderStyle:'dashed',borderTopColor:'#B798C3',paddingTop:16,flexDirection:'row',alignItems:'flex-start',gap:8},
});
