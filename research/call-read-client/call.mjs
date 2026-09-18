import { Cl, cvToString, deserializeCV, serializeCV } from '@stacks/transactions';
import fs from 'fs';
const B='https://api.hiro.so/v2/contracts/call-read/SP000000000000000000002Q6VF78/pox-5/';
const S='SP000000000000000000002Q6VF78';
const calls = [
 ['get-first-pox-5-reward-cycle',[]],['current-pox-reward-cycle',[]],['current-distribution-cycle',[]],
 ['get-pox-info',[]],['get-reserve-balance',[]],['get-rewards',[]],['get-new-rewards',[]],
 ['get-last-reward-compute-height',[]],['get-last-accounted-rewards-only',[]],['get-total-sbtc-staked',[]],
 ['get-protocol-bond',[Cl.uint(1)]],['get-total-sbtc-staked-for-bond',[Cl.uint(1)]],['get-bond-l1-unlock-height',[Cl.uint(1)]],
 ['bond-period-to-reward-cycle',[Cl.uint(1)]],['bond-period-to-burn-height',[Cl.uint(1)]],
 ['burn-height-to-reward-cycle',[Cl.uint(960230)]],['burn-height-to-distribution-index',[Cl.uint(960230)]],
 ['burn-height-to-distribution-index',[Cl.uint(967589)]],['burn-height-to-distribution-index',[Cl.uint(966350)]],
 ['distribution-cycle-to-burn-height',[Cl.uint(0)]],['distribution-cycle-to-burn-height',[Cl.uint(1)]],
 ['get-total-ustx-stacked',[Cl.uint(143)]],['get-ustx-delegated-for-cycle',[Cl.uint(143)]],
 ['get-rewards-per-token-for-cycle',[Cl.uint(143),Cl.some(Cl.uint(1))]],['get-rewards-per-token-for-cycle',[Cl.uint(143),Cl.none()]],
 ['get-total-shares-staked-for-cycle',[Cl.uint(143),Cl.some(Cl.uint(1))]],['get-total-shares-staked-for-cycle',[Cl.uint(143),Cl.none()]],
 ['get-rewards-per-token-for-cycle',[Cl.uint(142),Cl.none()]],['get-total-shares-staked-for-cycle',[Cl.uint(142),Cl.none()]],
 ['is-bond-active-at-height',[Cl.uint(1),Cl.uint(967589)]],
];
const out={};
for (const [fn,args] of calls){
  const r=await fetch(B+fn,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sender:S,arguments:args.map(a=>'0x'+Buffer.from(serializeCV(a).replace(/^0x/,''),'hex').toString('hex'))})});
  const j=await r.json(); const key=fn+'('+args.map(cvToString).join(',')+')';
  out[key]=j; console.log(key,'=>',j.okay?cvToString(deserializeCV(j.result)):JSON.stringify(j));
  await new Promise(s=>setTimeout(s,700));
}
fs.writeFileSync('../hiro/pox5_readonly_calls.json',JSON.stringify(out,null,1));
