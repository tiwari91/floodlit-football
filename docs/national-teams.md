# National teams and international jobs: design note

Status: Phases A, B and C built (sections 1 to 4: `src/game/18j-national-teams.js`, hooks in 07, 14, 17, 18, 18b,
18d, 18e, 18f, 18g, 21, 30, 31, 35 and 42, tests in `tests/intl.mjs`). As-built notes and the calls made where this
plan was ambiguous or did not fit the code are in section 6.
This note is the plan, so the work can be picked up in its own session.
Generic data only: country codes and names from `NATIONS` (05). There are no real people, and
national managers' names are generated the same way club staff names are.

## 1. National teams from the save

- A squad is picked from every player in the save whose `nat` is the country: your club, every
  CPU squad (`cpuSquad(id, getStr(id))`) and your transfer shortlist (`club.market`). As built: the
  continental-cup guests are left out, because a guest's eleven is generated in the borrowed slot on
  the night (`cpuSquad(slot)`), so those players are not stable members of the save.
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
- Cache: built once per half-season and rebuilt after the summer rollover and the January window,
  so transfers and retirements show up. As built: the cache is in memory only (keyed by season, half,
  format, your roster and shortlist), not `lg.intl.squads`. Computer clubs' players get a fresh `id`
  every time `cpuSquad` runs, so stored ids would not find them again; their elevens are rebuilt from
  their seeds instead. If Phase B needs a stored call-up list, store `{ club, slot }` references.
  Known limit: the key does not see edit-mode changes to computer players or in-season rating
  changes, so the Nations card can lag until January or next season. Phase B should call
  `nationSquads` fresh (or clear `intlCache`) before a call-up if that matters.
- Fillers for a country with nobody in the save start from overall 64 (so 60 after the drop).

## 2. International jobs alongside the club job

- State: `lg.intl = { nat: null | code, offers: [], record: [], season }`. (Superseded by section 9: a national job now replaces the club job.)
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
  plus the best runners-up go through. Even seasons are the World Championship (see section 7): the
  qualifiers in groups of four, then knockouts, spread over the three breaks.
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

## 6. As built (Phases B and C)

Calls made where the plan above did not fit the code, smallest change each time:

- **The second break is after matchday 20, not 21.** `CC_NIGHTS` has the continental knockout play-off's
  first leg after matchday 21, so 21 would put a continental night and a break on the same evening. 20 is
  clear of both lists (and of the January window at 19). Breaks: 9, 20, 30.
- **Qualifying is one round-robin over five nights**, two at each of the first two breaks and one at the
  last. Groups of 5 or 6 need five rounds for a single round-robin (a group of five has a bye each night);
  a double round-robin would need ten nights, more than three breaks hold. All countries take part (those
  short of players are filled with uncapped players, as in section 1). With 32 countries that is six
  groups, 6, 6, 5, 5, 5, 5.
- **Best runners-up are ranked on points a game** (then goal difference and goals a game), since the
  groups differ in size. Six winners plus the two best runners-up make the eight.
- **The tournament's eight** are last season's qualifiers (`lg.intl.next`). With none stored (an old save,
  or a career that moved abroad and restarted its season count) the eight strongest squads play.
  Seeded by strength 1v8, 4v5, 2v7, 3v6, all at neutral grounds.
- **State.** `lg.intl = { v: 1, nat, offers, record, season, missed, rest, next, comp }`. `comp` is the
  season's competition (groups, games, nights; or the bracket). `league.v` is unchanged; `lg.intl` is
  checked on load by `ensureIntl` (07 `ensureClub`), and anything that doesn't check out is dropped: a bad
  country code loses the job, a damaged competition becomes "no breaks this season".
- **"Your nationality"** for the offer weighting is the home country (`HOME_NAT`): there is no
  manager nationality in the save, and every career starts at home.
- **Reputation** for the offer is `yourStr()` plus a little for a top-four finish (less for the bottom
  three), for winning the League Cup or the continental cup, and for seasons managed, capped at 1..5.
  An offer comes after about 60% of seasons in the top half, 30% otherwise.
- **"A club in another country"** is read as any move abroad (`moveAbroad`, a change of league country).
  Pressing Move abroad while you hold a national job puts an FA card in the offers list: take the club
  job (the national job ends) or stay (the club offer is turned down). A move agreed with your agent in
  January has already been chosen, so it ends the national job without asking.
