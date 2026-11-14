import React,{useEffect,useState} from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Page,Button,Icon,Notice,Tag } from '../src/components/ui';
import { colors,fonts,styles } from '../src/theme';
import { useAppState } from '../src/context/AppState';
import { normalizeServerUrl } from '../src/lib/storage';
import { getHealth } from '../src/lib/api';

const palette={ink:'#3B2849',pink:'#FFB3DA',paper:'#FFEAF5',lavender:'#DCCBF5',mint:'#7EE5C8',white:'#FFFFFF',line:'#E3B3D3'};

export default function SettingsPage(){
  const {settings,setServerUrl,setReduceMotion,storageError,cards,sessions}=useAppState();
  const [url,setUrl]=useState(settings.serverUrl),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[success,setSuccess]=useState(false);
  useEffect(()=>setUrl(settings.serverUrl),[settings.serverUrl]);
  async function connect(){setBusy(true);setMessage('');setSuccess(false);try{const normalized=normalizeServerUrl(url);setServerUrl(normalized);setUrl(normalized);const result=await getHealth(normalized);setSuccess(true);setMessage(result.ai.configured?'Đã kết nối. Phân tích ảnh và phản hồi AI sẵn sàng.':'Đã kết nối. Server chưa cấu hình OpenAI; sáu bài mẫu và mô phỏng vẫn dùng được.');}catch(e){setMessage(e instanceof Error?e.message:'Không kết nối được.');}finally{setBusy(false);}}
  return <Page title="Cài đặt" kicker="Không gian học của bạn">
    <View style={s.stack}>
      <View style={s.shadow}><View style={s.card}>
        <View style={s.profileBand}><Tag dark>Góc học nhỏ</Tag></View>
        <View style={s.profileBody}>
          <View style={s.profileTop}>
            <View style={s.avatar}><Icon name="user" size={38} color={palette.ink}/></View>
            <View style={s.profileName}><Text style={s.name}>Bạn học tò mò</Text><Text style={[styles.small,{color:colors.muted}]}>Mỗi ngày hiểu thêm một chút.</Text></View>
          </View>
          <View style={s.metrics}>
            <View style={s.metric}><Text style={s.metricLabel}>Phiên học</Text><Text style={s.metricValue}>{Object.keys(sessions).length}</Text></View>
            <View style={[s.metric,s.metricDark]}><Text style={[s.metricLabel,s.lightLabel]}>Thẻ ôn</Text><Text style={[s.metricValue,s.lightValue]}>{cards.length}</Text></View>
            <View style={s.metric}><Text style={s.metricLabel}>Kết nối</Text><Text style={[s.metricValue,s.connectionValue]}>{busy?'Đang thử':success?'Sẵn sàng':'Chưa thử'}</Text></View>
          </View>
          <View style={s.profileFooter}><Icon name="heart" size={16} color={palette.ink}/><Text style={[styles.small,{flex:1,color:palette.ink}]}>Một không gian vừa vặn với cách bạn học.</Text></View>
        </View>
      </View></View>

      <View style={s.shadow}><View style={s.card}>
        <View style={s.cardHeader}><View style={s.iconTile}><Icon name="wifi" size={20} color={palette.ink}/></View><Text accessibilityRole="header" style={s.cardTitle}>Kết nối máy chủ</Text></View>
        <View style={s.cardBody}>
          <Text style={styles.body}>Giao diện mô phỏng và AI được phục vụ từ server. Dùng địa chỉ IP LAN khi điện thoại và máy chủ ở cùng Wi-Fi.</Text>
          <View style={s.field}><Text style={styles.label}>Địa chỉ server</Text><TextInput accessibilityLabel="Địa chỉ server" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.9:4000" placeholderTextColor={colors.muted} style={[styles.input,s.serverInput]}/></View>
          <Button busy={busy} icon="wifi" onPress={connect}>Lưu và kiểm tra kết nối</Button>
          {message?<Notice tone={success?'success':'error'}>{message}</Notice>:null}
          <View style={s.tip}><View style={s.tipHeading}><Icon name="info" size={16} color={palette.ink}/><Text style={s.tipTitle}>Mẹo kết nối</Text></View><Text style={[styles.small,{color:palette.ink}]}>Trên điện thoại, localhost là chính điện thoại. Với Android Emulator trên cùng máy, dùng http://10.0.2.2:4000. Khi triển khai qua Internet, dùng HTTPS.</Text></View>
        </View>
      </View></View>

      <View style={s.shadow}><View style={s.card}>
        <View style={[s.cardHeader,{backgroundColor:palette.mint}]}><View style={s.iconTile}><Icon name="wind" size={20} color={palette.ink}/></View><Text accessibilityRole="header" style={s.cardTitle}>Nhịp học của bạn</Text></View>
        <View style={s.cardBody}><View style={s.settingRow}><View style={s.settingCopy}><Text style={s.settingTitle}>Giảm chuyển động</Text><Text style={styles.small}>Ưu tiên chuyển trạng thái trực tiếp và thao tác tĩnh.</Text></View><Switch accessibilityLabel="Giảm chuyển động" value={settings.reduceMotion} onValueChange={setReduceMotion} trackColor={{false:palette.lavender,true:palette.ink}} thumbColor={palette.white}/></View></View>
      </View></View>

      <View style={s.shadow}><View style={s.card}>
        <View style={[s.cardHeader,{backgroundColor:palette.lavender}]}><View style={s.iconTile}><Icon name="shield" size={20} color={palette.ink}/></View><Text accessibilityRole="header" style={s.cardTitle}>Dữ liệu của bạn</Text></View>
        <View style={s.cardBody}>
          <Text style={styles.body}>Tiến độ, thẻ ôn tập và cấu hình mô phỏng được lưu trên thiết bị này. Server không lưu ảnh đề, bài làm hoặc lịch sử học của bạn.</Text>
          <View style={s.privacyRow}><Icon name="smartphone" size={18} color={palette.ink}/><Text style={s.privacyText}>Tiến độ ở lại trên thiết bị của bạn</Text></View>
          <Text style={styles.small}>Khi dùng AI, ảnh và nội dung liên quan được gửi tới server và OpenAI để xử lý. Khóa API chỉ được cấu hình trên server.</Text>
          {storageError?<Notice tone="error">{storageError}</Notice>:null}
        </View>
      </View></View>

      <View style={s.about}><Tag dark>Physim AI · 1.0</Tag><Text style={[styles.body,{textAlign:'center'}]}>Bản thí điểm giáo dục phi thương mại dành cho học sinh THPT.</Text><Text style={[styles.small,{textAlign:'center'}]}>Mô phỏng: PhET Interactive Simulations, University of Colorado Boulder. Ghi công và giấy phép cụ thể được hiển thị cạnh từng mô phỏng.</Text></View>
    </View>
  </Page>;
}

