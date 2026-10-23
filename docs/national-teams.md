# National teams and international jobs: design note

Status: not built yet. This note is the plan, so the work can be picked up in its own session.
Generic data only: country codes and names from `NATIONS` (05). There are no real people, and
national managers' names are generated the same way club staff names are.

## 1. National teams from the save

- A squad is picked from every player in the save whose `nat` is the country: your club, every
  CPU squad (`cpuSquad(id, getStr(id))`), the transfer markets and the continental-cup guests.
- Selection: the best 11 for the format by `ovrOf`, filled by position the way `slotsFor(fmt)`
  fills a club (gk, def, mid, fwd), with a bench of 5 from the next best. If a country is short in
  a position, the gap is filled with `genPlayer(pos, …, { nat })` at that country's average rating
  minus 4, so small nations stay playable without being strong.
- Strength for simulated games: the mean of the eleven's `ovrOf`, mapped onto the 1..5 `str`
  scale with the same curve `cpuOvr` uses in reverse (a helper `strOfOvr`).
- Identity: `{ nat, name: NATIONS[nat][0], short: nat, color, color2, ground }`. Colours come from
  a small generic table per region, run through `foreignSecond`; the ground is "National Stadium".
  An option file may later add a `nations` section (`color`, `color2`, `ground`) in the same
  checked way as clubs (18g `checkClubFields`). Nothing real is put in the repo.
- Cache: built once a season (`lg.intl.squads[nat]`, player ids only), and rebuilt after the
  summer rollover and the January window, so transfers and retirements show up.

## 2. International jobs alongside the club job

- State: `lg.intl = { nat: null | code, offers: [], record: [], season }`. The club job doesn't
  change; the national job is a second hat.
- Offers come after the season, in `offerJobs` (18b): one at most, from a country whose squad
  strength is within about one star of your reputation (league position, trophies, seasons).
  Your own nationality's FA is twice as likely to ask. Offers are shown under Club, Career, as
  "International offer" cards with Accept and Decline, using the same markup as `jobOffers`.
- You can hold one national job. It ends if you resign from the Club tab, after two qualifying
  campaigns in a row that miss the tournament, or if you take a job at a club in another
  country (the FA asks you to choose).
- Squad picking: an "International" card on the Squad tab lists the called-up players with
  Auto-pick (best XI) as the default. Picking your own club's players can cost them fitness
  (`fitOf`) for the next league match, the same trade-off as rotation.

## 3. International breaks and fixtures

- Calendar: three breaks a season, after league matchdays 9, 21 and 30. They are kept off
  `CUP_NIGHTS` (5, 11, 19, 27, 34) and the continental nights (`CC_NIGHTS`).
- Odd seasons are qualifiers: groups of 5 or 6 drawn from the countries with at least 11 players
  in the save (others get the generated filler above), two games per break, and the group winners
  plus the best runners-up go through. Even seasons are the tournament: a final round of 8 played
  at the last break of the season as quarter-finals, semi-finals and a final (one per night, so
  the break grows to three nights).
- The flow: `currentFixture()` (14) already lets the continental cup come first. An `intlFixture()`
  hook goes in the same place, ahead of the league, returning
  `{ round, home, opp, intl: { gi }, label: "Qualifier · Group B", neutral }`. The national side is
  played through the same guest mechanism the continental cup uses (`applyGuest` / `restoreGuest`
  in 18f), so the match engine, kits, ground name, commentary and the match centre all just work.
  Your side in an international takes the national squad in place of `league.club` for that one
  match (a `matchSquad()` indirection where `applySquad` reads `league.club`).
- Other countries' games are simulated with `simMatch`-style Poisson results from the two strengths.
- Overview gets a line per break ("International break: Qualifier v ITA, Saturday"), and the
  Cups tab gets an "International" section with the group table or bracket.

## 4. Saves, files and tests

- `lg.intl` is versioned and optional: an old save loads with no national job and no breaks until
  the next season starts.
- Export and import carry `lg.intl` (and an option file's optional `nations` section, checked).
- Tests (new `tests/intl.mjs`): squads are only that nationality and include the best players;
  an offer can be accepted and held with the club job; the break fixture comes before the league
  and returns to it afterwards; the guest is restored (no nation name left in `TEAMS`); an old
  save loads; no real names appear in the repo (a check that every generated manager name comes
  from the name tables).

## 5. Order of work

1. Squad builder plus strength (pure functions, unit-tested through `window.__ff`).
2. Calendar and simulated internationals (no job yet): tables appear in Cups.
3. The job: offers, accept or decline, resign.
4. Playing your national side's match through the guest path.
5. UI polish: Overview line, Squad tab card, Help text.
