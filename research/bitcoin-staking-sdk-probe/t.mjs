import * as bs from "@stacks/bitcoin-staking";
for (const net of ["testnet", "mainnet"]) {
  try { const b = await bs.fetchProtocolBond({ bondIndex: 3, network: net }); console.log(net, "fetchProtocolBond(3)", JSON.stringify(b, (k,v)=>typeof v==="bigint"?v.toString():v)); } catch (e) { console.log(net, "ERR", String(e).slice(0,300)); }
  try { const b = await bs.fetchTotalSbtcStaked({ network: net }); console.log(net, "fetchTotalSbtcStaked", String(b)); } catch (e) { console.log(net, "ERR2", String(e).slice(0,300)); }
}
