import {useRef} from 'react';
export const KEY='tracker_habits_v7',STYLE_KEY='tracker_card_style',GROQ_KEY='tracker_groq_key',CHAT_KEY='tracker_chat_v1',MOOD_KEY='tracker_mood_v1',TODO_KEY='tracker_todo_v1',SEEN_KEY='tracker_seen_v1';
export const MOODS=['😞','😕','😐','🙂','😄'],MS=[7,14,21,30];
export const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
export const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
export const persist=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
export const uid=()=>crypto.randomUUID?crypto.randomUUID():'h_'+Date.now()+Math.random().toString(36).slice(2);
export const stats=h=>{let days=0,mins=0;for(const r of Object.values(h.history||{}))if(r.status==='done'){days++;mins+=r.minutes||0}return{days,mins}};
export const fmt=m=>`${Math.floor(m/60)}h ${m%60}m`;
export const skipCount=h=>{let n=0;for(let i=0;i<7;i++){if(h.history[dateKey(add(new Date(),-i))]?.status==='skipped')n++}return n};

// A day is complete when every habit that existed is done or skipped, with at least one done
export const habDone=(habits,k)=>{const hs=habits.filter(h=>!h.created||k>h.created||h.history[k]); // a habit made today doesn't undo today
  return hs.length>0&&hs.every(h=>['done','skipped'].includes(h.history[k]?.status))&&hs.some(h=>h.history[k]?.status==='done')};
const first=habits=>{let m=null;for(const h of habits)for(const k of [h.created,...Object.keys(h.history)])if(k&&(m===null||k<m))m=k;return m};
const span=f=>Math.min(36600,Math.ceil((Date.now()-new Date(f+'T00:00:00'))/864e5)+3); // walk the whole history, however long
export const isMilestone=n=>n===7||n===14||n===21||(n>=30&&n%30===0);
// Same rule as the demo app: one missed day is "frozen" (kept), two in a row freezes the streak.
// A frozen streak is NOT deleted: it shows as 0 (dim fire) and "lost" remembers the old run until it is restored.
const NONE=new Set();
export const forgivenSet=restores=>{const s=new Set();for(const r of restores){const[y,m,d]=r.from.split('-');for(let x=new Date(+y,m-1,+d);dateKey(x)<=r.to;x=add(x,1))s.add(dateKey(x))}return s};
export function streakInfo(habits,fg=NONE){
  const out={n:0,gap:false,frozen:false,lost:0,gapFrom:null,gapTo:null},f=first(habits);if(!f)return out;
  const N=span(f),t=new Date(),ok=k=>habDone(habits,k),s=ok(dateKey(t))?t:add(t,-1),dk=i=>dateKey(add(s,-i));
  let c=0,m=0,brk=-1;
  for(let i=0;i<N;i++){const k=dk(i);if(k<f)break;if(fg.has(k)){m=0;continue}if(ok(k)){if(m>0)out.gap=true;c++;m=0}else if(++m>=2){brk=i;break}}
  out.n=c;
  if(brk>=0){out.gapTo=dk(brk-1);let j=brk;while(j<N&&dk(j)>=f&&!ok(dk(j))&&!fg.has(dk(j)))j++;out.gapFrom=dk(j-1);
    let p=0,mm=0;for(let q=j;q<N;q++){const k=dk(q);if(k<f)break;if(fg.has(k)){mm=0;continue}if(ok(k)){p++;mm=0}else if(++mm>=2)break}
    out.lost=p}
  out.frozen=c===0&&out.lost>0;return out}
export function gapBefore(habits,fg=NONE){const f=first(habits);if(!f)return 0;let g=0;
  for(let i=1;i<span(f);i++){const k=dateKey(add(new Date(),-i));if(k<f)return 0;if(habDone(habits,k)||fg.has(k))return g;g++}return 0}

export const readFile=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
export const resizeBlob=(src,max,q)=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');
  c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?res(b):rej(new Error('blob')),'image/jpeg',q)};i.onerror=rej;i.src=src});

