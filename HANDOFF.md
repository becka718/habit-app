# Handoff: "Tracking" habit app (for another AI model or developer)

## What it is
A mobile-first habit tracker (React 18 + Vite + Supabase) styled after Duolingo. Accounts, habits with cover photos, daily check-ins, moods, a streak with Rive animations, to-dos with priority ranking, AI quests and chat, a gem economy with a shop, and optional photo proof checked by AI. Written for one non-expert owner, so the code is compact and the README has beginner steps.

## Status (be honest about this)
- Code compiles (`vite build` passes) and the UI was screenshotted with sample data in headless Chromium.
- **Nothing has ever been run against a real Supabase project.** `supabase/schema.sql`, the Edge Function and all RPC calls are untested. Expect first-run fixes.
- The owner has not done any Supabase setup yet (no project, no SQL, no `.env`, no function deployed).
- The Rive flame and number on the streak screen did NOT draw in the headless test browser. A fallback (plain fire SVG + number after 6 seconds) was added. Verify on a real phone.

## Stack and layout
- `src/App.jsx` state, saving (optimistic with rollback via reload), sync, rewards, quests, shop, account tools
- `src/db.js` every Supabase call (data, RPCs, storage images, realtime, AI function calls)
- `src/lib.js` streak logic, quest windows and progress, constants (PRICE, BUY_LIMIT, HOLD_MAX, REROLL_PRICE, REROLL_LIMIT)
- `src/habits.jsx` habit cards, expanded sheet (calendar, mood, sequence), habit modal, image crop, photo-proof hook
- `src/pages.jsx` to-do page (scopes, edit, rank, archive/restore) and settings/account
- `src/rank.jsx` pairwise "which matters more" ranker (binary insertion, undo)
- `src/quests.jsx`, `src/shop.jsx`, `src/proof.jsx`, `src/streak.jsx` (Rive flame + odometer, Lottie celebration), `src/chat.jsx`, `src/auth.jsx`, `src/Root.jsx`, `src/icons.jsx` (all gem/ice icons in one place)
- `supabase/schema.sql` tables, Row Level Security, gem/quest/shop functions, limits, realtime
- `supabase/functions/ai-coach/index.ts` one Edge Function: chat, quest chooser, photo verifier (Groq)
- `public/` Rive files (`rive/fire.riv`, `rive/number.riv`), 5 Lottie celebrations, mp3, favicons, manifest

## Features
- **Auth:** email/password sign up (with first name), log in, forgot/reset password, log out, change name/password, delete account and all data.
- **Habits:** add/edit/delete, reorder, weekly split text, sequence checklist, cover image (crop 16:9, stored in a private Storage bucket, full quality), optional photo proof (prompt text per habit), calendar (tap a day: done, skipped, cleared), mood per day (5 emoji), SKIP/DONE.
- **Streak:** a day counts when every habit that existed is done or skipped (at least one done). One missed day is forgiven; two in a row **freezes** the streak (fire dims, number 0, old run remembered). Restore with an unfreeze or an AI hard quest. Milestone celebration at 7, 14, 21 and every 30 days. Streak calculation walks the full history (works for 3000+ days).
- **Celebration:** when today completes, a random Lottie plays full page with a sound, then the streak screen (Rive flame + rolling number, week row, month calendar with moods, shop link).
- **To-dos:** Today / Week / Month tabs, due dates, optional reminders (only while the app is open), priority ranking, edit, delete, clear completed, restore cleared. Finishing a whole day's list (3+ tasks) can give a gem or rarely an unfreeze (once per day, rolled once, reversed if you un-check).
- **Quests (AI tab):** AI picks today / week / month / weekly real-life photo quest ("Clean your room") with progress bars and countdowns. Rewards are decided by the database by difficulty. Swap a quest for 5 gems (3 per month). Claimed quests are reversed if progress later drops. Hard "recovery" quests restore a frozen streak.
- **Shop:** unfreeze streak, 25 gems, max 2 bought per month, max 3 held.
- **AI chat:** Christian habit coach, short replies, Bible verse when fitting.
- **Other:** bottom nav with sliding pill, dim/lit fire in the top bar and browser tab icon, backups (export/import JSON including images, moods, to-dos), live sync across devices, daily AI rate limits per user.

## Security model
All tables have Row Level Security. Wallet, ledger, quests, restores and reward tables are read-only to the app; only SECURITY DEFINER functions change them. Photo approval (`proof_ok`) is set only by the Edge Function using the service role. The Edge Function requires a signed-in user and enforces daily limits (80 chat, 40 quest, 30 verify).

