/* ────────────────────────────────────────────────────────────────────────
 * /hits i18n — English ↔ Tagalog string dictionary
 *
 * The masa-facing copy on /hits ships Tagalog-first (Taglish): the `tl`
 * values are the live default copy, and `en` is the plain-English variant
 * exposed by the header EN | TL toggle.
 *
 * Markup convention (see LanguageProvider.renderRich):
 *   *word*   → <em>word</em>   (accent italics)
 *   \n       → <br/>           (hard line break)
 * Interpolation: {name} tokens are filled from the vars arg.
 * ──────────────────────────────────────────────────────────────────────── */

export type Lang = 'en' | 'tl'

export const LANG_STORAGE_KEY = 'hula-hits-lang'

type Entry = { en: string; tl: string }

export const STRINGS = {
  // ── Common ──────────────────────────────────────────────────────────
  'common.signIn': { en: 'Sign in', tl: 'Sign in' },
  'common.loading': { en: 'Loading…', tl: 'Loading…' },
  'common.loadingGame': { en: 'Loading game info…', tl: 'Loading game info…' },
  'common.later': { en: 'Later', tl: 'Saka na' },
  'common.foot': {
    en: '21+ only · *Play smart* · Demo — no real money yet',
    tl: '21+ lang · *Play smart* · Demo — walang tunay na pera pa',
  },

  // ── Entry page (/hits) ──────────────────────────────────────────────
  'entry.identityAuthed': {
    en: 'Hi, *{name}* · Tokens saved to your account ✓',
    tl: 'Hi, *{name}* · Tokens saved sa account ✓',
  },
  'entry.anonPrefix': { en: '🔓 Playing as anon · ', tl: '🔓 Playing as anon · ' },
  'entry.signInToSave': {
    en: 'Sign in to save tokens →',
    tl: 'Sign in to save tokens →',
  },

  'entry.heroLiveDemo': { en: 'DEMO · LIVE', tl: 'DEMO · LIVE' },
  'entry.heroLiveBadge': { en: 'LIVE', tl: 'LIVE NA' },
  'entry.heroLiveSubDemo': {
    en: 'Try it while you wait for the real game',
    tl: 'Subukan habang naghihintay sa real game',
  },
  'entry.heroLiveSub': {
    en: 'Cells light up as the game happens',
    tl: 'Cells light up habang nangyayari ang laro',
  },
  'entry.heroUpcomingEyebrow': { en: 'NEXT GAME', tl: 'SUSUNOD NA LARO' },
  'entry.heroDemoEyebrow': { en: 'DEMO', tl: 'DEMO' },
  'entry.heroDemoTitle': { en: 'Hula Demo Card', tl: 'Hula Demo Card' },
  'entry.heroDemoSub': { en: 'Sample cells, no live game', tl: 'Sample cells, no live game' },
  'entry.heroDailyEyebrow': { en: 'MANILA · TODAY', tl: 'MANILA · TODAY' },
  'entry.heroDailyTitle': { en: 'Daily card', tl: 'Daily card' },
  'entry.heroDailyWindow': { en: '6 AM → MIDNIGHT', tl: '6 AM → MIDNIGHT' },

  'entry.purchaseH': {
    en: 'Buy a card.\nWatch the game.\n*Win when it hits.*',
    tl: 'Bili ng card.\nPanóorin ang laro.\n*Panalo kapag tumama.*',
  },
  'entry.purchaseSub': {
    en: 'Every box is something that can happen in the game. Get 5 in a row and win. Fill the whole card and win big.',
    tl: 'Bawat box ay pwedeng mangyari sa laro. Kumuha ng 5 in a row para manalo. Punuin ang buong card para sa malaking panalo.',
  },
  'entry.priceCard': { en: 'card', tl: 'card' },
  'entry.priceBigger': { en: 'Bigger wins', tl: 'Mas malaking panalo' },

  'entry.buyNoTokens': { en: 'No tokens · come back tomorrow', tl: 'Walang tokens · balik bukas' },
  'entry.buyLimitReached': { en: 'Stop for now · come back tomorrow', tl: 'Tigil muna · balik bukas' },
  'entry.buyDaily': { en: 'Buy daily card · ₱{price} →', tl: 'Bumili ng daily card · ₱{price} →' },
  'entry.buyDemo': { en: 'Open the demo pack · ₱{price} →', tl: 'Buksan ang demo pack · ₱{price} →' },
  'entry.buyLive': { en: 'Join LIVE · ₱{price} →', tl: 'Sumali sa LIVE · ₱{price} →' },
  'entry.buyReserve': { en: 'Reserve ₱{price} pack →', tl: 'Reserve ₱{price} pack →' },
  'entry.buyFallback': { en: 'Open a pack · ₱{price} →', tl: 'Buksan ang pack · ₱{price} →' },

  'entry.toggleToDaily': { en: '→ Or play the daily card', tl: '→ O maglaro ng daily card' },
  'entry.toggleToSports': { en: '← Back to sports', tl: '← Balik sa sports' },
  'entry.playDemoWhileWait': {
    en: 'Play demo while you wait',
    tl: 'Maglaro ng demo habang naghihintay',
  },

  'entry.metaDaily': {
    en: 'Daily card · all-day window · no real money yet',
    tl: 'Daily card · buong araw · walang tunay na pera pa',
  },
  'entry.metaDemo': {
    en: 'Demo · auto-fired events · no real money yet',
    tl: 'Demo · auto-fired events · walang tunay na pera pa',
  },
  'entry.metaLive': {
    en: 'Live game · cells light up as it happens',
    tl: 'Live game · mag-iilaw ang cells habang nangyayari',
  },
  'entry.metaUpcoming': {
    en: 'Pre-game · reserve now, cells light up at game start',
    tl: 'Pre-game · reserve na, mag-iilaw ang cells sa simula ng laro',
  },
  'entry.metaFallback': { en: 'Demo only · no real money yet', tl: 'Demo lang · walang tunay na pera pa' },

  'entry.upcomingEyebrow': { en: 'Upcoming games', tl: 'Mga susunod na laro' },
  'entry.reserveActive': { en: 'Selected ✓', tl: 'Selected ✓' },
  'entry.reserve': { en: 'Reserve', tl: 'Reserve' },

  'entry.payoutsEyebrow': {
    en: 'What you can win on a ₱{price} card',
    tl: 'Pwede mong manalo sa ₱{price} card',
  },
  'entry.payout5row': { en: '5 in a row', tl: '5 in a row' },
  'entry.payoutCorner': { en: 'Corner to corner', tl: 'Corner to corner' },
  'entry.payoutJackpot': { en: 'All boxes (jackpot)', tl: 'Lahat ng box (jackpot)' },

  'entry.limitH': {
    en: "You've spent ₱{spend} today. *Stop when?*",
    tl: 'Gumastos ka na ng ₱{spend} today. *Magtigil kailan?*',
  },
  'entry.limitSub': {
    en: "Pick your stop. We'll block the buy button when you hit it. Resets tomorrow.",
    tl: 'Pumili ng hangganan. I-block namin ang buy button pag naabot mo. Mag-reset bukas.',
  },
  'entry.limitStop': { en: 'Stop at ₱{amount}', tl: 'Tigil sa ₱{amount}' },

  // ── Active card (/hits/[card_id]) ───────────────────────────────────
  'card.new': { en: '← New', tl: '← Bago' },
  'card.playerWon': {
    en: '🎉 player won ₱{score} · {ago}',
    tl: '🎉 may nanalo ng ₱{score} · {ago}',
  },
  'card.reserved': { en: 'Reserved', tl: 'Reserved' },
  'card.pregameWithTip': {
    en: 'Starts {time} · cells light up at the start of the game',
    tl: 'Simula {time} · mag-iilaw ang cells sa simula ng laro',
  },
  'card.pregameNoTip': {
    en: 'Cells light up at the start of the game',
    tl: 'Mag-iilaw ang cells sa simula ng laro',
  },
  'card.betSuffix': { en: '₱{amount} bet', tl: '₱{amount} bet' },
  'card.shuffleNoFunds': {
    en: 'No ₱{cost} for a shuffle',
    tl: 'Walang ₱{cost} para sa shuffle',
  },
  'card.shuffleDo': { en: 'New card · ₱{cost} tokens', tl: 'Iba ang card · ₱{cost} tokens' },
  'card.shuffleTitle': {
    en: 'Generate a fresh card. Available only before any event lights up.',
    tl: 'Gumawa ng bagong card. Pwede lang bago mag-ilaw ang kahit anong event.',
  },
  'card.payoutsTitle': { en: 'Prizes · ₱{amount} bet', tl: 'Premyo · ₱{amount} bet' },
  'card.payoutRowCol': { en: '📏 Row / Column', tl: '📏 Row / Column' },
  'card.payoutDiag': { en: '↘ Diagonal', tl: '↘ Diagonal' },
  'card.payoutFull': { en: '💰 Full card jackpot', tl: '💰 Buong card jackpot' },
  'card.payoutsNote': {
    en: 'Highest pattern pays. The free cell is always in. Wins credit your token balance instantly.',
    tl: 'Ang pinakamataas na pattern ang manalo. Ang free cell ay laging kasama. Agad na madadagdag ang panalo sa tokens mo.',
  },
  'card.share': { en: 'Share card', tl: 'Share card' },
  'card.anotherCard': { en: 'Another card →', tl: 'Iba pang card →' },
  'card.foot': {
    en: 'Demo. *Real hits follows a real game.*',
    tl: 'Demo. *May tunay na hits kapag may tunay na laro.*',
  },
  'card.winBadgeJackpot': { en: 'Jackpot!', tl: 'Jackpot!' },
  'card.winBadge': { en: 'You win!', tl: 'Panalo ka!' },
  'card.winFull': { en: '*Full card.*', tl: '*Full card.*' },
  'card.winMult': { en: '{mult}× your bet', tl: '{mult}× ng taya mo' },
  'card.youWin': { en: 'you win', tl: 'panalo mo' },
  'card.winClose': { en: 'Keep playing', tl: 'Tuloy laro' },

  // ── Gacha flow: pack rip, post-rip strip, card complete ────────────
  'common.binder': { en: 'Binder', tl: 'Binder' },
  'rip.tap': { en: 'Tap to open', tl: 'Tap para buksan' },
  'rip.skip': { en: 'Tap to skip', tl: 'Tap para laktawan' },
  'rip.rareNote': {
    en: '✨ {n} rare pull — rainbow cells are hard-to-hit events with bragging rights',
    tl: '✨ {n} rare pull — ang rainbow cells ay bihirang events, pang-yabang pag tumama',
  },
  'strip.q': { en: 'How was your pull?', tl: 'Kamusta ang pull mo?' },
  'strip.keep': { en: 'Play this card →', tl: 'Laruin ang card na ’to →' },
  'strip.shuffle': { en: 'No luck? Shuffle · ₱{cost}', tl: 'Hindi swerte? Shuffle · ₱{cost}' },
  'strip.another': { en: 'Open another · ₱{price}', tl: 'Buksan pa ng isa · ₱{price}' },
  'strip.blocked': { en: 'Pack limit / out of tokens', tl: 'Pack limit / tokens ubos' },
  'complete.note': { en: 'Card complete', tl: 'Card complete' },
  'complete.noteWin': { en: 'Card complete · you won! 🎉', tl: 'Card complete · panalo ka! 🎉' },
  'complete.buy': {
    en: 'Open another pack · ₱{price} →',
    tl: 'Buksan pa ng isang pack · ₱{price} →',
  },
  'complete.blocked': {
    en: 'Pack limit / out of tokens · come back tomorrow',
    tl: 'Pack limit / tokens ubos · balik bukas',
  },
  'complete.binder': { en: 'Add to binder →', tl: 'Add to binder →' },
  'card.noTokens': { en: 'Out of tokens', tl: 'Tokens ubos' },

  // ── Binder (/hits/history) ──────────────────────────────────────────
  'binder.title': { en: 'My binder', tl: 'My binder' },
  'binder.statCards': { en: 'cards', tl: 'cards' },
  'binder.statWins': { en: 'wins', tl: 'panalo' },
  'binder.statWon': { en: 'won', tl: 'napanalunan' },
  'binder.anonPrefix': { en: '🔓 Anon binder · ', tl: '🔓 Anon binder · ' },
  'binder.emptyPrefix': { en: 'Your binder is empty. ', tl: 'Walang laman ang binder mo. ' },
  'binder.emptyLink': { en: 'Open your first pack →', tl: 'Buksan ang unang pack →' },
  'binder.live': { en: '● LIVE', tl: '● LIVE' },

  // ── History (/hits/history) ─────────────────────────────────────────
  'history.back': { en: '← /hits', tl: '← /hits' },
  'history.title': { en: 'Card history', tl: 'Card history' },
  'history.anonPrefix': { en: '🔓 Anon history · ', tl: '🔓 Anon history · ' },
  'history.anonLink': {
    en: "Sign in so it's not lost when you clear your browser →",
    tl: 'Sign in para hindi mawala kapag nag-clear ng browser →',
  },
  'history.emptyPrefix': { en: 'No cards yet. ', tl: 'Wala pang card. ' },
  'history.emptyLink': { en: 'Play first →', tl: 'Maglaro muna →' },
  'history.rowMeta': { en: '{ago} · ₱{price} card', tl: '{ago} · ₱{price} card' },
  'history.loadMore': { en: 'Load more', tl: 'Load more' },
  'history.patternRow': { en: 'Row', tl: 'Row' },
  'history.patternCol': { en: 'Column', tl: 'Column' },
  'history.patternDiag': { en: 'Diagonal', tl: 'Diagonal' },
  'history.patternFull': { en: 'Full card', tl: 'Buong card' },
  'history.win': { en: 'Win', tl: 'Panalo' },

  // ── Account menu ────────────────────────────────────────────────────
  'account.signedInAs': { en: 'Signed in as {email}', tl: 'Signed in as {email}' },
  'account.history': { en: '📋 Card history', tl: '📋 Card history' },
  'account.signOut': { en: 'Sign out', tl: 'Sign out' },

  // ── Header overflow menu ────────────────────────────────────────────
  'menu.newCard': { en: 'New card', tl: 'Bagong card' },
  'menu.binder': { en: 'My binder', tl: 'My binder' },

  // ── Contact capture modal ───────────────────────────────────────────
  'capture.doneH': { en: "You're on the *insider list.*", tl: 'Sali ka na sa *insider list.*' },
  'capture.doneSub': {
    en: "You'll be the first to know when there's a new game or game mode.",
    tl: 'Ikaw ang unang aabisuhan kapag may bagong laro o bagong game mode.',
  },
  'capture.eyebrowWin': { en: '🎉 You win!', tl: '🎉 Panalo ka!' },
  'capture.eyebrow': { en: 'Pre-launch insider list', tl: 'Pre-launch insider list' },
  'capture.hWin': {
    en: 'Drop your email — join the *insider list.*',
    tl: 'Drop your email — sumali sa *insider list.*',
  },
  'capture.h': { en: 'Join the *insider list.*', tl: 'Sali ka na sa *insider list.*' },
  'capture.sub': {
    en: "Free-play tokens for now. People on the list are first to know when there's a new game or mode. No spam, no timeline promises.",
    tl: 'Free-play tokens muna. Ang nasa list, sila ang unang aabisuhan kapag may bagong laro o mode. No spam, no timeline promises.',
  },
  'capture.phonePlaceholder': { en: 'Phone (optional)', tl: 'Phone (optional)' },
  'capture.error': { en: "Didn't go through. Try again.", tl: 'Hindi tumagos. Subukan ulit.' },
  'capture.sending': { en: 'Sending…', tl: 'Sending…' },
  'capture.submit': { en: 'Join the insider list →', tl: 'Sumali sa insider list →' },

  // ── Sign-in modal ───────────────────────────────────────────────────
  'signin.confirmH': { en: 'Confirm your *email.*', tl: 'I-confirm mo *email mo.*' },
  'signin.confirmSub': {
    en: 'We sent a confirmation link to *{email}*. Click it, then come back here to sign in.',
    tl: 'Pinadalhan ka namin ng confirmation link sa *{email}*. Click mo, tapos balik ka rito para mag-sign in.',
  },
  'signin.confirmOk': { en: 'OK', tl: 'Sige' },
  'signin.eyebrowSignin': { en: 'Sign in', tl: 'Sign in' },
  'signin.eyebrowSignup': { en: 'Create account', tl: 'Create account' },
  'signin.h': { en: 'Save your *tokens + ranking.*', tl: 'I-save ang *tokens + ranking mo.*' },
  'signin.subSignin': {
    en: 'Sign in to save your balance + rank across devices. Anonymous play is fine too.',
    tl: 'Sign in para ma-save ang balance + rank mo across devices. Anonymous play OK lang din.',
  },
  'signin.subSignup': {
    en: "Create an account so you don't lose your tokens + rank. Just email + password.",
    tl: 'Gumawa ng account para hindi mawala ang tokens + rank mo. Email + password lang.',
  },
  'signin.passwordSignin': { en: 'Password', tl: 'Password' },
  'signin.passwordSignup': { en: 'Password (6+ chars)', tl: 'Password (6+ chars)' },
  'signin.submitting': { en: 'One moment…', tl: 'Saglit lang…' },
  'signin.submitSignin': { en: 'Sign in →', tl: 'Sign in →' },
  'signin.submitSignup': { en: 'Create account →', tl: 'Gumawa ng account →' },
  'signin.toggleToSignup': { en: 'No account? Create one →', tl: 'Walang account? Gumawa →' },
  'signin.toggleToSignin': { en: '← Have an account? Sign in', tl: '← May account na? Sign in' },
  'signin.errInvalid': { en: 'Wrong email or password.', tl: 'Mali ang email o password.' },
  'signin.errRegistered': {
    en: 'This email already has an account. Just sign in.',
    tl: 'May account na sa email na ito. Sign in na lang.',
  },
  'signin.errPassword': {
    en: 'Password must be at least 6 characters.',
    tl: 'Password must be at least 6 characters.',
  },
  'signin.errRateLimit': {
    en: 'Too many attempts. Try again later.',
    tl: 'Sobra ang attempts. Subukan ulit mamaya.',
  },
  'signin.errGeneric': { en: 'Something went wrong. Try again.', tl: 'May problema. Subukan ulit.' },
} satisfies Record<string, Entry>

export type StringKey = keyof typeof STRINGS

export type Vars = Record<string, string | number>

/**
 * Replace {token} placeholders in a template with values from `vars`.
 * Unknown tokens are left untouched so a missing var is visible, not silent.
 */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole
  )
}

/** Look up a key in the given language and interpolate any vars. */
export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const entry = STRINGS[key]
  return interpolate(entry[lang], vars)
}

/** 'en' | 'tl' pass through; anything else → null (invalid stored value). */
export function normalizeLang(value: string | null | undefined): Lang | null {
  return value === 'en' || value === 'tl' ? value : null
}

/**
 * Detect the preferred language from the browser. Filipino/Tagalog locales
 * (`fil`, `tl`, `fil-PH`, …) → 'tl'; everything else falls back to 'en'.
 */
export function detectBrowserLang(nav?: {
  language?: string
  languages?: readonly string[]
}): Lang {
  const source = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined)
  if (!source) return 'en'
  const tags = [source.language, ...(source.languages ?? [])].filter(Boolean) as string[]
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('fil') || lower === 'tl' || lower.startsWith('tl-')) return 'tl'
  }
  return 'en'
}
