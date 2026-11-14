import React from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { SAMPLE_LESSONS,CHAPTERS } from '@physim/shared';
import { useAppState } from '../context/AppState';
import { createId,type LearningSession } from '../lib/storage';
import { colors,fonts,styles } from '../theme';
import { Icon,Tag } from './ui';

export function useOpenLesson(){
  const {saveSession}=useAppState(),router=useRouter();
  return (id:string)=>{
    const lesson=SAMPLE_LESSONS.find(item=>item.id===id);if(!lesson)return;
    const now=new Date().toISOString(),sessionId=createId('lesson');
    const session:LearningSession={id:sessionId,lessonId:lesson.id,title:lesson.title,slug:lesson.slug,config:lesson.config,screenId:lesson.config.screenId,step:0,hintCount:0,causalOrder:lesson.causalLinks.map(item=>item.id).reverse(),explanation:'',createdAt:now,updatedAt:now};
    saveSession(session);router.push(`/lab/${sessionId}`);
  };
}
export function LessonList(){
  const open=useOpenLesson(),{hydrated,sessions}=useAppState();
  const complete=new Set(Object.values(sessions).filter(item=>item.completedSteps?.length===4).map(item=>item.lessonId));
  return <View style={styles.card}><View style={styles.between}><View style={{flex:1,gap:3}}><Text accessibilityRole="header" style={styles.subtitle}>Sáu câu hỏi đáng thử</Text><Text style={styles.label}>Bài mẫu · Không cần AI</Text></View><Tag>06 bài</Tag></View>{SAMPLE_LESSONS.map((lesson,index)=><Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={`Mở bài ${lesson.title}`} disabled={!hydrated} onPress={()=>open(lesson.id)} style={({pressed})=>[s.row,pressed&&{backgroundColor:colors.goldLight}]}><View style={[s.number,{backgroundColor:complete.has(lesson.id)?colors.mint:colors.white}]}>{complete.has(lesson.id)?<Icon name="check" size={15}/>:<Text style={[styles.number,{fontSize:16}]}>{index+1}</Text>}</View><View style={{flex:1,gap:3}}><Text style={s.title}>{lesson.title}</Text><Text style={styles.small}>{CHAPTERS.find(chapter=>chapter.id===lesson.chapter)?.title}</Text></View><Icon name="chevron-right" size={17}/></Pressable>)}</View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderTopWidth:2,borderStyle:'dashed',borderTopColor:colors.dash,minHeight:65},number:{width:27,height:28,borderWidth:3,borderColor:colors.ink,borderRadius:8,alignItems:'center',justifyContent:'center'},title:{fontFamily:fonts.bold,fontSize:14,lineHeight:20,color:colors.ink}});
