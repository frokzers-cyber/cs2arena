CS2 Arena

Files:
index.html
style.css
app.js
supabase.js
supabase.sql

Setup:
1. Create a Supabase project.
2. Run supabase.sql in the SQL editor.
3. Create public storage buckets team-logos, news-covers, tournament-banners if your project does not allow bucket inserts from SQL.
4. Put your Supabase URL and publishable key into supabase.js.
5. Disable email confirmation for password auth if you want immediate sign-up/login without manual email verification.
6. Register your account.
7. Promote your profile to admin in public.profiles by setting is_admin = true for your user id.
