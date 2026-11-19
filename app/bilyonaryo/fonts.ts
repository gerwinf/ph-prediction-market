import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--by-display-font' })
const sans = Inter_Tight({ subsets: ['latin'], variable: '--by-sans-font' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--by-mono-font' })

export const previewFonts = `${display.variable} ${sans.variable} ${mono.variable}`
