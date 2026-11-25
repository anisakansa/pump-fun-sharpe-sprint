// Slice backtest for the Sharpe Sprint: 4 x 6-hour slices of the 24h dev
// window plus the full 24h run. Prints net PnL, hourly Sharpe, max
// drawdown, fills, coins, trips and the decision journal per slice, then
// the S1 / S3 / S5 gate verdicts from the audit.
//   node tools/slices.ts <kit dir> ['{"takeProfit":0.12}']
// Slices are cut on block_time from the dev window start (03:09:02 UTC);
// each slice is an independent run (fresh bot, fresh capital), exactly like
// a 6-hour final window. Curves created before a slice starts are entered
// through their first in-slice trade, as they would be in a fresh window.

import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';
import { loadDataset, makeHello, phaseSeed, simulate, sliceDataset, type SimResult } from './sim.ts';

const kit = process.argv[2];
if (kit === undefined) {
  console.error('usage: node tools/slices.ts <kit dir> [params json]');
  process.exit(2);
}
const overrides = process.argv[3] !== undefined && process.argv[3].startsWith('{') ? (JSON.parse(process.argv[3]) as Partial<Params>) : {};
const params = { ...DEFAULT_PARAMS, ...overrides };
const ds = loadDataset(kit);
const sol = (x: bigint) => (Number(x) / 1e9).toFixed(6);
const fmtSharpe = (s: number | null) => (s === null ? 'null' : s.toFixed(4));

function runOne(label: string, data: ReturnType<typeof sliceDataset>, seedPhase: string): SimResult {
  const hello = makeHello(phaseSeed('pump-fun-sharpe-sprint', seedPhase, ds.sha256));
  const bot = createStrategy(params);
  const r = simulate(data, hello, bot);
  const wins = r.trips.filter((t) => t.pnl > 0n).length;
  const top3 = [...r.perMint.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)).slice(0, 3);
  const top3Sum = top3.reduce((a, [, v]) => a + (v > 0n ? v : 0n), 0n);
  const posSum = [...r.perMint.values()].reduce((a, v) => a + (v > 0n ? v : 0n), 0n);
  const top3Share = posSum > 0n ? Number(top3Sum) / Number(posSum) : 0;
  console.log(`${label}: net ${sol(r.netPnl)} SOL  sharpe ${fmtSharpe(r.sharpe)}  dd ${r.maxDrawdown.toFixed(4)}  fills ${r.fills}  coins ${r.mints}  trips ${r.trips.length}  wins ${wins}  rejected ${r.rejected}  failed ${r.failed}`);
  console.log(`  hourly returns: [${r.hourlyReturns.map((x) => (x * 100).toFixed(3) + '%').join(', ')}]`);
  console.log(`  top3 share of gains: ${(top3Share * 100).toFixed(1)}%  decisions: ${JSON.stringify(bot.summarizeDecisions())}`);
  return r;
}

const t0 = ds.firstBlockTime;
const slices: SimResult[] = [];
for (let i = 0; i < 4; i++) {
  slices.push(runOne(`slice ${i + 1} (${i * 6}-${(i + 1) * 6}h)`, sliceDataset(ds, t0 + i * 21600, t0 + (i + 1) * 21600), `slice-${i + 1}`));
}
const full = runOne('full 24h', ds, 'dev');

// --- Gates (audit G-SHARPE) ---
const s1Coins = slices.every((r) => r.mints >= 25);
const s1Dd = slices.every((r) => r.maxDrawdown <= 0.5);
const s1Pnl = slices.filter((r) => r.netPnl >= 0n).length;
const s2Sharpe = slices.filter((r) => r.sharpe !== null && r.sharpe > 0).length;
const s3 = full.netPnl > 0n && full.sharpe !== null && full.sharpe > 0;
const top3 = [...full.perMint.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)).slice(0, 3);
const top3Sum = top3.reduce((a, [, v]) => a + (v > 0n ? v : 0n), 0n);
const posSum = [...full.perMint.values()].reduce((a, v) => a + (v > 0n ? v : 0n), 0n);
const s5 = posSum > 0n ? Number(top3Sum) / Number(posSum) <= 0.5 : true;
console.log(`GATES: S1 coins>=25 all: ${s1Coins} | S1 dd<=50% all: ${s1Dd} | S1 pnl>=0 slices: ${s1Pnl}/4 (need >=3)`);
console.log(`GATES: S2 sharpe>0 slices: ${s2Sharpe}/4 (need >=3, all pilots negative in full-dev)`);
console.log(`GATES: S3 full pnl>0 + sharpe>0: ${s3} (net ${sol(full.netPnl)}, sharpe ${fmtSharpe(full.sharpe)})`);
console.log(`GATES: S5 top3 share ${(posSum > 0n ? (Number(top3Sum) / Number(posSum) * 100).toFixed(1) : '0')}% (need <=50%): ${s5}`);
const pass = s1Coins && s1Dd && s1Pnl >= 3 && s2Sharpe >= 3 && s3 && s5;
console.log(`VERDICT: ${pass ? 'PASS' : 'FAIL'}`);
if (!pass) process.exit(1);