- **Your side's identity.** The guest seat only covers the opponent, so for your national kit, name and
  ground `YOU` is swapped in `newMatch` (never in `currentFixture`, which the panels call all the time)
  and restored at the start of every `newMatch`, when the result is recorded, and before
  `rememberIdentity`. `YOU.short` stays "You". The swap is in memory only: a reload rebuilds `YOU` from
  the save and swaps again if the international is still next.
- **`matchSquad()`** is read where match code used `league.club`: `applySquad` (18), the formation
  change (21), the substitutes (30), the late auto-substitution (17) and the captain (42). The opponent's
  eleven is that country's picked eleven, not the guest seat's generated one. `simulateMine` uses the
  national side's strength.
- **No club bookkeeping on international duty.** An international doesn't advance the league round,
  tick injuries or bans, pay wages, change morale or form, or count goals, appearances or cards for your
  club. Your own club's players who play lose fitness as a league start would cost them (by object, not
  by name, so a namesake elsewhere is never charged). Your own injured or banned players are not called up.
  Your club's upgrades and staff don't apply to the national side. The half-time team talk is skipped.
- **Squad picking** is Auto-pick (the best available) with "Leave out" and "Recall" for your own
  club's players (`lg.intl.rest`); Auto-pick clears the list. Other clubs' players can't be left out.
- **National managers' names** (shown on the matchday card for the other country) come from the staff
  first names (17) and player surnames (04), hashed from the country code.
- **Option file `nations`**: `{ "ITA": { "color", "color2", "ground" } }`, checked with the same colour
  and text rules as a club (18g `checkNationFields`); unknown codes and bad values are skipped and counted
  in the preview. Kept in the save's edits, exported with them, and in `docs/option-file-schema.json`.

- **The opponent on the night is a copy** of the guest seat's identity (`setOpponent` in 31), so the
  full-time card still names the right country when the next country has already taken the seat (two
  qualifiers in one break). The full-time card after an international shows its result, your league
  place and any tired club players, not the last league match's bans and injuries.
- **Winning the tournament** queues its own trophy ("World Championship") for the ceremony (44a).

Known limits:

