/* BOOSTERA Live Intelligence V10 — public TikTok event analysis, bounded memory, read-only. */
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,Number(x)||0));
const clean=(s,n=280)=>String(s??'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const sum=a=>a.reduce((n,x)=>n+x,0);
const tokens=s=>clean(s,240).toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[];
const stop=new Set(('אני אתה את הוא היא לנו לכם שלי שלך של זה הזאת הזו אבל וכן כמה מה איך למה איפה מתי האם יש אין זהו תודה שלום לייב עכשיו טוב יכול יכולה יכולים רוצה רוצים אפשר פה שם עם או כי רק גם לא כן is the and for your can are where why how what when does this that live hello thanks you have from please').split(' '));
const words=s=>tokens(s).filter(w=>!stop.has(w));
const questionStart=/^(איך|כמה|למה|מתי|איפה|מה|האם|מי|אפשר|יש|where|when|why|how|what|can|is|do|does|price|cost|who|which|will|could|are)(?:\s|$)/iu;
const questionLike=s=>s.includes('?')||s.includes('؟')||questionStart.test(s);
const categories=[
 {id:'price',name:'מחיר ותשלום',pattern:/(מחיר|עולה|עלות|כמה כסף|תשלום|price|cost|pay|שקל|₪|\$)/iu},
 {id:'setup',name:'התקנה והפעלה',pattern:/(איך|להתקין|להפעיל|נרשמים|מגדירים|setup|install|how to|connect|חיבור)/iu},
 {id:'where',name:'מיקום וקישור',pattern:/(איפה|קישור|לינק|אתר|לרכוש|where|link|website|url|shop)/iu},
 {id:'time',name:'זמן וזמינות',pattern:/(מתי|שעה|משך|זמין|זמינה|when|time|available|delivery)/iu},
 {id:'battle',name:'קרב ומתנות',pattern:/(קרב|באטל|battle|match|gift|מתנה|נקודות|glove|כפפה|לייקים|likes)/iu}
];
const category=s=>categories.find(b=>b.pattern.test(s))?.id||'general';
const label=id=>categories.find(b=>b.id===id)?.name||'שאלות כלליות';
export const normalizeLiveInput=(raw)=>{
 const text=clean(raw,220);let name=text.replace(/^@/,'');
 if(/^https?:\/\//i.test(name)){
  let url;try{url=new URL(name)}catch{return null}
  if(!['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(url.hostname.toLowerCase()))return null;
  const m=url.pathname.match(/^\/@([A-Za-z0-9._]{2,32})(?:\/live)?(?:\/.*)?$/i);
  if(!m)return null;name=m[1];
 }
 return /^[A-Za-z0-9._]{2,32}$/.test(name)?name.toLowerCase():null;
};
export class StreamInsights {
 constructor(username,opts={}){
  this.username=normalizeLiveInput(username);if(!this.username)throw Error('Invalid username');
  this.createdAt=Date.now();this.status='idle';this.connectedAt=0;this.lastAt=0;this.lastError='';
  this.viewerCount=null;this.total={likes:0,shares:0,follows:0,chats:0,joins:0,gifts:0};
  this.points=[];this.messages=[];this.captions=[];this.seenIds=new Map();
  this.approvedFacts=String(opts.approvedFacts||'').slice(0,1500).split('\n').map(s=>clean(s,180)).join('\n');this.visual=null;
 }
 ingest(kind,data={},at=Date.now()){
  const k=clean(kind,20);
  if(!['like','share','follow','chat','join','viewer','gift'].includes(k))return false;
  this.prune(at);this.lastAt=at;
  const id=clean(data?.id??'',130),dedupe=id?k+':'+id:null;
  if(dedupe&&this.seenIds.has(dedupe))return false;
  if(dedupe)this.seenIds.set(dedupe,at);
  if(k==='viewer'){
   const raw=data?.count??data?.viewerCount;
   if(raw!==null&&raw!==undefined){const x=Number(raw);if(Number.isFinite(x)&&x>=0)this.viewerCount=Math.round(x);}
   return true;
  }
  const n=['like','gift'].includes(k)?clamp(data?.count??1,1,10000):1;
  const user=clean(data?.user??data?.nickname??'צופה',45),msg=clean(data?.text??data?.comment??'',300);
  const field={like:'likes',share:'shares',follow:'follows',chat:'chats',join:'joins',gift:'gifts'}[k];
  this.total[field]+=n;this.points.push({kind:k,at,n,user});
  if(k==='chat'&&msg){
   this.messages.push({at,text:msg,user,isQuestion:questionLike(msg),category:category(msg)});
   if(this.messages.length>140)this.messages.splice(0,this.messages.length-140);
  }
  if(this.points.length>3200)this.points.splice(0,this.points.length-3200);
  return true;
 }
 ingestCaption(text,at=Date.now()){
  const value=clean(text,200);if(!value)return false;
  this.captions.push({at,text:value});if(this.captions.length>28)this.captions.shift();
  return true;
 }
 ingestVisual(data={},at=Date.now()){
  if(data.active===false){this.visual=null;return}
  this.visual={at,brightness:clamp(data.brightness,0,1),motion:clamp(data.motion,0,1),
   saturation:clamp(data.saturation,0,1),audioRms:clamp(data.audioRms,0,1),
   beat:clamp(data.beat,0,1),audioConnected:!!data.audioConnected};
 }
 prune(now=Date.now()){
  this.points=this.points.filter(x=>x.at>=now-300000);
  this.messages=this.messages.filter(x=>x.at>=now-360000);
  this.captions=this.captions.filter(x=>x.at>=now-360000);
  for(const [id,time] of this.seenIds)if(time<now-120000)this.seenIds.delete(id);
  if(this.seenIds.size>2200)for(const k of [...this.seenIds.keys()].slice(0,this.seenIds.size-1600))this.seenIds.delete(k);
 }
 questionGroups(now=Date.now()){
  const messages=this.messages.filter(x=>x.isQuestion&&x.at>=now-180000),groups=[];
  for(const m of messages){
   const terms=words(m.text),a=new Set(terms);
   const target=groups.find(g=>{
    if(g.category===m.category&&g.category!=='general')return true;
    const b=new Set(g.terms),common=[...a].filter(x=>b.has(x)).length;
    return a.size&&b.size&&common/Math.max(1,Math.min(a.size,b.size))>=.6;
   });
   if(target){target.count++;target.users.add(m.user);target.lastAt=m.at;
    if(target.examples.length<3&&!target.examples.includes(m.text))target.examples.push(m.text);
   }else groups.push({category:m.category,terms,examples:[m.text],count:1,users:new Set([m.user]),lastAt:m.at});
  }
  return groups.sort((a,b)=>b.count-a.count||b.lastAt-a.lastAt).slice(0,6).map(g=>({
   category:g.category,label:label(g.category),count:g.count,uniqueAskers:g.users.size,
   example:g.examples[0],examples:g.examples,lastAt:g.lastAt,draft:this.draftFor(g)
  }));
 }
 draftFor(g){
  const terms=new Set(g.terms),lines=this.approvedFacts.split('\n').map(s=>clean(s,180)).filter(Boolean);
  const approved=lines.find(line=>words(line).some(x=>terms.has(x)));
  if(approved)return 'לשאלה שחזרה בצ׳אט: '+approved;
  return 'ראינו כמה שאלות בנושא ״'+clean(g.examples[0],110)+'״. המארח/ת יכול/ה לתת עכשיו תשובה מדויקת ומאומתת.';
 }
 metrics(now=Date.now()){
  this.prune(now);const points=this.points;
  const count=(kind,ms)=>sum(points.filter(x=>x.kind===kind&&x.at>=now-ms).map(x=>x.n));
  const chat60=count('chat',60000),chat10=count('chat',10000),likes10=count('like',10000),likes60=count('like',60000);
  const oldVolume=count('chat',60000)-count('chat',30000),newVolume=count('chat',30000);
  const trend=oldVolume<3?'insufficient':newVolume>oldVolume*1.4?'rising':newVolume<oldVolume*.65?'falling':'stable';
  const questions=this.questionGroups(now),topicCounts=new Map();
  for(const m of this.messages.filter(x=>x.at>=now-180000))
   for(const term of new Set(words(m.text)))if(term.length>=3)topicCounts.set(term,(topicCounts.get(term)||0)+1);
  const topics=[...topicCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([term,count])=>({term,count}));
  const participants=new Set(points.filter(x=>x.kind==='chat'&&x.at>=now-60000).map(x=>x.user));
  const shares60=count('share',60000),follows60=count('follow',60000),chatPerSec=chat10/10,likesPerSec=likes10/10;
  const chatOverloaded=chatPerSec>=1.4||(chat60>=45&&questions.length>=2);
  const score=Math.round(clamp(likesPerSec*1.9+chatPerSec*22+shares60*3+follows60*2,0,1000));
  const sampleSec=this.connectedAt?Math.max(0,Math.floor((now-this.connectedAt)/1000)):0;
  const visualFresh=this.visual&&now-this.visual.at<7000;
  const visual=visualFresh?this.visual:null;
  const captions=this.captions.filter(x=>x.at>=now-180000).slice(-8);
  return {captions,visual,chat60,chat10,likes10,likes60,likesPerSec,chatPerSec,shares60,follows60,
   viewerCount:this.viewerCount,participants60:participants.size,
   questions,topics,trend,chatOverloaded,score,sampleSec,
   evidenceCoverage:{events:true,video:!!visual,audio:!!visual?.audioConnected,captions:captions.length>0,privateMessages:false},observedAt:this.lastAt};
 }
 recommendations(now=Date.now()){
  const m=this.metrics(now),ideas=[];
  const add=(id,priority,title,rationale,create,format)=>ideas.push({id,priority,title,rationale,
   create,format,source:this.username,evidence:m.chat60+' הודעות בדקה, '+m.likesPerSec.toFixed(1)+' לייקים/שנייה'});
  if(m.chatOverloaded)
   add('chat_triage',100,'מצב צ׳אט עמוס',m.chat60+' הודעות בדקה; שאלות עלולות להיעלם.',
    'חלון שאלות מאוגדות + תשובה אחת לכל קבוצה; בועות פרופיל בתדירות מוגבלת.','overlay + reply drafts');
  const repeated=m.questions.find(q=>q.count>=3);
  if(repeated)
   add('faq_'+repeated.category,95,'כרטיס תשובות: '+repeated.label,
    'השאלה עלתה '+repeated.count+' פעמים. דוגמה: "'+repeated.example+'"',
    'צור כרטיס FAQ שקוף 9:16 עם מקום לתשובה מאומתת ומעבר עדין.','FAQ transparent PNG/WebM');
  if(m.likesPerSec>=20)
   add('energy_peak',80,'תגובה קצרה לרצף לייקים חריג','נמדדו '+m.likes10+' לייקים ב־10 שניות.',
    'אנרגיה אדומה־שחורה שמתחזקת לשנייה וחצי בלי לכסות פנים. ללא אש ארוכה.','transparent WebM');
  else if(m.likesPerSec>=4)
   add('like_charging',60,'מד אנרגיה ללייקים','נמדדו '+m.likes10+' לייקים ב־10 שניות.',
    'מד טעינה קטן בתחתית המסך שמתחזק לפי קצב לייקים אמיתי.','HUD overlay');
  if(m.visual?.motion>=.32)
   add('busy_screen',72,'להפחית אפקטים בזמן תנועה חזקה',
    'דגימת התמונה מצביעה על תנועה חזותית גבוהה בחלון שנבחר.',
    'הפחת כיסוי המסך והתמקד באפקטים קטנים בפינות עד שהסצנה תירגע.',
    'minimal foreground FX');
  if(m.visual?.audioConnected&&m.visual.audioRms>=.24)
   add('audio_balance',67,'איזון סאונד בזמן עוצמת מוזיקה גבוהה',
    'מד עוצמת השמע של החלון שנבחר גבוה יחסית.',
    'הנמך SFX זמנית, ודא שהקול נשאר ברור. זהו מד עוצמה ולא תמלול.',
    'audio mix guidance');
  if(m.shares60>=3)
   add('shares',70,'אנימציית תודה על שיתופים',m.shares60+' שיתופים בדקה.',
    'חלקיקי זהב שקופים בעדינות למשך 1–2 שניות בעת שיתוף.','short alpha effect');
  if(m.trend==='falling'&&m.sampleSec>=70)
   add('engagement_decline',66,'שינוי קצב השיחה',
    'קצב הצ׳אט במחצית הדקה האחרונה ירד בהשוואה לקודמת.',
    'הכנס שאלה לקהל או סקר קצר. אל תגביר אש רק כדי להסתיר ירידה.','host prompt + poll overlay');
  if(m.topics[0]?.count>=4)
   add('topic_'+m.topics[0].term,55,'הדגשת נושא: '+m.topics[0].term,
    'הביטוי הופיע ב־'+m.topics[0].count+' הודעות.',
    'כותרת קטנה וניתנת לעריכה עם תשובה מאושרת בנושא.','editable caption overlay');
  if(!ideas.length)
   add('stay_calm',20,'אין צורך באפקט חדש כרגע','לא נצפה טריגר משמעותי בנתונים שנאספו.',
    'השאר רק עשן אדום־שחור עדין. המשך באיסוף הנתונים.','no new asset');
  return ideas.sort((a,b)=>b.priority-a.priority).slice(0,6);
 }
 snapshot(now=Date.now()){
  const m=this.metrics(now);
  return {username:this.username,status:this.status,error:this.lastError||null,
   createdAt:this.createdAt,connectedAt:this.connectedAt,lastAt:this.lastAt,
   totals:{...this.total},metrics:m,recommendations:this.recommendations(now),
   chat:this.messages.filter(x=>x.at>=now-120000).slice(-20).map(x=>({at:x.at,user:x.user,text:x.text,
     question:x.isQuestion,category:x.category})),approvedFactsPresent:!!this.approvedFacts};
 }
}
export function summarizeLives(lives,now=Date.now()){
 const valid=lives.filter(l=>l.status==='live').map(l=>({source:l,metrics:l.metrics(now)}));
 const ranked=valid.sort((a,b)=>b.metrics.score-a.metrics.score).map((v,i)=>({
  position:i+1,username:v.source.username,score:v.metrics.score,
  likesPerSec:Number(v.metrics.likesPerSec.toFixed(2)),chatPerSec:Number(v.metrics.chatPerSec.toFixed(2)),
  sampleSeconds:v.metrics.sampleSec,reliable:v.metrics.sampleSec>=45
 }));
 const overloaded=valid.filter(v=>v.metrics.chatOverloaded).map(v=>v.source.username);
 const actions=valid.flatMap(v=>v.source.recommendations(now).slice(0,3))
  .sort((a,b)=>b.priority-a.priority).slice(0,8);
 return {liveCount:valid.length,ranked,overloaded,actions,
  note:'דירוג לפי מדדי פעילות נצפים בלבד, לא לפי איכות הווידאו. נדרשת דגימה רציפה של 45 שניות להשוואה.',
  videoAnalyzed:false,audioAnalyzed:false,at:now};
}
