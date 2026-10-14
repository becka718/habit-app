import {useEffect,useState} from 'react';
import {supabase,configured} from './db.js';
import AuthScreen from './auth.jsx';
import App from './App.jsx';

export default function Root(){
  const [session,setSession]=useState(undefined),[recovery,setRecovery]=useState(false);
  useEffect(()=>{if(!supabase)return;
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const{data:sub}=supabase.auth.onAuthStateChange((ev,s)=>{if(ev==='PASSWORD_RECOVERY')setRecovery(true);if(ev==='SIGNED_OUT')setRecovery(false);setSession(s)});
    return()=>sub.subscription.unsubscribe()},[]);
  if(!configured)return <div className="auth-wrap"><div className="auth-card"><div className="auth-title">Almost there</div>
    <div className="auth-sub">This app needs your Supabase details. Copy <b>.env.example</b> to <b>.env</b>, fill in your project URL and anon key, then restart <b>npm run dev</b>. The README has every step.</div></div></div>;
  if(session===undefined)return <div className="splash">Loading…</div>;
  if(!session||recovery)return <AuthScreen recovery={recovery} onDone={()=>setRecovery(false)}/>;
  return <App key={session.user.id} user={session.user}/>}
