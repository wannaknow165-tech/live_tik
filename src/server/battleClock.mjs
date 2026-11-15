/* BOOSTERA: TikTok-observed battle clocks. No fabricated server-time countdown.
 * LINK_MIC_BATTLE is the event-of-record for battle start.
 * A receipt timestamp is an estimate, not an official TikTok timer.
 * Client-provided protocol times are trusted only within plausible bounds.
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const num=x=>x===null||x===undefined||x===''?null:Number(x);
const secondsOrMs=x=>{
 const n=num(x);
 if(n===null||!Number.isFinite(n)||n<=0)return null;
 const v=n>1e12?n:n>1e9?n*1000:null;
 return v?Math.round(v):null;
};
const read=(obj,keys)=>{
 for(const target of [obj,obj?.battleSettings,obj?.battleSetting,obj?.battleInfo,obj?.battleDetail,obj?.battleData]){
  if(!target||typeof target!=='object')continue;
  for(const key of keys)if(Object.hasOwn(target,key)&&target[key]!==null)return target[key];
 }
 return null;
};
export function fromTikTokBattleEvent(event,receivedAt=Date.now(),previous=null){
 if(!event||typeof event!=='object')return previous;
 const id=String(read(event,['battleId','battleID','battle_id','battleIdStr'])??'').slice(0,90)||null;
 if(previous&&((id&&previous.id===id)||(!id&&receivedAt-previous.lastObservedAt<240000))){
  // Repeated notifications (including missing battle IDs) do not restart the clock.
  return {...previous, lastObservedAt:receivedAt};
 }
 const protocolStart=secondsOrMs(read(event,[
  'battleStartTime','startTime','startTimeMs','battleStartTimeMs','battleStartTs',
  'startTimestamp','start_timestamp',
 ]));
 const startValid=protocolStart!==null&&
  protocolStart>receivedAt-1200000&&protocolStart<receivedAt+5000;
 const rawEnd=secondsOrMs(read(event,[
  'battleEndTime','endTime','endTimeMs','battleEndTimeMs','endTimestamp',
 ]));
 const durRaw=num(read(event,['battleDuration','duration','durationSec','battleDurationSec']));
 let durationSec=Number.isFinite(durRaw)&&durRaw>=30&&durRaw<=1200?durRaw:null;
 const startedAtMs=startValid?protocolStart:receivedAt;
 const endValid=rawEnd!==null&&rawEnd>startedAtMs+30000&&rawEnd<startedAtMs+1200000;
 if(durationSec===null&&endValid)durationSec=Math.round((rawEnd-startedAtMs)/1000);
 return {id:id||('observed-'+receivedAt),source:startValid?'TIKTOK_TIMESTAMP':'EVENT_RECEIPT_ESTIMATE',
  startedAtMs,receivedAt,lastObservedAt:receivedAt,durationSec};
}
export function battleClockNow(clock,now=Date.now()){
 if(!clock)return {source:'NO_BATTLE_CLOCK',seconds:null,remainingSec:null,official:false,durationSec:null};
 const elapsed=Math.max(0,(now-clock.startedAtMs)/1000);
 const duration=clock.durationSec;
 return {source:clock.source,seconds:Number(elapsed.toFixed(1)),
  durationSec:duration,remainingSec:duration!==null?Math.max(0,Math.round(duration-elapsed)):null,
  official:clock.source==='TIKTOK_TIMESTAMP',id:clock.id,lastObservedAt:clock.lastObservedAt};
}
export function clockMayTriggerFinale(clock,now=Date.now()){
 const status=battleClockNow(clock,now);
 return status.durationSec!==null&&status.remainingSec!==null&&status.remainingSec<=35&&status.remainingSec>0;
}
