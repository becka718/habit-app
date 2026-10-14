import {useEffect,useRef,useState} from 'react';

const EMO={grocery:'🛒',groceries:'🛒',shop:'🛍️',laundry:'🧺',clean:'🧹',dishes:'🍽️',trash:'🗑️',bill:'🧾',rent:'🏠',email:'📧',call:'📞',meeting:'📅',study:'📚',read:'📖',homework:'📝',exam:'📝',code:'💻',gym:'🏋️',workout:'💪',run:'🏃',walk:'🚶',doctor:'🩺',dentist:'🦷',pray:'🙏',church:'⛪',cook:'🍳',dinner:'🍽️',car:'🚗',flight:'✈️',gift:'🎁',birthday:'🎂',pay:'💰',bank:'🏦',plan:'🗓️',write:'✍️',sleep:'😴',water:'💧'};
export const guessEmoji=t=>{for(const w of t.toLowerCase().split(/\W+/)){const k=EMO[w]||EMO[w.replace(/s$/,'')];if(k)return k}return''};

// Binary-insertion ranking with a human comparator (same idea as your priority-ranker app).
// Moves forward until a question is needed or everything is placed.
function settle(s){s={...s};
  for(;;){
    if(s.cur==null){if(!s.queue.length){s.done=true;return s}s.cur=s.queue[0];s.queue=s.queue.slice(1);
      if(!s.sorted.length){s.sorted=[s.cur];s.cur=null;continue}s.lo=0;s.hi=s.sorted.length;continue}
    if(s.lo<s.hi)return s;
    s.sorted=[...s.sorted.slice(0,s.lo),s.cur,...s.sorted.slice(s.lo)];s.cur=null}}

export default function Ranker({items,fresh,onSave,onClose}){
  const [s,setS]=useState(()=>{const ranked=fresh?[]:items.filter(i=>i.rank!=null).sort((a,b)=>a.rank-b.rank),queue=(fresh?items:items.filter(i=>i.rank==null)).slice().sort(()=>Math.random()-.5);
    return settle({sorted:ranked,queue,cur:null,lo:0,hi:0,hist:[],n:0,total:Math.max(1,queue.length*Math.ceil(Math.log2(items.length+1)))})});
  const saved=useRef(false);
  useEffect(()=>{if(s.done&&!saved.current){saved.current=true;onSave(s.sorted.map(i=>i.id))}},[s.done]);
  const pick=a=>setS(p=>{const mid=(p.lo+p.hi)>>1,{hist,...rest}=p;return settle({...p,hist:[...hist,rest],n:p.n+1,lo:a?p.lo:mid+1,hi:a?mid:p.hi})});
  const back=()=>setS(p=>p.hist.length?{...p.hist[p.hist.length-1],hist:p.hist.slice(0,-1),done:false}:p);
  const b=s.done?null:s.sorted[(s.lo+s.hi)>>1],pct=s.done?100:Math.min(99,Math.round(s.n/s.total*100));
  return <div className="ss rk" role="dialog" aria-label="Rank by priority"><button className="ss-x" onClick={onClose} aria-label="Close">✕</button>
    <div className="ss-body">
      <div className="rk-head">{s.done?'Your priorities':'Which matters more?'}</div>
      {!s.done&&<><div className="quest-bar big"><div style={{width:pct+'%'}}/><span>{pct}%</span></div>
        <button className="rk-card" onClick={()=>pick(true)}>{guessEmoji(s.cur.text)} {s.cur.text}</button>
        <div className="rk-vs">or</div>
        <button className="rk-card" onClick={()=>pick(false)}>{guessEmoji(b.text)} {b.text}</button>
        <div className="rk-row"><button className="sb-btn" disabled={!s.hist.length} onClick={back} style={s.hist.length?undefined:{opacity:.4}}>↩ Back</button>
          <button className="sb-btn" onClick={()=>pick(Math.random()<.5)}>Not sure, skip</button></div></>}
      {s.done&&<><div className="set-note">Saved. The most important task is at the top of your list.</div>
        {s.sorted.map((i,k)=><div className="todo-item" key={i.id}><span className="rk-num">{k+1}</span><span className="todo-text">{guessEmoji(i.text)} {i.text}</span></div>)}
        <button className="btn" style={{width:'100%',background:'var(--accent)',color:'var(--bg)',marginTop:10}} onClick={onClose}>DONE</button></>}
    </div></div>}
