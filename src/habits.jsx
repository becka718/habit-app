import {useEffect,useRef,useState} from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import {usePress,stats,skipCount,resizeBlob,MOODS} from './lib.js';
import {useImg,imgPut,imgDel} from './db.js';
import tickSvg from './assets/correct.svg';
import ProofModal from './proof.jsx';

const dow=k=>{const[y,m,d]=k.split('-');return new Date(+y,m-1,+d).getDay()};
const bg=u=>u?{backgroundImage:`url("${u}")`}:undefined;
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS=[['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat'],['0','Sun']];

function Head({h,full,badge,tick,mood,extra}){const s=stats(h),u=useImg(full?h.imageFull||h.image:h.image);
  return <div className="feed-image-header" style={bg(u)} {...extra}>{badge}
    {tick&&<div className="done-tick"><img src={tickSvg} alt="Done today"/></div>}
    <div className="feed-header-content"><div className="feed-title">{h.name}</div><div className="feed-stats"><span>{s.days} Days Done</span>{mood!=null&&<span>{MOODS[mood]}</span>}</div></div></div>}

function Card({h,today,mood,onOpen,onMenu}){
  const press=usePress(()=>onMenu(h.id),()=>onOpen(h.id)),r=h.schedule?.[dow(today)],sk=skipCount(h);
  const key=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(h.id)}};
  return <div className="feed-card"><Head h={h} tick={h.history[today]?.status==='done'} mood={mood} extra={{...press,role:'button',tabIndex:0,onKeyDown:key}}
    badge={r?<div className="workout-badge">🔥 {r}</div>:sk?<div className="skip-badge">Skipped {sk} Days</div>:null}/></div>}

export function HabitsPage({habits,today,moods,style,onOpen,onMenu}){
  return <div className="habit-pages">{habits.length===0
    ?<div style={{textAlign:'center',padding:40,color:'var(--muted)',fontWeight:600}}>No habits yet. Open More to add one.</div>
    :<div className={'habits-list'+(style!=='list'?' style-'+style:'')}>{habits.map(h=><Card key={h.id} h={h} today={today} mood={moods[today]} onOpen={onOpen} onMenu={onMenu}/>)}</div>}</div>}

