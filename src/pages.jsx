import {useEffect,useRef,useState} from 'react';
import {dateKey,add,mondayOf,dueLabel} from './lib.js';
import Ranker,{guessEmoji} from './rank.jsx';
import tick from './assets/correct.svg';

const TABS=[['day','Today'],['week','This week'],['month','This month']];
const defaultDue=scope=>{const t=new Date();return dateKey(scope==='week'?add(mondayOf(t),6):scope==='month'?new Date(t.getFullYear(),t.getMonth()+1,0):t)};

const toLocal=iso=>{if(!iso)return'';const d=new Date(iso),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
export function TodoPage({todos,today,onAdd,onUpdate,onDelete,onArchive,onRank,onRestore}){
  const [scope,setScope]=useState('day'),[t,setT]=useState(''),[due,setDue]=useState(defaultDue('day')),[remind,setRemind]=useState(''),[ed,setEd]=useState(null),[rk,setRk]=useState(null),[arch,setArch]=useState(false);
  useEffect(()=>setDue(defaultDue(scope)),[scope]);
  const inScope=todos.filter(i=>i.scope===scope),list=inScope.filter(i=>!i.archived),archived=inScope.filter(i=>i.archived);
  const open=list.filter(i=>!i.done).sort((a,b)=>(a.rank??1e9)-(b.rank??1e9)||(a.due||'').localeCompare(b.due||'')),done=list.filter(i=>i.done);
  const fresh=open.filter(i=>i.rank==null).length;
  const perm=()=>{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()};
  const iso=v=>{const r=v?new Date(v):null;return r&&!isNaN(r)?r.toISOString():null};
  const addItem=()=>{const x=t.trim();if(!x)return;const r=iso(remind);if(r)perm();onAdd({text:x,scope,due:due||null,remindAt:r});setT('');setRemind('')};
  const saveEd=()=>{const x=ed.text.trim();if(!x)return setEd(null);const r=iso(ed.remind);if(r)perm();onUpdate(ed.id,{text:x,scope:ed.scope,due:ed.due||null,remindAt:r});setEd(null)};
  const editor=i=><div className="todo-item" key={i.id}><div style={{flex:1,minWidth:0}}>
    <input autoFocus className="form-input" value={ed.text} maxLength={120} onChange={e=>setEd({...ed,text:e.target.value})} onKeyDown={e=>{if(e.key==='Enter')saveEd();if(e.key==='Escape')setEd(null)}}/>
    <div className="add-row" style={{marginTop:8}}><label className="set-note">Due<input className="form-input" type="date" value={ed.due} onChange={e=>setEd({...ed,due:e.target.value})}/></label>
      <label className="set-note">Remind<input className="form-input" type="datetime-local" value={ed.remind} onChange={e=>setEd({...ed,remind:e.target.value})}/></label></div>
    <select className="form-input" value={ed.scope} onChange={e=>setEd({...ed,scope:e.target.value})} aria-label="Plan for">{TABS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
    <div className="rk-row"><button className="sb-btn" onClick={saveEd}>Save</button><button className="sb-btn" onClick={()=>setEd(null)}>Cancel</button></div></div></div>;
  const row=i=>ed?.id===i.id?editor(i):<div className={'todo-item'+(i.done?' done':'')} key={i.id}>
    <button className="todo-check" onClick={()=>onUpdate(i.id,{done:!i.done})} aria-label={i.done?'Mark not done':'Mark done'} aria-pressed={i.done}>{i.done&&<img src={tick} alt=""/>}</button>
    <div className="todo-body"><span className="todo-text" onClick={()=>setEd({id:i.id,text:i.text,due:i.due||'',remind:toLocal(i.remindAt),scope:i.scope})}>{guessEmoji(i.text)} {i.text}</span>
      <div className="todo-meta">{!i.done&&i.rank!=null&&<span>#{i.rank+1}</span>}
        {i.due&&<span className={!i.done&&i.due<today?'od':''}>{!i.done&&i.due<today?'Overdue':dueLabel(i.due,today)}</span>}
        {i.remindAt&&<span>🔔 {new Date(i.remindAt).toLocaleString([],{dateStyle:'short',timeStyle:'short'})}</span>}</div></div>
    <button className="todo-x" onClick={()=>onDelete(i.id)} aria-label="Delete task">✕</button></div>;
  return <div className="habit-pages">
    <div className="seg" style={{padding:'0 0 12px'}}>{TABS.map(([k,l])=><button key={k} className={scope===k?'on':''} onClick={()=>setScope(k)}>{l}</button>)}</div>
    <div className="quest-card"><div className="quest-title">{TABS.find(x=>x[0]===scope)[1]}</div><div className="quest-bar"><div style={{width:list.length?done.length/list.length*100+'%':0}}/><span>{done.length} / {list.length}</span></div></div>
    <div className="todo-add"><input className="form-input" placeholder="Add a task…" value={t} maxLength={120} onChange={e=>setT(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addItem()}/><button className="btn" onClick={addItem}>Add</button></div>
    <div className="add-row"><label className="set-note">Due<input className="form-input" type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
      <label className="set-note">Remind me (optional)<input className="form-input" type="datetime-local" value={remind} onChange={e=>setRemind(e.target.value)}/></label></div>
    {open.length>=2&&<div className="rk-row" style={{marginTop:0,marginBottom:12}}>
      {fresh>0&&<button className="sb-btn" onClick={()=>setRk({fresh:false})}>⚖️ Rank {fresh} new task{fresh>1?'s':''}</button>}
      {fresh<open.length&&<button className="sb-btn" onClick={()=>setRk({fresh:true})}>↻ Re-rank all</button>}</div>}
    {list.length===0&&<div style={{textAlign:'center',padding:30,color:'var(--muted)',fontWeight:600}}>Nothing planned here yet.</div>}
    {open.map(row)}{done.map(row)}
    {done.length>0&&<button className="sb-btn" onClick={onArchive}>Clear completed</button>}
    {archived.length>0&&<button className="sb-btn" onClick={()=>setArch(a=>!a)}>{arch?'Hide':'Show'} cleared ({archived.length})</button>}
    {arch&&archived.map(i=><div className="todo-item done" key={i.id}><span className="todo-text" style={{flex:1}}>{i.text}</span>
      <button className="sb-btn" style={{width:'auto',padding:'6px 12px',margin:0}} onClick={()=>onRestore(i.id)}>Restore</button>
      <button className="todo-x" onClick={()=>onDelete(i.id)} aria-label="Delete task">✕</button></div>)}
    {rk&&<Ranker items={open} fresh={rk.fresh} onSave={onRank} onClose={()=>setRk(null)}/>}
  </div>}

const VIEWS=[['list','☰ List View'],['grid-compact','▦ Grid Compact'],['grid-clean','⊞ Grid Clean'],['masonry','⊟ Pinterest Grid'],['icon-grid','⊙ Icon Grid']];
export function Settings({style,setStyle,onNew,onExport,onImport,clearChat,email,name,onName,onPassword,onDeleteAccount,onLogout}){
  const file=useRef(),[nm,setNm]=useState(name||''),[pw,setPw]=useState('');
  return <div className="habit-pages">
    <div className="set-title" style={{marginTop:0}}>Habits</div>
    <button className="btn" style={{width:'100%',background:'var(--accent)',color:'var(--bg)'}} onClick={onNew}>+ New habit</button>
    <div className="set-title">Habit view</div>
    {VIEWS.map(([k,l])=><button key={k} className={'sb-btn'+(style===k?' on':'')} onClick={()=>setStyle(k)}>{l}</button>)}
    <div className="set-title">Data</div>
    <button className="sb-btn" onClick={onExport}><span className="material-icons-outlined" style={{fontSize:18}}>download</span> Export Backup</button>
    <button className="sb-btn" onClick={()=>file.current.click()}><span className="material-icons-outlined" style={{fontSize:18}}>upload</span> Import Backup</button>
    <input ref={file} type="file" accept=".json" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];e.target.value='';f&&onImport(f)}}/>
    <button className="sb-btn" onClick={()=>{if(confirm('Delete the whole chat history?'))clearChat()}}><span className="material-icons-outlined" style={{fontSize:18}}>delete_sweep</span> Clear chat history</button>
    <div className="set-title">Account</div>
    <div className="set-note">Signed in as {email}</div>
    <input className="form-input" maxLength={30} placeholder="What should we call you?" value={nm} onChange={e=>setNm(e.target.value)} style={{marginBottom:8}}/>
    <button className="sb-btn" onClick={()=>onName(nm)}>Save name</button>
    <input className="form-input" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw} onChange={e=>setPw(e.target.value)} style={{margin:'8px 0'}}/>
    <button className="sb-btn" onClick={()=>{onPassword(pw);setPw('')}}>Change password</button>
    <button className="sb-btn" onClick={onLogout}><span className="material-icons-outlined" style={{fontSize:18}}>logout</span> Log out</button>
    <button className="sb-btn" style={{color:'#ff4b4b'}} onClick={onDeleteAccount}>Delete my account and all my data</button>
  </div>}
