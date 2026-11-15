import test from 'node:test';
import assert from 'node:assert/strict';
import {fromTikTokBattleEvent,battleClockNow,clockMayTriggerFinale} from '../src/server/battleClock.mjs';

const T=Date.UTC(2026,10,15,13,0,0);
test('A start event with battleId anchors wall clock once',()=>{
 const a=fromTikTokBattleEvent({battleId:'real-123'},T);
 assert.equal(a.source,'EVENT_RECEIPT_ESTIMATE');
 assert.equal(a.startedAtMs,T);
 assert.equal(a.durationSec,null);
 const b=fromTikTokBattleEvent({battleId:'real-123'},T+10000,a);
 assert.equal(b.startedAtMs,T);
 assert.equal(battleClockNow(b,T+10000).seconds,10);
 assert.equal(battleClockNow(b,T+10000).remainingSec,null);
 assert.equal(clockMayTriggerFinale(b,T+10000),false);
});
test('Official protocol timestamp is used only when plausible',()=>{
 const c=fromTikTokBattleEvent({battleId:'new',battleStartTime:Math.floor((T-2000)/1000),
  durationSec:240},T);
 assert.equal(c.source,'TIKTOK_TIMESTAMP');
 assert.equal(c.startedAtMs,T-2000);
 assert.equal(battleClockNow(c,T+12000).remainingSec,226);
 assert.equal(clockMayTriggerFinale(c,T+206000),true);
});
test('Bogus timestamps fall back to observed event time, not 1970',()=>{
 const old=fromTikTokBattleEvent({battleId:'old',battleStartTime:12345},T);
 assert.equal(old.source,'EVENT_RECEIPT_ESTIMATE');
 assert.equal(old.startedAtMs,T);
});
test('New battle ID starts new clock; repeated ID does not',()=>{
 const first=fromTikTokBattleEvent({battleId:'A'},T);
 const same=fromTikTokBattleEvent({battleId:'A'},T+20000,first);
 const next=fromTikTokBattleEvent({battleId:'B'},T+30000,same);
 assert.equal(same.startedAtMs,T);
 assert.equal(next.startedAtMs,T+30000);
 assert.equal(next.id,'B');
});
test('Unknown duration never fabricates 4-minute remaining time',()=>{
 const c=fromTikTokBattleEvent({battleId:'partial'},T);
 assert.equal(battleClockNow(c,T+239000).remainingSec,null);
 assert.equal(battleClockNow(c,T+260000).seconds,260);
 assert.equal(clockMayTriggerFinale(c,T+260000),false);
});
test('Validation rejects nonsensical durations and impossible end time',()=>{
 const c=fromTikTokBattleEvent({battleId:'bad',durationSec:-1,
  endTime:Math.floor((T-1000)/1000)},T);
 assert.equal(c.durationSec,null);
});
test('No battle event means no clock',()=>{
 const c=battleClockNow(null,T);
 assert.equal(c.seconds,null);
 assert.equal(c.remainingSec,null);
 assert.equal(c.official,false);
});
