import {Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {STYLE_KEY,isMilestone,dateKey,add,uid,stats,habDone,streakInfo,gapBefore,forgivenSet,readFile,windowFor,recoveryWindow,metricProgress,fallbackQuest,load,persist,REROLL_PRICE,REROLL_LIMIT} from './lib.js';
import * as db from './db.js';
import {HabitsPage,Sheet,HabitModal,MenuSheet} from './habits.jsx';
import Chat from './chat.jsx';
import {TodoPage,Settings} from './pages.jsx';
import {QuestsPanel,questDone} from './quests.jsx';
import {Shop,RewardModal} from './shop.jsx';
import ProofModal from './proof.jsx';
import {Gem} from './icons.jsx';
const StreakScreen=lazy(()=>import('./streak.jsx').then(m=>({default:m.StreakScreen})));
const Celebrate=lazy(()=>import('./streak.jsx').then(m=>({default:m.Celebrate})));
import lightFire from './assets/light_fire.svg';
import dimFire from './assets/dim_fire.svg';

const TABS=[['habits','checklist','Habits'],['todo','task_alt','To-do'],['chat','smart_toy','AI'],['more','tune','More']];
const arr=v=>Array.isArray(v)?v:[],DAY=/^\d{4}-\d{2}-\d{2}$/;
const diffHistory=(a,b)=>{const out=[];for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[k])!==JSON.stringify(b[k]))out.push([k,b[k]||null]);return out};
const ERR={monthly_limit:'You already bought the monthly limit.',inventory_full:'You are holding the maximum unfreezes.',not_enough_gems:'Not enough gems yet.',no_unfreeze:'You have no unfreeze.',not_complete:'That quest is not finished yet.',already_claimed:'Already claimed.',not_eligible:'Not eligible yet.',reroll_limit:'No swaps left this month.',cannot_reroll:'This quest cannot be swapped.',proof_required:'Add your proof photo first.'};
const errText=e=>ERR[e?.message]||'Something went wrong. Try again.';

function useToday(){ // keeps "today" correct if the app stays open past midnight
  const [t,setT]=useState(()=>dateKey(new Date()));
  useEffect(()=>{const f=()=>setT(dateKey(new Date())),i=setInterval(f,30000);document.addEventListener('visibilitychange',f);return()=>{clearInterval(i);document.removeEventListener('visibilitychange',f)}},[]);
  return t}

