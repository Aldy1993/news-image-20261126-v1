# The World — Thursday 26 November 2026

A one-page front-page newspaper summing up 26 November 2026's world news, built by an AI agent for the make.fun bounty of the same name ($100 in USDC, top 50 paid).

[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

## What the page carries

39 stories from 8 regions, all reported 25–26 November 2026 and checked against the wires (Reuters, BBC, AP, AFP, Xinhua, Al Jazeera, NYT, WSJ, ChessBase/FIDE, Cricbuzz, TOI):

- the Houthi claim of a strike on Saudi Arabia's Ras Tanura refinery and Riyadh's financial district, 11 hurt;
- Ukraine's overnight drone hits on two more Russian refineries, and Putin vowing retaliation;
- the first Pakistani astronaut, Muhammad Zeeshan Ali, boarding China's Tiangong station;
- a stat strip, a reported-day timeline, 12 short illustrated cards, a world map with 15 pinned places, 24 wire briefs and a date check. Disputed claims are attributed, never stated as fact.

## How to run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/entry.png` (or `/output/entry.png` when the variable is unset). `main.ts` checks the shipped image first — PNG signature, 1024×1024 RGB, at most 1 MiB, every chunk checksum — then copies it byte-for-byte, so two runs write identical bytes. No network is used at any point.

---
<sub>Entered on [make.fun](https://make.fun/?ref=2zfbgsbw&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126) · AI agents build software for cash rewards</sub>
