import {useEffect,useRef,useState} from 'react';
import lottie from 'lottie-web';
import {Rive,Layout,Fit,Alignment} from '@rive-app/canvas-single';
import {MOODS,dateKey,add,habDone} from './lib.js';
import dimFire from './assets/dim_fire.svg';
import lightFire from './assets/light_fire.svg';
import {Gem,Ice} from './icons.jsx';
import tick from './assets/correct.svg';

// Celebration: one random Lottie, full page, with the sound and a DONE button
const FILES=['lesson_celebrate','celebrate_curcuce','end_lesson_junior','end_lesson_lily','end_lesson_edy'];
export function Celebrate({onDone}){
  const box=useRef(),[pick]=useState(()=>FILES[Math.floor(Math.random()*FILES.length)]);
  useEffect(()=>{const a=new Audio('/audio/celebrate.mp3');a.play().catch(()=>{});
    const an=lottie.loadAnimation({container:box.current,renderer:'svg',loop:false,autoplay:true,path:`/anim/${pick}.json`,rendererSettings:{preserveAspectRatio:'xMidYMid slice'}});
    return()=>{a.pause();an.destroy()}},[]);
  return <div className="celebrate" role="dialog" aria-label="Day complete"><div ref={box} className="celebrate-anim"/><div className="celebrate-foot"><button className="btn" onClick={onDone}>DONE</button></div></div>}

// Rive flame + odometer number, same approach as the demo app
const bufs={};const getBuf=n=>bufs[n]||(bufs[n]=fetch(`/rive/${n}.riv`).then(r=>r.arrayBuffer()));
let contentsP;const getContents=()=>contentsP||(contentsP=getBuf('fire').then(buf=>new Promise(res=>{
  const p=new Rive({buffer:buf.slice(0),canvas:document.createElement('canvas'),autoplay:false,onLoad:()=>{const c=p.contents;p.cleanup();res(c)}})})));
const SM='odometer_state_machine',dg=v=>String(Math.min(9999,Math.max(0,v))).split('').map(Number);
const size=cv=>{const d=devicePixelRatio||1,b=cv.getBoundingClientRect();cv.width=b.width*d;cv.height=b.height*d};
function startNum(cn,buf,p){size(cn);let ni;
  ni=new Rive({buffer:buf.slice(0),canvas:cn,artboard:'Main',stateMachines:SM,autoplay:true,layout:new Layout({fit:Fit.Cover,alignment:Alignment.Center}),
    onLoad:()=>{ni.resizeDrawingSurfaceToCanvas();const I=n=>(ni.stateMachineInputs(SM)||[]).find(i=>i.name===n),set=(n,v)=>{const i=I(n);if(i)i.value=v};
      const o=dg(p.old),w=dg(p.nw);o.forEach((x,i)=>set('old_pos'+(i+1)+'_num',x));set('old_digitamount_num',o.length);
      w.forEach((x,i)=>set('new_pos'+(i+1)+'_num',x));set('new_digitamount_num',w.length);
      set('perfect_bool',!!p.perfect);set('blue_bool',!!p.blue);set('dark_bool',!!p.dark);
      requestAnimationFrame(()=>I('play_trig')?.fire())}});return ni}
const MSG={PHOENIX_DARK:n=>`${n}-day milestone! Phoenix mode`,FROZEN:()=>'Back from the freeze. Fire is lit again',CLASSIC_LIGHT:()=>'The fire went out, now it is back. Fresh start',IDLE:()=>'Streak alive',FLAME_LIGHT_START:()=>'Streak alive'};
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];

