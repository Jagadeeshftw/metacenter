import { cvToString, deserializeCV } from '@stacks/transactions';
for (const c of ['RESERVE_RATIO','PRECISION','BOND_LENGTH_CYCLES','BOND_GAP_CYCLES','MAX_NUM_CYCLES','SIGNER_SET_MIN_USTX']) {
  const r=await fetch(`https://api.hiro.so/v2/constant_val/SP000000000000000000002Q6VF78/pox-5/${c}`); const t=await r.text();
  try{const j=JSON.parse(t); console.log(c, cvToString(deserializeCV(j.data)));}catch(e){console.log(c,r.status,t.slice(0,200))}
}
for (const v of ['first-pox-5-reward-cycle','first-bond-period-cycle','reserve-balance','rewards-paused','last-reward-compute-height']) {
  const r=await fetch(`https://api.hiro.so/v2/data_var/SP000000000000000000002Q6VF78/pox-5/${v}?proof=0`); const t=await r.text();
  try{const j=JSON.parse(t); console.log(v, cvToString(deserializeCV(j.data)));}catch(e){console.log(v,r.status,t.slice(0,200))}
}
