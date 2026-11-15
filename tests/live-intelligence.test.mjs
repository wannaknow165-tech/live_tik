import test from 'node:test';
import assert from 'node:assert/strict';
import {StreamInsights,normalizeLiveInput,summarizeLives} from '../src/server/liveInsights.mjs';
const T=Date.now();
test('TikTok username and full LIVE URLs normalize, arbitrary URLs do not',()=>{
 assert.equal(normalizeLiveInput('@Test.User'), 'test.user');
 assert.equal(normalizeLiveInput('https://www.tiktok.com/@Shk.Name/live?lang=he'),'shk.name');
 assert.equal(normalizeLiveInput('https://evil.example/@name/live'),null);
 assert.equal(normalizeLiveInput('http://127.0.0.1/@bob/live'),null);
 assert.equal(normalizeLiveInput('no spaces allowed'),null);
});
test('Monitors keep independent live statistics',()=>{
 const a=new StreamInsights('alice.test'),b=new StreamInsights('bob.test');
 a.status=b.status='live';a.connectedAt=b.connectedAt=T-70000;
 a.ingest('like',{count:52},T-2000);a.ingest('chat',{text:'שלום',user:'User A'},T-1000);
 b.ingest('like',{count:8},T-2000);
 assert.equal(a.metrics(T).likesPerSec,5.2);
 assert.equal(a.metrics(T).chat60,1);
 assert.equal(b.metrics(T).likesPerSec,.8);
 assert.equal(b.metrics(T).chat60,0);
 const r=summarizeLives([a,b],T);
 assert.equal(r.liveCount,2);assert.equal(r.ranked[0].username,'alice.test');
 assert.equal(r.videoAnalyzed,false);assert.equal(r.audioAnalyzed,false);
});
test('Question grouping supports Hebrew without question mark and repeated FAQ',()=>{
 const a=new StreamInsights('chat.live');a.status='live';a.connectedAt=T-120000;
 for(let i=0;i<4;i++)a.ingest('chat',{text:'כמה זה עולה?',user:'User'+i},T-2200+i*100);
 a.ingest('chat',{text:'איך נרשמים',user:'User5'},T-1300);
 const q=a.metrics(T).questions;
 assert.ok(q[0].count>=4);
 assert.equal(q[0].category,'price');
 assert.ok(q.some(x=>x.category==='setup'));
 const rec=a.recommendations(T);
 assert.ok(rec.some(x=>x.id.startsWith('faq_')));
 assert.match(q[0].draft,/מארח/);
});
test('Draft replies do not fabricate unapproved facts',()=>{
 const a=new StreamInsights('faq.live',{approvedFacts:'המחיר המאושר: 49 ₪'});
 a.ingest('chat',{text:'מה המחיר?',user:'U1'},T-1000);
 assert.ok(a.questionGroups(T)[0].draft.includes('49'));
 const b=new StreamInsights('faq2.live');
 b.ingest('chat',{text:'מה המחיר?',user:'U1'},T-1000);
 assert.ok(!b.questionGroups(T)[0].draft.includes('49'));
});
test('Chat load produces high-priority moderation suggestions without auto-send',()=>{
 const a=new StreamInsights('busy.live');a.status='live';a.connectedAt=T-120000;
 for(let i=0;i<50;i++){
  a.ingest('chat',{text:'מה המחיר?',user:'User'+i,id:'c'+i},T-9000+i*130);
 }
 const m=a.metrics(T);assert.equal(m.chatOverloaded,true);
 assert.ok(m.chat60>=45);
 assert.equal(a.recommendations(T)[0].id,'chat_triage');
 assert.ok(a.snapshot(T).metrics.evidenceCoverage.privateMessages===false);
});
test('Deduplication of repeated event IDs',()=>{
 const a=new StreamInsights('dedup');
 assert.equal(a.ingest('like',{count:20,id:'same'},T-1000),true);
 assert.equal(a.ingest('like',{count:20,id:'same'},T-900),false);
 assert.equal(a.total.likes,20);
});
test('Insufficient samples are marked unreliable',()=>{
 const a=new StreamInsights('new.live');a.connectedAt=T-18000;a.status='live';
 a.ingest('chat',{text:'שלום'},T-100);
 const ranking=summarizeLives([a],T);
 assert.equal(ranking.ranked[0].reliable,false);
});
test('Excludes stale chat messages from current question recommendations',()=>{
 const a=new StreamInsights('old.live');
 a.ingest('chat',{text:'כמה זה עולה?',user:'old'},T-200000);
 assert.equal(a.metrics(T).questions.length,0);
});

test('TikTok caption events are observed separately from audience chat',()=>{
 const a=new StreamInsights('caption.live');a.ingestCaption('Host announces 10 second finale',T-500);
 assert.equal(a.metrics(T).chat60,0);
 assert.equal(a.metrics(T).captions.length,1);
 assert.equal(a.metrics(T).evidenceCoverage.captions,true);
});