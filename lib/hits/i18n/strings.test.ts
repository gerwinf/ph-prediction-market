import { describe, it, expect } from 'vitest'
import {
  STRINGS,
  interpolate,
  translate,
  normalizeLang,
  detectBrowserLang,
  type StringKey,
} from './strings'

describe('/hits i18n strings', () => {
  it('every key has non-empty en + tl values', () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(entry.en, `${key}.en`).toBeTruthy()
      expect(entry.tl, `${key}.tl`).toBeTruthy()
    }
  })

  it('en and tl share the same {token} placeholders per key', () => {
    const tokens = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort()
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(tokens(entry.tl), `${key} tokens`).toEqual(tokens(entry.en))
    }
  })

  it('emphasis markers are balanced (even number of asterisks) in both langs', () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect((entry.en.match(/\*/g) ?? []).length % 2, `${key}.en asterisks`).toBe(0)
      expect((entry.tl.match(/\*/g) ?? []).length % 2, `${key}.tl asterisks`).toBe(0)
    }
  })
})

describe('interpolate', () => {
  it('substitutes known tokens', () => {
    expect(interpolate('Hi, {name}!', { name: 'Ana' })).toBe('Hi, Ana!')
    expect(interpolate('₱{price} card', { price: 20 })).toBe('₱20 card')
  })

  it('substitutes multiple + repeated tokens', () => {
    expect(interpolate('{a}+{b}={a}{b}', { a: 1, b: 2 })).toBe('1+2=12')
  })

  it('leaves unknown tokens untouched (no silent blanks)', () => {
    expect(interpolate('Hi, {name}!', {})).toBe('Hi, {name}!')
    expect(interpolate('Hi, {name}!')).toBe('Hi, {name}!')
  })

  it('leaves no unresolved placeholder for a real interpolated key', () => {
    const s = translate('en', 'entry.buyDaily', { price: 50 })
    expect(s).toBe('Buy daily card · ₱50 →')
    expect(s).not.toMatch(/\{\w+\}/)
  })
})

describe('translate', () => {
  it('returns the requested language', () => {
    expect(translate('en', 'card.winClose')).toBe('Keep playing')
    expect(translate('tl', 'card.winClose')).toBe('Tuloy laro')
  })
})

describe('normalizeLang', () => {
  it('accepts valid codes, rejects everything else', () => {
    expect(normalizeLang('en')).toBe('en')
    expect(normalizeLang('tl')).toBe('tl')
    expect(normalizeLang('fr')).toBeNull()
    expect(normalizeLang(null)).toBeNull()
    expect(normalizeLang(undefined)).toBeNull()
    expect(normalizeLang('')).toBeNull()
  })
})

describe('detectBrowserLang', () => {
  it('maps Filipino/Tagalog locales to tl', () => {
    expect(detectBrowserLang({ language: 'fil-PH' })).toBe('tl')
    expect(detectBrowserLang({ language: 'tl' })).toBe('tl')
    expect(detectBrowserLang({ language: 'fil' })).toBe('tl')
    expect(detectBrowserLang({ language: 'tl-PH' })).toBe('tl')
  })

  it('detects tl anywhere in the languages list', () => {
    expect(detectBrowserLang({ language: 'en-US', languages: ['en-US', 'fil'] })).toBe('tl')
  })

  it('falls back to en for non-Filipino locales', () => {
    expect(detectBrowserLang({ language: 'en-US' })).toBe('en')
    expect(detectBrowserLang({ language: 'es-ES' })).toBe('en')
    expect(detectBrowserLang({})).toBe('en')
  })

  it('does not treat unrelated tags starting with t as tl', () => {
    expect(detectBrowserLang({ language: 'tr-TR' })).toBe('en')
    expect(detectBrowserLang({ language: 'th' })).toBe('en')
  })
})

// Type-level guard: keeps the test honest if a key is renamed.
const _sampleKey: StringKey = 'common.foot'
void _sampleKey
