// Pump.fun Sharpe Sprint: a paper trading bot for the pump.fun replay
// (agent-fun/replay/v2), ranked by hourly Sharpe ratio on a 6-hour window.
//
// The grader runs `node main.ts`. The harness speaks hello once, then one
// batch per slot, and this bot answers each batch with its orders for that
// slot. The strategy lives in strategy.ts; the SDK shim is the kit's
// sdk/ts/makefun-bot.ts, vendored byte for byte under vendor/.
//
// Idea: buy mature, large bonding curves only after a clean launch tape —
// several distinct buyers, no creator dump, buys outweighing sells, price
// holding near its early high — then exit fast and disciplined: take profit,
// cut losers, leave when the creator sells. The dev-window data says small
// young curves bleed on average while large survivors grind up toward
// completion, so size goes to the survivors: up to 0.6 SOL per coin, one add
// into strength, at most four momentum positions at once, no shorts, no
// leverage. Tiny probes keep the guardrail bar (round trips on 20+ coins)
// covered when the main signal is quiet; the probe pace ramps over 6 hours
// of block time so the guardrail is met inside the 6-hour final window.
//
// Before the bot starts, the default params are checked for internal
// consistency (sizing fits inside the per-position cap, exits are ordered
// sensibly, the probe size is worth its fee, the guardrail target covers
// the minimum bar). A bad config fails loudly here instead of silently
// trading with it for a whole replay.
//
// Deterministic by construction: no clock, no randomness, no I/O in the
// strategy; iteration only over insertion-ordered maps fed by the batch stream.

import { runBot } from './vendor/makefun-bot.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from './strategy.ts';

/**
 * Fail fast on a parameter set that cannot work as intended. These are
 * internal-consistency checks only — they never read the market, the clock,
 * or the environment, so they cannot change the bot's decisions.
 */
function checkParamsSane(cfg: Params): void {
  const problems: string[] = [];
  if (!(cfg.firstSol > 0)) problems.push('firstSol must be positive');
  if (!(cfg.addSol > 0)) problems.push('addSol must be positive');
  if (cfg.firstSol > cfg.maxStakeSol) problems.push('firstSol exceeds maxStakeSol');
  if (cfg.firstSol + cfg.addSol > cfg.maxStakeSol + 1e-9) problems.push('firstSol + addSol exceeds maxStakeSol');
  if (!(cfg.minRqSol < cfg.maxRqSol)) problems.push('minRqSol must be below maxRqSol');
  if (!(cfg.minAge < cfg.maxAge)) problems.push('minAge must be below maxAge');
  if (!(cfg.takeProfit > 0)) problems.push('takeProfit must be positive');
  if (!(cfg.stopLoss > 0 && cfg.stopLoss < cfg.takeProfit)) problems.push('stopLoss must be positive and below takeProfit');
  if (!(cfg.trailArm > 0 && cfg.trail > 0)) problems.push('trailArm and trail must be positive');
  if (!(cfg.probeSol >= cfg.minBuySol)) problems.push('probeSol is below minBuySol, the probe would never be placed');
  if (!(cfg.maxProbeSpendSol >= cfg.probeSol)) problems.push('maxProbeSpendSol is below one probe');
  if (!(cfg.maxMain >= 1)) problems.push('maxMain must allow at least one momentum position');
  if (!(cfg.targetCoins >= 20)) problems.push('targetCoins is below the 20-coin guardrail minimum');
  if (cfg.maxExposureSol < cfg.firstSol + cfg.addSol - 1e-9) problems.push('maxExposureSol cannot fund one full position (firstSol + addSol)');
  if (!(cfg.minRecentBuyers >= 1)) problems.push('minRecentBuyers must be at least 1');
  if (!(cfg.probeCooldown >= 0)) problems.push('probeCooldown must not be negative');
  if (!(cfg.paceSecs > 0)) problems.push('paceSecs must be positive');
  if (problems.length > 0) throw new Error(`invalid strategy params: ${problems.join('; ')}`);
}

checkParamsSane(DEFAULT_PARAMS);

await runBot(createStrategy(DEFAULT_PARAMS));