## Known limitations
- Reminders do not fire when the app is closed (needs Web Push).
- Installed app icon cannot change; only the browser tab icon dims.
- No offline mode (needs a connection; failed saves show a message and re-sync).
- No automated tests. No analytics. No error reporting. No privacy policy or terms pages.
- Photo proof depends on a Groq vision model name that may change (`VISION_MODEL` in the Edge Function). Photos from some iPhones (HEIC) may fail.
- The Rive streak number supports up to 4 digits (9999 days).
- The to-do reward can be gamed slightly (add and finish 3 tiny tasks), capped at 1 per day.
- Gift-box reward animation is a CSS placeholder.

## Still missing: assets the owner will provide
1. Frozen-streak icon (SVG).
2. Gem icon (SVG), and ideally an ice/unfreeze item icon.
3. Gem Rive animation with all states (gem out of a box, unfreeze out of a mystery box). Need: file name, artboard, state machine, input names, animation names, and amount variants.
4. Optional: reward sound, art for the real-life quest card.

Where they plug in: `src/icons.jsx` (icons), `RewardModal` in `src/shop.jsx` (Rive reward), and the top-bar fire in `src/App.jsx` for a frozen icon.

## Still to do before real users
- Create the Supabase project, run `schema.sql`, add `.env`, set Auth URLs, deploy `ai-coach` and add `GROQ_API_KEY` (README steps 1 to 6).
- Set minimum password length to 8 and add a real email provider (default email sending is very limited).
- Test the whole flow on a real phone: Rive flame/number, camera proof, sound autoplay, install as app.
- Run the SQL and fix any first-run errors; test quests, shop, reward reversal, unfreeze, account deletion.
- Add privacy policy and terms pages, and decide on analytics and error tracking.
- Confirm product numbers: prices, limits, rewards (in `schema.sql` and `src/lib.js`).
- Confirm streak/animation mapping: FROZEN and CLASSIC_LIGHT currently follow the demo app (FROZEN when returning after one missed day, CLASSIC_LIGHT after two or more); FLAME_LIGHT_START is shown on a white card; other animations on a dark card.

---

# INSTRUCTIONS FOR THE NEXT AI (read this part first)

## Ground rules: do not mess things up under the hood
1. **Only do what the owner asks.** No refactors, renames, reformatting, "cleanup", dependency upgrades or style rewrites. Keep every edit as small as possible and say exactly which files and lines you changed.
2. **Protected code. Do not change it unless the owner explicitly says so:**
   - `supabase/schema.sql` (security rules, gem/quest/shop functions, limits, prices, rewards)
   - `supabase/functions/ai-coach/index.ts` (login check, daily limits, photo-verification and `proof_ok` logic)
   - `src/db.js` (all data access, paging, realtime, RPC names)
   - `src/lib.js` streak and quest logic: `habDone`, `streakInfo`, `gapBefore`, `forgivenSet`, `windowFor`, `recoveryWindow`, `metricProgress`, `isMilestone`
   - In `src/App.jsx`: `run`, `reload`/`apply`, `patch`, the to-do reward effect, the reward-reversal (`recon`) effect, `makeQuest`, `claim`, `reroll`, `buy`, `unfreeze`
   - Auth flow (`src/auth.jsx`, `src/Root.jsx`)
3. **Money and fairness are decided by the database, never by the app.** Never add code that changes gems, unfreezes, quest rewards or `proof_ok` from the client. Never put the Supabase service-role key or the Groq key in the app. Only the public anon key belongs in `.env`.
4. **Product numbers are the owner's decisions** (prices, limits, rewards, streak rules, milestone days). Do not tune them.
5. **Pinned versions on purpose.** Keep React on 18.x (the `inert` attribute is used in the nav views) and `@rive-app/canvas-single` at 2.44.0. Do not upgrade.
6. **Do not invent missing details.** If a file name, artboard, state machine, input name, animation name or desired behavior is missing, stop and ask the owner. Do not guess Rive input names.
7. **Keep the safety fallbacks** (for example the plain fire and number shown if the Rive streak animation cannot start). Do not remove error handling or the "Could not save, re-sync" behavior.
8. If a request seems to require touching protected code, **stop and ask first**.

## Build gotcha (important)
Without Supabase keys the app compiles into just the setup screen and silently drops everything else. To verify a build, always run:
`VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy npm run build`

## What to do after the owner sends the missing files

### A. Frozen-streak icon (SVG)
- Save as `src/assets/frozen_fire.svg` (and `public/favicon-frozen.svg` if the owner wants the tab icon to change too).
- `src/App.jsx` top bar: the fire image is currently `doneToday ? lightFire : dimFire`. Make it three states: lit when `doneToday`, frozen when `info.frozen`, otherwise dim. Update the tab-icon effect (`document.getElementById('fav')`) the same way.
- `src/streak.jsx`: where the dim fire is shown when there is no animation (`plan.anim` empty), use the frozen icon when `info.frozen`.
- Keep the same rendered height (about 28px in the top bar) and check the SVG's viewBox so it is not stretched.

