# Chart Room

A web app for the hostage game. Malta's main island is cut into ~180 squares of
about 1.3 km each. Hostages mark where they were dropped, then bank challenges;
each one erases a slice of squares from their own team's map, weighted so the
live area creeps in towards them. The passenger in the car gets a fixed number
of seconds to look at what's left, and the clock only runs while the map is
actually open.

No page ever asks a seeker where they are.

## Files

```
malta-hunt/
├── index.html            create or join a game, pick your role
├── hostage.html          share location, work through challenges
├── seeker.html           the timed map
├── css/app.css
└── js/
    ├── firebase-config.js   ← the only file you must edit
    ├── db.js                shared state + the elimination rules
    ├── grid.js              coastline, grid, cell maths
    └── challenges.js        the challenge list, edit freely
```

No build step, no npm, no framework. Open the folder in VS Code and you're done.

## 1. Get it running locally

Install the **Live Server** extension in VS Code, right-click `index.html` →
*Open with Live Server*. Opening the files directly with `file://` will not
work — ES modules need a server.

## 2. Firebase (about five minutes)

The four phones need to see the same game state, so there's a database behind it.
Firebase's free tier covers this many times over.

1. <https://console.firebase.google.com> → **Add project**. Skip Analytics.
2. Build → **Realtime Database** → Create Database. Pick **europe-west1**.
   Start in **test mode**.
3. Project settings → **Your apps** → the `</>` web icon → register the app.
4. Copy the `firebaseConfig` object it shows you into `js/firebase-config.js`.
   Make sure `databaseURL` is in there — if it isn't, grab it from the Realtime
   Database page.

Test mode leaves the database open to anyone with the URL and it expires after
30 days. That's fine for a game night. If you want it locked down, use these
rules instead (Realtime Database → Rules):

```json
{
  "rules": {
    "games": {
      "$code": {
        ".read": true,
        ".write": "!data.exists() || newData.child('startedAt').val() > (now - 21600000)"
      }
    }
  }
}
```

That allows writes only to games started in the last six hours.

## 3. Put it online

Geolocation only works over **https**, so it has to be deployed — localhost
won't help you in a car.

Easiest route: push the folder to a GitHub repo, then Settings → Pages → deploy
from `main` / root. You get `https://you.github.io/malta-hunt/`. Netlify Drop
(drag the folder onto <https://app.netlify.com/drop>) is faster still if you
don't want a repo.

## 4. Playing it

- One person opens the site, sets the map seconds and erase percentage, and hits
  **Create game**. Read the four-letter code out to everyone.
- Everyone joins with that code and picks **their own** team — the team they
  belong to, not the one driving them. Team A's hostages narrow Team A's map.
- Hostages tap **Share my location** once, standing where they were left. Nothing
  works until they do, and the square they're standing in is never erased.
- The passenger uses **Open the map**. Backgrounding the phone closes it
  automatically, and the remaining seconds are stored server-side, so refreshing
  or switching devices doesn't buy more time.
- When a car has its people back, they tap **We've got our hostages**. Once both
  cars have, the app works out the halfway point between the two drop-offs and
  hands everyone a Maps link.

## Tuning

**Difficulty** is `elimPercent` × the number of challenges. Default is 20% over
12 challenges, which takes ~180 live squares down to ~13 clustered around them.
Fewer challenges or a lower percentage leaves a much bigger area.

**`elimMode`** in `js/db.js`:
- `"drift"` (default) — squares far from the hostages go first, so the live area
  closes in. Never exact enough to give away a centre.
- `"scatter"` — uniform random. Leaves candidate squares spread across the
  island. Harder, more driving.

**Square size** — `CELL_LAT` / `CELL_LON` in `js/grid.js`. Bigger squares mean a
coarser, faster game. Everyone must reload after a change; don't change it
mid-game.

**Coastline** — `MALTA_OUTLINE` in `js/grid.js` is a rough 25-point trace. If a
hostage gets told they're off the board, nudge the nearest points outward.
Gozo and Comino are deliberately not in it.

**Challenges** — `js/challenges.js`. `hold` forces a minimum number of seconds
before a task can be banked, which is the main thing stopping people tapping
through the list from the back of a car. `answer` adds a typed check.

## Why road tiles and not satellite

Place names and road shapes are what you actually navigate by when someone's
shouting directions at you. Satellite imagery of Malta is a uniform beige at
this zoom and tells you nothing. The map is also capped at zoom 15 so nobody can
read street signs off it.


## Versioning and caching (read this before you debug anything)

Every page shows a build stamp in a footer. Grey line = all files agree. Red box
= one of your JS files is stale and nothing you observe can be trusted until you
fix it.

Browsers cache ES modules hard, and a query string is part of the cached URL. If
`grid.js?v=5` was ever fetched while grid.js was broken, fixing grid.js does NOT
help — the browser keeps answering `?v=5` from its copy. That is why every
import carries a version number.

**When you change any .js file:**
1. Bump `BUILD` in that file.
2. Bump `BUILD` in `js/footer.js`.
3. Find-and-replace `?v=5` with `?v=6` across the whole folder.
4. Replace `>v5<` with `>v6<` in the three page headers.

Skip step 3 and your users keep running old code with no warning.

## Does the installed app update itself?

Mostly, but not reliably enough to trust while you're still changing things.
An installed PWA is the same site in its own window, using the same HTTP cache,
plus a service worker that only checks for updates when it feels like it.

`sw.js` here is set up to fight that: it deletes any cache storage it finds, and
fetches all same-origin files with `cache: "no-store"` so your own code always
comes from the network. Map tiles, fonts and the Firebase SDK are left cached,
since those never change.

If the app is ever stuck on an old version anyway:
Settings → Apps → Chart Room → Storage → **Clear cache**, then reopen it.

## Known rough edges

- Honour system on the challenges. The `hold` timers make faking them tedious
  rather than impossible.
- If two people on the same team open the seeker map at once, they'll both spend
  the same budget and it'll drain roughly twice as fast. Agree that one person
  holds the map.
- A hostage who walks a long way after locking their location will drag the live
  area to where they started, not where they are. That's arguably a feature.
