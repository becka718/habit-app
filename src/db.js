import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {uid} from './lib.js';

const url=import.meta.env.VITE_SUPABASE_URL,anon=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured=!!(url&&anon);
export const supabase=configured?createClient(url,anon):null;
let UID=null;export const setUid=u=>{UID=u};
const ok=r=>{if(r.error)throw r.error;return r};
// PostgREST returns at most 1000 rows per request, so page through everything
// PostgREST returns at most 1000 rows per request: read page one, then fetch the remaining pages in parallel
const all=async build=>{const a=await build().range(0,999);if(a.error)throw a.error;const total=a.count??a.data.length,jobs=[];
  for(let f=1000;f<total;f+=1000)jobs.push(build().range(f,f+999));const rest=await Promise.all(jobs);return[...a.data,...rest.flatMap(r=>{if(r.error)throw r.error;return r.data})]};
const pad=n=>String(n).padStart(2,'0'),dk=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return dk(d)};
const utcMonth=()=>{const n=new Date();return new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),1)).toISOString()}; // same month boundary as the database

// since = null loads everything; otherwise only the recent window (cheap refreshes for long-time users)
export async function loadAll(since=null){
  const rc={count:'exact'},led=r=>supabase.from('gem_ledger').select('id',{count:'exact',head:true}).eq('reason',r).gte('created_at',utcMonth()).then(x=>ok(x).count||0);
  const [hs,hist,ms,ts,cs,ch,wallet,qs,rs,rw,bought,rerolls]=await Promise.all([
    supabase.from('habits').select('*').order('position').order('created_at').order('id').limit(100).then(r=>ok(r).data),
    supabase.rpc('get_history',{p_since:since}).then(r=>ok(r).data),
    all(()=>{const q=supabase.from('moods').select('day,mood',rc).order('day');return since?q.gte('day',since):q}),
    all(()=>supabase.from('todos').select('id,text,done,scope,due,rank,remind_at,done_on,archived',rc).or(`archived.eq.false,done_on.gte.${ago(40)}`).order('created_at',{ascending:false}).order('id')),
    supabase.from('celebrations').select('day,kind').gte('day',ago(60)).then(r=>ok(r).data),
    supabase.from('chat_messages').select('id,q,a,bad').order('created_at',{ascending:false}).limit(40).then(r=>ok(r).data.reverse()),
    supabase.from('wallet').select('gems,unfreezes').maybeSingle().then(r=>ok(r).data||{gems:0,unfreezes:0}),
    supabase.from('quests').select('*').order('created_at',{ascending:false}).limit(60).then(r=>ok(r).data),
    all(()=>supabase.from('streak_restores').select('id,from_day,to_day',rc).order('id')),
    supabase.from('todo_rewards').select('day,active,done_count').gte('day',ago(7)).then(r=>ok(r).data),
    led('buy_unfreeze'),led('reroll_quest')]);
  const H={};for(const r of hist)H[r.habit_id]=Object.fromEntries(Object.entries(r.h).map(([d,v])=>[d,{status:v[0],minutes:v[1],sequenceProgress:v[2]}]));
  const moods={},seen={};ms.forEach(m=>{moods[m.day]=m.mood});cs.forEach(c=>{seen[c.day]=c.kind});
  const todos=ts.map(t=>({id:t.id,text:t.text,done:t.done,scope:t.scope,due:t.due,rank:t.rank,remindAt:t.remind_at,doneOn:t.done_on,archived:t.archived}));
  const quests=qs.map(q=>({id:q.id,kind:q.kind,title:q.title,description:q.description,metric:q.metric,target:q.target,difficulty:q.difficulty,rewardGems:q.reward_gems,startsOn:q.starts_on,endsOn:q.ends_on,endsAt:q.ends_at,gapFrom:q.gap_from,gapTo:q.gap_to,lostLen:q.lost_len,proofPrompt:q.proof_prompt||'',proofOk:q.proof_ok,status:q.status}));
  return{moods,seen,todos,chat:ch,wallet,quests,restores:rs.map(r=>({from:r.from_day,to:r.to_day})),rewards:Object.fromEntries(rw.map(r=>[r.day,{active:r.active,doneCount:r.done_count}])),bought,rerolls,
    habits:hs.map(h=>({id:h.id,name:h.name,image:h.image_path||'',imageFull:h.image_full_path||'',sequenceItems:h.sequence_items||[],schedule:h.schedule||{},created:h.created_on,position:h.position,proofPrompt:h.proof_prompt||'',history:H[h.id]||{}}))};
}

export const habitRow=(h,position)=>({id:h.id,name:h.name,sequence_items:h.sequenceItems||[],schedule:h.schedule||{},image_path:h.image||null,image_full_path:h.imageFull||null,position,created_on:h.created,proof_prompt:h.proofPrompt||null});
export const dbHabitUpsert=rows=>supabase.from('habits').upsert(rows,{onConflict:'id'}).then(ok);
export const dbHabitDelete=id=>supabase.from('habits').delete().eq('id',id).then(ok);
export const dbHabitsDelete=ids=>supabase.from('habits').delete().in('id',ids).then(ok);
export const dbLogSet=(hid,day,r)=>r
  ?supabase.from('habit_logs').upsert({habit_id:hid,user_id:UID,day,status:r.status,sequence_progress:r.sequenceProgress||0,minutes:r.minutes||0},{onConflict:'habit_id,day'}).then(ok)
  :supabase.from('habit_logs').delete().eq('habit_id',hid).eq('day',day).then(ok);