### B. Gem icon (SVG) and optional ice icon
- Save as `src/assets/gem.svg` (and `ice.svg`).
- Change **only** `src/icons.jsx`: make `Gem` render `<img src={gemSvg} alt="gems" style={{height:size,verticalAlign:'-0.15em'}}/>`. Keep the `size` prop and the alt text. Do the same for `Ice` if an icon is supplied.
- Then check every place the icons appear: top-bar gem chip, shop balance (size 40), shop price, quest reward text, quest swap button, reward pop-up (size 64), streak-screen shop button. Fix alignment only with CSS, not by changing logic.

### C. Gem Rive animation (reward pop-up)
- Save as `public/rive/gem.riv`. Ask the owner for: artboard name, state machine name, input names and types, animation names, and how amounts or variants work (single gem, several gems, unfreeze from the mystery box).
- Change **only** `RewardModal` in `src/shop.jsx`. Replace the CSS box and emoji animation (`.reward-box`, `.reward-item`) with a Rive canvas, following the same approach as `src/streak.jsx`: `@rive-app/canvas-single`, fetch the file into a buffer, size the canvas from `getBoundingClientRect()` times the device pixel ratio, call `resizeDrawingSurfaceToCanvas()` on load, clean up on unmount, and fall back to the existing emoji animation if loading fails or takes longer than about 6 seconds.
- Keep the props exactly as they are: `reward = {kind: 'gem' | 'unfreeze', amount, title}` and `onClose`. `kind === 'gem'` plays the gem-out-of-box state, `kind === 'unfreeze'` plays the mystery-box state. The animation is cosmetic only: never grant anything from it.
- Load the Rive code lazily (like `StreakScreen` in `src/App.jsx`) because the runtime is large. If the shared buffer helper in `src/streak.jsx` is reused, export it with the smallest possible change.

### D. Optional art
Shop item icon, real-life quest card illustration: add the files to `src/assets/` and reference them only from `src/shop.jsx` or `src/quests.jsx`.

### E. When finished
Update the "Swapping in your own icons later" section in `README.md`, and remove the finished items from "Still missing" in this file.

## Sounds and vibration (the owner will add more later)
**Today:** the celebration sound is `public/audio/celebrate.mp3`, played in `Celebrate` (`src/streak.jsx`) with `new Audio`. Vibration is `navigator.vibrate?.(40)` on long-press (`usePress` in `src/lib.js`) and `navigator.vibrate?.(45)` when an AI reply arrives (`src/chat.jsx`).

**Plan when the owner sends sounds:**
- Create one small helper file `src/feedback.js` with `playSound(name)` and `buzz(pattern)`. Preload sounds, play only one at a time, and never throw (iOS Safari does not support `navigator.vibrate`, so feature-detect it).
- Add two toggles on the More page (`Settings` in `src/pages.jsx`), "Sound" and "Vibration", saved in `localStorage` and on by default.
- Ask the owner to confirm which events get which sound or buzz. Likely candidates: habit DONE, SKIP, to-do check, quest claim, reward pop-up (gem and unfreeze separately), shop purchase, streak restored, photo approved or rejected, error, light tap on the bottom nav.
- Play sounds and buzz only on the person's own actions. Never on page load, never when realtime sync updates arrive from another device, and never twice for one action (the app updates the screen optimistically and then reloads).
- Keep the existing celebration sound behavior unless told otherwise.

## Checklist after any change (use a test account, never the owner's real data)
1. Dummy-key build passes (see the build gotcha).
2. Check each screen at a phone size (390 x 844).
3. Sign up, log in, log out. Add, edit and delete a habit with an image. DONE with and without photo proof. Calendar tap cycle. Mood set and clear.
4. To-dos: add, edit (date, reminder, scope), rank, clear completed, restore, delete.
5. Quests: claim, swap, photo proof. Shop: buy. Un-checking a to-do after the list reward should take the reward back.
6. Streak screen opens (flame or the fallback), the celebration plays once per day, a frozen streak can be restored.
7. Never commit `.env`. Do not test "Delete my account" on a real account.

## Prompt the owner can paste to the next AI along with the new files
```
You are continuing work on an existing React + Supabase habit app. Read HANDOFF.md fully before touching anything, especially "INSTRUCTIONS FOR THE NEXT AI".
Rules: make the smallest possible changes, do not refactor or upgrade anything, and do not edit protected code (schema.sql, the ai-coach function, src/db.js, the streak/quest logic in src/lib.js, the reward and sync logic in src/App.jsx, auth). Never move money, rewards or approvals into the client. If anything is unclear or needs protected code, stop and ask me.
I am attaching: [frozen streak icon SVG] [gem icon SVG] [gem Rive file + its artboard, state machine, input and animation names] [sounds, if any].
Do the steps in "What to do after the owner sends the missing files", then (only if I attached sounds) the "Sounds and vibration" plan after asking me which sound goes with which action. Build with the dummy-key command, run the checklist, and give me a short list of exactly which files and lines you changed.
```
