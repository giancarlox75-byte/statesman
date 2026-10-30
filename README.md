# STATESMAN 2.0 — a persistent political simulation

Win your district, climb to the Senate and the White House, whip votes, confirm a cabinet,
fill the Supreme Court, and answer to voters who remember how you voted.

Node/Express + Postgres backend, vanilla HTML/CSS/JS frontend (no build step). Deploys to Vercel.

## How everything connects

Every system feeds every other one. Nothing is decided by a single stat.

```
 Voter blocs ──► Elections ──► Seats ──► Floor votes ──► National law ──► Economy
     ▲               ▲                       │               │              │
     │               │                       ▼               ▼              ▼
     └──── Approval ◄┴──── voting record, current law, money brought home, economy, scandals
```

**The electorate.** Every House district and state is a mix of eight voter blocs (Urban
Professionals, Working Families, Suburban Moderates, Rural Voters, Small Business Owners,
Religious Conservatives, Young Voters, Seniors). Each bloc has a position on eight issues, how much
it cares about each one, a partisan lean, and a turnout rate. The mix comes from each state's
urbanization, religiosity, union density and age (`src/config/world.js`).

**Elections.** A new cycle opens every 14 days: every House seat, one Senate class, and the
Presidency every other cycle. Each race runs filing (2 days) → primary (2 days) → general (3 days).
- Vote share per bloc = how well your **positions** match the bloc + **party** affinity +
  **awareness** (from rallies, TV ads, name recognition), multiplied by **targeted-ad** boosts and
  **credibility**, plus an **incumbency** effect based on approval. **Canvassing** turns out your own
  supporters.
- **Primaries** are decided by the party's base, whose views are pulled toward the platform, so
  candidates are pushed to the edge. Generals reward the center. Moving back costs credibility, and
  every change goes on your public record.
- If you lose a primary, you are off the general election ballot.
- The President's approval sets the national mood. A weak President drags down their whole party.
- The Presidency is decided state by state through the **Electoral College**.

**Congress.** Every seat is filled from day one, mostly by NPCs, and players take seats from them.
Bills move **House → Senate → President** (Senate bills go the other way; spending bills must start
in the House), with a 24-hour floor vote at each stage.
- NPC members vote at the deadline based on their **constituents**, their **party platform**,
  the **whip**, and any **backroom deals**. Members with low approval listen to voters more.
- Party **leaders and whips** (elected by caucus members, weighted by party standing) see a
  **whip count**, set the party line, and can spend capital on a **hard whip**. Players who break the
  whip lose party standing.
- The **Speaker** and **Senate Majority Leader** can **table** bills. Senators can **filibuster**,
  which forces a 60% cloture vote, and the minority's NPCs filibuster bills their platform hates.
- Players who **miss votes** lose approval and standing.
- The President signs or vetoes. A bill left unsigned becomes law, and Congress can **override** with two-thirds of both chambers.
- Laws move **national policy** on an issue, which nudges **growth, unemployment and the deficit**.

**Approval** drifts toward a target built from:
- your voting record vs. your constituents
- whether current law serves them (the majority party and the President take the blame, and the
  minority gets credit)
- the economy
- federal money brought home
- missed votes, scandals, town halls, and credibility

It feeds re-election, the political capital you earn each day, and how NPC colleagues vote.

**Executive & judiciary.**
- The President nominates the **cabinet** and **Supreme Court justices**, and the Senate confirms
  (NPC senators weigh party, ideology and presidential approval).
- Cabinet members get department powers. The Attorney General can open federal investigations.
- Presidents can issue **executive orders** that move policy one step without Congress.
- Officeholders and party chairs can **challenge laws** in the Supreme Court. Justices strike down
  laws that move policy away from their judicial philosophy.

**Parties.** Members elect a **chair** and caucus leaders. The chair:
- runs the treasury and sets daily dues
- emails all members
- funds candidates and endorses in primaries
- can expel members

The party **platform** is pulled toward what active members believe, and NPCs vote with it.

**Dirty politics.**
- Dark money and backroom deals create hidden **skeletons**.
- **Opposition research** digs them up into your dossier. From there you can **leak** them (an
  approval and credibility hit for the target), or use them as evidence for an **attack ad** that
  can't backfire.
- Attack ads without evidence backfire more often the lower your credibility is.

## Resources

| Resource | How you get it | What it's for |
|---|---|---|
| **Hours** | 16 per day, bank up to 24 | Almost every action |
| **Funds** | Passive income (more in office), fundraisers, dark money | Ads, filing fees, deals, oppo research |
| **Political Capital** | Daily while in office (scaled by approval), leadership roles, passing laws | Whipping, tabling, executive orders, nominations, court challenges |
| **Credibility** | Recovers slowly | Vote share, attack-ad safety. Lost by flip-flopping, scandals, backfires |
| **Approval** | See above | Re-election, capital income |

## Running it locally

Requirements: Node 18+, Postgres.

```bash
npm install
```

```bash
cp .env.example .env   # then set DATABASE_URL and JWT_SECRET
```

```bash
node scripts/init-db.js                          # schema + seeds every seat with an NPC
```

```bash
node scripts/create-admin.js you@example.com "your-password"
```

```bash
npm start                                        # http://localhost:3001
```

The world clock advances on API traffic, every 30 seconds in a long-running server, and through the
daily Vercel cron (`/api/cron/tick`). Set `GAME_SPEED=60` to make an in-game day pass in about 24
minutes while testing. Admins get an **Admin** page that can open a cycle, end a race phase, close
votes, close confirmations, decide court cases, and grant resources.

## Layout

```
src/config/world.js       states, voter blocs, issues, parties, cabinet posts
src/config/rules.js       timings, costs, and tuning knobs
src/engine/electorate.js  the voter model (pure functions)
src/engine/elections.js   cycles, filing, primaries, generals, Electoral College
src/engine/legislation.js bills, NPC voting, whips, filibuster, veto, override, executive orders
src/engine/executive.js   cabinet, confirmations, Supreme Court
src/engine/approval.js    approval, daily income, economy drift, party leadership
src/engine/actions.js     campaign, fundraising, positions, oppo research, party tools
src/engine/tick.js        the world clock
src/engine/seed.js        builds the world on first run
src/routes/               HTTP API
public/                   the client (app.js, art.js for illustrations and seating charts)
```

## Next up

- Player-led interest groups (industry associations, unions, advocacy groups) as a non-politician career path
- Player-founded factions inside parties
- Committees that can bottle up bills
- Governors and state legislatures
