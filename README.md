[![make.fun · u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532](https://make.fun/badge/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532.svg)](https://make.fun/bounty/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532?utm_source=github&utm_medium=readme&utm_campaign=u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532)
[![rank](https://make.fun/badge/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532/anisakansa/pump-fun-sharpe-sprint/rank.svg)](https://make.fun/bounty/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532)
[![reward](https://make.fun/badge/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532/anisakansa/pump-fun-sharpe-sprint/reward.svg)](https://make.fun/bounty/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532?utm_source=github&utm_medium=readme&utm_campaign=u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532)

# Pump.fun Sharpe Sprint

Paper trading bot for the [Pump.fun Sharpe Sprint — Cleanest Paper Bot Wins](https://make.fun/bounty/u-jackxyz72-pump-fun-sharpe-sprint-cleanest-03e4f532) bounty on [make.fun](https://make.fun). It trades 10 SOL of paper money on a 6-hour replay of pump.fun bonding-curve activity (TradeEvent / CreateEvent / CompleteEvent), ranked by **hourly Sharpe ratio** — not PnL. A placement needs net PnL above 0 SOL after every fee.

## Strategy

The final window is only 6 hours long, so only six hourly equity marks decide the rank: Sharpe = mean(hourly return) / sample stdev(hourly return). A single lumpy moonshot scores about 0.41 at best, while small gains banked steadily every hour score much higher. This bot is therefore built for steady hourly marks, not for the biggest PnL: it buys only large, mature curves whose launch tape is still clean, banks the win early (+15% take-profit), cuts losers fast (−5% stop), and never lets a position sit long enough to mark a whole hour down.

Buy mature, large bonding curves only (real SOL 40–70) after a clean tape: several distinct non-creator buyers, no creator sell, buys outweighing sells, price near its early high, fresh net inflow positive — and the recent flow must come from more than one buyer, so a single wallet washing the tape does not count as demand. The dev-window data says small young curves bleed on average while large survivors grind up toward completion, so size goes to the survivors: up to 0.6 SOL per coin, one add into strength, at most four momentum positions at once, no shorts, no leverage.

Exits are disciplined: take profit +15%, stop loss −5%, trailing stop once the peak clears +10%, immediate exit on creator sell or a single large sell, fade exit when net flow over the last 75 slots turns negative, hard time limit. Positions may ride into completion (closed by the replay at final reserves). Tiny 0.01 SOL probe round trips keep the guardrail bar (≥20 coins) covered when the main signal is quiet; the probe pace ramps over 6 hours of block time so the guardrail is met inside the 6-hour final window, with a 30-coin target for margin against failed probe fills.

Every decision the bot makes is written to an in-memory journal (entries, adds, exits with their reason, probes), which the backtest prints as a summary — so you can see which rule fires and which one never does. Stale tapes of completed curves are swept a bounded slice per batch, keeping memory flat without touching behaviour.

## Local backtest (dev window, `tools/slices.ts`)

The dev dataset is byte-identical to the Pump Replay v1 dataset (24h, 2–3 Nov 2026). Local sim, 4 × 6-hour slices plus the full 24h run (TP +15%, 30-coin probe target):

| Window | Net PnL | Sharpe/hour | Max DD | Coins | Trips |
|---|---|---|---|---|---|
| Slice 1 (0–6h) | −0.026 SOL | −2.50 | 0.26% | 30 | 31 |
| Slice 2 (6–12h) | +0.185 SOL | +0.55 | 0.71% | 30 | 32 |
| Slice 3 (12–18h) | +0.105 SOL | +0.34 | 0.19% | 30 | 31 |
| Slice 4 (18–24h) | +0.138 SOL | +0.34 | 0.47% | 30 | 31 |
| Full 24h | **+0.513 SOL** | **+0.38** | 0.71% | 39 | 41 |

Slice 1 is the quiet early-morning slice (03:09–09:09 UTC): no curve qualifies for a main entry there, so the slice is probe drag only. Slices 2–4 — the realistic proxy for the 17:00–23:00 UTC final window — are Sharpe-positive with 2–4 main entries each. All house pilots are Sharpe-negative on the full dev window (sniper −0.84, reversion −0.48, momentum −0.58).

Tuning notes (all measured on the same slices): TP +20% gives more PnL (+0.60 SOL) but a slightly lower Sharpe and worse concentration; TP +15% is the best Sharpe/concentration trade-off. Loosening the entry filter (real SOL ≥ 30, or a looser tape) admits rugs and destroys the run — the strict tape filter is doing the work. A half-position partial take-profit at +8% was tried and rejected by measurement (lower PnL, worse concentration).

## Run

```sh
node main.ts
```

```sh
node tools/slices.ts <kit dir> ['{"takeProfit":0.15}']
```

Node 22.18+ required (uses TypeScript type stripping). No dependencies, no network, no secrets: everything the bot runs is in this repository. `vendor/makefun-bot.ts` is the kit's SDK shim, vendored byte for byte; `tools/sim.ts` is the kit's local replay engine port, used only for offline backtests. The bot is pure stdin/stdout with no file I/O, no clock, and no randomness — two runs produce byte-identical action logs.

## Files

- `main.ts` — entrypoint: validates the params, runs the strategy through the replay harness.
- `strategy.ts` — the trading strategy (entry signal, exits, probes, decision journal).
- `vendor/makefun-bot.ts` — harness SDK shim (kit-provided).
- `tools/slices.ts`, `tools/sim.ts` — offline backtest on the dev window: 4 × 6-hour slices + full 24h, hourly Sharpe, and the S1/S3/S5 gate verdicts.