export default function App({user}){
  db.setUid(user.id);
  const name=(user.user_metadata?.name||'').trim();
  const today=useToday();
  const [status,setStatus]=useState('loading');
  const [habits,setHabits]=useState([]),ref=useRef([]);
  const [moods,setMoods]=useState({}),[todos,setTodos]=useState([]),[seen,setSeen]=useState({}),[chat,setChat]=useState([]);
  const [wallet,setWallet]=useState({gems:0,unfreezes:0}),[bought,setBought]=useState(0),[rerolls,setRerolls]=useState(0),[proofQ,setProofQ]=useState(null),[quests,setQuests]=useState([]),[restores,setRestores]=useState([]),[rewards,setRewards]=useState({});
  const [style,setStyleState]=useState(()=>localStorage.getItem(STYLE_KEY)||'list');
  const [tab,setTab]=useState(0),[aiView,setAiView]=useState('chat'),[openId,setOpenId]=useState(null),[menuId,setMenuId]=useState(null),[modal,setModal]=useState(null),[typing,setTyping]=useState(false),[msg,setMsg]=useState('');
  const [cel,setCel]=useState(null),[ss,setSs]=useState(null),[shop,setShop]=useState(false),[reward,setReward]=useState(null),[busyQ,setBusyQ]=useState(false),[creating,setCreating]=useState({});
  const toast=useCallback(m=>setMsg(m),[]);
  useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(''),2400);return()=>clearTimeout(t)},[msg]);

  // ── Loading + keeping every device in sync ──
  const inflight=useRef(0),dirty=useRef(false),ver=useRef(0),tm=useRef(),last=useRef(0),pend=useRef(new Set());
  const lastFull=useRef(0),lastDone=useRef(0);
  const apply=(d,since)=>{
    const keepOld=(o,n)=>since?{...Object.fromEntries(Object.entries(o).filter(([k])=>k<since)),...n}:n; // a recent refresh keeps older history already in memory
    const hs=since?d.habits.map(h=>{const o=ref.current.find(x=>x.id===h.id);return o?{...h,history:keepOld(o.history,h.history)}:h}):d.habits;
    ref.current=hs;setHabits(hs);setMoods(m=>keepOld(m,d.moods));setTodos(d.todos);setSeen(d.seen);setWallet(d.wallet);setBought(d.bought);setRerolls(d.rerolls);setQuests(d.quests);setRestores(d.restores);setRewards(d.rewards);last.current=Date.now();
    setChat(prev=>{const ids=new Set(d.chat.map(g=>g.id));return[...d.chat,...prev.filter(g=>!ids.has(g.id)&&(g.a===null||g.bad))]})};
  const reload=useCallback(async force=>{const v=ver.current,full=force===true||Date.now()-lastFull.current>30*60*1000,since=full?null:db.ago(90);
    try{const d=await db.loadAll(since);
      if(ver.current!==v||inflight.current>0){clearTimeout(tm.current);tm.current=setTimeout(()=>reload(force),500);return}
      if(since&&d.habits.some(h=>!ref.current.some(x=>x.id===h.id)))return reload(true); // a habit we haven't seen: load its full history
      apply(d,since);if(full)lastFull.current=Date.now();setStatus('ready')}
    catch(e){console.error(e);setStatus(s=>s==='ready'?s:'error')}},[]);
  const refresh=full=>{ver.current++;return reload(full)};
  useEffect(()=>{reload();
    const poke=()=>{if(inflight.current>0){dirty.current=true;return}if(Date.now()-lastDone.current<2500)return; // that was the echo of our own save
      clearTimeout(tm.current);tm.current=setTimeout(()=>inflight.current>0?(dirty.current=true):reload(),400)};
    const poll=setInterval(()=>{if(!document.hidden&&inflight.current===0)reload()},60000);
    const ch=db.supabase.channel('sync-'+user.id);
    ['habits','habit_logs','moods','todos','celebrations','wallet','quests','streak_restores','todo_rewards'].forEach(t=>ch.on('postgres_changes',{event:'*',schema:'public',table:t},poke));ch.subscribe();
    const vis=()=>{if(!document.hidden&&Date.now()-last.current>30000)reload()};
    document.addEventListener('visibilitychange',vis);addEventListener('online',reload);
    return()=>{db.supabase.removeChannel(ch);clearTimeout(tm.current);clearInterval(poll);document.removeEventListener('visibilitychange',vis);removeEventListener('online',reload)}},[]);
  const run=p=>{inflight.current++;ver.current++;
    const pr=Promise.resolve(p).then(()=>true,e=>{console.error(e);toast('Could not save. Check your connection.');dirty.current=true;return false})
      .finally(()=>{pend.current.delete(pr);lastDone.current=Date.now();if(--inflight.current===0&&dirty.current){dirty.current=false;reload()}});
    pend.current.add(pr);return pr};

  const forgiven=useMemo(()=>forgivenSet(restores),[restores]);
  const info=useMemo(()=>streakInfo(habits,forgiven),[habits,forgiven,today]),doneToday=useMemo(()=>habDone(habits,today),[habits,today]);

  // ── Habits ──
  const setLocal=next=>{ref.current=next;setHabits(next)};
  const markSeen=(d,kind)=>{setSeen(s=>({...s,[d]:kind}));run(db.dbSeen(d,kind))};
  const patch=(id,fn)=>{const prev=ref.current,old=prev.find(h=>h.id===id);if(!old)return;
    const nh=fn(old),next=prev.map(h=>h.id===id?nh:h),was=habDone(prev,today);setLocal(next);
    run(Promise.all(diffHistory(old.history,nh.history).map(([d,r])=>db.dbLogSet(id,d,r))));
    if(!was&&habDone(next,today)&&!seen[today]){ // today just became complete: celebrate once per day
      const a=streakInfo(prev,forgiven),b=streakInfo(next,forgiven),g=gapBefore(next,forgiven);
      const kind=isMilestone(b.n)?'PHOENIX_DARK':g===1?'FROZEN':g>=2?'CLASSIC_LIGHT':'IDLE';
      markSeen(today,kind);setCel({mode:'celebrate',anim:kind,then:kind!=='IDLE',old:a.n,nw:b.n,perfect:!b.gap,blue:kind==='FROZEN',dark:true})}};
  const saveHabit=async d=>{const old=d.id&&ref.current.find(h=>h.id===d.id);
    const h=old?{...old,...d}:{...d,id:uid(),history:{},created:today};
    const pos=old?old.position:(ref.current.length?Math.min(...ref.current.map(x=>x.position))-1:0),nh={...h,position:pos};
    try{await db.dbHabitUpsert([db.habitRow(nh,pos)])}catch(e){console.error(e);toast('Could not save the habit. Check your connection.');return false}
    ver.current++;const cur=ref.current;setLocal(old?cur.map(x=>x.id===nh.id?nh:x):[nh,...cur]);setModal(null);return true};
  const del=id=>{if(!confirm('Delete this habit and all its history?'))return;const h=ref.current.find(x=>x.id===id);setMenuId(null);if(openId===id)setOpenId(null);
    setLocal(ref.current.filter(x=>x.id!==id));run(db.dbHabitDelete(id).then(()=>{db.imgDel(h?.image);db.imgDel(h?.imageFull)}))};
  const move=(id,dir)=>{const a=[...ref.current],i=a.findIndex(h=>h.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];
    const n=a.map((h,k)=>({...h,position:k}));setLocal(n);run(db.dbHabitUpsert(n.map(h=>db.habitRow(h,h.position))))};
  const setMood=(d,i)=>{setMoods(m=>{const n={...m};if(i==null)delete n[d];else n[d]=i;return n});run(db.dbMood(d,i))};

  // ── To-dos (with scope, due date, reminder and priority rank) and chat ──
  const todoAdd=t=>{const n={id:uid(),done:false,rank:null,doneOn:null,archived:false,...t};setTodos(x=>[n,...x]);run(db.dbTodoAdd(n))};
  const todoUpd=(id,p)=>{if('done' in p)p={...p,doneOn:p.done?today:null};setTodos(x=>x.map(i=>i.id===id?{...i,...p}:i));run(db.dbTodoUpd(id,p))};
  const todoDel=id=>{setTodos(x=>x.filter(i=>i.id!==id));run(db.dbTodoDel(id))};
  const todoArchive=()=>{setTodos(x=>x.map(i=>i.done?{...i,archived:true}:i));run(db.dbTodoArchive())};
  const todoRank=ids=>{setTodos(x=>x.map(i=>{const k=ids.indexOf(i.id);return k>=0?{...i,rank:k}:i}));run(Promise.all(ids.map((id,k)=>db.dbTodoUpd(id,{rank:k}))))};
  const todoRestore=id=>{setTodos(x=>x.map(i=>i.id===id?{...i,archived:false}:i));run(db.dbTodoRestore(id))};
  const saveName=async n=>{const{error}=await db.supabase.auth.updateUser({data:{name:n.trim().slice(0,30)}});toast(error?'Could not save your name':'Name saved')};
  const changePw=async pw=>{if(pw.length<8)return toast('Use at least 8 characters');const{error}=await db.supabase.auth.updateUser({password:pw});toast(error?error.message:'Password changed')};
  const deleteAccount=async()=>{if(!confirm('Delete your account and ALL your data? This cannot be undone.')||prompt('Type DELETE to confirm')!=='DELETE')return;
    try{await db.dbDeleteAccount();db.clearImgCache();await db.supabase.auth.signOut()}catch(e){console.error(e);toast('Could not delete the account. Try again.')}};
  const chatClear=()=>{setChat([]);run(db.dbChatClear())};
  const setStyle=s=>{localStorage.setItem(STYLE_KEY,s);setStyleState(s)};

  // Reminders: shown while the app is open (a toast, plus a browser notification if you allowed it)
  useEffect(()=>{if(status!=='ready')return;
    const check=()=>{const fired=load('tracker_reminded',{});let ch=false;
      for(const i of todos){if(i.done||i.archived||!i.remindAt)continue;const key=i.id+'@'+i.remindAt;if(fired[key]||new Date(i.remindAt)>new Date())continue;
        fired[key]=1;ch=true;toast('⏰ '+i.text);
        try{if('Notification' in window&&Notification.permission==='granted')new Notification('Reminder',{body:i.text,icon:'/icons/icon-192.png'})}catch{}}
      if(ch)persist('tracker_reminded',fired)};
    check();const t=setInterval(check,20000);return()=>clearInterval(t)},[todos,status]);

  // Finishing a whole day's to-do list (3+ tasks) asks the server for a rare reward, once per day
  const claiming=useRef(false);
  useEffect(()=>{if(status!=='ready'||claiming.current||rewards[today]?.active)return;
    const dayT=todos.filter(t=>t.scope==='day'&&!t.archived),doneN=todos.filter(t=>t.scope==='day'&&t.done&&t.doneOn===today).length;
    if(doneN<3||dayT.some(t=>!t.done&&(!t.due||t.due<=today)))return;
    claiming.current=true;
    Promise.allSettled([...pend.current]).then(()=>db.dbClaimTodoReward(today)).then(r=>{setReward({kind:r.reward,amount:r.amount,title:'To-do list finished!'});return refresh()})
      .catch(e=>console.debug(e)).finally(()=>{claiming.current=false})},[todos,status,today,rewards]);

  // Un-checking takes the reward back: if progress no longer meets a claimed reward, ask the server to reverse it
  const recon=useRef({busy:false,sig:''});
  useEffect(()=>{if(status!=='ready')return;
    const doneN=todos.filter(t=>t.scope==='day'&&t.done&&t.doneOn===today).length,tr=rewards[today],from=db.ago(45),ctx={habits,todos,moods};
    const todoBad=!!(tr?.active&&(doneN<tr.doneCount||doneN<3));
    const badQ=quests.filter(q=>q.status==='claimed'&&q.metric!=='photo'&&q.endsOn>=from&&metricProgress(q.metric,q.startsOn,q.endsOn,ctx)<q.target).map(q=>q.id);
    if(!todoBad&&!badQ.length)return;
    const sig=`${todoBad}|${badQ.join()}|${doneN}`;
    const t=setTimeout(()=>{if(recon.current.busy||recon.current.sig===sig)return;recon.current={busy:true,sig};
      Promise.allSettled([...pend.current]).then(()=>db.dbReconcile(today)).then(async r=>{await refresh();const p=[];
        if(r.gems_removed)p.push(`-${r.gems_removed} gem${r.gems_removed>1?'s':''}`);if(r.unfreezes_removed)p.push('-1 unfreeze');if(r.quests_reversed&&!r.gems_removed)p.push('a quest was reopened');
        if(p.length)toast('Reward reversed ('+p.join(', ')+') because your progress changed')})
        .catch(e=>console.debug(e)).finally(()=>{recon.current.busy=false})},1200);
    return()=>clearTimeout(t)},[todos,habits,moods,quests,rewards,status,today]);

  // ── Quests, shop, unfreeze ──
  const qBusy=useRef({}),qFail=useRef({}),qAvoid=useRef({});
  const baseline=()=>{const to=dateKey(new Date()),from=dateKey(add(new Date(),-13)),c={habits:ref.current,todos,moods};
    return{habits:ref.current.length,checkins14:metricProgress('habit_completions',from,to,c),activeDays14:metricProgress('habit_days',from,to,c),todos14:metricProgress('todos_done',from,to,c),moodDays14:metricProgress('mood_days',from,to,c),streak:info.n,lostStreak:info.lost}};
  const makeQuest=async(kind,manual)=>{if(qBusy.current[kind]||status!=='ready')return;if(!manual&&Date.now()-(qFail.current[kind]||0)<120000)return;
    qBusy.current[kind]=true;setCreating(c=>({...c,[kind]:true}));
    try{const b={...baseline(),avoid:qAvoid.current[kind]||null,name};let q;try{q=await db.askQuest(kind,b)}catch{q=fallbackQuest(kind,b,info.lost)}
      const rec=kind==='recovery',w=rec?recoveryWindow(Math.min(9,Math.max(3,q.days||4))):windowFor(kind);
      await db.dbCreateQuest({p_kind:kind,p_title:q.title,p_desc:q.description,p_metric:q.metric,p_target:q.target,p_difficulty:q.difficulty,p_starts:w.start,p_ends:w.end,p_ends_at:w.endsAt,p_gap_from:rec?info.gapFrom:null,p_gap_to:rec?info.gapTo:null,p_lost:rec?info.lost:null,p_proof:q.proof||null});
      await refresh()}
    catch(e){console.error(e);qFail.current[kind]=Date.now();if(manual)toast(errText(e))}
    finally{qBusy.current[kind]=false;setCreating(c=>({...c,[kind]:false}))}};
  const restored=async(from,to)=>{const fg=new Set(forgiven),[y,m,d]=from.split('-');for(let x=new Date(+y,m-1,+d);dateKey(x)<=to;x=add(x,1))fg.add(dateKey(x));
    setSs({mode:'restore',anim:'FROZEN',then:true,old:0,nw:streakInfo(habits,fg).n,perfect:true,blue:true,dark:true});await refresh()};
  const claim=async q=>{setBusyQ(true);try{const r=await db.dbClaimQuest(q.id);
      if(r.restored)await restored(r.from,r.to);else{if(r.gems>0)setReward({kind:'gem',amount:r.gems,title:'Quest complete!'});else toast('Quest complete!');await refresh()}}
    catch(e){toast(errText(e));refresh()}finally{setBusyQ(false)}};
  const reroll=async q=>{if(!confirm(`Swap this quest for a brand new one?\nIt costs ${REROLL_PRICE} gems (${REROLL_LIMIT-rerolls} swaps left this month).`))return;
    setBusyQ(true);try{await db.dbRerollQuest(q.id);qAvoid.current[q.kind]=q.title;await refresh();toast('Finding you a new quest…')}catch(e){toast(errText(e))}finally{setBusyQ(false)}};
  const unfreeze=async()=>{if(!info.lost)return;try{await db.dbUseUnfreeze(info.gapFrom,info.gapTo);await restored(info.gapFrom,info.gapTo)}catch(e){toast(errText(e))}};
  const buy=async()=>{setBusyQ(true);try{await db.dbBuyUnfreeze();toast('Unfreeze added');await refresh()}catch(e){toast(errText(e))}finally{setBusyQ(false)}};
  const hasRecovery=quests.some(q=>q.kind==='recovery'&&q.status==='active'&&q.gapFrom===info.gapFrom&&new Date(q.endsAt)>new Date());
  const recQuest=async()=>{setSs(null);setTab(2);setAiView('quests');if(!hasRecovery)await makeQuest('recovery',true)};
  const qctx={habits,todos,moods},claimable=quests.filter(q=>questDone(q,qctx)).length;

  // The browser tab icon dims like Duolingo when today's habits are not done yet
  useEffect(()=>{const l=document.getElementById('fav');if(l)l.href=doneToday?'/favicon.svg':'/favicon-dim.svg'},[doneToday]);

  // ── Backup / restore (backups include images, moods and to-dos) ──
  const exportData=async()=>{try{
    const img=async r=>{if(!r||r.startsWith('data:'))return r;try{return await readFile(await db.imgGet(r))}catch{return ''}};
    const hs=await Promise.all(ref.current.map(async h=>{const s=stats(h);return{...h,image:await img(h.image),imageFull:await img(h.imageFull),totalDays:s.days,totalMinutes:s.mins}}));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({v:3,habits:hs,moods,todos})],{type:'application/json'}));a.download='tracker_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
  }catch{toast('Export failed')}};
  const importFile=async f=>{const added=[],ids=[];try{
    const raw=JSON.parse(await f.text()),list=Array.isArray(raw)?raw:raw.habits;
    if(!Array.isArray(list)||!list.every(h=>h&&typeof h.id==='string'&&typeof h.name==='string'&&h.history&&typeof h.history==='object'))throw new Error('bad');
    if(!confirm(`Replace all current data with the ${list.length} habits in this backup?`))return;
    toast('Importing, please wait…');
    const toRef=async v=>{if(typeof v==='string'&&v.startsWith('data:')){const p=await db.imgPut(await (await fetch(v)).blob());added.push(p);return p}return ''};
    const rows=[],logs=[];
    for(const [i,h] of list.entries()){const id=uid(),days=Object.keys(h.history).filter(d=>DAY.test(d)).sort();ids.push(id);
      const image=await toRef(h.image),full=h.imageFull===h.image?image:await toRef(h.imageFull);
      rows.push({id,name:String(h.name).trim().slice(0,80)||'Habit',sequence_items:arr(h.sequenceItems).map(String),schedule:h.schedule||{},image_path:image||null,image_full_path:full||image||null,position:i,created_on:DAY.test(h.created)?h.created:(days[0]||today)});
      for(const d of days){const r=h.history[d];if(['pending','done','skipped'].includes(r?.status))logs.push({habit_id:id,user_id:user.id,day:d,status:r.status,sequence_progress:Math.max(0,r.sequenceProgress|0),minutes:Math.max(0,r.minutes|0)})}}
    const old=ref.current;
    await db.dbHabitUpsert(rows);await db.dbLogsBulk(logs);
    if(old.length)await db.dbHabitsDelete(old.map(h=>h.id));
    if(!Array.isArray(raw)){
      const ms=Object.entries(raw.moods||{}).filter(([d,m])=>DAY.test(d)&&Number.isInteger(m)&&m>=0&&m<=4).map(([day,mood])=>({day,mood}));if(ms.length)await db.dbMoodsBulk(ms);
      if(raw.todos)await db.dbTodosReplace(arr(raw.todos).filter(t=>t&&typeof t.text==='string'&&t.text.trim()).slice(0,500).map(t=>({id:uid(),text:t.text.trim().slice(0,120),done:!!t.done,scope:['day','week','month'].includes(t.scope)?t.scope:'day',due:DAY.test(t.due)?t.due:null,rank:Number.isInteger(t.rank)?t.rank:null,done_on:DAY.test(t.doneOn)?t.doneOn:null,archived:!!t.archived})))}
    old.forEach(h=>{db.imgDel(h.image);db.imgDel(h.imageFull)});
    await refresh(true);toast('Backup restored');
  }catch(e){console.error(e);if(ids.length)try{await db.dbHabitsDelete(ids)}catch{};added.forEach(db.imgDel);toast(e.message==='bad'?'Invalid backup file':'Import failed, nothing was changed')}};
  const logout=async()=>{db.clearImgCache();await db.supabase.auth.signOut()};

  const openStreak=()=>setSs({mode:'view',anim:doneToday?'FLAME_LIGHT_START':null,then:false,old:info.n,nw:info.n,perfect:!info.gap,blue:seen[today]==='FROZEN',dark:false});
  const openH=habits.find(h=>h.id===openId),menuIdx=habits.findIndex(h=>h.id===menuId),editH=modal?.id&&habits.find(h=>h.id===modal.id);
  if(status==='loading')return <div className="splash">Loading your habits…</div>;
  if(status==='error')return <div className="splash">Could not load your data. Check your connection and that the database setup was run.
    <button className="btn" style={{background:'var(--accent)',color:'var(--bg)'}} onClick={()=>{setStatus('loading');reload()}}>Try again</button>
    <button className="auth-link" onClick={logout}>Log out</button></div>;
  const views=[
    <HabitsPage habits={habits} today={today} moods={moods} style={style} onOpen={setOpenId} onMenu={setMenuId}/>,
    <TodoPage todos={todos} today={today} onAdd={todoAdd} onUpdate={todoUpd} onDelete={todoDel} onArchive={todoArchive} onRank={todoRank} onRestore={todoRestore}/>,
    <div className="ai-wrap"><div className="seg"><button className={aiView==='chat'?'on':''} onClick={()=>setAiView('chat')}>Chat</button>
        <button className={aiView==='quests'?'on':''} onClick={()=>setAiView('quests')}>Quests{claimable>0&&<i className="dot"/>}</button></div>
      <div className="ai-pane" style={{display:aiView==='chat'?'flex':'none'}}><Chat chat={chat} setChat={setChat} habits={habits} today={today} active={tab===2&&aiView==='chat'} toast={toast} onTyping={setTyping} onSaveMsg={g=>run(db.dbChatAdd(g))} onDelMsg={id=>run(db.dbChatDel(id))} name={name}/></div>
      <div className="ai-pane" style={{display:aiView==='quests'?'flex':'none'}}><QuestsPanel quests={quests} ctx={qctx} creating={creating} onCreate={makeQuest} onClaim={claim} busy={busyQ} gems={wallet.gems} rerollsLeft={Math.max(0,REROLL_LIMIT-rerolls)} onReroll={reroll} onProof={setProofQ}/></div></div>,
    <Settings style={style} setStyle={setStyle} onNew={()=>setModal({})} onExport={exportData} onImport={importFile} clearChat={chatClear} email={user.email} name={name} onName={saveName} onPassword={changePw} onDeleteAccount={deleteAccount} onLogout={logout}/>];
  return <>
    <div className="topbar"><span style={{fontSize:16,fontWeight:700,letterSpacing:'-.01em'}}>{name?`Hi, ${name} 👋`:'Tracking'}</span>
      <div className="top-right"><button className="gem-chip" onClick={()=>setShop(true)} aria-label={`${wallet.gems} gems. Open shop`}><Gem/> {wallet.gems}</button>
        <button className={'streak-chip'+(doneToday?' on':'')} onClick={openStreak} aria-label={`${info.n} day streak. Open streak`}><img src={doneToday?lightFire:dimFire} alt=""/>{info.n}</button></div></div>
    <div className="app-body"><div className="chat-main">{views.map((v,i)=>
      <section key={TABS[i][0]} className={'view '+(i===tab?'active':i<tab?'before':'after')} aria-hidden={i!==tab} inert={i===tab?undefined:''}>{v}</section>)}</div></div>
    <nav className={'bnav'+(typing?' hide':'')} aria-label="Main"><div className="bnav-pill" style={{transform:`translateX(${tab*100}%)`}}/>
      {TABS.map(([k,ic,l],i)=><button key={k} className={'bnav-btn'+(i===tab?' on':'')} onClick={()=>setTab(i)} aria-current={i===tab?'page':undefined}><span className="material-icons-outlined">{ic}</span>{l}</button>)}</nav>
    {openH&&<Sheet key={openH.id} h={openH} today={today} moods={moods} setMood={setMood} patch={patch} onClose={()=>setOpenId(null)}/>}
    {menuId&&menuIdx>=0&&<MenuSheet i={menuIdx} count={habits.length} onClose={()=>setMenuId(null)} onMove={d=>{move(menuId,d);setMenuId(null)}} onEdit={()=>{setModal({id:menuId});setMenuId(null)}} onDelete={()=>del(menuId)}/>}
    {modal&&(!modal.id||editH)&&<HabitModal key={modal.id||'new'} habit={editH||undefined} onSave={saveHabit} onClose={()=>setModal(null)}/>}
    <Suspense fallback={null}>
    {ss&&<StreakScreen key={ss.mode+ss.anim} habits={habits} moods={moods} setMood={setMood} today={today} plan={ss} onClose={()=>setSs(null)}
      info={info} wallet={wallet} onShop={()=>setShop(true)} onUnfreeze={unfreeze} onQuest={recQuest} hasRecovery={hasRecovery}/>}
    {cel&&<Celebrate onDone={()=>{setSs(cel);setCel(null)}}/>}
    </Suspense>
    {shop&&<Shop wallet={wallet} bought={bought} busy={busyQ} onBuy={buy} onClose={()=>setShop(false)}/>}
    {proofQ&&<ProofModal expect={proofQ.proofPrompt} questId={proofQ.id} onClose={()=>setProofQ(null)} onApproved={()=>{setProofQ(null);refresh();toast('Photo approved ✓')}}/>}
    {reward&&<RewardModal reward={reward} onClose={()=>setReward(null)}/>}
    {msg&&<div className="toast">{msg}</div>}
  </>}