export const dbLogsBulk=async rows=>{for(let i=0;i<rows.length;i+=500)ok(await supabase.from('habit_logs').upsert(rows.slice(i,i+500),{onConflict:'habit_id,day'}))};
export const dbMood=(day,m)=>m==null?supabase.from('moods').delete().eq('day',day).then(ok):supabase.from('moods').upsert({user_id:UID,day,mood:m},{onConflict:'user_id,day'}).then(ok);
export const dbMoodsBulk=rows=>supabase.from('moods').upsert(rows.map(r=>({...r,user_id:UID})),{onConflict:'user_id,day'}).then(ok);
const TCOL={text:'text',done:'done',scope:'scope',due:'due',rank:'rank',remindAt:'remind_at',doneOn:'done_on',archived:'archived'};
const todoCols=p=>Object.fromEntries(Object.entries(p).filter(([k])=>TCOL[k]).map(([k,v])=>[TCOL[k],v===''?null:v]));
export const dbTodoAdd=t=>supabase.from('todos').insert({id:t.id,...todoCols(t)}).then(ok);
export const dbTodoUpd=(id,p)=>supabase.from('todos').update(todoCols(p)).eq('id',id).then(ok);
export const dbTodoDel=id=>supabase.from('todos').delete().eq('id',id).then(ok);
export const dbTodoArchive=()=>supabase.from('todos').update({archived:true}).eq('done',true).eq('archived',false).then(ok);
export const dbTodosReplace=async list=>{ok(await supabase.from('todos').delete().eq('user_id',UID));if(list.length)ok(await supabase.from('todos').insert(list))};
export const dbSeen=(day,kind)=>supabase.from('celebrations').upsert({user_id:UID,day,kind},{onConflict:'user_id,day'}).then(ok);
export const dbChatAdd=g=>supabase.from('chat_messages').insert({id:g.id,q:g.q,a:g.a,bad:false}).then(ok);
export const dbChatDel=id=>supabase.from('chat_messages').delete().eq('id',id).then(ok);
const rpc=(fn,args)=>supabase.rpc(fn,args).then(ok).then(r=>r.data);
export const dbCreateQuest=a=>rpc('create_quest',a);
export const dbClaimQuest=id=>rpc('claim_quest',{p_id:id});
export const dbReconcile=day=>rpc('reconcile_rewards',{p_day:day});
export const dbBuyUnfreeze=()=>rpc('buy_unfreeze');
export const dbUseUnfreeze=(from,to)=>rpc('use_unfreeze',{p_from:from,p_to:to});
export const dbClaimTodoReward=day=>rpc('claim_todo_reward',{p_day:day});
export const dbTodoRestore=id=>supabase.from('todos').update({archived:false}).eq('id',id).then(ok);
export const dbDeleteAccount=async()=>{try{for(let i=0;i<20;i++){const{data}=await supabase.storage.from(B).list(UID,{limit:100});if(!data?.length)break;await supabase.storage.from(B).remove(data.map(f=>`${UID}/${f.name}`))}}catch{}ok(await supabase.rpc('delete_my_account'))};
export const dbRerollQuest=id=>rpc('reroll_quest',{p_id:id});
export const verifyPhoto=async({image,expect,questId})=>{const{data,error}=await supabase.functions.invoke('ai-coach',{body:{mode:'verify',image,expect,questId}});if(error)throw error;return data};
export const askQuest=async(kind,stats)=>{const{data,error}=await supabase.functions.invoke('ai-coach',{body:{mode:'quest',kind,stats}});if(error||!data?.metric)throw error||new Error('no quest');return data};
export const dbChatClear=()=>supabase.from('chat_messages').delete().eq('user_id',UID).then(ok);

// ── Images live in a private Storage bucket, one folder per user ──
const B='habit-images',cache=new Map();
export const imgPut=async blob=>{const p=`${UID}/${uid()}.jpg`;ok(await supabase.storage.from(B).upload(p,blob,{contentType:'image/jpeg',cacheControl:'31536000'}));return p};
export const imgGet=async p=>ok(await supabase.storage.from(B).download(p)).data;
export const imgDel=async p=>{if(!p||p.startsWith('data:'))return;if(cache.has(p)){URL.revokeObjectURL(cache.get(p));cache.delete(p)}try{await supabase.storage.from(B).remove([p])}catch{}};
export const clearImgCache=()=>{cache.forEach(u=>URL.revokeObjectURL(u));cache.clear()};
export function useImg(ref){
  const [u,setU]=useState(()=>!ref?'':/^(data|https?):/.test(ref)?ref:cache.get(ref)||'');
  useEffect(()=>{let off=false;if(!ref){setU('');return}if(/^(data|https?):/.test(ref)){setU(ref);return}
    if(cache.has(ref)){setU(cache.get(ref));return}
    imgGet(ref).then(b=>{if(b&&!off){const url=URL.createObjectURL(b);cache.set(ref,url);setU(url)}}).catch(()=>{});return()=>{off=true}},[ref]);
  return u}