const s=StyleSheet.create({
  stack:{gap:20,paddingTop:16,paddingBottom:12},
  shadow:{borderRadius:20,backgroundColor:palette.paper,shadowColor:palette.ink,shadowOffset:{width:4,height:4},shadowOpacity:1,shadowRadius:0,elevation:3,boxShadow:'4px 4px 0px #3B2849'},
  card:{borderWidth:3,borderColor:palette.ink,borderRadius:20,backgroundColor:palette.paper,overflow:'hidden'},
  profileBand:{minHeight:61,backgroundColor:palette.pink,borderBottomWidth:3,borderBottomColor:palette.ink,alignItems:'center',paddingTop:11,paddingBottom:18},
  profileBody:{padding:14,gap:14},
  profileTop:{flexDirection:'row',gap:12,alignItems:'flex-end',marginTop:-30},
  avatar:{height:66,width:66,borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:palette.lavender,alignItems:'center',justifyContent:'center',shadowColor:palette.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,boxShadow:'3px 3px 0px #3B2849'},
  profileName:{flex:1,minWidth:0,paddingBottom:2,gap:2},
  name:{fontFamily:fonts.heading,color:palette.ink,fontSize:21,lineHeight:27},
  metrics:{flexDirection:'row',gap:8},
  metric:{flex:1,minWidth:0,gap:3,borderWidth:3,borderColor:palette.ink,borderRadius:14,paddingHorizontal:4,paddingVertical:9,backgroundColor:palette.white,alignItems:'center',justifyContent:'center',shadowColor:palette.ink,shadowOffset:{width:2,height:2},shadowOpacity:1,shadowRadius:0,boxShadow:'2px 2px 0px #3B2849'},
  metricDark:{backgroundColor:palette.ink},
  metricLabel:{fontFamily:fonts.heading,fontSize:10,lineHeight:15,letterSpacing:.5,textTransform:'uppercase',color:colors.muted,textAlign:'center'},
  metricValue:{fontFamily:fonts.heading,fontSize:25,lineHeight:30,color:palette.ink,fontVariant:['tabular-nums'],textAlign:'center'},
  connectionValue:{fontSize:15,lineHeight:23},
  lightLabel:{color:palette.lavender},lightValue:{color:palette.white},
  profileFooter:{flexDirection:'row',alignItems:'center',gap:8,borderTopWidth:2,borderTopColor:palette.line,borderStyle:'dashed',paddingTop:12},
  cardHeader:{flexDirection:'row',alignItems:'center',gap:10,padding:12,backgroundColor:palette.pink,borderBottomWidth:3,borderBottomColor:palette.ink},
  iconTile:{width:36,height:36,borderWidth:3,borderColor:palette.ink,borderRadius:10,backgroundColor:palette.white,alignItems:'center',justifyContent:'center'},
  cardTitle:{fontFamily:fonts.heading,fontSize:20,lineHeight:27,color:palette.ink,flex:1,minWidth:0},
  cardBody:{padding:14,gap:14},
  field:{gap:7},
  serverInput:{borderWidth:3,borderColor:palette.ink,borderRadius:12,backgroundColor:palette.white,minHeight:50,paddingHorizontal:12},
  tip:{gap:7,padding:12,borderWidth:2,borderColor:palette.ink,borderRadius:12,backgroundColor:'#FFF3C2'},
  tipHeading:{flexDirection:'row',alignItems:'center',gap:7},
  tipTitle:{fontFamily:fonts.heading,fontSize:14,lineHeight:19,color:palette.ink},
  settingRow:{flexDirection:'row',alignItems:'center',gap:12},
  settingCopy:{flex:1,minWidth:0,gap:5},
  settingTitle:{fontFamily:fonts.heading,fontSize:18,lineHeight:25,color:palette.ink},
  privacyRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderTopWidth:2,borderBottomWidth:2,borderColor:palette.line,borderStyle:'dashed'},
  privacyText:{fontFamily:fonts.bold,fontSize:13,lineHeight:20,color:palette.ink,flex:1},
  about:{alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:6},
});
