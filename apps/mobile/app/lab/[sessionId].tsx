import React,{useCallback,useEffect,useRef,useState} from 'react';
import { ActivityIndicator,Linking,Pressable,StyleSheet,Switch,Text,TextInput,View,useWindowDimensions } from 'react-native';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { getSampleLesson,initialSM2,validateSimulationConfig,SimulationStateSchema,type BridgeReadyPayload,type EnsureReadyResponse,type LearningContext,type SimulationConfig,type SimulationState,type SimulationSchema } from '@physim/shared';
import { Page,Button,Icon,Notice,Tag } from '../../src/components/ui';
import SimulationFrame from '../../src/components/SimulationFrame';
import type {SimulationFrameHandle} from '../../src/components/SimulationFrame.types';
import { colors,fonts,styles } from '../../src/theme';
import { useAppState } from '../../src/context/AppState';
import { createId,type LearningSession } from '../../src/lib/storage';
import { checkWork,ensureReady,evaluateTeachBack,generateVariant,simulationUrl } from '../../src/lib/api';
import { pickPhoto } from '../../src/lib/photo';

export default function LabPage(){
  const {sessionId}=useLocalSearchParams<{sessionId?:string|string[]}>(),{sessions,hydrated}=useAppState(),router=useRouter();
  const id=Array.isArray(sessionId)?sessionId[0]:sessionId;
  const session=id&&Object.hasOwn(sessions,id)?sessions[id]:undefined;
  if(!hydrated)return <Page><View style={{padding:40}}><ActivityIndicator color={colors.navy}/></View></Page>;
  if(!session)return <Page title="Chưa tìm thấy phiên học"><View style={styles.section}><Notice>Phiên này chưa được lưu trên thiết bị hoặc đường dẫn không còn hợp lệ.</Notice><Button onPress={()=>router.replace('/')}>Chọn một bài học</Button></View></Page>;
  return <LabSession key={session.id} session={session}/>;
}

