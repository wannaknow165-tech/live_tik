/* 16:9 VFX clip -> vertical 9:16 LIVE layer without deforming the asset.
 * True alpha preserved; the crop policy is explicit by effect ID.
 */
const edgeKinds=new Set(['ALPHA_BATTLE_SMOKE','ALPHA_ELECTRIC_ENERGY','ALPHA_LIGHTNING_STRIKES']);
const make=(sx,sy,sw,sh,dx,dy,dw,dh)=>({sx,sy,sw,sh,dx,dy,dw,dh});
export function alphaPlacementRects(id,srcW,srcH,W,H){
 if(![srcW,srcH,W,H].every(v=>Number.isFinite(v)&&v>0))return [];
 const ratio=srcW/srcH,verticalRatio=W/H;
 // Native portrait footage: use original 9:16 stage space.
 if(ratio<1&&Math.abs(ratio-verticalRatio)<.13)
  return [make(0,0,srcW,srcH,0,0,W,H)];
 if(ratio>=1.25&&edgeKinds.has(id)){
  // Only the left/right real pixels; never stretch the original 16:9 into portrait.
  // Each crop maintains its aspect ratio when drawn along the edge of the 9:16 stage.
  const dw=W*.30,sw=dw*srcH/H;
  return [make(0,0,sw,srcH,0,0,dw,H),
    make(srcW-sw,0,sw,srcH,W-dw,0,dw,H)];
 }
 // Widescreen smoke/fire/CO2/shockwave: full original frame, no deformation.
 // Anchor on lower stage instead of clipping the effect in the center.
 const dw=W,dh=dw/ratio;
 const dy=Math.max(0,H-dh);
 return [make(0,0,srcW,srcH,0,dy,dw,Math.min(dh,H))];
}
