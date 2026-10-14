import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {usePress,stats,uid} from './lib.js';
import {supabase} from './db.js';

const RE=/\[([^\]]+)\]\((https:\/\/www\.youtube\.com\/results\?search_query=[^)\s]+)\)/g;
const links=t=>{const out=[];let last=0,m;RE.lastIndex=0;
  while((m=RE.exec(t))){out.push(t.slice(last,m.index),<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>{m[1]}</a>);last=RE.lastIndex}
  out.push(t.slice(last));return out};

async function askAI(history,habits,today,msg,name){
  const ctx=habits.length?habits.map(h=>{const s=stats(h);return`- ${h.name}: ${s.days} days done, today: ${h.history[today]?.status||'not logged'}`}).join('\n'):'The user has no habits tracked yet.';
  try{const {data,error}=await supabase.functions.invoke('ai-coach',{body:{messages:[...history,{role:'user',content:msg}],context:ctx,today,name}});
    if(error)return{ok:false,text:({404:'The AI coach is not set up yet. See the README, step 6.',429:"You've used all of today's AI messages. Come back tomorrow!",401:'Please log in again.'})[error.context?.status]||'Sorry, the AI service returned an error. Try again shortly.'};
    return data?.text?{ok:true,text:data.text}:{ok:false,text:"Sorry, I couldn't get a response right now."}
  }catch{return{ok:false,text:"Sorry, I'm having trouble connecting. Try again shortly."}}}

function Typed({text,animate}){
  const [n,setN]=useState(animate?0:text.length);
  useEffect(()=>{if(!animate)return;const t=setInterval(()=>setN(k=>{if(k>=text.length){clearInterval(t);return k}return k+1}),8);return()=>clearInterval(t)},[]);
  return <>{links(text.slice(0,n))}</>}

function User({g,onCtx}){const press=usePress(p=>onCtx(p,'user',g),null);
  return <div className="msg-row user-row"><div className="bubble-user" {...press}>{g.q}</div></div>}

function Bot({g,animate,onCtx}){
  const [open,setOpen]=useState(false),[fb,setFb]=useState(null),press=usePress(p=>onCtx(p,'bot',g),()=>setOpen(o=>!o));
  return <div className="msg-row bot-row"><div className="bubble-bot" {...press}><div className="bot-text"><Typed text={g.a} animate={animate}/></div></div>
    {open&&!g.bad&&<div className="feedback-row" style={{display:'flex'}}>
      {fb!=='down'&&<button className={'fb-btn'+(fb==='up'?' up':'')} onClick={()=>setFb('up')}>Helpful</button>}
      {fb!=='up'&&<button className={'fb-btn'+(fb==='down'?' down':'')} onClick={()=>setFb('down')}>Not helpful</button>}</div>}</div>}

export default function Chat({chat,setChat,habits,today,active,toast,onTyping,onSaveMsg,onDelMsg,name}){
  const [input,setInput]=useState(''),[anim,setAnim]=useState(null),[ctx,setCtx]=useState(null),ta=useRef(),end=useRef();
  const pending=chat.some(g=>g.a===null);
  useEffect(()=>{if(active)end.current?.scrollIntoView({behavior:'smooth',block:'start'})},[chat.length,active]);
  useEffect(()=>{const c=()=>setCtx(null);addEventListener('pointerdown',c);addEventListener('keydown',c);return()=>{removeEventListener('pointerdown',c);removeEventListener('keydown',c)}},[]);
  useLayoutEffect(()=>{const t=ta.current;if(t){t.style.height='auto';t.style.height=Math.min(t.scrollHeight,120)+'px'}},[input]);
  const send=async()=>{const q=input.trim();if(!q||pending)return;const id=uid();setInput('');
    const hist=chat.filter(g=>g.a&&!g.bad).slice(-4).flatMap(g=>[{role:'user',content:g.q},{role:'assistant',content:g.a}]);
    setChat(c=>[...c,{id,q,a:null}]);
    const r=await askAI(hist,habits,today,q,name);
    setChat(c=>c.map(g=>g.id===id?{...g,a:r.text,bad:!r.ok}:g));setAnim(id);if(r.ok)onSaveMsg({id,q,a:r.text});navigator.vibrate?.(45)};
  const open=(p,kind,g)=>setCtx({x:Math.min(p.x,innerWidth-170),y:Math.min(p.y,innerHeight-130),kind,g});
  return <div className="chat-section"><div className="chat-box">
    {chat.length===0&&<div className="empty-state"><div className="empty-title">Ask about your habits...</div></div>}
    {chat.map((g,i)=><div className="qa-group" key={g.id} ref={i===chat.length-1?end:null}><User g={g} onCtx={open}/>
      {g.a===null?<div className="msg-row bot-row"><div className="thinking-wrap"><span className="material-icons-outlined" style={{fontSize:16,animation:'textPulse 1.4s infinite'}}>hourglass_empty</span><div className="thinking-text">Thinking...</div></div></div>
        :<Bot g={g} animate={anim===g.id} onCtx={open}/>}</div>)}</div>
    <div className="input-wrap"><div className="input-box"><textarea ref={ta} rows={1} placeholder="Message..." value={input} autoComplete="off"
      onFocus={()=>onTyping(true)} onBlur={()=>onTyping(false)} onChange={e=>setInput(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/>
      <button className="send-btn-circle" onClick={send} disabled={pending||!input.trim()} style={{opacity:pending||!input.trim()?.5:1}} aria-label="Send"><span className="material-icons-outlined" style={{fontSize:20}}>arrow_upward</span></button></div></div>
    {ctx&&<div className="ctx-menu" style={{display:'block',left:ctx.x,top:ctx.y}} onPointerDown={e=>e.stopPropagation()}>
      {ctx.kind==='user'?<button className="ctx-item" onClick={()=>{setInput(ctx.g.q);setCtx(null);ta.current?.focus()}}><span className="material-icons-outlined" style={{fontSize:16}}>edit</span>Edit</button>
        :<button className="ctx-item" onClick={()=>{navigator.clipboard?.writeText(ctx.g.a).then(()=>toast('Copied'),()=>toast('Could not copy'));setCtx(null)}}><span className="material-icons-outlined" style={{fontSize:16}}>content_copy</span>Copy</button>}
      <button className="ctx-item" onClick={()=>{setChat(c=>c.filter(x=>x.id!==ctx.g.id));onDelMsg(ctx.g.id);setCtx(null)}}><span className="material-icons-outlined" style={{fontSize:16}}>delete</span>Delete</button></div>}
  </div>}
