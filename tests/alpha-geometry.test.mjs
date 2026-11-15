import test from 'node:test';
import assert from 'node:assert/strict';
import {alphaPlacementRects} from '../src/engine/alphaGeometry.mjs';
const pct=(a,b)=>Math.abs(a-b)/Math.max(1,b);
test('Landscape smoke can fill both vertical edges without warping aspect ratio',()=>{
 const rects=alphaPlacementRects('ALPHA_BATTLE_SMOKE',1280,720,1080,1920);
 assert.equal(rects.length,2);
 for(const r of rects)assert.ok(pct(r.sw/r.sh,r.dw/r.dh)<.000001);
 assert.ok(rects[0].dx+rects[0].dw<=1080*.31);
 assert.ok(rects[1].dx>=1080*.69);
});
test('Widescreen fire is projected to lower stage without stretching or center cut',()=>{
 const [r]=alphaPlacementRects('ALPHA_FIRE_CANNONS',1280,720,1080,1920);
 assert.ok(pct(r.sw/r.sh,r.dw/r.dh)<.000001);
 assert.ok(r.dy>1000);
 assert.equal(r.dw,1080);
 assert.equal(r.dx,0);
});
test('Native 9:16 alpha source fills stage without side cropping',()=>{
 const [r]=alphaPlacementRects('ALPHA_FIRE_CANNONS',1080,1920,1080,1920);
 assert.equal(r.dw,1080);assert.equal(r.dh,1920);assert.equal(r.sw,1080);
});
test('Invalid source metadata cannot generate unsafe drawImage geometries',()=>{
 assert.deepEqual(alphaPlacementRects('ALPHA_BATTLE_SMOKE',0,720,1080,1920),[]);
});
