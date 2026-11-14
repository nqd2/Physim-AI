import React,{useState} from 'react';
import { Image,Pressable,StyleSheet,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { Page,Button,Icon,Notice,Tag } from '../src/components/ui';
import { LessonList } from '../src/components/LessonList';
import { SciencePaper,StudyIcon } from '../src/components/StudyIllustrations';
import { colors,styles } from '../src/theme';
import { useAppState } from '../src/context/AppState';
import { createId } from '../src/lib/storage';
import { analyzePhoto } from '../src/lib/api';
import { pickPhoto,type PickedPhoto } from '../src/lib/photo';

export default function ScanPage(){
  const router=useRouter(),{settings,saveSession,storageError}=useAppState();
  const [photo,setPhoto]=useState<PickedPhoto|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function choose(camera:boolean){setError('');try{const selected=await pickPhoto(camera);if(selected)setPhoto(selected);}catch(e){setError(e instanceof Error?e.message:'Không mở được ảnh.');}}
  async function analyze(){
    if(!photo||busy)return;setBusy(true);setError('');
    try{
      const id=createId('photo'),analysis=await analyzePhoto(settings.serverUrl,{sessionId:id,image:photo.image});
      if(analysis.status==='unreadable'){setError(analysis.message||'Ảnh chưa rõ. Hãy chụp lại toàn bộ đề trong điều kiện đủ sáng.');return;}
      const now=new Date().toISOString();
      saveSession({id,title:'Bài học từ đề của bạn',slug:analysis.simulationConfig?.slug||analysis.simulationSlug||'',config:analysis.simulationConfig||undefined,screenId:analysis.simulationConfig?.screenId,analysis,step:0,hintCount:0,causalOrder:[],explanation:'',createdAt:now,updatedAt:now});
      setPhoto(null);router.push(`/lab/${id}`);
    }catch(e){setError(e instanceof Error?e.message:'Không phân tích được ảnh.');}finally{setBusy(false);}
  }
  return <Page title="Chụp một câu hỏi" headerAction={<Tag dark>Camera</Tag>}>
    <View style={styles.card}><View style={s.cameraFrame}>{photo?<Image source={{uri:photo.uri}} style={s.photo} accessibilityLabel="Ảnh đề bài đã chọn"/>:<SciencePaper/>}<View pointerEvents="none" style={[s.corner,{left:11,top:11,borderRightWidth:0,borderBottomWidth:0}]}/><View pointerEvents="none" style={[s.corner,{right:11,bottom:11,borderLeftWidth:0,borderTopWidth:0}]}/></View><Text style={[styles.small,{textAlign:'center'}]}>{photo?'Ảnh đã sẵn sàng. Cùng khám phá đề bài nhé!':'Đặt toàn bộ đề bài trong khung hình.'}</Text>
      <View style={s.captureRow}><Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh từ thiết bị" onPress={()=>choose(false)} disabled={busy} style={s.smallButton}><Icon name="image" size={24}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Chụp đề bài" onPress={()=>choose(true)} disabled={busy} style={s.shutter}><View style={s.shutterInside}><StudyIcon name="camera" size={30}/></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Về trang chủ" onPress={()=>router.replace('/')} style={s.smallButton}><StudyIcon name="home" size={24}/></Pressable></View>
      <View style={{flexDirection:'row',justifyContent:'space-around'}}><Text style={styles.small}>Thư viện ảnh</Text><Text style={styles.small}>Chụp ảnh</Text><Text style={styles.small}>Trang chủ</Text></View>
    </View>
    <Notice>Ảnh được gửi tới server và OpenAI để phân tích. Ứng dụng không lưu ảnh trong lịch sử học.</Notice>
    {storageError?<Notice tone="error">{storageError}</Notice>:null}
    {error?<Notice tone="error">{error}</Notice>:null}
    {photo?<View style={{gap:12}}><Button busy={busy} icon="arrow-right" onPress={analyze}>Phân tích đề</Button><Button variant="secondary" disabled={busy} onPress={()=>setPhoto(null)}>Bỏ ảnh</Button></View>:<Text style={[styles.small,{textAlign:'center'}]}>Chưa có ảnh? Thử một bài mẫu bên dưới nhé. ✦</Text>}
    <LessonList/>
  </Page>;
}
const s=StyleSheet.create({cameraFrame:{minHeight:315,borderWidth:3,borderColor:colors.ink,borderRadius:16,backgroundColor:'#EEE6F7',overflow:'hidden',alignItems:'center',justifyContent:'center'},photo:{height:315,width:'100%',resizeMode:'contain'},corner:{position:'absolute',width:38,height:38,borderWidth:4,borderColor:colors.pink},captureRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingVertical:6},smallButton:{width:44,height:44,borderWidth:3,borderColor:colors.ink,borderRadius:14,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',boxShadow:'3px 3px 0px #3B2849'},shutter:{width:72,height:72,borderRadius:38,borderWidth:4,borderColor:colors.ink,backgroundColor:colors.pink,padding:4,boxShadow:'3px 3px 0px #3B2849'},shutterInside:{flex:1,borderWidth:4,borderColor:colors.white,borderRadius:30,alignItems:'center',justifyContent:'center'}});