function LabSession({session}:{session:LearningSession}){
  const {settings,saveSession,saveCard,cards,storageError}=useAppState(),router=useRouter(),{width}=useWindowDimensions();
  const lesson=session.lessonId?getSampleLesson(session.lessonId):undefined;
  const guided=Boolean(lesson||session.analysis);
  const frame=useRef<SimulationFrameHandle>(null),sessionRef=useRef(session);sessionRef.current=session;
  const requestedVersion=useRef(session.version||session.config?.version);
  const [source,setSource]=useState<EnsureReadyResponse|null>(null),[ready,setReady]=useState<BridgeReadyPayload|null>(null),[state,setState]=useState<SimulationState|null>(null);
  const [loading,setLoading]=useState(Boolean(session.slug)),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[retry,setRetry]=useState(0),[saved,setSaved]=useState(false);
  const initialized=useRef(false);
  const update=useCallback((patch:Partial<LearningSession>)=>saveSession(session.id,{...patch,updatedAt:new Date().toISOString()}),[saveSession,session.id]);
  useEffect(()=>{
    if(!session.slug){setLoading(false);return;}
    let active=true;initialized.current=false;setLoading(true);setError('');setReady(null);setSource(null);setState(null);
    ensureReady(settings.serverUrl,session.slug,requestedVersion.current).then(value=>{simulationUrl(settings.serverUrl,value.url);if(active)setSource(value);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[settings.serverUrl,session.slug,retry]);
  const onReady=useCallback((value:BridgeReadyPayload)=>{
    if(source&&value.version!==source.version){setError('Phiên bản mô phỏng không khớp với phiên đã mở. Hãy tải lại.');return;}
    setReady(value);setError('');
    if(initialized.current)return;
    initialized.current=true;
    requestedVersion.current=value.version;
    const current=sessionRef.current;
    update({version:value.version,screenId:current.config?.screenId||value.screenId});
    if(current.config&&value.capabilities.applyConfig){
      const config={...current.config,version:value.version};
      const validation=validateSimulationConfig(value.schema,config);
      if(!validation.success){setError(validation.errors.join(' '));return;}
      void frame.current?.command('APPLY_CONFIG',config).then(()=>{update({config});setNotice('Đã mở đúng cấu hình của phiên học.');}).catch(e=>setError(e.message));
    }else if(current.config&&!value.capabilities.applyConfig){setNotice('Mô phỏng này mở ở chế độ tương tác trực tiếp. Cấu hình tự động chưa được hỗ trợ.');}
    else if(value.capabilities.getState){void frame.current?.command<SimulationState>('GET_STATE').then(setState).catch(e=>setError(e.message));}
  },[source,update]);
  const problem=lesson?.problem||session.analysis?.transcription||'Tự thay đổi các đại lượng trong mô phỏng và quan sát mối liên hệ giữa chúng.';
  const hints=lesson?.hints||session.analysis?.hints||[];
  const context:LearningContext={problem,...(session.slug?{slug:session.slug}:{}),...(session.config?{simulationConfig:session.config}:{}),step:(session.step+1) as 1|2|3|4,priorHints:hints.slice(0,session.hintCount)};
  const activeScreen=ready?.schema.screens.find(screen=>screen.id===(state?.screenId||session.screenId||ready.screenId));
  const runAction=activeScreen?.actions[0];
  async function applyConfig(candidate:SimulationConfig){
    if(!ready||!frame.current)throw new Error('Mô phỏng chưa sẵn sàng.');
    const config={...candidate,version:ready.version};
    const validation=validateSimulationConfig(ready.schema,config);
    if(!validation.success)throw new Error(validation.errors.join(' '));
    await frame.current.command('APPLY_CONFIG',config);update({config,screenId:config.screenId,version:ready.version});
  }
  async function run(variant=false){
    if(busy)return;setBusy('experiment');setError('');setNotice('');
    try{
      if(!ready||!frame.current)throw new Error('Đợi mô phỏng sẵn sàng trước khi kiểm chứng.');
      const config=variant?(session.generatedVariant?session.generatedVariant.simulationConfig:lesson?.variant.config):(lesson?.config||session.config);
      if(variant&&!config)throw new Error('Biến thể này chưa có cấu hình mô phỏng phù hợp. Hãy dùng hướng dẫn văn bản; ứng dụng không tự áp cấu hình của một bài khác.');
      if(!ready.schema.adapterVerified)throw new Error('Mô phỏng chưa hỗ trợ thí nghiệm tự động cho phiên bản này. Hãy thao tác và quan sát trực tiếp.');
      if(config&&ready.capabilities.applyConfig)await applyConfig(config);
      const screen=ready.schema.screens.find(item=>item.id===(config?.screenId||state?.screenId||ready.screenId));
      const action=screen?.actions.find(item=>item.id===lesson?.experiment.action)||screen?.actions[0];
      let observed:SimulationState|null=null;
      if(ready.capabilities.runExperiment&&action){const output=await frame.current.command<{state?:unknown}>('RUN_EXPERIMENT',{action:action.id,...(lesson?.experiment.args?{args:lesson.experiment.args}:{})});const parsed=SimulationStateSchema.safeParse(output?.state);if(parsed.success)observed=parsed.data;}
      if(ready.capabilities.getState){observed=await frame.current.command<SimulationState>('GET_STATE');}
      if(!observed||!Object.keys(observed.values).length)throw new Error('Mô phỏng chưa hỗ trợ đọc số liệu tự động. Hãy thao tác và quan sát trực tiếp trong khung mô phỏng.');
      setState(observed);
      update({...(variant?{variantChecked:true}:{predictionChecked:true}),measurements:[...(sessionRef.current.measurements||[]),observed].slice(-100)});
      setNotice('Đã đọc số liệu từ mô phỏng. Hãy so sánh với dự đoán của bạn.');
    }catch(e){setError(e instanceof Error?e.message:'Chưa chạy được thí nghiệm.');}finally{setBusy('');}
  }
  async function sendWork(camera=false){
    if(busy)return;setError('');
    try{const photo=await pickPhoto(camera);if(!photo)return;setBusy('work');const feedback=await checkWork(settings.serverUrl,{sessionId:session.id,image:photo.image,context});update({workFeedback:feedback});}
    catch(e){setError(e instanceof Error?e.message:'Chưa kiểm tra được bài làm.');}finally{setBusy('');}
  }
  async function teach(useAI=false){
    if(!session.explanation.trim()){setError('Viết một câu giải thích của bạn trước khi nhận phản hồi.');return;}
    setError('');setBusy('teach');
    try{
      if(lesson&&!useAI){
        const order=session.causalOrder.length?session.causalOrder:lesson.causalLinks.map(item=>item.id).reverse();
        const correct=order.every((id,index)=>lesson.causalLinks[index]?.id===id);
        update({teachFeedback:{status:'evaluated',correct,missingLinks:correct?[]:lesson.causalLinks.filter((item,index)=>order[index]!==item.id).map(item=>item.text),feedback:correct?`Chuỗi nhân quả khớp thứ tự tham khảo. Hãy tự đối chiếu câu giải thích của bạn: ${lesson.review.answer}`:'Hãy xem lại thứ tự các mắt xích. Bắt đầu từ đại lượng được thay đổi, rồi đến tác động và kết quả quan sát.'}});
      }else{const feedback=await evaluateTeachBack(settings.serverUrl,{sessionId:session.id,context,explanation:session.explanation,orderedLinks:session.causalOrder.map(id=>lesson?.causalLinks.find(item=>item.id===id)?.text||id)});update({teachFeedback:feedback});}
    }catch(e){setError(e instanceof Error?e.message:'Chưa nhận được phản hồi.');}finally{setBusy('');}
  }
  async function newVariant(){setBusy('variant');setError('');try{const variant=await generateVariant(settings.serverUrl,{sessionId:session.id,context});update({generatedVariant:variant,variantPrediction:'',variantChecked:false});}catch(e){setError(e instanceof Error?e.message:'Chưa tạo được biến thể.');}finally{setBusy('');}}
  function reorder(index:number,direction:-1|1){if(!lesson)return;const order=session.causalOrder.length?[...session.causalOrder]:lesson.causalLinks.map(item=>item.id).reverse();const next=index+direction;if(next<0||next>=order.length)return;[order[index],order[next]]=[order[next]!,order[index]!];update({causalOrder:order,teachFeedback:undefined});}
  async function saveReview(){
    setError('');setBusy('save');
    try{
      if(!ready?.capabilities.getState||!ready.schema.adapterVerified||!frame.current)throw new Error('Mô phỏng chưa hỗ trợ lưu và mở lại cấu hình. Bạn có thể tiếp tục khám phá trực tiếp.');
      const observed=await frame.current.command<SimulationState>('GET_STATE');
      const screen=ready.schema.screens.find(item=>item.id===observed.screenId);
      const values=Object.fromEntries((screen?.properties||[]).filter(item=>item.writable&&observed.values[item.key]!==undefined&&observed.values[item.key]!==null).map(item=>[item.key,observed.values[item.key]])) as SimulationConfig['values'];
      const config:SimulationConfig={slug:session.slug,version:ready.version,screenId:observed.screenId,values};
      const valid=validateSimulationConfig(ready.schema,config);if(!valid.success)throw new Error(valid.errors.join(' '));
      const date=new Date().toISOString(),previous=cards.find(card=>card.id===`card-${session.id}`);
      const schedule=previous?{repetitions:previous.repetitions,intervalDays:previous.intervalDays,easeFactor:previous.easeFactor,dueAt:previous.dueAt,lastReviewedAt:previous.lastReviewedAt}:initialSM2(date);
      await saveCard({id:`card-${session.id}`,lessonId:lesson?.id,title:session.title,question:lesson?.review.question||session.generatedVariant?.problem||problem,answer:lesson?.review.answer||session.explanation||'Mở lại mô phỏng và quan sát các số liệu đã lưu.',slug:session.slug,version:ready.version,screenId:observed.screenId,config,createdAt:previous?.createdAt||date,...schedule});
      update({config,completedSteps:[0,1,2,3]});setSaved(true);setNotice('Đã lưu thẻ và cấu hình mô phỏng trên thiết bị.');
    }catch(e){setError(e instanceof Error?e.message:'Chưa lưu được thẻ.');}finally{setBusy('');}
  }
  const variant=session.generatedVariant||lesson?.variant;
  const causalOrder=lesson?(session.causalOrder.length?session.causalOrder:lesson.causalLinks.map(item=>item.id).reverse()):[];
  return <Page nav={!guided}>
    <View style={s.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay về danh sách bài học" onPress={()=>router.back()} style={s.backButton}><Icon name="arrow-left" size={20}/><Text style={s.backLabel}>Quay lại</Text></Pressable>
      <Tag dark>{lesson?'Bài mẫu':session.analysis?'Đề của bạn':'Khám phá tự do'}</Tag>
    </View>
    <View style={s.titleRow}><Text accessibilityRole="header" style={[styles.title,s.labTitle]}>{session.title}</Text><View style={s.labBadge} accessible={false}><Icon name="zap" size={27}/></View></View>
    <View style={s.missionCard}><Text style={s.missionLabel}>Nhiệm vụ của bạn</Text><Text style={s.missionText}>{lesson?.objective||'Thay đổi một đại lượng, quan sát và khám phá điều mới.'}</Text></View>
    <View style={[s.labColumns,width>=1000&&{flexDirection:'row',alignItems:'flex-start'}]}>
      <View style={[s.simColumn,width>=1000&&{flex:1.15}]}>
        <View style={s.sceneHeading}><View style={s.sceneIcon}><Icon name="activity" size={17}/></View><Text style={s.sceneLabel}>Không gian thí nghiệm</Text><Tag>{ready?'Đã kết nối':'PhET'}</Tag></View>
        {loading?<View style={s.simPlaceholder}><View style={s.loadingTile}><Icon name="zap" size={28}/></View><ActivityIndicator color={palette.ink}/><Text style={styles.small}>Đang chuẩn bị mô phỏng…</Text></View>:source?<SimulationFrame ref={frame} url={simulationUrl(settings.serverUrl,source.url)} slug={session.slug} height={width<600?310:440} onReady={onReady} onLoadStart={()=>{initialized.current=false;setReady(null);setState(null);}} onState={setState} onError={setError}/>:session.slug?<View style={s.simPlaceholder}><View style={s.loadingTile}><Icon name="wifi-off" size={26}/></View><Text style={styles.body}>Mô phỏng chưa mở được.</Text><Button onPress={()=>setRetry(value=>value+1)} variant="secondary" icon="refresh-cw">Thử tải lại</Button></View>:<Notice>Đề bài chưa có mô phỏng phù hợp. Bạn vẫn có thể học theo hướng dẫn bằng văn bản bên dưới.</Notice>}
      {source?<Text style={[styles.small,s.attribution]}>{source.attribution}{' · '}<Text accessibilityRole="link" style={{textDecorationLine:'underline'}} onPress={()=>Linking.openURL(source.license.url)}>{source.license.id}</Text>{'\n'}Physim bổ sung bridge cho hoạt động học tập. Phiên bản {source.version} · {source.locale==='vi'?'Tiếng Việt':'Tiếng Anh'}.</Text>:null}
      {ready?<View style={s.controlCard}><Text style={s.controlTitle}>Bảng điều khiển</Text><Text style={styles.small}>{ready.capabilities.applyConfig?'Hỗ trợ đồng bộ cấu hình và đọc số liệu.':'Chế độ tương tác trực tiếp với PhET. Thao tác tự động chưa được hỗ trợ.'}</Text><View style={[styles.row,{flexWrap:'wrap'}]}>{ready.capabilities.resetSim?<Button variant="secondary" style={s.toolbarButton} icon="rotate-ccw" onPress={()=>{void frame.current?.command('RESET_SIM').catch(e=>setError(e.message));}}>Đặt lại</Button>:null}{ready.capabilities.getState?<Button variant="secondary" style={s.toolbarButton} icon="refresh-cw" onPress={()=>{void frame.current?.command<SimulationState>('GET_STATE').then(setState).catch(e=>setError(e.message));}}>Đọc số liệu</Button>:null}</View></View>:null}
      {state?<Measurements state={state} schema={ready?.schema}/>:null}
    </View><View style={[s.lessonColumn,width>=1000&&{flex:1}]}>
      {storageError?<Notice tone="error">{storageError}</Notice>:null}{error?<Notice tone="error">{error}</Notice>:null}{notice?<Notice tone="success">{notice}</Notice>:null}
      <View style={s.problemCard}><View style={s.cardBand}><Icon name="book-open" size={18}/><Text style={s.cardBandTitle}>{lesson?'Tình huống':'Nội dung bài học'}</Text></View><View style={s.cardBody}><Text style={styles.body}>{problem}</Text>{session.analysis?.facts.length?<View style={s.factGrid}>{session.analysis.facts.map((fact,index)=><View key={index} style={s.fact}><Text style={s.metricLabel}>{fact.label}</Text><Text style={[s.metricValue,{fontSize:17,fontFamily:fonts.heading}]}>{fact.value} {fact.unit}</Text></View>)}</View>:null}</View></View>
      {guided?<View style={s.steps}><View style={s.stepSegments} accessibilityRole="tablist">{['Dự đoán','Lý giải','Nói lại','Biến thể'].map((label,index)=><Pressable key={label} accessibilityRole="tab" accessibilityState={{selected:session.step===index}} onPress={()=>update({step:index as 0|1|2|3})} style={[s.stepSegment,session.step===index&&s.stepSegmentSelected]}><Text style={[s.segmentNumber,session.step===index&&s.segmentTextSelected]}>{String(index+1).padStart(2,'0')}</Text><Text style={[s.segmentLabel,session.step===index&&s.segmentTextSelected]}>{label}</Text></Pressable>)}</View>{['Dự đoán & kiểm chứng','Từng bước lý giải','Giải thích bằng lời bạn','Thử một biến thể'].map((title,index)=>{const expanded=session.step===index;return <View key={title} style={s.step}><Pressable accessibilityRole="button" accessibilityState={{expanded}} aria-expanded={expanded} onPress={()=>update({step:index as 0|1|2|3})} style={[s.stepHeading,expanded&&{backgroundColor:stepColors[index]}]}><View style={[s.stepNumber,expanded&&s.stepNumberActive]}><Text style={[s.stepNumberText,expanded&&{color:palette.pink}]}>{String(index+1).padStart(2,'0')}</Text></View><Text style={[s.stepTitle,{flex:1}]}>{title}</Text><View style={s.expandMark}><Icon name={expanded?'minus':'plus'} size={18}/></View></Pressable>{expanded?<View style={s.stepBody}>
        {index===0?<><Text style={styles.body}>{lesson?.prediction.question||'Trước khi quan sát, bạn nghĩ điều gì sẽ xảy ra?'}</Text>{lesson?<Choices options={lesson.prediction.options} value={session.prediction} onChange={prediction=>update({prediction,predictionChecked:false})}/>:<TextInput accessibilityLabel="Dự đoán của bạn" style={[styles.input,{minHeight:90}]} multiline value={session.prediction||''} onChangeText={prediction=>update({prediction,predictionChecked:false})} placeholder="Mình dự đoán rằng…" placeholderTextColor={colors.muted}/>}<Button variant="dark" busy={busy==='experiment'} disabled={!session.prediction||!ready?.capabilities.getState} icon="play" onPress={()=>run(false)}>Chạy và đối chiếu</Button>{!ready?.capabilities.getState?<Text style={styles.small}>Khi mô phỏng không hỗ trợ đọc số liệu, hãy quan sát trực tiếp. Phần giải thích vẫn có thể mở ở bước 02.</Text>:null}{session.predictionChecked&&lesson?<Notice tone={session.prediction===lesson.prediction.correctOptionId?'success':'info'}>{lesson.prediction.explanation}</Notice>:null}<Button variant="quiet" onPress={()=>update({step:1})} icon="arrow-right">Tiếp tục lý giải</Button></>:null}
        {index===1?<><Text style={styles.body}>Mở từng gợi ý khi bạn cần. Dừng lại và thử giải thích trước khi xem tiếp.</Text>{hints.slice(0,session.hintCount).map((hint,i)=><View key={i} style={s.hintCard}><View style={s.hintHeading}><View style={s.hintNumber}><Text style={s.hintNumberText}>{i+1}</Text></View><Text style={s.controlTitle}>Gợi ý {i+1}</Text></View><Text style={styles.body}>{hint}</Text></View>)}{session.hintCount<hints.length?<Button variant="secondary" onPress={()=>update({hintCount:session.hintCount+1})} icon="plus">Mở gợi ý {session.hintCount+1}/{hints.length}</Button>:<Text style={styles.small}>{hints.length?'Bạn đã mở hết gợi ý.':'Hãy xác định đại lượng thay đổi và đại lượng cần quan sát.'}</Text>}{ready?.capabilities.applyConfig&&session.config?<ConfigEditor config={session.config} schema={ready.schema} onApply={async config=>{setBusy('config');setError('');try{await applyConfig(config);setNotice('Đã áp dụng cấu hình đã kiểm tra.');}catch(e){setError(e instanceof Error?e.message:'Cấu hình không hợp lệ.');}finally{setBusy('');}}} busy={busy==='config'}/>:null}<View style={s.insetCard}><View style={s.hintHeading}><View style={s.hintNumber}><Icon name="camera" size={18}/></View><Text style={[styles.subtitle,{flex:1}]}>Đang vướng ở bài làm?</Text></View><Text style={styles.small}>Gửi ảnh bài nháp để AI tìm bước sai đầu tiên và đưa một gợi ý sửa.</Text><Button variant="secondary" busy={busy==='work'} icon="image" onPress={()=>sendWork(false)}>Chọn ảnh bài nháp</Button><Button variant="quiet" icon="camera" onPress={()=>sendWork(true)} disabled={Boolean(busy)}>Chụp bài nháp</Button></View>{session.workFeedback?<Notice tone={session.workFeedback.status==='unreadable'?'error':'info'}>{session.workFeedback.message}{session.workFeedback.firstIncorrectStep?` Bước cần xem lại: ${session.workFeedback.firstIncorrectStep}`:''}{session.workFeedback.hint?` Gợi ý: ${session.workFeedback.hint}`:''}</Notice>:null}<Button variant="quiet" onPress={()=>update({step:2})} icon="arrow-right">Thử giải thích lại</Button></>:null}
        {index===2?<><View style={s.chatRow}><View style={s.buddyAvatar} accessible={false}><Icon name="heart" size={25}/></View><View style={s.promptBubble}><Text style={styles.body}>{lesson?.teachBackPrompt||'Dùng lời của bạn để giải thích mối liên hệ giữa dữ kiện và kết quả.'}</Text></View></View>{lesson?<><Text style={styles.label}>Sắp xếp chuỗi nhân quả</Text>{causalOrder.map((id,i)=><View key={id} style={s.causal}><View style={s.causalNumber}><Text style={s.causalNumberText}>{i+1}</Text></View><Text style={[styles.body,{flex:1,fontSize:13,lineHeight:21}]}>{lesson.causalLinks.find(item=>item.id===id)?.text}</Text><View><Pressable accessibilityRole="button" accessibilityLabel={`Đưa mắt xích ${i+1} lên`} disabled={i===0} onPress={()=>reorder(i,-1)} style={[s.moveButton,i===0&&{opacity:.25}]}><Icon name="chevron-up" size={18}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Đưa mắt xích ${i+1} xuống`} disabled={i===causalOrder.length-1} onPress={()=>reorder(i,1)} style={[s.moveButton,i===causalOrder.length-1&&{opacity:.25}]}><Icon name="chevron-down" size={18}/></Pressable></View></View>)}</>:null}<View style={s.answerBubble}><Text style={s.answerLabel}>Lời giải thích của bạn</Text><TextInput accessibilityLabel="Câu giải thích của bạn" multiline style={[styles.input,s.replyInput]} value={session.explanation} onChangeText={explanation=>update({explanation,teachFeedback:undefined})} placeholder="Vì… nên… dẫn đến…" placeholderTextColor={colors.muted}/></View><Button variant="dark" onPress={()=>teach(false)} busy={busy==='teach'} disabled={!session.explanation.trim()} icon="check">{lesson?'Đối chiếu bài mẫu':'Nhận phản hồi AI'}</Button>{lesson?<><Text style={styles.small}>Bài mẫu kiểm tra thứ tự mắt xích và cho lời giải tham khảo; câu viết của bạn chưa được AI đánh giá.</Text><Button variant="quiet" onPress={()=>teach(true)} disabled={Boolean(busy)||!session.explanation.trim()}>Nhờ AI nhận xét câu giải thích</Button></>:null}{session.teachFeedback?<Notice tone={session.teachFeedback.correct?'success':'info'}>{session.teachFeedback.feedback}{session.teachFeedback.missingLinks.length?` Cần xem lại: ${session.teachFeedback.missingLinks.join(' → ')}`:''}</Notice>:null}<Button variant="quiet" onPress={()=>update({step:3})} icon="arrow-right">Thử một điều kiện mới</Button></>:null}
        {index===3?<><View style={s.variantBubble}><View style={s.hintHeading}><Icon name="zap" size={20}/><Text style={s.controlTitle}>Một thay đổi nhỏ…</Text></View><Text style={styles.body}>{variant?.problem||'Tạo một đề tương tự nhưng thay đổi một điều kiện để kiểm tra điều bạn vừa hiểu.'}</Text></View>{variant?<Tag>{variant.changedCondition}</Tag>:null}{!session.generatedVariant&&lesson?<Choices options={lesson.variant.prediction.options} value={session.variantPrediction} onChange={variantPrediction=>update({variantPrediction,variantChecked:false})}/>:<TextInput accessibilityLabel="Dự đoán biến thể" style={[styles.input,{minHeight:90}]} multiline placeholder="Nếu thay đổi điều kiện này, mình dự đoán…" placeholderTextColor={colors.muted} value={session.variantPrediction||''} onChangeText={variantPrediction=>update({variantPrediction,variantChecked:false})}/>}<Button variant="dark" busy={busy==='experiment'} disabled={!session.variantPrediction||!ready?.capabilities.getState||!variant} icon="play" onPress={()=>run(true)}>Kiểm chứng biến thể</Button>{session.variantChecked&&lesson&&!session.generatedVariant?<Notice tone={session.variantPrediction===lesson.variant.prediction.correctOptionId?'success':'info'}>{lesson.variant.prediction.explanation}</Notice>:null}<Button variant="quiet" busy={busy==='variant'} onPress={newVariant} icon="refresh-cw">Tạo biến thể khác bằng AI</Button><View style={s.reviewCard}><View style={s.hintHeading}><View style={s.reviewMark}><Icon name="bookmark" size={23}/></View><Text style={[styles.subtitle,{flex:1}]}>Giữ lại điều vừa hiểu</Text></View><Text style={styles.small}>Thẻ ôn tập lưu câu hỏi, phiên bản và cấu hình hiện tại. Bạn có thể mở lại đúng thí nghiệm này.</Text><Button busy={busy==='save'} disabled={!session.variantChecked||saved} onPress={saveReview} icon="bookmark">{saved?'Đã lưu thẻ ôn tập':'Lưu thẻ ôn tập'}</Button>{saved?<Button variant="quiet" onPress={()=>router.push('/review')}>Xem lịch ôn tập</Button>:null}</View></>:null}
      </View>:null}</View>;})}</View>:<View style={s.controlCard}><Text style={styles.subtitle}>Thử thay đổi một đại lượng</Text><Text style={styles.body}>Quan sát mô phỏng và đặt câu hỏi: điều gì thay đổi, điều gì giữ nguyên?</Text>{runAction&&ready?.capabilities.runExperiment?<Button onPress={()=>run(false)} busy={busy==='experiment'} icon="play">{runAction.name}</Button>:null}{ready?.capabilities.getState?<Button onPress={saveReview} busy={busy==='save'} variant="secondary" icon="bookmark">Lưu cấu hình để ôn tập</Button>:null}</View>}
    </View></View><View style={{height:28}}/>
  </Page>;
}

function Choices({options,value,onChange}:{options:readonly {id:string;text:string}[];value?:string;onChange:(value:string)=>void}){
  return <View accessibilityRole="radiogroup" style={{gap:11}}>{options.map((option,index)=>{
    const selected=value===option.id;
    return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{checked:selected}} aria-checked={selected} onPress={()=>onChange(option.id)} style={[s.choice,selected&&s.choiceSelected]}>
      <View style={[s.choiceLetter,selected&&s.choiceLetterSelected]}><Text style={[s.choiceLetterText,selected&&{color:palette.pink}]}>{String.fromCharCode(65+index)}</Text></View>
      <Text style={[styles.body,{flex:1,minWidth:0,fontSize:14,lineHeight:22}]}>{option.text}</Text>
      {selected?<Icon name="check" size={17}/>:null}
    </Pressable>;
  })}</View>;
}
function Measurements({state,schema}:{state:SimulationState;schema?:SimulationSchema}){
  const {width}=useWindowDimensions();
  const screen=schema?.screens.find(item=>item.id===state.screenId);
  const entries=Object.entries(state.values).slice(0,12);
  return <View style={s.measurementSection}>
    <View style={s.sceneHeading}><View style={s.sceneIcon}><Icon name="bar-chart-2" size={17}/></View><Text style={s.sceneLabel}>Số liệu đang quan sát</Text></View>
    <View style={s.factGrid}>{entries.map(([key,value])=>{
      const property=screen?.properties.find(item=>item.key===key);
      return <View key={key} style={[s.fact,{flexBasis:width<360?'43%':'27%'}]}>
        <Text style={s.metricLabel}>{property?.name||key}</Text>
        <Text style={[s.metricValue,typeof value!=='number'&&{fontFamily:fonts.heading}]}>{value===null?'—':typeof value==='number'?Number(value.toFixed(3)).toLocaleString('vi-VN'):typeof value==='boolean'?(value?'Bật':'Tắt'):String(value)}{property?.unit?<Text style={s.metricUnit}>{` ${property.unit}`}</Text>:null}</Text>
      </View>;
    })}</View>
  </View>;
}
function ConfigEditor({config,schema,onApply,busy}:{config:SimulationConfig;schema:SimulationSchema;onApply:(config:SimulationConfig)=>Promise<void>;busy:boolean}){
  const [draft,setDraft]=useState<Record<string,string|boolean>>({});
  useEffect(()=>setDraft(Object.fromEntries(Object.entries(config.values).map(([key,value])=>[key,typeof value==='boolean'?value:String(value)]))),[config]);
  const properties=schema.screens.find(item=>item.id===config.screenId)?.properties.filter(item=>item.writable&&Object.hasOwn(config.values,item.key))||[];
  const [error,setError]=useState('');
  async function apply(){const values:SimulationConfig['values']={};for(const property of properties){const raw=draft[property.key];if(property.type==='number'){if(typeof raw!=='string'||!raw.trim()){setError(`Nhập giá trị cho ${property.name||property.key}.`);return;}values[property.key]=Number(raw);}else values[property.key]=property.type==='boolean'?Boolean(raw):String(raw);}const candidate={...config,values};const checked=validateSimulationConfig(schema,candidate);if(!checked.success){setError(checked.errors.join(' '));return;}setError('');await onApply(candidate);}
  return <View style={s.configCard}>
    <View style={s.hintHeading}><View style={s.hintNumber}><Icon name="sliders" size={18}/></View><Text style={s.controlTitle}>Thông số mô phỏng</Text></View>
    {properties.map(property=><View key={property.key} style={s.configField}>
      <View style={s.configLabelRow}><Text style={[s.configLabel,{flex:1}]}>{property.name||property.key}</Text>{property.unit?<Tag>{property.unit}</Tag>:null}</View>
      {property.type==='boolean'?<Switch accessibilityLabel={property.name||property.key} value={Boolean(draft[property.key])} trackColor={{false:'#E6DDFB',true:palette.pink}} thumbColor={palette.ink} onValueChange={value=>setDraft(current=>({...current,[property.key]:value}))}/>:<TextInput accessibilityLabel={property.name||property.key} value={String(draft[property.key]??'')} onChangeText={value=>setDraft(current=>({...current,[property.key]:value}))} style={[styles.input,s.configInput]} keyboardType={property.type==='number'?'numeric':'default'}/>}
      {property.min!==undefined&&property.max!==undefined?<Text style={s.rangeLabel}>{property.min} – {property.max}{property.unit?` ${property.unit}`:''}</Text>:null}
    </View>)}
    {error?<Notice tone="error">{error}</Notice>:null}
    <Button variant="secondary" onPress={apply} busy={busy} icon="sliders">Áp dụng cấu hình</Button>
  </View>;
}
const palette={ink:'#3B2849',pink:'#FFB3DA',paper:'#FFEAF5',lavender:'#AEA5D6',lavenderLight:'#E6DDFB',mint:'#7EE5C8',yellow:'#FFE27A',muted:'#6F5A75',white:'#FFFFFF'};
const stepColors=[palette.pink,palette.lavenderLight,palette.mint,palette.yellow];
const s=StyleSheet.create({
  topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingTop:16,paddingBottom:18},
  backButton:{minHeight:44,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7,borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:palette.white,boxShadow:'3px 3px 0 #3B2849'},
  backLabel:{fontFamily:fonts.heading,color:palette.ink,fontSize:15},
  titleRow:{flexDirection:'row',alignItems:'center',gap:12,paddingBottom:15},
  labTitle:{flex:1,minWidth:0,fontSize:28,lineHeight:35},
  labBadge:{width:52,height:52,borderWidth:3,borderColor:palette.ink,borderRadius:15,backgroundColor:palette.pink,boxShadow:'3px 3px 0 #3B2849',alignItems:'center',justifyContent:'center'},
  missionCard:{backgroundColor:palette.ink,borderWidth:3,borderColor:palette.ink,borderRadius:20,paddingHorizontal:14,paddingVertical:12,gap:4,boxShadow:'4px 4px 0 #7D5C8F',marginBottom:21},
  missionLabel:{fontFamily:fonts.heading,color:'#E9D6F5',fontSize:10,lineHeight:15,letterSpacing:1.2,textTransform:'uppercase'},
  missionText:{fontFamily:fonts.bold,color:palette.white,fontSize:15,lineHeight:23},
  labColumns:{gap:22},simColumn:{gap:16,minWidth:0},lessonColumn:{gap:18,minWidth:0},
  sceneHeading:{flexDirection:'row',alignItems:'center',gap:8,minWidth:0},
  sceneIcon:{width:29,height:29,borderWidth:2.5,borderColor:palette.ink,borderRadius:9,backgroundColor:palette.white,alignItems:'center',justifyContent:'center'},
  sceneLabel:{fontFamily:fonts.heading,color:palette.ink,fontSize:15,lineHeight:20,flex:1,minWidth:0},
  simPlaceholder:{minHeight:270,borderWidth:3,borderColor:palette.ink,borderRadius:20,backgroundColor:palette.lavenderLight,padding:20,alignItems:'center',justifyContent:'center',gap:16,boxShadow:'5px 5px 0 #3B2849'},
  loadingTile:{width:58,height:58,borderWidth:3,borderColor:palette.ink,borderRadius:15,backgroundColor:palette.pink,alignItems:'center',justifyContent:'center',boxShadow:'3px 3px 0 #3B2849'},
  attribution:{fontSize:10,lineHeight:16,paddingHorizontal:4},
  controlCard:{borderWidth:3,borderColor:palette.ink,borderRadius:20,backgroundColor:palette.paper,padding:14,gap:12,boxShadow:'5px 5px 0 #3B2849'},
  controlTitle:{fontFamily:fonts.heading,color:palette.ink,fontSize:18,lineHeight:24,flexShrink:1},
  toolbarButton:{flexGrow:1},
  problemCard:{borderWidth:3,borderColor:palette.ink,borderRadius:20,backgroundColor:palette.paper,boxShadow:'5px 5px 0 #3B2849',overflow:'hidden'},
  cardBand:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:palette.pink,borderBottomWidth:3,borderBottomColor:palette.ink,paddingHorizontal:14,paddingVertical:10},
  cardBandTitle:{fontFamily:fonts.heading,color:palette.ink,fontSize:19,lineHeight:25},
  cardBody:{gap:12,padding:12,borderWidth:3,borderColor:palette.white,borderBottomLeftRadius:16,borderBottomRightRadius:16},
  steps:{gap:17},
  stepSegments:{flexDirection:'row',backgroundColor:palette.ink,padding:4,gap:3,borderRadius:17},
  stepSegment:{flex:1,minWidth:0,minHeight:58,borderRadius:12,alignItems:'center',justifyContent:'center',paddingVertical:7,paddingHorizontal:2,gap:1},
  stepSegmentSelected:{backgroundColor:palette.pink},
  segmentNumber:{fontFamily:fonts.display,fontSize:18,lineHeight:21,color:'#E9D6F5',fontVariant:['tabular-nums']},
  segmentLabel:{fontFamily:fonts.heading,fontSize:11,lineHeight:17,color:'#E9D6F5',textAlign:'center'},
  segmentTextSelected:{color:palette.ink},
  step:{borderWidth:3,borderColor:palette.ink,borderRadius:20,backgroundColor:palette.paper,boxShadow:'4px 4px 0 #3B2849',overflow:'hidden'},
  stepHeading:{minHeight:74,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,paddingLeft:12,paddingRight:7},
  stepNumber:{width:38,height:42,borderWidth:3,borderColor:palette.ink,borderRadius:12,backgroundColor:palette.white,alignItems:'center',justifyContent:'center'},
  stepNumberActive:{backgroundColor:palette.ink},
  stepNumberText:{fontFamily:fonts.display,fontSize:20,lineHeight:25,color:palette.ink,fontVariant:['tabular-nums']},
  stepTitle:{fontFamily:fonts.heading,fontSize:18,lineHeight:24,color:palette.ink,minWidth:0},
  expandMark:{width:30,minHeight:44,alignItems:'center',justifyContent:'center'},
  stepBody:{padding:12,gap:16,borderTopWidth:3,borderTopColor:palette.ink},
  choice:{flexDirection:'row',gap:10,alignItems:'center',padding:10,borderWidth:3,borderColor:palette.ink,backgroundColor:palette.white,minHeight:62,borderRadius:14,boxShadow:'3px 3px 0 #3B2849'},
  choiceSelected:{backgroundColor:palette.pink},
  choiceLetter:{width:30,height:32,borderRadius:9,borderWidth:2.5,borderColor:palette.ink,backgroundColor:palette.paper,alignItems:'center',justifyContent:'center'},
  choiceLetterSelected:{backgroundColor:palette.ink},
  choiceLetterText:{fontFamily:fonts.display,color:palette.ink,fontSize:16,lineHeight:21},
  hintCard:{borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:palette.white,padding:12,gap:10,boxShadow:'3px 3px 0 #3B2849'},
  hintHeading:{flexDirection:'row',alignItems:'center',gap:10,minWidth:0},
  hintNumber:{width:32,height:34,borderWidth:2.5,borderColor:palette.ink,borderRadius:10,backgroundColor:palette.pink,alignItems:'center',justifyContent:'center'},
  hintNumberText:{fontFamily:fonts.display,fontSize:19,color:palette.ink},
  insetCard:{borderWidth:3,borderColor:palette.ink,borderRadius:16,backgroundColor:palette.lavenderLight,padding:12,gap:12,boxShadow:'3px 3px 0 #3B2849'},
  chatRow:{flexDirection:'row',alignItems:'flex-end',gap:9},
  buddyAvatar:{width:45,height:49,borderWidth:3,borderColor:palette.ink,borderRadius:13,backgroundColor:palette.white,alignItems:'center',justifyContent:'center',boxShadow:'3px 3px 0 #3B2849'},
  promptBubble:{flex:1,minWidth:0,backgroundColor:palette.lavenderLight,borderWidth:3,borderColor:palette.ink,borderRadius:17,borderBottomLeftRadius:5,padding:10,boxShadow:'3px 3px 0 #3B2849'},
  causal:{flexDirection:'row',alignItems:'center',gap:8,borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:palette.white,padding:8,boxShadow:'3px 3px 0 #3B2849'},
  causalNumber:{width:28,height:40,borderRadius:8,backgroundColor:palette.ink,alignItems:'center',justifyContent:'center'},
  causalNumberText:{fontFamily:fonts.display,fontSize:25,color:palette.pink},
  moveButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:palette.paper,borderWidth:2,borderColor:palette.ink,borderRadius:10},
  answerBubble:{marginLeft:16,borderWidth:3,borderColor:palette.ink,borderRadius:17,borderBottomRightRadius:5,backgroundColor:palette.paper,padding:10,gap:4,boxShadow:'3px 3px 0 #3B2849'},
  answerLabel:{fontFamily:fonts.heading,color:palette.muted,fontSize:12,lineHeight:18},
  replyInput:{minHeight:110,textAlignVertical:'top',backgroundColor:'transparent',borderWidth:0,padding:0},
  variantBubble:{borderWidth:3,borderColor:palette.ink,borderRadius:15,backgroundColor:'#FFF0B8',padding:12,gap:10,boxShadow:'3px 3px 0 #3B2849'},
  reviewCard:{borderWidth:3,borderColor:palette.ink,borderRadius:18,backgroundColor:'#D5F6E9',padding:12,gap:12,boxShadow:'3px 3px 0 #3B2849'},
  reviewMark:{width:42,height:45,borderWidth:3,borderColor:palette.ink,borderRadius:12,backgroundColor:palette.white,alignItems:'center',justifyContent:'center',boxShadow:'2px 2px 0 #3B2849'},
  measurementSection:{gap:11},
  factGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,paddingBottom:3},
  fact:{minWidth:0,flexBasis:'40%',flexGrow:1,gap:5,padding:8,borderWidth:3,borderColor:palette.ink,borderRadius:14,backgroundColor:palette.white,boxShadow:'3px 3px 0 #3B2849',alignItems:'center'},
  metricLabel:{fontFamily:fonts.heading,fontSize:10,lineHeight:15,letterSpacing:.5,textTransform:'uppercase',textAlign:'center',color:palette.muted},
  metricValue:{fontFamily:fonts.display,fontSize:21,lineHeight:27,fontVariant:['tabular-nums'],textAlign:'center',color:palette.ink},
  metricUnit:{fontFamily:fonts.heading,fontSize:12,lineHeight:17},
  configCard:{borderWidth:3,borderColor:palette.ink,borderRadius:17,backgroundColor:palette.white,padding:12,gap:14,boxShadow:'3px 3px 0 #3B2849'},
  configField:{gap:7},
  configLabelRow:{flexDirection:'row',alignItems:'center',gap:8},
  configLabel:{fontFamily:fonts.heading,color:palette.muted,fontSize:12,lineHeight:18},
  configInput:{borderWidth:3,borderColor:palette.ink,borderRadius:13,backgroundColor:palette.paper,minHeight:48,fontFamily:fonts.heading,fontSize:19},
  rangeLabel:{fontFamily:fonts.body,color:palette.muted,fontSize:11,lineHeight:16},
});
