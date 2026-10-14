import {PRICE,BUY_LIMIT,HOLD_MAX} from './lib.js';
import {Gem,Ice} from './icons.jsx';

export function Shop({wallet,bought,busy,onBuy,onClose}){
  const why=wallet.unfreezes>=HOLD_MAX?`You can hold at most ${HOLD_MAX}.`:bought>=BUY_LIMIT?`Limit reached: ${BUY_LIMIT} per month.`:wallet.gems<PRICE?`You need ${PRICE-wallet.gems} more gems.`:'';
  return <div className="ss shop" role="dialog" aria-label="Shop"><button className="ss-x" onClick={onClose} aria-label="Close">✕</button>
    <div className="ss-body"><div className="rk-head">Shop</div>
      <div className="shop-bal"><Gem size={40}/> {wallet.gems}<small>gems</small></div>
      <div className="qcard"><div className="q-title"><Ice/> Unfreeze streak</div>
        <div className="q-desc">Brings a frozen streak back exactly where it was. You own {wallet.unfreezes}.</div>
        <div className="q-foot"><span><Gem/> {PRICE} · bought {bought}/{BUY_LIMIT} this month</span>
          <button className="btn q-claim" disabled={busy||!!why} style={why?{opacity:.45}:undefined} onClick={onBuy}>BUY</button></div>
        {why&&<div className="set-note" style={{marginTop:8}}>{why}</div>}</div>
      <div className="set-note">Gems are rare. You earn them from AI quests (weekly and monthly pay the most) and, now and then, for finishing your whole to-do list. A hard quest can restore a frozen streak for free.</div>
    </div></div>}

// Placeholder animation (gift box). The Rive gem and box files will replace this later.
export function RewardModal({reward,onClose}){
  const gem=reward.kind==='gem';
  return <div className="reward" role="dialog" aria-label="Reward"><div className="reward-card">
    <div className="reward-box">🎁</div><div className="reward-item">{gem?<Gem size={64}/>:<Ice size={64}/>}</div>
    <div className="rk-head">{reward.title}</div>
    <div className="set-note">{gem?`You earned ${reward.amount} gem${reward.amount>1?'s':''}!`:'Lucky! You found an Unfreeze Streak.'}</div>
    <button className="btn" style={{width:'100%',background:'#1cb0f6',color:'#fff',boxShadow:'0 4px 0 #1899d6'}} onClick={onClose}>COLLECT</button></div></div>}
