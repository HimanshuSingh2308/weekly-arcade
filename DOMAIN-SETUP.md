# Domain Setup Guide — weeklyarcade.games + weeklyarcade.com
**Date:** March 2026

---

## What was done to the codebase

All 13 source files updated. 109 occurrences of `https://weekly-arcade.web.app`
replaced with `https://www.weeklyarcade.games`. Zero `web.app` domain references remain.

Files updated:
- `src/index.html` (14 occurrences)
- `src/sitemap.xml` (11 occurrences)
- `src/robots.txt` (2 occurrences)
- `src/leaderboard/index.html` (8)
- `src/profile/index.html` (1)
- `src/games/wordle/index.html` (10, including share text)
- `src/games/2048/index.html` (9)
- `src/games/snake/index.html` (9)
- `src/games/chaos-kitchen/index.html` (9)
- `src/games/lumble/index.html` (9)
- `src/games/memory-match/index.html` (9)
- `src/games/fieldstone/index.html` (2)
- `src/games/voidbreak/index.html` (9)

---

## Domain Strategy — Two Domains, One Site

### Primary: weeklyarcade.games
This is the canonical domain. All content lives here. Google indexes this.
All SEO equity accumulates here.

### Secondary: weeklyarcade.com
301 redirect everything to `https://www.weeklyarcade.games`.
This is purely defensive — prevent squatters from copying, capture direct
traffic from people who type .com by reflex.

**Never host content on both.** Duplicate content = Google penalty.
301 redirect = full link equity passes to .games.

---

## Step 1: Firebase Hosting — Add Custom Domains

In Firebase Console → Hosting → your project:

1. Click **"Add custom domain"**
2. Add `weeklyarcade.games` (apex/root domain)
3. Add `www.weeklyarcade.games` (www subdomain)
4. Add `weeklyarcade.com` (redirect-only)
5. Add `www.weeklyarcade.com` (redirect-only)

Firebase will give you DNS records to add for each.

---

## Step 2: DNS Records to Add at Your Registrar

Firebase Hosting uses these record types:

### For weeklyarcade.games (primary — where content lives)

```
Type    Name    Value
A       @       151.101.1.195    (Firebase IP — confirm in Firebase console)
A       @       151.101.65.195   (Firebase IP — confirm in Firebase console)
CNAME   www     weeklyarcade.games.
```

Note: Firebase gives you their current IPs in the console during setup.
Always use the IPs Firebase provides — don't copy from here as they can change.

### For weeklyarcade.com (redirect-only)

```
Type    Name    Value
A       @       151.101.1.195    (same Firebase IPs)
A       @       151.101.65.195
CNAME   www     weeklyarcade.com.
```

Firebase handles the 301 redirect automatically once you configure it in the
console as a redirect domain → weeklyarcade.games.

---

## Step 3: firebase.json — Update Hosting Config

Add redirect rules so:
- `weeklyarcade.com` → `https://www.weeklyarcade.games` (301)
- `weekly-arcade.web.app` → `https://www.weeklyarcade.games` (301)
- Non-www → www redirect

```json
{
  "hosting": {
    "site": "weekly-arcade",
    "public": "dist",
    "cleanUrls": true,
    "trailingSlash": true,
    "redirects": [
      {
        "source": "/**",
        "destination": "https://www.weeklyarcade.games/:splat",
        "type": 301
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "SAMEORIGIN" }
        ]
      }
    ]
  }
}
```

Note: The redirect block goes in the .com hosting site config, not the .games one.
You may need two separate hosting sites in Firebase — one for .games (content),
one for .com (redirect). Firebase supports multiple sites per project.

---

## Step 4: Google Search Console

After DNS propagates (24–48 hrs):

1. Go to search.google.com/search-console
2. Add property: `https://www.weeklyarcade.games`
3. Verify via DNS TXT record (Firebase provides this too)
4. Submit sitemap: `https://www.weeklyarcade.games/sitemap.xml`
5. Request indexing of homepage

Do NOT add weeklyarcade.com to Search Console — it redirects, not content.

---

## Step 5: Update API CORS (if needed)

The NestJS API at Cloud Run likely has CORS set to `weekly-arcade.web.app`.
Update it to allow the new domain:

```typescript
// In NestJS main.ts or app.module.ts
app.enableCors({
  origin: [
    'https://www.weeklyarcade.games',
    'https://weeklyarcade.games',
    'https://weekly-arcade.web.app',  // keep during transition
  ],
  credentials: true,
});
```

Keep `weekly-arcade.web.app` in the CORS allowlist during the transition period
(first 2–4 weeks) in case of cached pages.

---

## Step 6: Firebase Auth Authorized Domains

Firebase Console → Authentication → Settings → Authorized domains:

Add:
- `weeklyarcade.games`
- `www.weeklyarcade.games`

Keep `weekly-arcade.web.app` during transition.

Without this, Firebase Auth sign-in will fail on the new domain.

---

## SEO Transition Checklist

- [ ] DNS records set at registrar for both domains
- [ ] Firebase custom domains verified (SSL auto-provisioned)
- [ ] 301 redirect: weeklyarcade.com → www.weeklyarcade.games
- [ ] 301 redirect: weekly-arcade.web.app → www.weeklyarcade.games
- [ ] firebase.json deployed with redirect rules
- [ ] Google Search Console: new property added + sitemap submitted
- [ ] API CORS updated to allow weeklyarcade.games
- [ ] Firebase Auth authorized domains updated
- [ ] All source files updated (done ✅)
- [ ] Test: visit weekly-arcade.web.app → should redirect to www.weeklyarcade.games
- [ ] Test: visit weeklyarcade.com → should redirect to www.weeklyarcade.games
- [ ] Test: Auth sign-in works on new domain
- [ ] Test: Score submission works on new domain

---

## Why www.weeklyarcade.games and not weeklyarcade.games

Both work. `www` is recommended because:
- Some CDNs and proxies handle apex domains differently
- Firebase sometimes has quirks with apex + SSL
- `www` allows you to use CNAME which is more portable than A records
- Industry standard for app-style sites

If you prefer the clean non-www, redirect `www` → `weeklyarcade.games` instead.
Pick one, redirect the other — never serve content on both.

---

## Domain Handoff Timeline

| Day | Action |
|-----|--------|
| Today | Set DNS records at registrar |
| Day 1–2 | DNS propagates globally |
| Day 2 | Firebase verifies SSL, domains go live |
| Day 3 | Test all redirects and auth |
| Day 3 | Submit to Google Search Console |
| Week 1–2 | Google re-crawls and updates index |
| Month 1 | Old web.app URLs fully replaced in Google index |
| Month 2+ | Remove web.app from CORS and Auth allowlist |