export function usePress(onLong,onClick){
  const t=useRef(),p=useRef([0,0]),f=useRef(false),stop=()=>clearTimeout(t.current);
  const start=e=>{stop();f.current=false;const s=e.touches?.[0]||e;p.current=[s.clientX,s.clientY];t.current=setTimeout(()=>{f.current=true;navigator.vibrate?.(40);onLong({x:p.current[0],y:p.current[1]})},600)};
  return{onMouseDown:start,onMouseUp:stop,onMouseLeave:stop,onTouchStart:start,onTouchEnd:stop,onTouchCancel:stop,
    onTouchMove:e=>{const s=e.touches[0];if(Math.hypot(s.clientX-p.current[0],s.clientY-p.current[1])>10)stop()},
    onClick:e=>{if(f.current){f.current=false;return}onClick?.(e)},
    onContextMenu:e=>{e.preventDefault();stop();f.current=true;setTimeout(()=>{f.current=false},400);onLong({x:e.clientX,y:e.clientY})}};
}

// Gem shop numbers (the database enforces these too; change both together)
export const PRICE=25,BUY_LIMIT=2,HOLD_MAX=3,REROLL_PRICE=5,REROLL_LIMIT=3;
// Quest windows and progress (mirrors the database, which re-checks everything when you claim)
export const mondayOf=d=>add(d,-((d.getDay()+6)%7));
const midnightAfter=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).toISOString();
export function windowFor(kind,now=new Date()){const d0=new Date(now.getFullYear(),now.getMonth(),now.getDate());let s=d0,e=d0;
  if(kind==='week'||kind==='life'){s=mondayOf(d0);e=add(s,6)}else if(kind==='month'){s=new Date(d0.getFullYear(),d0.getMonth(),1);e=new Date(d0.getFullYear(),d0.getMonth()+1,0)}
  return{start:dateKey(s),end:dateKey(e),endsAt:midnightAfter(e)}}
export const recoveryWindow=days=>{const d0=new Date(),e=add(d0,days-1);return{start:dateKey(d0),end:dateKey(e),endsAt:midnightAfter(e)}};
export function metricProgress(metric,from,to,{habits,todos,moods}){
  const inR=d=>d>=from&&d<=to;
  if(metric==='habit_completions'||metric==='habit_days'){let n=0;const days=new Set();
    for(const h of habits)for(const[d,r] of Object.entries(h.history))if(r.status==='done'&&inR(d)){n++;days.add(d)}return metric==='habit_days'?days.size:n}
  if(metric==='todos_done')return todos.filter(t=>t.done&&t.doneOn&&inR(t.doneOn)).length;
  if(metric==='mood_days')return Object.keys(moods).filter(inR).length;return 0}
const LIFE=[['Clean your room','Tidy up your room, then show it off.','your tidy room'],['Make your bed and clear your desk','A fresh space helps a fresh mind.','your made bed or clear desk'],['Wash the dishes','Clear the sink and show the shiny result.','clean dishes or an empty sink'],['Take a walk outside','Fresh air counts. Snap where you walked.','an outdoor place you walked in']];
export function fallbackQuest(kind,b,lost){const hb=Math.max(1,b.habits);
  if(kind==='life'){const[t,d,p]=LIFE[Math.floor(Math.random()*LIFE.length)];return{title:t,description:d,metric:'photo',target:1,difficulty:2,days:1,proof:p}}
  if(kind==='recovery'){const days=Math.min(9,Math.max(4,Math.ceil(lost/5)+3));return{title:`Comeback: ${days} days in a row`,description:`Do at least one habit every day for ${days} days to bring your ${lost}-day streak back.`,metric:'habit_days',target:days,difficulty:3,days}}
  if(kind==='day')return{title:'Finish your habits today',description:'Check off every habit you have today.',metric:'habit_completions',target:Math.min(12,hb),difficulty:2,days:1};
  if(kind==='week')return{title:'Show up 5 days this week',description:'Do at least one habit on 5 different days.',metric:'habit_days',target:5,difficulty:2,days:1};
  return{title:'20 active days this month',description:'Do at least one habit on 20 days this month.',metric:'habit_days',target:20,difficulty:2,days:1}}
export const dueLabel=(due,today)=>{if(!due)return'';if(due===today)return'Today';const t=new Date(today+'T00:00:00'),d=new Date(due+'T00:00:00'),diff=Math.round((d-t)/864e5);
  if(diff===1)return'Tomorrow';if(diff<0)return'Overdue';return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})};
