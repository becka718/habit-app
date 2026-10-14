import {useEffect,useState} from 'react';
import {metricProgress,windowFor,REROLL_PRICE} from './lib.js';
import {Gem} from './icons.jsx';

export const useNow=ms=>{const[n,setN]=useState(Date.now());useEffect(()=>{const i=setInterval(()=>setN(Date.now()),ms);return()=>clearInterval(i)},[ms]);return n};
const left=ms=>{if(ms<=0)return'Ended';const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?`${d}d ${h}h ${m}m`:`${h}h ${String(m).padStart(2,'0')}m ${String(s%60).padStart(2,'0')}s`};
const KIND={day:"Today's quest",week:"This week's quest",month:"This month's quest",life:'Real-life quest',recovery:'Hard quest: restore your streak'};
const prog=(q,ctx)=>q.metric==='photo'?(q.proofOk?1:0):metricProgress(q.metric,q.startsOn,q.endsOn,ctx);
export const questDone=(q,ctx)=>q.status==='active'&&prog(q,ctx)>=q.target&&(!q.proofPrompt||q.proofOk);

function Card({q,ctx,now,onClaim,onProof,onReroll,rerollsLeft,gems,busy}){
  const p=Math.min(q.target,prog(q,ctx)),dataDone=p>=q.target,active=q.status==='active',done=active&&dataDone&&(!q.proofPrompt||q.proofOk);
  const ms=new Date(q.endsAt).getTime()-now,expired=ms<=0&&!done&&active,needsPhoto=active&&q.proofPrompt&&!q.proofOk&&(q.metric==='photo'||dataDone);
  return <div className={'qcard'+(q.kind==='recovery'?' hard':'')+(q.status==='claimed'?' claimed':'')}>
    <div className="q-top"><span className="q-kind">{KIND[q.kind]}</span><span className="q-time">{!active?'Completed ✓':expired?'Expired':'⏱ '+left(ms)}</span></div>
    <div className="q-title">{q.title}</div><div className="q-desc">{q.description}</div>
    {q.proofPrompt&&active&&<div className="q-desc" style={{marginTop:-6}}>📷 Proof: a photo of {q.proofPrompt}</div>}
    <div className="quest-bar big"><div style={{width:p/q.target*100+'%'}}/><span>{q.metric==='photo'?(q.proofOk?'Photo approved ✓':'Photo needed'):`${p} / ${q.target}`}</span></div>
    <div className="q-foot"><span>{q.kind==='recovery'?'Reward: your old streak comes back':q.rewardGems>0?<>Reward: <Gem/> {q.rewardGems}</>:'Reward: keep the momentum'}</span>
      <span style={{display:'flex',gap:8}}>{needsPhoto&&<button className="btn q-claim" style={{background:'#1cb0f6'}} disabled={busy} onClick={()=>onProof(q)}>📷 PROOF</button>}
        {done&&<button className="btn q-claim" disabled={busy} onClick={()=>onClaim(q)}>CLAIM</button>}</span></div>
    {active&&!done&&q.kind!=='recovery'&&<button className="q-reroll" disabled={busy||gems<REROLL_PRICE||rerollsLeft<1} onClick={()=>onReroll(q)}>🔄 Not feeling it? New quest · <Gem/> {REROLL_PRICE} · {rerollsLeft} swap{rerollsLeft===1?'':'s'} left</button>}</div>}

export function QuestsPanel({quests,ctx,creating,onCreate,onClaim,onProof,onReroll,rerollsLeft,gems,busy}){
  const now=useNow(1000),cur=k=>{const w=windowFor(k);return quests.find(q=>q.kind===k&&q.startsOn===w.start)};
  const rec=quests.filter(q=>q.kind==='recovery'&&q.status==='active'&&new Date(q.endsAt).getTime()>now);
  useEffect(()=>{['day','life','week','month'].forEach(k=>{if(!cur(k))onCreate(k,false)})},[quests.length]);
  const props={ctx,now,onClaim,onProof,onReroll,rerollsLeft,gems,busy};
  return <div className="habit-pages">
    <div className="set-note" style={{marginBottom:12}}>Quests picked just for you, based on how you have been doing. Gems are rare, so every one is earned.</div>
    {rec.map(q=><Card key={q.id} q={q} {...props}/>)}
    {['day','life','week','month'].map(k=>{const q=cur(k);
      return q?<Card key={q.id} q={q} {...props}/>
        :<div className="qcard" key={k}><div className="q-top"><span className="q-kind">{KIND[k]}</span></div>
          {creating[k]?<div className="q-desc">Thinking of something for you…</div>
            :<><div className="q-desc">Nothing here yet.</div><button className="btn" style={{background:'var(--accent)',color:'var(--bg)'}} onClick={()=>onCreate(k,true)}>Ask the AI</button></>}</div>})}
  </div>}
