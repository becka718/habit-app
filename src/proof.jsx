import {useEffect,useRef,useState} from 'react';
import {readFile,resizeBlob} from './lib.js';
import {verifyPhoto} from './db.js';
import tick from './assets/correct.svg';

// Camera proof: the phone camera opens, the AI checks the photo, and the photo is never saved.
export default function ProofModal({expect,questId,allowSkip,onApproved,onClose}){
  const [st,setSt]=useState('idle'),[msg,setMsg]=useState(''),[prev,setPrev]=useState('');
  const timer=useRef();useEffect(()=>()=>{clearTimeout(timer.current)},[]);
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;setSt('checking');setMsg('');
    const url=URL.createObjectURL(f);setPrev(url);
    try{const image=await readFile(await resizeBlob(url,768,.72)),r=await verifyPhoto({image,expect,questId});
      if(r?.ok){setSt('ok');setMsg(r.reason||'Approved!');timer.current=setTimeout(onApproved,1100)}
      else{setSt('no');setMsg(r?.reason||'That did not look right. Try again.')}
    }catch(err){console.error(err);setSt('err');setMsg(err?.context?.status===429?"You've reached today's photo-check limit. Try again tomorrow.":'Could not check the photo right now. Check your connection and that the AI function is set up.')}};
  return <div className="proof" role="dialog" aria-label="Photo proof"><div className="proof-card">
    <div className="rk-head" style={{margin:'0 0 8px'}}>Show me! 📸</div>
    <div className="set-note" style={{fontSize:15}}>Take a photo of: <b>{expect}</b></div>
    {prev&&<div className="proof-prev" style={{backgroundImage:`url("${prev}")`}}>{st==='ok'&&<img src={tick} alt="Approved"/>}</div>}
    {st==='checking'&&<div className="set-note">The AI is taking a look…</div>}
    {msg&&<div className={st==='ok'?'form-ok':'form-err'} role="status">{msg}</div>}
    {st!=='ok'&&st!=='checking'&&<label className="btn" style={{display:'block',textAlign:'center',background:'var(--accent)',color:'var(--bg)',marginTop:14}}>
      {st==='idle'?'📷 Open camera':'📷 Try again'}<input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={pick}/></label>}
    {allowSkip&&st==='err'&&<button className="sb-btn" onClick={onApproved}>Mark done anyway</button>}
    {st!=='ok'&&<button className="auth-link" style={{width:'100%'}} onClick={onClose}>Cancel</button>}
  </div></div>}
