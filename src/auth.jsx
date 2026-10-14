import {useState} from 'react';
import {supabase} from './db.js';

const TITLES={login:'Welcome back',signup:'Create account',forgot:'Reset password',reset:'Choose a new password'};
export default function AuthScreen({recovery,onDone}){
  const [mode,setMode]=useState(recovery?'reset':'login'),[email,setEmail]=useState(''),[name,setName]=useState(''),[pw,setPw]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(null);
  const go=m=>{setMode(m);setNote(null)};
  const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setNote(null);
    try{
      if(mode==='login'){const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});if(error)throw error}
      else if(mode==='signup'){if(pw.length<8)throw new Error('Password must be at least 8 characters.');
        const{data,error}=await supabase.auth.signUp({email:email.trim(),password:pw,options:{data:{name:name.trim().slice(0,30)}}});if(error)throw error;
        if(!data.session)setNote({ok:1,t:'Almost done! Open the email we sent and click the confirmation link, then log in.'})}
      else if(mode==='forgot'){const{error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin});if(error)throw error;
        setNote({ok:1,t:'If that email has an account, a reset link is on its way.'})}
      else{if(pw.length<8)throw new Error('Password must be at least 8 characters.');const{error}=await supabase.auth.updateUser({password:pw});if(error)throw error;onDone()}
    }catch(err){setNote({t:err.message||'Something went wrong. Try again.'})}finally{setBusy(false)}};
  return <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
    <div className="auth-title">{TITLES[mode]}</div><div className="auth-sub">Tracking: build your habits, one day at a time.</div>
    {mode==='signup'&&<div className="form-group"><label className="form-label">What should we call you?</label><input className="form-input" maxLength={30} autoComplete="given-name" placeholder="Your first name" value={name} onChange={e=>setName(e.target.value)}/></div>}
    {mode!=='reset'&&<div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>}
    {mode!=='forgot'&&<div className="form-group"><label className="form-label">{mode==='reset'?'New password':'Password'}</label><input className="form-input" type="password" required minLength={mode==='login'?undefined:8} autoComplete={mode==='login'?'current-password':'new-password'} value={pw} onChange={e=>setPw(e.target.value)}/></div>}
    <button className="btn" type="submit" disabled={busy} style={{width:'100%',background:'var(--accent)',color:'var(--bg)',marginTop:6}}>{busy?'PLEASE WAIT…':mode==='login'?'LOG IN':mode==='signup'?'SIGN UP':mode==='forgot'?'SEND RESET LINK':'SAVE PASSWORD'}</button>
    {note&&<div className={note.ok?'form-ok':'form-err'} role="alert">{note.t}</div>}
    <div style={{display:'flex',justifyContent:'space-between',marginTop:14}}>
      {mode==='login'&&<><button type="button" className="auth-link" onClick={()=>go('signup')}>Create account</button><button type="button" className="auth-link" onClick={()=>go('forgot')}>Forgot password?</button></>}
      {mode!=='login'&&mode!=='reset'&&<button type="button" className="auth-link" onClick={()=>go('login')}>Back to log in</button>}
    </div></form></div>}
