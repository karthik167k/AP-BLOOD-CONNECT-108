# AP Blood Connect (Supabase version)

Static frontend (HTML/CSS/JS) + Supabase (Postgres database, login, security rules). No server to run.

## Setup (10 minutes)
1. Create a free project at https://supabase.com
2. Open **SQL Editor**, paste all of `supabase.sql`, click **Run**.
3. Go to **Authentication > Providers > Email** and turn **off** "Confirm email" (for a quick demo; otherwise users must click an email link before logging in).
4. Go to **Project Settings > API**, copy the **Project URL** and the **anon public** key into `config.js`.
5. Open `index.html` in your browser. To put it online, drag this folder onto Netlify, or use Vercel or GitHub Pages.

## Security
- Only the anon key is used in the browser. Never share or use the `service_role` key.
- Row Level Security is on for every table: anyone can read requests and camps and submit a request, donor form or booking; emergency contacts are visible only to their owner; donor names and phones can never be read publicly (the home page sees blood groups only).
- Invalid data is rejected by database constraints (blood group, urgency, district, phone, age 18-65, weight 50+).
