/* Evidence-first battle score mapping; never guess the index of "our team".
 * TikTok's armies array order may change. Trust only matching anchor IDs.
 */
const text=x=>x===null||x===undefined?'':String(x).trim();
const value=x=>{
 const n=Number(x);
 return Number.isFinite(n)&&n>=0&&n<1000000000?Math.round(n):null;
};
export function verifiedBattleSides(entries,hostAnchorId,opponentAnchorId){
 if(!Array.isArray(entries)||entries.length<2)return null;
 const hostId=text(hostAnchorId),oppId=text(opponentAnchorId);
 if(!hostId&&!oppId)return null;
 const sides=entries.map(x=>({id:text(x?.anchorIdStr||x?.anchorId||x?.anchor_id),
  score:value(x?.hostscore??x?.points??x?.hostScore)}));
 if(sides.some(x=>x.score===null))return null;
 if(!sides[0].id||!sides[1].id||sides[0].id===sides[1].id)return null;
 let ourIdx=-1;
 if(hostId)ourIdx=sides.findIndex(x=>x.id===hostId);
 if(ourIdx<0&&oppId){
  const rivalIdx=sides.findIndex(x=>x.id===oppId);
  if(rivalIdx>=0&&sides.length===2)ourIdx=1-rivalIdx;
 }
 if(ourIdx<0)return null;
 const rival=oppId?sides.findIndex(x=>x.id===oppId):1-ourIdx;
 if(rival<0||rival===ourIdx)return null;
 return {hostPts:sides[ourIdx].score,oppPts:sides[rival].score,
  source:'TIKTOK_LINK_MIC_ARMIES_ANCHOR_MATCH',ourIdx,rivalIdx:rival};
}
