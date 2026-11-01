# PLAYTEST — capture and player feedback

Two separate things live here:

1. `?playtest=1` — the local QA tour that records a machine-readable session log. **Built in v0.1.90.**
2. A no-backend way for outside players to send run data back. **Evaluated only; nothing is built.**

---

## 1. The local tour (`?playtest=1`)

```
http://127.0.0.1:5173/?playtest=1
http://127.0.0.1:5173/?playtest=1&debug=1   (adds window.__defl inspection helpers)
```

The hook boots straight into `VS BOTS`, skips the menus, and:

- uses the saved callsign, selected program and bot tier, with **3 bots**;
- plays `PLAYTEST_ROUNDS_PER_MAP` (**3**) completed rounds on each arena in `ARENAS` order;
- waits ~2 s after the third round, then rotates to the next arena and starts a fresh match;
- ends on a **PLAYTEST COMPLETE** overlay with `DOWNLOAD LOG`, `COPY LOG` and `TITLE`;
- writes the log to `localStorage['deflect.playtest.last']` after **every** round, so a crash keeps the
  finished rounds;
- clears the live tour state when you leave to the title; the saved copy stays until the next tour
  overwrites it.

Once you have seen every arena, stop the tour; you do not need to finish the last match for earlier rounds
to be usable.

### What a round records

`deflect.playtest.last`, `schema: 1`:

| Field | Contents |
| --- | --- |
| header | build stamp, `startedAt`, `finishedAt`, `complete`, `mode`, program, bot count, bot tier, rounds per map |
| `maps[]` | arena id + name, and its `rounds[]` |
| round | arena, round number, duration (s), winner slot + name, match winner |
| `players[]` | slot, name, program, hp, maxHp, score, shots, dashes, swings, deflects, skills, heavies, hits, damage, kills, deaths |
| `deflect` | exact catch sources: guard, swing, beam, atom, net, arm, plow, broom, wave |
| perf | round FPS and sim ms |
| `summary` | rounds, seconds, wins/losses/draws, every action count, damage, kills, deaths, avg FPS |

So a tour answers: which arenas produce long or short rounds, where the player dies without firing, whether
guard/lash reflection is actually used, whether a program's skill or heavy ever fires, and whether any map
drops frames or spikes sim time. It does not record positions, inputs, IPs or room codes, and none of it
enters `Snapshot`.

With `?debug=1`, `window.__defl.playtestState()` reports
`{ active, complete, mapIndex, roundsOnMap, advanceAt }` and `window.__defl.playtestLog()` returns the
current log object.

---

## 2. Player feedback without a backend — evaluation

**Proposal:** put a cipher-coded GitHub personal access token in a URL parameter; the game decodes it and
opens repository issues containing the session data.

**Verdict: rejected.** It is not low risk, and the cipher does not change the risk.

### Why a client-held token cannot be safe

- **A URL is not a secret channel.** It lands in browser history, account sync, screenshots and stream
  captures, support pastes, any `Referer` sent to a third party, and proxy/CDN/access logs. Anyone the link
  reaches has the credential.
- **A shipped bundle is worse.** View-source recovers it, and so does unzipping the PWA or reading the
  service-worker cache.
- **Ciphering is encoding.** The decode routine ships with the key, so an obfuscated token is a plaintext
  token with one extra function call. Obfuscation only defeats a casual glance, not a scraper.
- **GitHub tokens are broad by construction.** A classic token with `repo` can write every repository the
  account can reach; a fine-grained token still needs issue-write on this repository. A leaked copy is a
  write credential for the owner's account, with the owner's name on every issue and comment.
- **No per-player revocation.** You cannot revoke one leaked copy; you rotate the token for everyone and
  ship a new build, then repeat when it leaks again.
- **Abuse is unbounded.** Anyone with the token can open, edit, close or spam issues, and can burn the API
  quota the owner needs for real work. GitHub also scans public repositories for tokens and will revoke a
  leaked one, which silently breaks every installed copy.
- **GitHub's API is not a browser ingest endpoint.** `api.github.com` needs an `Authorization` header and
  CORS rules are not a submission contract; routing around that would need a proxy — a backend.

If automated issue creation ever becomes mandatory, the token must live **server-side**: a small Worker
endpoint receives the JSON, validates size and shape, rate-limits by IP/session, and calls the GitHub API.
That is a backend, just a tiny one. Keep credentials out of the client in every version of this design.

### Recommended path (no backend, no secret)

1. The tour log above is already the payload. Keep `schema` versioned so old files stay readable.
2. Add **`REPORT`** beside `DOWNLOAD LOG` on the completion overlay: it opens a prefilled GitHub issue URL
   (`title=[playtest] <build> <program> <arena>`, body = the summary block plus “attach the downloaded
   JSON”). A repository issue form (`.github/ISSUE_TEMPLATE/playtest.yml`) can carry the same fields.
3. The player downloads the JSON and drags it into the issue. No token, no backend, no third party; the
   repository owner moderates, and uploads stay in the issue thread with the report.
4. Keep `COPY LOG` for players who would rather post a condensed summary on Discord or a forum than use
   GitHub.

Costs: one manual attach step, and GitHub's attachment limits. A 14-arena tour is small (well under a
megabyte), so that is not a constraint.

### Privacy and schema rules for that work

- Submission is **opt-in** and never automatic. Make the issue text say what is in the file.
- Callsigns are player-chosen and can be real names. Offer an anonymized export (`P1`–`P4`) or strip the
  callsign from the summary.
- Additive fields do not bump `schema`; only a breaking change does. Every log carries the build stamp so
  an old report is attributable to the version that produced it.
- Keep the reader local: a small script that ingests a folder of JSON logs and prints per-arena round
  length, win rate, catch rate and action usage. Do not send the logs anywhere by default.

Related files: `src/main.ts` (the tour), `src/game/world.ts` (`deflectTelemetry` counters),
`src/game/arenas.ts` (rotation order), `AGENTS.md` §D6 and §8.
