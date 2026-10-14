# Tracking: habit app with Supabase

React + Vite app. Accounts, data, images and the AI coach all run on Supabase, so your habits follow you across phone and laptop.

You do **not** need any Supabase experience. Follow the steps in order (about 20 minutes).

---

## What you need first
- **Node.js 18 or newer** (https://nodejs.org, choose "LTS")
- A free **Supabase** account (https://supabase.com, "Start your project")
- Your **Groq API key** (only for the AI chat; the rest of the app works without it)

---

## Step 1. Create your Supabase project
1. Sign in at https://supabase.com/dashboard and click **New project**.
2. Pick a name (for example `tracking`), choose the region closest to you, and set a **database password**. Save it somewhere, you rarely need it but can't recover it.
3. Click **Create new project** and wait 1 to 2 minutes until it finishes setting up.

## Step 2. Create the database tables
1. In your project, open **SQL Editor** (left menu) and click **New query**.
2. Open the file `supabase/schema.sql` from this project, copy **everything**, paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned".

This creates the tables (habits, daily logs, moods, to-dos, chat, celebrations), the private image bucket, and the security rules so each person can only see their own data. It is safe to run again if something goes wrong.

## Step 3. Connect the app to your project
1. In the dashboard, click **Project Settings** (gear icon), then **API Keys** (or **Data API**). If you see a **Connect** button at the top of the page instead, use that.
2. Copy two things:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - The **anon / publishable** key (a long text, usually labelled `anon` `public`)
3. In this project folder, make a copy of `.env.example` and name it exactly `.env`.
4. Open `.env` and paste your values:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=your-long-anon-key
   ```
> The anon key is designed to be public, because the security rules from Step 2 protect your data. **Never** put the `service_role` key anywhere in this app.

## Step 4. Set up sign-in
1. In the dashboard, open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to `http://localhost:5173`.
3. Under **Redirect URLs** click **Add URL** and add `http://localhost:5173` (add your real website address later, see Step 8).
4. Open **Authentication**, then **Sign In / Providers**, and check that **Email** is enabled.
5. About confirmation emails (**Confirm email** switch):
   - **On** (default): new users must click a link in an email before they can log in. Good for a real app.
   - **Off**: new users can log in immediately. Handy while you test.
   - The built-in email sender allows only a few emails per hour. For real users, add your own email service under **Authentication, then SMTP Settings**.

## Step 5. Run the app
Open a terminal in this folder and run:
```
npm install
npm run dev
```
Open **http://localhost:5173**, tap **Create account**, and sign up. If you left Confirm email on, click the link in your email first, then log in.

You can also sign in on your phone using the **Network** address the terminal prints (phone and laptop must be on the same Wi-Fi). To use that address, add it under Redirect URLs as well.

## Step 6. Turn on the AI coach and AI quests (optional)
The Groq key is stored as a Supabase secret, so it never reaches the phone. This one function powers both the chat and the quests. If you deployed it earlier, open it again and paste in the newer `supabase/functions/ai-coach/index.ts`, then Deploy.
1. In the dashboard, open **Edge Functions**, then **Deploy a new function**, then **Via Editor**.
2. Name it exactly `ai-coach`.
3. Delete the sample code, then paste in everything from `supabase/functions/ai-coach/index.ts`, and click **Deploy**. Leave **Verify JWT** switched on.
4. Open **Edge Functions**, then **Secrets**, and add a secret named `GROQ_API_KEY` with your Groq key as the value.
5. Open the app, go to the **AI** tab, and send a message. The **Quests** tab fills in by itself, and photo proof uses the same function (it needs no extra secrets, Supabase provides the rest). If the AI is not set up, simple built-in quests are used instead.

## Step 7. Bring over your old data (if you used the earlier version)
1. **Before** switching, open the old version of the app, go to **More**, and tap **Export Backup**.
2. Log in to this new version, go to **More**, tap **Import Backup**, and choose that file.
3. Your habits, history, moods, to-dos and images move to your account. This **replaces** whatever is already in the account.

Images that were saved in the old version only come across if they were included in that backup file.

## Step 8. Put it online (optional)
1. Push the project to GitHub, then import it into **Vercel** or **Netlify**.
2. Add the same two values from `.env` as **Environment Variables** in their settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Deploy. Then go back to Supabase, **Authentication, then URL Configuration**, set **Site URL** to your live address, and add it to **Redirect URLs** too.

---

## Gems, quests and the shop
Gems are meant to be **rare**, so they never replace doing your habits.
| What | Result |
|---|---|
| Today's quest (chosen by the AI) | 0 to 1 gem, depending on difficulty |
| This week's quest | 2, 3 or 5 gems (easy, medium, hard) |
| This month's quest | 6, 10 or 15 gems |
| **Real-life quest** (once a week, proved with a photo), for example "Clean your room" | 5, 10 or 20 gems (easy, medium, hard) |
| Finish a whole day's to-do list (at least 3 tasks) | Usually 1 gem, sometimes an unfreeze. Once a day |
| Shop: Unfreeze streak | 25 gems, max 2 bought per month, max 3 held |
| Swap a quest you don't like for a new one | 5 gems, max 3 swaps per month |

- The AI chooses the quest and its difficulty. The **database decides the reward**, so the AI can't hand out extra gems, and progress is re-checked from your saved data when you tap CLAIM.
- **Missing days:** one missed day is forgiven. Two in a row **freezes** the streak: the fire turns dim and the number shows 0, but your old streak is remembered.
- **Getting it back:** open the streak (top right) and either use an **unfreeze** or take a **hard quest** from the AI (free, no gems). The streak returns exactly where it was.
- To change prices, limits or rewards, edit the numbers inside the functions in `supabase/schema.sql` and run it again. If you change the price or limits, also change `PRICE`, `BUY_LIMIT` and `HOLD_MAX` at the bottom of `src/lib.js`.
- The gift-box animation is a temporary placeholder until the gem Rive file is added.

## Photo proof (camera)
- **Habits:** when you create or edit a habit, tick **Ask me for a photo as proof** and say what the photo should show (for example "my open Bible"). Later, tapping DONE opens the camera. The AI looks at the photo and approves it, or tells you to try again. It's optional, per habit.
- **Quests:** real-life quests always need a photo. Other quests can too. The approval is recorded by the AI function itself, so the app can't fake it, and **CLAIM** only works after approval.
- Photos are sent to the AI to be checked and then thrown away. They are never saved.
- If the AI service is down, a **habit** lets you tap "Mark done anyway". Quests do not, because gems are at stake.
- Photo checking uses a Groq vision model. If Groq renames it, change `VISION_MODEL` at the top of `supabase/functions/ai-coach/index.ts`.

## To-dos, ranking and reminders
- Plan tasks for **Today, This week or This month**, each with a due date.
- **Rank by priority** compares two tasks at a time ("which matters more?") and puts the most important first. New tasks are slotted into your existing order.
- **Reminders** pop up while the app is open (and as a browser notification if you allow it). They can't fire when the app is fully closed. That would need push notifications, which is a bigger add-on.

## App icon
The browser tab icon switches to the dim fire until today is done. An **installed** app icon (home screen or desktop shortcut) can't change while installed, so it always uses the lit fire.

## Built for many people and years of use
- **3000-day streaks:** the streak is calculated over your whole history (not just recent months) and only recalculated when your data changes. Loading is fast because the database returns each habit's full history in one request, and later refreshes only fetch the last 90 days.
- **Limits that keep it healthy:** 40 habits, 600 to-dos (cleared ones are removed after 60 days), the last 200 chat messages, old quests tidied up after about 4 months.
- **AI limits per person per day:** 80 chat messages, 40 quest requests, 30 photo checks. Only signed-in people can use the AI, so strangers can't burn your Groq credit. Change the numbers at the top of `supabase/functions/ai-coach/index.ts`.
- **Everything can be undone:** habits, logs, moods, to-dos (edit, delete, restore cleared ones), chat messages, images, and your whole account (More, then Delete my account and all my data).
- **Un-checking reverses rewards.** If you finish your whole to-do list (or a quest) and then un-check or delete something so you no longer qualify, the reward is taken back and a message tells you. Finish it again and you get it back. The to-do prize is decided once per day, so you can't re-roll it by un-checking. If you already spent the gem, your balance goes below zero until you earn it back, so the shop stays closed until you're even. Photo quests can't be reversed, and a streak unfreeze you already used can't be undone.
- Gems, unfreezes and quest rewards can only change through the database functions, never directly from the app.

## Swapping in your own icons later
All gem and ice icons are in one file, `src/icons.jsx`. Replace the emoji there with your SVG and every screen updates. The reward pop-up (gift box) is `RewardModal` at the bottom of `src/shop.jsx`: that is where the gem Rive animation goes.

## How it behaves
- Everything you add, edit or delete is saved to your account straight away, and appears on all your devices within a moment. If a save fails (for example you're offline) the app shows a message and reloads the true data.
- Images are stored privately in your own folder. Only you can open them.
- Streak, mood, to-do list, backups, cropping and celebration all work as before.
- On the free plan, a project that is not used for about a week gets **paused**. Open the Supabase dashboard and click **Restore** to wake it up. Your data is kept.

## Troubleshooting
| What you see | What to do |
|---|---|
| "Almost there" screen | The `.env` file is missing or misnamed. It must be called `.env` (not `.env.example`), saved in the project folder. Restart `npm run dev` after editing it. |
| "Could not load your data" | Step 2 was not run, or you are offline. Run `supabase/schema.sql` again and tap **Try again**. |
| "Invalid login credentials" | Wrong email or password, or the confirmation email link has not been clicked yet. Use **Forgot password?** if needed. |
| Confirmation email never arrives | Check spam. The free built-in sender is very limited, so add SMTP (Step 4) or switch **Confirm email** off while testing. |
| Reset or confirmation link goes to the wrong site | Fix **Site URL** and **Redirect URLs** (Step 4). |
| "Could not save. Check your connection." | Offline, or the database setup is incomplete. Run `schema.sql` again. |
| Pictures not showing | The `habit-images` bucket or its policies are missing. Run `schema.sql` again. Images over 5 MB are refused. |
| AI says it is "not set up yet" | Step 6: the function name must be exactly `ai-coach`. |
| AI says the service returned an error | The `GROQ_API_KEY` secret is missing or wrong. |

## Project map
- `src/db.js`: all Supabase calls (data, images, live sync, quests, shop)
- `src/quests.jsx`, `src/shop.jsx`, `src/rank.jsx`: quests with countdowns, the shop, the priority ranker
- `src/auth.jsx`: sign up, log in, forgot and reset password
- `src/App.jsx`: app state and saving
- `supabase/schema.sql`: database, security rules, image bucket
- `supabase/functions/ai-coach/index.ts`: AI coach function