- Simulate whole season counts internationals in its matches-played summary.
- Edit-mode changes to computer players are not seen by the national squads until the cache rebuilds
  (section 1's limit still applies).

## 7. The World Championship (even seasons)

Replaces the eight-team knockout. Generic names only ("World Championship"), no real competition names.

- **Qualifying (odd seasons)** is as before (every country, groups of 5 or 6, one round-robin over five
  nights), but the finals now hold `intlFinalsSize(N)` countries: 16 when the save has 32 or more
  countries, 8 with 16 to 31, else 4. They are the group winners, then the runners-up, then the best of
  the thirds, each batch ranked on points a game (the groups differ in size). `C.qn` records the number;
  `lg.intl.next.nats` carries them into the next season. With 32 countries that is 6 winners, 6
  runners-up and the 4 best thirds.
- **The finals** (`drawTournament`): the qualifiers seeded by strength into four pots, one from each pot
  per group, groups of four, a single round-robin (three matchdays). Every game is at a neutral ground.
  The top two of each group go through; a group winner meets the runners-up of the neighbouring group
  (A1 v B2, C1 v D2, B1 v A2, D1 v C2) in single-match quarter-finals, then semi-finals and the final.
  With eight countries the knockouts start at the semi-finals.
- **Calendar** (`intlFinalsNights`, still clear of `CUP_NIGHTS` and `CC_NIGHTS`): group matchdays 1 and 2
  after league matchday 9, matchday 3 and the quarter-finals after 20, the semi-finals and the final after
  30. Several nights can share a break; each is one match for your side, in order. Knockout ties level
  after ninety minutes go to extra time and penalties (`intlDecide`).
- **Saves.** `lg.intl.comp` for the finals gains `groups` (optional). A save made mid-season in the old
  eight-team format has no `groups` and plays out as before (quarter-finals at the last break); `next`
  lists of 8 are still accepted. Nothing else about the save changes.
- The Cups tab shows the four group tables (top two marked, your group first) and then the bracket.
  The trophy for winning it is queued as "World Championship".
- Tests: `tests/worldcup.mjs` (sizes, groups, pairing, calendar clash, the cups card, an old save);
  `tests/intl.mjs` follows the new format.

## 8. The European Nations Cup (alternate even seasons)

Generic name ("European Nations Cup"), no real competition names.

- **The cycle.** The even seasons alternate: the World Championship in seasons 2, 6, 10 ... and the European
  Nations Cup in seasons 4, 8, 12 ... (`intlTourOf`). The season before each is its qualifying season, so
  odd seasons 1, 5, 9 qualify for the World Championship and 3, 7, 11 for the European Nations Cup.
  `C.tour` (`"wc"` or `"eu"`) records it on the competition; a competition without it (an old save) is the
  World Championship.
- **Europe only.** Countries carry a region tag in `NATIONS`; the European pool is the `home` and `europe`
  regions (16 countries). Qualifying draws only those, four groups of four, one round-robin (three nights
  of the five); `intlFinalsSize(16)` is 8, so the top two of each group go to the finals. The finals are two
  groups of four on the same break calendar (matchdays 1 and 2 after matchday 9, 3 after 20) and then the
  semi-finals and the final after matchday 30.
- **Non-European jobs have no Euro.** A national job in another region plays no European qualifying or
  finals: no fixtures, no missed tournament counted against you (the FA does not sack you for it), and the
  Cups card and Overview say so. The job carries on into the next World Championship cycle.
- Tests: `tests/euro.mjs` (six seasons of the cycle, the pool, a non-European job, a European fixture).

## 9. Club or country, never both

Replaces the "second hat" of section 2. Managing a national team and managing a club are mutually exclusive.

- **State.** `lg.intl.only` (boolean). `nat` set and `only` true: country only. `only` true and `nat` null: between jobs
  (resigned or sacked from the country, no club yet). `nat` set and `only` not true: an old save holding both jobs.
- **Accepting** an offer sets `only`, records "(national team)" in the career clubs, and the old club (still id 0 in the
  league, with its squad frozen) is played by the computer. The offer card says "You'll leave X to manage Y full-time".
- **The league still runs.** `intlOnlyAdvance` (18j) is called from `newMatch` (31) and `startPlay` (35): it simulates your
  club's fixtures, cups included, through the normal `simulateMine` path with `bulkSim`, and stops at the next
  international fixture or the end of the season. The Overview shows the national side, the next international and the
  competition status (`intlNext`). The full-time card after an international says "Continue".
- **Tabs.** `renderIntlOnly` hides the club squad, Transfers, assistant, coaching, upgrades and academy and shows
  "You manage Spain. No club duties." The Squad tab keeps the International card, where any player of your nationality
  (not only your old club's) can be left out or recalled, and nobody loses fitness for the club.
- **Club offers** still arrive each season (and after a resignation or a sacking, straight away, via `intlFreeOffers`).
  `takeOffer` (18b) asks once ("Take the club job" or "Stay with Spain"); taking it ends the national job and
  clears `only`.
- **Old saves** with `nat` set and `only` unset get a Club, Career card, "Club or country? You can't manage both any
  more": keep the club (the national job ends) or keep the country (you leave the club). Until chosen the save behaves as before.
- Tests: `tests/intl.mjs` (accepting leaves the club, fixture and simulated matchdays, no-club tabs, club offer ends the job,
  the old-save choice, whole-season simulation).

### 9.1 What a country-only manager does (intl-mode-polish)

- **Next step.** The match bar's `New match` button is relabelled in country-only mode: `Next international`, or `Start season N+1` once the season is complete (`Restart match` while a game is live). It never starts a club match and is on screen on every tab. The `Start season N+1` card button used to loop back to the same card (`startPlay` re-ran the advance on a finished season); it now rolls the season over.
- **Call-up of 23** (`I.sel`, up to 23 names; empty means auto-pick). The Squad tab lists every eligible player of the nationality with position, rating, club, form (season average) and fitness; `Call up` / `Drop`, and `Auto-pick 23`. `intlCallUp` only takes called-up players of your nation. This replaces the old leave-out/recall (`I.rest` is still read, so old saves work).
- **Formation and captain.** The Squad card has the club game's own formation buttons (same `setLineupShape`), and a captain select (`I.capt`, name) that overrides the best-form armband in `42-the-officials` for the national side.
- **Friendlies** (`I.fr`, `I.frDone`). At the next break (after matchday 9, 20 or 30) where your country has no competitive game, one friendly is arranged against a random nation; the Squad card lets you change the opponent or skip it. It is recorded as `Friendly`, moves no league round and is not offered twice.
- **FA objective and confidence** (`I.obj`, `I.conf` 0..100, start 60). A target from the side's strength rank: `qualify` in qualifying seasons; in a tournament season `reach the knockout rounds`, `reach the semi-finals` or `win the tournament`. A win is +4, a defeat -4 (friendlies +-1); when the competition ends, meeting the target is +15 and missing it -15. Shown on Overview (the international line) and as a meter on the International card. Missing targets only lowers confidence; the sacking rule is still two missed tournaments.
- All new fields are optional and validated in `ensureIntl`; tests are in `tests/intl.mjs`.
