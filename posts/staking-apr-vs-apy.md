title: Crypto staking: APR vs APY, where rewards come from and what can go wrong
meta_title: Crypto Staking: APR vs APY and the Real Risks
og_title: Crypto Staking Explained: APR vs APY, Where Rewards Come From, and the Risks
date: 2026-11-08
section: Fundamentals
readtime: 8 min read
emoji: 🪙
color: rgba(255,176,32,.08)
summary: What crypto staking is, where rewards come from, APR vs APY, why a staking yield can still lose money, and what to ask before locking tokens up.
card_summary: Staking pays a rate in tokens, but the dollar result depends on price, lock-ups and fees. Here is how to read the numbers.
keywords: crypto staking, staking apr vs apy, how staking works, staking rewards, proof of stake staking, staking risks, liquid staking, staking calculator
related: spot-vs-futures, bitcoin-halving-explained, position-sizing-and-the-one-percent-rule
---
Staking is often described as earning interest on your crypto. That description is half right and half dangerous. The reward rate is real, but it is paid in tokens whose price can move far more than the reward, it can change, and the tokens may be locked up when you most want them. This article explains how staking works and how to read the numbers you will see on a staking dashboard.

## What staking is

Some blockchains use [proof of stake](glossary.html#proof-of-stake) to agree on which transactions are valid. Instead of miners spending electricity, validators lock up (stake) the network's own token as collateral and take turns proposing and checking blocks. Honest validators earn rewards; dishonest or offline validators can be penalised. You do not have to run a validator yourself: most people delegate tokens to a validator, or use an exchange or a liquid-staking service that does it for them.

## Where the rewards come from

Staking rewards usually come from two sources: new tokens issued by the network according to its rules, and transaction fees paid by users. That distinction matters. When rewards come mostly from new issuance, every holder's share of the total supply is diluted, and stakers are partly being paid to avoid being diluted. Subtract the rate at which new tokens are created from the headline staking rate and you get a rough sense of the real yield for holders.

## APR versus APY

- **[APR](glossary.html#apr)** is the yearly rate without compounding: 5% APR on 100 tokens is 5 tokens after a year.
- **[APY](glossary.html#apy)** includes the effect of reinvesting rewards so they earn rewards too. At 5% APR compounded daily, the APY is about 5.13%.

The more often rewards compound, the higher the APY for the same APR, but the effect is small. At a 10% APR the yearly APY is 10.00%, the monthly is 10.47% and the daily is 10.52%. When you compare two products, make sure you are comparing the same measure. The [staking calculator](crypto-staking-calculator.html) converts one to the other and projects a balance over time.

## The dollar problem

Staking rewards are normally paid in the staked token. Suppose you stake 10 tokens priced at $100 ($1,000) at a 5% yearly reward. After a year you hold 10.5 tokens. If the price has fallen to $80, your holding is worth $840, a loss of 16% in dollar terms even though the "yield" was positive. If the price has risen to $120, it is worth $1,260, a gain of 26%. The reward is the smaller effect; the price is usually the larger one. Anyone who stakes should be comfortable holding the token itself.

## What can go wrong

- **Lock-ups and unbonding.** Some networks keep your tokens locked for days or weeks after you unstake. You cannot sell during that window, which matters in a fast market.
- **[Slashing](glossary.html#slashing).** A validator that double-signs or is offline too long can lose part of its stake, and delegators can share that loss.
- **Changing rates.** Rates are set by the network or the platform and move with how much is staked in total. A 9% rate today may be 5% next year.
- **Fees and commissions.** Validators and platforms keep a share of rewards, so your net rate is lower than the gross one.
- **Counterparty risk.** Staking on an exchange means the exchange holds your tokens. If it fails or freezes withdrawals, the yield is irrelevant.
- **Smart-contract risk.** Liquid-staking tokens and DeFi wrappers add code risk on top of the network risk.
- **Tax.** Many countries tax rewards when you receive them and again when you sell. Rules differ, so check yours.

## Exchange staking, self-staking and liquid staking

| Option | How it works | Main trade-off |
|---|---|---|
| Exchange staking | The exchange stakes on your behalf | Convenient, but you hold exchange risk and often pay a larger fee |
| Delegating to a validator | You keep control of your keys and choose a validator | You must choose well and accept lock-ups |
| Running your own validator | You operate the node | Highest control, with technical work and slashing risk |
| Liquid staking | You receive a token that represents your staked amount | You can use it elsewhere, but you add smart-contract and de-peg risk |

## Questions to ask before you stake

1. What is the rate after fees, and is it paid in the same token?
2. How long can my tokens be locked, and what does unstaking cost?
3. What happens to my tokens if the validator or platform fails?
4. Why is the rate this high? Unusually high yields usually mean higher risk.
5. Am I comfortable holding this token if its price halves?

Staking is one way to earn from holding; trading and providing liquidity are others, each with different risks. For the liquidity-provider side, see [impermanent loss explained](impermanent-loss-explained.html). This article is educational and is not financial advice.