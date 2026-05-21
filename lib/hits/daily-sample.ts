import type { Match } from './types'

/**
 * Sample-day timeline for the Daily card demo. 15 events spread across a
 * simulated 6 AM → midnight day, compressed into the same 90-second window
 * the sports card uses. At ?speed=10 the whole day plays out in ~9 seconds.
 */
export const DAILY_SAMPLE: Match = {
  id: 'daily-manila-may21',
  league: "MANILA · TODAY",
  home: 'Sunrise',
  homeColor: '#f4b942',
  away: 'Midnight',
  awayColor: '#0f2419',
  tipoff: 'Buy by 6 AM · Resolves at midnight',
  durationMs: 90_000,
  timeline: [
    { atMs:  3_000, gameClock: '06:30 AM', eventId: 'd-thunderstorm',  description: 'PAGASA thunderstorm advisory' },
    { atMs:  8_000, gameClock: '07:30 AM', eventId: 'd-traffic-red',   description: 'EDSA Code Red traffic alert' },
    { atMs: 13_000, gameClock: '08:00 AM', eventId: 'd-naia-delay',    description: 'NAIA T2 flights delayed 1hr' },
    { atMs: 22_000, gameClock: '10:00 AM', eventId: 'd-bsp-stmt',      description: 'BSP releases monetary statement' },
    { atMs: 30_000, gameClock: '11:30 AM', eventId: 'd-heat-42',       description: 'Heat index hits 42°C in Manila' },
    { atMs: 34_000, gameClock: '12:00 PM', eventId: 'd-marian-tv',     description: 'Marian guests on noontime TV' },
    { atMs: 40_000, gameClock: '01:30 PM', eventId: 'd-senate-early',  description: 'Senate adjourns early' },
    { atMs: 50_000, gameClock: '03:30 PM', eventId: 'd-psei-green',    description: 'PSEi closes +0.8% green' },
    { atMs: 54_000, gameClock: '04:00 PM', eventId: 'd-usdphp-strong', description: 'Peso closes at 55.87, stronger' },
    { atMs: 62_000, gameClock: '05:30 PM', eventId: 'd-bianca-post',   description: 'Bianca G drops afternoon post' },
    { atMs: 67_000, gameClock: '06:30 PM', eventId: 'd-anne-showtime', description: 'Anne Curtis on Showtime' },
    { atMs: 72_000, gameClock: '07:00 PM', eventId: 'd-bini-trend',    description: 'BINI #1 trending PH' },
    { atMs: 78_000, gameClock: '08:30 PM', eventId: 'd-vice-show',     description: 'Vice Ganda show airs' },
    { atMs: 85_000, gameClock: '10:00 PM', eventId: 'd-btc-green',     description: 'BTC closes green for the day' },
    { atMs: 89_000, gameClock: 'MIDNIGHT', eventId: 'd-bea-ig',        description: 'Bea Alonzo posts goodnight IG' },
  ],
}
