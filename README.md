# Five a Day

Five trivia questions a day. Everyone gets the same five. Answer fast, climb the boards, beat your friends.

A plain website with no build step. It's hosted on **Vercel** and uses **Supabase** for accounts, scores, leagues and player-written questions.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The whole game: questions, scoring, leagues, boards, profile |
| `backend.js` | Connects the game to Supabase (sign-in, saving, live leaderboards) |
| `config.js` | Your Supabase address and public key. **The only file you edit to set up.** |
| `vendor/supabase.js` | The Supabase library, included so the site doesn't depend on another server |
| `supabase/schema.sql` | Creates the database tables and the rules for who can read and write what |

## One-time setup

### 1. Supabase (the database)
1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**. Pick any name (e.g. `five-a-day`), set a database password (save it somewhere), and choose the region closest to you (e.g. *Central US*). Wait about two minutes for it to finish.
2. In the left sidebar, open **SQL Editor** → **New query**. Paste everything from `supabase/schema.sql` and click **Run**. You should see "Success. No rows returned."
3. Open **Authentication** → **URL Configuration**:
   - **Site URL**: your Vercel address from step 2 below (e.g. `https://five-a-day.vercel.app`). You can come back and fill this in after Vercel.
   - **Redirect URLs**: add the same address.
4. Open **Project Settings** → **API** (or the **Connect** button at the top). Copy the **Project URL** and the **anon / publishable key**.
5. Paste them into `config.js` in this repo and commit.

### 2. Vercel (the website)
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New…** → **Project**, find `5-a-day`, click **Import**.
3. Leave every setting as it is (Framework: *Other*, no build command) and click **Deploy**.
4. You get an address like `https://5-a-day-xxxx.vercel.app`. Put that address into Supabase (step 1.3 above).

From now on, every change pushed to GitHub goes live automatically in about a minute.

### 3. Make yourself the admin
1. Open your site, tap **Sign in**, enter your email and click the link it sends you.
2. Back in Supabase **SQL Editor**, run this with your email:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
   ```
3. Reload the site. You'll now see the review queue for player questions and the **Hide** buttons on the boards.

## Good to know
- **Sign-in emails.** Supabase's built-in email sender only allows a few emails per hour, which is fine for testing. Before launch, connect a free email service under **Authentication → Emails → SMTP Settings**, such as Resend (about 3,000 free emails a month).
- **Google sign-in (optional).** Turn it on under **Authentication → Providers → Google**, then set `googleSignIn: true` in `config.js`.
- **Guests can play.** Scores stay on their device until they sign in, then move to their account automatically.
- **Changing questions.** All questions live in `index.html` (`BANKS`). Each question version is locked once players have played it, so new questions are added as a new version. Ask Claude to do it.
- **Before money or prizes:** move answer checking to the server so scores can't be faked.
