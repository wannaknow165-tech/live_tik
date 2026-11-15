import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedBattleSides } from '../src/server/battleScores.mjs';
const a={anchorIdStr:'host1',hostscore:1200,userArmies:[]};
const b={anchorIdStr:'rival2',hostscore:1600,userArmies:[]};
test('Scores are assigned by anchor ID regardless of order',()=>{
 const direct=verifiedBattleSides([a,b],'host1','rival2');
 const inverted=verifiedBattleSides([b,a],'host1','rival2');
 assert.equal(direct.hostPts,1200);assert.equal(direct.oppPts,1600);
 assert.equal(inverted.hostPts,1200);assert.equal(inverted.oppPts,1600);
 assert.equal(inverted.ourIdx,1);
});
test('Only opponent ID is sufficient in a verified two-army event',()=>{
 const x=verifiedBattleSides([b,a],null,'rival2');
 assert.equal(x.hostPts,1200);assert.equal(x.oppPts,1600);
});
test('Unknown mapping never assumes first array item is host',()=>{
 assert.equal(verifiedBattleSides([a,b],'someUnknownId',null),null);
 assert.equal(verifiedBattleSides([a,b],null,null),null);
});
test('Rejects duplicate/missing anchor IDs and invalid numbers',()=>{
 assert.equal(verifiedBattleSides([{hostscore:3},{hostscore:4}],'host1',null),null);
 assert.equal(verifiedBattleSides([{anchorIdStr:'host1',hostscore:-1},b],'host1','rival2'),null);
 assert.equal(verifiedBattleSides([{anchorIdStr:'host1',hostscore:'NaN'},b],'host1','rival2'),null);
});
test('Valid zero-zero at battle start is not incorrectly dismissed',()=>{
 const zero=verifiedBattleSides([{anchorIdStr:'host1',hostscore:0},{anchorIdStr:'rival2',hostscore:0}],'host1','rival2');
 assert.deepEqual([zero.hostPts,zero.oppPts],[0,0]);
});