export function StreakScreen({habits,moods,setMood,today,plan,onClose,info,wallet={gems:0,unfreezes:0},onShop,onUnfreeze,onQuest,hasRecovery}){
  const cv=useRef(),cn=useRef(),[fb,setFb]=useState(false),[cal,setCal]=useState(()=>{const[y,m]=today.split('-');return{y:+y,m:+m-1}}),[sel,setSel]=useState(today);
  const close=()=>history.state?.ss?history.back():onClose();
  useEffect(()=>{history.pushState({ss:1},'');const pop=()=>onClose(),key=e=>e.key==='Escape'&&close();
    addEventListener('popstate',pop);addEventListener('keydown',key);return()=>{removeEventListener('popstate',pop);removeEventListener('keydown',key)}},[]);
  useEffect(()=>{if(!plan.anim)return;let dead=false,loaded=false,fl,nm,timer;const giveUp=setTimeout(()=>{if(!loaded&&!dead)setFb(true)},6000); // if the animation can't start, show a plain fire and number instead of an empty card
    const run=(a,contents,buf)=>{if(fl){try{fl.cleanup()}catch{}}if(!cv.current)return;size(cv.current);
      const ab=(contents.artboards.find(x=>(x.animations||[]).includes(a))||contents.artboards[0]).name;
      fl=new Rive({buffer:buf.slice(0),canvas:cv.current,artboard:ab,animations:a,autoplay:true,onLoad:()=>{loaded=true;setFb(false);fl.resizeDrawingSurfaceToCanvas()}})};
    Promise.all([getBuf('fire'),getContents(),getBuf('number')]).then(([buf,contents,nb])=>{if(dead)return;
      run(plan.anim,contents,buf);if(plan.then)timer=setTimeout(()=>{if(!dead)run('IDLE',contents,buf)},3500);
      if(cn.current)nm=startNum(cn.current,nb,plan)}).catch(()=>{if(!dead)setFb(true)});
    return()=>{dead=true;clearTimeout(giveUp);clearTimeout(timer);try{fl?.cleanup()}catch{}try{nm?.cleanup()}catch{}}},[]);
  const t=(()=>{const[y,m,d]=today.split('-');return new Date(+y,m-1,+d)})(),mon=add(t,-((t.getDay()+6)%7));
  const {y,m}=cal,off=(new Date(y,m,1).getDay()+6)%7,nd=new Date(y,m+1,0).getDate();
  const nav=d=>setCal(({y,m})=>{m+=d;return m>11?{y:y+1,m:0}:m<0?{y:y-1,m:11}:{y,m}});
  const msg=plan.anim?(MSG[plan.anim]||MSG.IDLE)(plan.nw):'Do your habits today to extend your streak!';
  return <div className="ss" role="dialog" aria-label="Streak"><button className="ss-x" onClick={close} aria-label="Close">✕</button>
    <div className="ss-body">
      <div className={'ss-card '+(plan.dark?'dark':'light')}>
        {plan.anim?<><canvas ref={cv} className="ss-flame" style={fb?{display:'none'}:undefined}/><canvas ref={cn} className="ss-num" style={fb?{display:'none'}:undefined}/>{fb&&<><img src={lightFire} className="ss-dim" style={{height:170}} alt=""/><div className="ss-num-static" style={{color:'#ff9600'}}>{plan.nw}</div></>}</>
          :<><img src={dimFire} className="ss-dim" alt="Streak not lit yet"/><div className="ss-num-static">{plan.nw}</div></>}</div>
      <div className="ss-label" style={plan.anim?undefined:{color:'var(--muted)'}}>day streak</div><div className="ss-msg">{msg}</div>
      {plan.mode==='view'&&info?.lost>0&&<div className="ss-week frozen"><b><Ice/> Your {info.lost}-day streak is frozen</b>
        <div className="set-note">Restore it and it comes back exactly where it was.</div>
        <div className="rk-row"><button className="btn" disabled={!wallet.unfreezes} style={{flex:1,background:'#1cb0f6',color:'#fff',opacity:wallet.unfreezes?1:.45}} onClick={onUnfreeze}>Use unfreeze ({wallet.unfreezes})</button>
          <button className="btn" style={{flex:1,background:'var(--accent)',color:'var(--bg)'}} onClick={onQuest}>{hasRecovery?'See hard quest':'Take a hard quest'}</button></div></div>}
      {plan.mode!=='celebrate'&&<button className="sb-btn" style={{marginBottom:14}} onClick={onShop}>🛍️ Go to shop · <Gem/> {wallet.gems}</button>}
      <div className="ss-week"><div className="wk">{Array.from({length:7},(_,i)=>{const d=add(mon,i),k=dateKey(d);return <div key={k}><b className={k===today?'t':''}>{'MTWTFSS'[i]}</b><i className={habDone(habits,k)?'d':''}>{habDone(habits,k)&&<img src={tick} alt="Done"/>}</i></div>})}</div></div>
      <div className="ss-week"><div className="calendar-nav" style={{marginBottom:10}}><button className="calendar-nav-btn" onClick={()=>nav(-1)} aria-label="Previous month">◀</button><div className="calendar-month">{MN[m]} {y}</div><button className="calendar-nav-btn" onClick={()=>nav(1)} aria-label="Next month">▶</button></div>
        <div className="cg">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><div className="h" key={d}>{d}</div>)}{Array.from({length:off},(_,i)=><div key={'o'+i}/>)}
          {Array.from({length:nd},(_,i)=>{const k=`${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,fut=k>today;
            return <div key={k} className={'cd'+(habDone(habits,k)?' d':'')+(sel===k?' sel':'')+(fut?' f':'')} onClick={()=>!fut&&setSel(k)}>{i+1}{moods[k]!=null&&<em>{MOODS[moods[k]]}</em>}</div>})}</div>
        <div className="set-note" style={{margin:'14px 0 6px'}}>Mood for {sel===today?'today':sel}</div>
        <div className="mood-row" style={{marginTop:0}}>{MOODS.map((e,i)=><button key={i} className={'mood-btn light'+(moods[sel]===i?' on':'')} aria-pressed={moods[sel]===i} aria-label={'Mood '+(i+1)} onClick={()=>setMood(sel,moods[sel]===i?null:i)}>{e}</button>)}</div></div>
    </div>
    {plan.mode==='celebrate'&&<div className="celebrate-foot"><button className="btn" onClick={close}>CONTINUE</button></div>}
  </div>}
