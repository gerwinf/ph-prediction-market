# Hula Landing Page

The Philippines' first prediction market — built with Next.js 14, Tailwind CSS, and Framer Motion.

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Vercel account (for deployment)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the dev server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

The landing page will update automatically as you edit files.

## Email Capture Setup

The landing page includes an email capture form at `/api/waitlist`. By default, it accepts emails and returns success.

### To connect a real email service:

#### Option 1: Formspree
1. Sign up at [formspree.io](https://formspree.io)
2. Create a form and get your FORM_ID
3. Update `/app/api/waitlist/route.ts` — uncomment the Formspree section and add your FORM_ID:
   ```typescript
   const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email }),
   })
   return NextResponse.json({ success: res.ok }, { status: res.ok ? 200 : 500 })
   ```

#### Option 2: ConvertKit
1. Generate an API key from ConvertKit's settings
2. Store it in `.env.local`:
   ```
   CONVERTKIT_API_KEY=your_api_key
   CONVERTKIT_FORM_ID=your_form_id
   ```
3. Update `/app/api/waitlist/route.ts` to call ConvertKit's API:
   ```typescript
   const res = await fetch('https://api.convertkit.com/v3/forms/{FORM_ID}/subscriptions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email,
       api_key: process.env.CONVERTKIT_API_KEY,
     }),
   })
   ```

#### Option 3: Custom Backend
Send to your own database/CRM:
```typescript
const res = await fetch('https://your-api.com/waitlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
})
```

## Deploy to Vercel

### 1-Click Deploy
Click the button below to deploy directly to Vercel:

```
[Deploy Button - configure in vercel.json]
```

### Manual Deploy

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Hula landing page"
   git push
   ```

2. **Import to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel auto-detects Next.js and configures the build

3. **Set environment variables (if using email service):**
   - In Vercel project settings → Environment Variables
   - Add `CONVERTKIT_API_KEY`, `CONVERTKIT_FORM_ID`, etc. as needed

4. **Deploy:**
   - Click "Deploy"
   - Your site will be live at `your-project.vercel.app`

### Custom Domain
1. In Vercel → Settings → Domains
2. Add your custom domain (e.g., `hulaan.ph`)
3. Update DNS records at your registrar
4. Vercel provides DNS instructions — follow them exactly

## Design System

### Colors
- **Background:** `#0A0A0B` (near-black)
- **Surface:** `#141417` with `#222226` borders
- **Primary text:** `#FAFAFA`
- **Secondary text:** `#8A8A92`
- **Accent (gold):** `#F4B942`
- **Success:** `#10B981`
- **Danger:** `#EF4444`

### Typography
- **Wordmark:** Fraunces (serif)
- **Headlines:** Inter (sans) — substitutes for Geist Sans
- **Body:** Inter (sans)
- **Numbers/prices:** Space Mono (monospace) — substitutes for Geist Mono
  - *All numbers on the page use monospace — this is non-negotiable*

### Spacing
- Mobile: 16px padding, 24px section gaps
- Desktop (768px+): 24px padding, 96px section gaps
- Max width: 1120px

### Border Radius
- Cards: 12px
- Buttons: 8px
- Inputs: 6px

## Build & Optimize

### Production Build
```bash
npm run build
npm run start
```

### Performance
- Lighthouse targets: 95+ on mobile across all categories
- Static pages auto-optimized by Next.js
- Images lazy-loaded by default
- CSS purged of unused styles by Tailwind

## Project Structure

```
app/
├── layout.tsx          # Root layout + fonts
├── page.tsx            # Landing page (all 5 sections)
├── globals.css         # Global styles + typography
└── api/
    └── waitlist/
        └── route.ts    # Email capture endpoint

tailwind.config.ts      # Tailwind color + spacing config
postcss.config.js       # PostCSS for Tailwind
tsconfig.json           # TypeScript config
next.config.js          # Next.js config
package.json            # Dependencies
```

## Important Notes

### Brand
- Render the wordmark as plain "Hula"; pair with the circular "H" mark in gold (`#F4B942`) when a logo treatment is needed
- Brand name in copy is "Hula" (Tagalog for "predict / guess")
- Domain is `hulaan.ph` (Tagalog imperative form: "predict it / guess it")
- Use Tagalog accent words sparingly (max 3 on page)

### Design
- Inspired by Kalshi.com (clean, financial, serious)
- Zero stock photos, mascots, or gambling imagery
- Monospace for ALL numbers — this is the Kalshi visual signature
- Subtle motion: fade-in on scroll, no parallax or auto-play
- Respect `prefers-reduced-motion` media query

### What NOT to include
- No "licensed" / "regulated" claims
- No specific payouts or odds tables
- No direct comparisons to competitors
- No KYC/login mentions
- No political or sabong references
- No dark patterns (fake urgency, fake user counts)

## Troubleshooting

### Build fails with "module not found"
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### "Cannot find module 'next/font/google'"
Ensure Next.js 14+ is installed:
```bash
npm install next@14
```

### Email form not submitting
1. Check browser console for errors
2. Verify `/api/waitlist` endpoint is reachable
3. Ensure email validation passes (must be valid format)

### Deploy to Vercel fails
- Check build logs in Vercel dashboard
- Ensure no secrets/env vars are hardcoded
- Verify Node version matches (18+ recommended)

## License

© 2026 Hula. All rights reserved.