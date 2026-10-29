const fs = require('fs'), vm = require('vm');
const ctx = { console, Math, window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/sim/mob-shape.js','utf8'), ctx);
vm.runInContext(fs.readFileSync('assets/mob-shapes.js','utf8'), ctx);
const S = ctx.MOB_SHAPES['3'];
console.log('pts', S.pts.length, 'r', S.r);
const D = 39;
for (const facing of [0, Math.PI/2, Math.PI, -Math.PI/2]) {
  const mob = { x: 0, y: 60, facing, artRot: Math.PI*3/4, collSize: D, shape: { pts: S.pts, r: S.r } };
  let n = 0, first = -1, last = -1;
  for (let a = 0; a < 360; a += 1) {
    const rad = a * Math.PI/180;
    const h = ctx.mobHitTest(mob, Math.cos(rad)*52.5, Math.sin(rad)*52.5, 12.6);
    if (h) { n++; if (first<0) first=a; last=a; }
  }
  console.log('facing', facing.toFixed(2), 'hits', n, 'range', first, last);
}