export function Sheet({h,today,moods,setMood,patch,onClose}){
  const [cal,setCal]=useState(()=>{const[y,m]=today.split('-');return{y:+y,m:+m-1}});
  const [proof,setProof]=useState(false);
  const close=()=>history.state?.sheet?history.back():onClose();
  useEffect(()=>{history.pushState({sheet:1},'');const pop=()=>onClose(),key=e=>e.key==='Escape'&&close();
    addEventListener('popstate',pop);addEventListener('keydown',key);return()=>{removeEventListener('popstate',pop);removeEventListener('keydown',key)}},[]);
  const rec=h.history[today],items=h.sequenceItems||[],prog=Math.min(rec?.sequenceProgress||0,items.length),mood=moods[today];
  const setRec=(k,fn)=>patch(h.id,x=>{const n={...x.history},v=fn(n[k]);if(v)n[k]=v;else delete n[k];return{...x,history:n}});
  const seq=i=>{if(i!==prog&&i!==prog-1)return;setRec(today,r=>({status:'pending',minutes:0,...r,sequenceProgress:i===prog?prog+1:prog-1}))};
  const finish=()=>{setRec(today,r=>({minutes:0,...r,status:'done',sequenceProgress:prog}));close()};
  const done=()=>h.proofPrompt?setProof(true):finish();
  const skip=()=>{setRec(today,()=>({status:'skipped',minutes:0,sequenceProgress:prog}));close()};
  const cycle=k=>{if(k>today)return;if(k===today&&h.proofPrompt&&(!h.history[k]||h.history[k].status==='pending')){setProof(true);return}setRec(k,r=>!r||r.status==='pending'?{status:'done',minutes:0,sequenceProgress:r?.sequenceProgress||0}
    :r.status==='done'?{status:'skipped',minutes:0,sequenceProgress:r.sequenceProgress||0}:null)};
  const nav=d=>setCal(({y,m})=>{m+=d;return m>11?{y:y+1,m:0}:m<0?{y:y-1,m:11}:{y,m}});
  const {y,m}=cal,off=(new Date(y,m,1).getDay()+6)%7,n=new Date(y,m+1,0).getDate(),r=h.schedule?.[dow(today)];
  return <div className="feed-card expanded">
    <button className="close-expanded-btn" onClick={close} aria-label="Close">✕</button>
    <Head h={h} full tick={rec?.status==='done'} badge={r?<div className="workout-badge">🔥 {r}</div>:null}/>
    <div className="feed-expanded-dark">
      {items.length>0&&<div className="sequence-list">{items.map((it,i)=>{const st=i<prog?'done':i===prog?'next':'';
        return <div className="sequence-item" key={i} onClick={()=>seq(i)}><div className="sequence-line"/><div className={'sequence-circle '+st}>{st==='done'?<img src={tickSvg} alt="Done" style={{width:16}}/>:i+1}</div><div className={'sequence-label '+st}>{it}</div></div>})}</div>}
      <div className="mood-block"><span className="log-time-label-dark">HOW ARE YOU FEELING TODAY?</span>
        <div className="mood-row">{MOODS.map((e,i)=><button key={i} className={'mood-btn'+(mood===i?' on':'')} aria-pressed={mood===i} aria-label={'Mood '+(i+1)} onClick={()=>setMood(today,mood===i?null:i)}>{e}</button>)}</div></div>
      <div className="calendar-nav"><button className="calendar-nav-btn" onClick={()=>nav(-1)} aria-label="Previous month">◀</button><div className="calendar-month">{MN[m]} {y}</div><button className="calendar-nav-btn" onClick={()=>nav(1)} aria-label="Next month">▶</button></div>
      <div className="calendar-grid">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><div className="calendar-header-day" key={d}>{d}</div>)}
        {Array.from({length:off},(_,i)=><div key={'o'+i}/>)}
        {Array.from({length:n},(_,i)=>{const k=`${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,st=h.history[k]?.status;
          return <div key={k} className={'calendar-day'+(st==='done'?' done':'')+(st==='skipped'?' skipped':'')+(k===today&&st!=='skipped'?' today-white':'')} style={k>today?{opacity:.35,cursor:'default'}:undefined} onClick={()=>cycle(k)}>{i+1}</div>})}</div>
      <div className="action-row"><button className="btn" style={{flex:1,background:'#222',color:'#fff',border:'1px solid #444'}} onClick={skip}>SKIP</button>
        <button className="btn" style={{flex:2,background:'#fff',color:'#111'}} onClick={done}>DONE</button></div>
    </div>{proof&&<ProofModal expect={h.proofPrompt} allowSkip onClose={()=>setProof(false)} onApproved={()=>{setProof(false);finish()}}/>}</div>}

function CropModal({src,onDone,onCancel}){
  const img=useRef(),cr=useRef();
  useEffect(()=>{cr.current=new Cropper(img.current,{aspectRatio:16/9,viewMode:1,dragMode:'move',autoCropArea:.9,background:false});return()=>cr.current?.destroy()},[]);
  const ok=()=>{const c=cr.current?.getCroppedCanvas({maxWidth:1920,maxHeight:1080,imageSmoothingQuality:'high'});c?.toBlob(b=>b&&onDone(b),'image/jpeg',.92)};
  return <div className="crop-modal" style={{display:'flex'}}><div className="crop-header">Drag corners to adjust · Crop the image</div>
    <div className="crop-container"><img ref={img} id="imageToCrop" src={src} alt="Picture"/></div>
    <div className="crop-actions"><button className="btn" onClick={onCancel} style={{flex:1,background:'#333',color:'#fff'}}>Cancel</button>
      <button className="btn" onClick={ok} style={{flex:1,background:'#fff',color:'#000'}}>Crop & Use</button></div></div>}

export function HabitModal({habit,onSave,onClose}){
  const [f,setF]=useState(()=>({name:habit?.name||'',seq:(habit?.sequenceItems||[]).join('\n'),image:habit?.image||'',full:habit?.imageFull||habit?.image||'',cropB:null,fullB:null,prev:'',sch:{...(habit?.schedule||{})},proofOn:!!habit?.proofPrompt,proof:habit?.proofPrompt||''}));
  const [raw,setRaw]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false),cur=useImg(f.image);
  const pick=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const url=URL.createObjectURL(file);
    try{setRaw({url,full:await resizeBlob(url,2400,.92)})}catch{URL.revokeObjectURL(url);setErr('Could not read that image.')}};
  const save=async()=>{const name=f.name.trim();if(!name)return setErr('Name required');if(f.proofOn&&!f.proof.trim())return setErr('Say what the photo should show');if(busy)return;setBusy(true);
    const schedule={};DAYS.forEach(([k])=>{schedule[k]=(f.sch[k]||'').trim()});
    const added=[];let image=f.image,imageFull=f.full;
    try{if(f.cropB){image=await imgPut(f.cropB);added.push(image);imageFull=await imgPut(f.fullB);added.push(imageFull)}}
    catch{added.forEach(imgDel);setBusy(false);return setErr('Could not upload the image. Check your connection and try again.')}
    const drop=[habit?.image,habit?.imageFull].filter(r=>r&&r!==image&&r!==imageFull);
    if(await onSave({id:habit?.id,name,image,imageFull,sequenceItems:f.seq.split('\n').map(x=>x.trim()).filter(Boolean),schedule,proofPrompt:f.proofOn?f.proof.trim():''}))drop.forEach(imgDel);
    else{added.forEach(imgDel);setBusy(false)}};
  if(raw)return <CropModal src={raw.url} onCancel={()=>{URL.revokeObjectURL(raw.url);setRaw(null)}}
    onDone={b=>{setF(x=>({...x,cropB:b,fullB:raw.full,prev:URL.createObjectURL(b)}));URL.revokeObjectURL(raw.url);setRaw(null)}}/>;
  const shown=f.prev||cur;
  return <div className="modal-overlay active"><div className="modal-sheet">
    <div className="modal-header"><div className="modal-title">{habit?'Edit Habit':'New Habit'}</div><button className="close-btn" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="form-group"><label className="form-label">Habit Name</label><input className="form-input" maxLength={80} value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Gym or Devotion" autoComplete="off"/></div>
    <div className="form-group"><label className="form-label">Weekly Split (Optional)</label><div className="split-grid">{DAYS.map(([k,l])=>
      <input key={k} className="form-input" placeholder={l} autoComplete="off" style={k==='0'?{gridColumn:'span 2'}:undefined} value={f.sch[k]||''} onChange={e=>setF({...f,sch:{...f.sch,[k]:e.target.value}})}/>)}</div></div>
    <div className="form-group"><label className="form-label">Sequence Items (Optional)</label><textarea className="form-input" placeholder={'1 cup\n2 cup\n(one item per line)'} value={f.seq} onChange={e=>setF({...f,seq:e.target.value})}/></div>
    <div className="form-group"><label className="form-label">Cover Image</label>
      <label className="image-upload-block" style={bg(shown)}>{!shown&&'Tap to choose image'}<input type="file" accept="image/*" style={{display:'none'}} onChange={pick}/></label>
      {shown&&<button className="btn" style={{padding:'8px 14px',fontSize:13,background:'var(--accent-lt)',color:'var(--text)'}} onClick={()=>setF({...f,image:'',full:'',cropB:null,fullB:null,prev:''})}>Remove image</button>}</div>
    <div className="form-group"><label className="proof-toggle"><input type="checkbox" checked={f.proofOn} onChange={e=>setF({...f,proofOn:e.target.checked})}/> Ask me for a photo as proof (optional)</label>
      {f.proofOn&&<input className="form-input" maxLength={100} placeholder="What should the photo show? e.g. my open Bible" value={f.proof} onChange={e=>setF({...f,proof:e.target.value})}/>}</div>
    {err&&<div className="form-err">{err}</div>}
    <div style={{display:'flex',gap:12,marginTop:30}}><button className="btn" onClick={save} disabled={busy} style={{flex:1,background:'var(--accent)',color:'var(--bg)'}}>{busy?'SAVING…':'SAVE'}</button>
      <button className="btn" onClick={onClose} style={{flex:1,background:'var(--bg-card)',border:'1px solid var(--border)',color:'var(--text)'}}>CANCEL</button></div></div></div>}

export function MenuSheet({i,count,onMove,onEdit,onDelete,onClose}){
  return <div className="longpress-overlay active" onClick={onClose}><div className="longpress-sheet" onClick={e=>e.stopPropagation()}>
    <button className="longpress-btn" disabled={i===0} style={i===0?{opacity:.4}:undefined} onClick={()=>onMove(-1)}>Move Up</button>
    <button className="longpress-btn" disabled={i===count-1} style={i===count-1?{opacity:.4}:undefined} onClick={()=>onMove(1)}>Move Down</button>
    <button className="longpress-btn" onClick={onEdit}>Edit Habit</button>
    <button className="longpress-btn danger" onClick={onDelete}>Delete Habit</button>
    <button className="longpress-btn" onClick={onClose}>Cancel</button></div></div>}
