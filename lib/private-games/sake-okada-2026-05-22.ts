/**
 * Private dry-run game definition.
 *
 * Sake Manila + Okada night, 2026-05-22. 4 players: Tonio, Gerwin,
 * Tollo, Matt. Validates the predictive + personalized card mechanic
 * with the founding team before Phase 0 public launch.
 *
 * Source: .context/attachments/rw1ogx/ spec. Hardcoded per spec §6 —
 * single private game, no creation UI yet.
 */
import type { PrivateGame } from './types'

export const SAKE_OKADA_2026_05_22: PrivateGame = {
  id: 'private-sake-okada-2026-05-22',
  title: 'Sake Manila + Okada — May 22',
  description: 'Founding-team dry run. Observe + predict. Score at the bar.',
  startsAt: '2026-05-22T18:00:00+08:00',
  endsAt: '2026-05-23T03:00:00+08:00',
  kittyTotalPhp: 4000,
  payouts: {
    firstBingoPhp: 2500,
    secondBingoPhp: 500,
    predictionKingPhp: 1000,
    fullCardBasePhp: 0,
    rolloverNote:
      'Unclaimed bingo prizes roll into the Full Card jackpot. ' +
      'If Full Card stays unclaimed at end of night, it rolls to the player with the most observational cells marked. ' +
      'Prediction King is independent and always pays.',
    observationalTiebreaker: 'most_marked',
  },
  squarePool: [
    // ── Shared observational squares (16) ─────────────────────────────
    { id: 'first_round_10min', type: 'observational', label: 'First round arrives under 10 min', category: 'sake_bar', isShared: true },
    { id: 'sake_spill', type: 'observational', label: 'Someone spills sake', category: 'sake_bar', isShared: true },
    { id: 'meet_someone', type: 'observational', label: 'We meet someone we know', category: 'either', isShared: true },
    { id: 'multi_drug', type: 'observational', label: 'More than one drug consumed', category: 'either', isShared: true },
    { id: 'escorts_2plus', type: 'observational', label: '2+ escorts ordered', category: 'either', isShared: true },
    { id: 'group_photo', type: 'observational', label: 'Group photo before second course', category: 'sake_bar', isShared: true },
    { id: 'anyone_blackjack', type: 'observational', label: 'Anyone gets blackjack', category: 'casino', isShared: true },
    { id: 'toilet_before_okada', type: 'observational', label: 'First bump before dinner', category: 'sake_bar', isShared: true },
    { id: 'first_slot_15min', type: 'observational', label: 'First slot pulled <15 min after arrival', category: 'casino', isShared: true },
    { id: 'walk_to_okada', type: 'observational', label: 'Group walks instead of Grab', category: 'either', isShared: true },
    { id: 'free_drink_casino', type: 'observational', label: 'Free drink from casino floor', category: 'casino', isShared: true },
    { id: '10k_hand', type: 'observational', label: 'Anyone wins ₱10K+ in one hand', category: 'casino', isShared: true },
    { id: 'dealer_recognizes', type: 'observational', label: 'A dealer recognizes someone', category: 'casino', isShared: true },
    { id: 'matt_poker_pitch', type: 'observational', label: 'Matt tries to convince group to play poker', category: 'casino', isShared: true },
    { id: 'anyone_tips_dealer', type: 'observational', label: 'Anyone tips the dealer', category: 'casino', isShared: true },
    { id: 'leave_before_2am', type: 'observational', label: 'Someone leaves before 2 AM', category: 'either', isShared: true },

    // ── Personalized observational squares per player ────────────────
    // Tonio
    { id: 'matt_home_first', type: 'observational', label: 'Matt home before Tollo', category: 'either', isShared: false },
    { id: 'tonio_tokyo_rec', type: 'observational', label: 'Tonio recommends a Tokyo restaurant', category: 'sake_bar', isShared: false },
    { id: 'tonio_leaves_call', type: 'observational', label: 'Tonio leaves to take a call', category: 'either', isShared: false },
    { id: 'tonio_roulette', type: 'observational', label: 'Tonio wins big at craps', category: 'casino', isShared: false },
    { id: 'tonio_straight_up', type: 'observational', label: 'Tonio bets a single number straight up', category: 'casino', isShared: false },

    // Tollo
    { id: 'tollo_wine_list', type: 'observational', label: 'Tollo asks for the wine list', category: 'sake_bar', isShared: false },
    { id: 'tollo_wager', type: 'observational', label: 'Tollo proposes a wager mid-dinner', category: 'sake_bar', isShared: false },
    { id: 'tollo_high_limit', type: 'observational', label: 'Tollo at the high-limit table', category: 'casino', isShared: false },
    { id: 'tollo_wins_walks', type: 'observational', label: 'Tollo wins big and walks away', category: 'casino', isShared: false },
    { id: 'tollo_cashes_midnight', type: 'observational', label: 'Tollo cashes out before midnight', category: 'casino', isShared: false },

    // Gerwin
    { id: 'tollo_home_first', type: 'observational', label: 'Tollo home before Matt', category: 'either', isShared: false },
    { id: 'gerwin_disappears', type: 'observational', label: 'Gerwin disappears for 5+ min unannounced', category: 'either', isShared: false },
    { id: 'gerwin_double_11', type: 'observational', label: 'Gerwin doubles down on 11', category: 'casino', isShared: false },
    { id: 'gerwin_loses_first', type: 'observational', label: 'Gerwin loses on his first bet', category: 'casino', isShared: false },
    { id: 'anyone_three_streak', type: 'observational', label: 'Anyone wins three hands in a row', category: 'casino', isShared: false },

    // Matt
    { id: 'matt_3drinks', type: 'observational', label: 'Matt has 3+ drinks', category: 'sake_bar', isShared: false },
    { id: 'matt_stallone', type: 'observational', label: 'Matt goes full Stallone', category: 'either', isShared: false },
    { id: 'matt_lets_go', type: 'observational', label: 'Matt stays after 2 AM', category: 'either', isShared: false },
    { id: 'matt_long_table', type: 'observational', label: 'Matt at a card table >30 min', category: 'casino', isShared: false },
    { id: 'matt_blackjack', type: 'observational', label: 'Matt gets blackjack himself', category: 'casino', isShared: false },

    // Roulette colors / casino flavor
    { id: 'anyone_red', type: 'observational', label: 'Anyone hits red on roulette', category: 'casino', isShared: false },
    { id: 'anyone_black', type: 'observational', label: 'Anyone hits black on roulette', category: 'casino', isShared: false },
    { id: 'high_roller_chips', type: 'observational', label: 'A high-roller chip stack appears', category: 'casino', isShared: false },

    // ── Predictive squares (resolved at end of night) ─────────────────
    { id: 'predict_okada_before_1030', type: 'predictive', label: 'Group leaves Okada before 10:30 PM', category: 'prediction', isShared: false },
    { id: 'predict_winnings_100k', type: 'predictive', label: 'Total group winnings exceed ₱100K', category: 'prediction', isShared: false },
    { id: 'predict_tonio_positive', type: 'predictive', label: "Tonio's casino net is positive", category: 'prediction', isShared: false },
    { id: 'predict_3plus_leave_early', type: 'predictive', label: 'More than 3 people leave before 2 AM', category: 'prediction', isShared: false },
    { id: 'predict_3plus_blackjacks', type: 'predictive', label: 'Total blackjacks at our table is 3+', category: 'prediction', isShared: false },
    { id: 'predict_tollo_biggest_win', type: 'predictive', label: "Tollo's biggest single win is largest", category: 'prediction', isShared: false },
    { id: 'predict_instagram_story', type: 'predictive', label: 'A photo from tonight ends up on someone\'s Instagram story', category: 'prediction', isShared: false },
    { id: 'predict_gerwin_negative', type: 'predictive', label: "Gerwin's casino net is negative", category: 'prediction', isShared: false },
    { id: 'predict_meet_2plus_known', type: 'predictive', label: 'We meet 2+ people we know across the night', category: 'prediction', isShared: false },
    { id: 'predict_matt_last', type: 'predictive', label: 'Matt is the last one still gambling', category: 'prediction', isShared: false },
    { id: 'predict_2hrs_sake_bar', type: 'predictive', label: 'Group spends more than 2 hours at the sake bar', category: 'prediction', isShared: false },
    { id: 'predict_50k_hand', type: 'predictive', label: "Night's biggest single hand wins more than ₱50K", category: 'prediction', isShared: false },
    { id: 'predict_group_net_positive', type: 'predictive', label: "Group's casino winnings exceed total losses", category: 'prediction', isShared: false },
    { id: 'predict_tollo_highest_bet', type: 'predictive', label: 'Tollo bets the highest single amount tonight', category: 'prediction', isShared: false },
    { id: 'predict_4plus_drinks_predinner', type: 'predictive', label: 'More than 4 drinks ordered before food arrives', category: 'prediction', isShared: false },
    { id: 'predict_matt_3_games', type: 'predictive', label: 'Matt plays at least 3 different table games', category: 'prediction', isShared: false },
    { id: 'predict_matts_color_hits', type: 'predictive', label: "At least one roulette spin lands on Matt's preferred color", category: 'prediction', isShared: false },
    { id: 'predict_tonio_expensive_order', type: 'predictive', label: 'Tonio orders the most expensive item at dinner', category: 'prediction', isShared: false },
  ],
  players: [
    {
      slug: 'tonio',
      displayName: 'Tonio',
      cardSquareIds: [
        'first_round_10min', 'sake_spill', 'meet_someone', 'multi_drug', 'escorts_2plus',
        'matt_home_first', 'group_photo', 'anyone_blackjack', 'toilet_before_okada', 'tollo_wine_list',
        'anyone_red', 'predict_okada_before_1030', '__hula__', 'tonio_tokyo_rec', 'predict_winnings_100k',
        'free_drink_casino', '10k_hand', 'dealer_recognizes', 'tonio_roulette', 'matt_poker_pitch',
        'predict_tonio_positive', 'anyone_tips_dealer', 'predict_3plus_leave_early', 'tonio_straight_up', 'predict_3plus_blackjacks',
      ],
    },
    {
      slug: 'gerwin',
      displayName: 'Gerwin',
      cardSquareIds: [
        'first_round_10min', 'sake_spill', 'meet_someone', 'multi_drug', 'escorts_2plus',
        'tollo_home_first', 'group_photo', 'anyone_blackjack', 'toilet_before_okada', 'tonio_tokyo_rec',
        'anyone_red', 'predict_tollo_biggest_win', '__hula__', 'gerwin_disappears', 'predict_instagram_story',
        'free_drink_casino', '10k_hand', 'dealer_recognizes', 'gerwin_double_11', 'matt_poker_pitch',
        'predict_gerwin_negative', 'anyone_three_streak', 'predict_meet_2plus_known', 'gerwin_loses_first', 'predict_matt_last',
      ],
    },
    {
      slug: 'tollo',
      displayName: 'Tollo',
      cardSquareIds: [
        'first_round_10min', 'sake_spill', 'meet_someone', 'multi_drug', 'escorts_2plus',
        'tollo_wine_list', 'group_photo', 'anyone_blackjack', 'toilet_before_okada', 'matt_home_first',
        'anyone_black', 'predict_2hrs_sake_bar', '__hula__', 'tollo_wager', 'predict_50k_hand',
        'free_drink_casino', '10k_hand', 'dealer_recognizes', 'tollo_high_limit', 'matt_poker_pitch',
        'predict_group_net_positive', 'tollo_wins_walks', 'predict_tollo_highest_bet', 'tollo_cashes_midnight', 'predict_tonio_expensive_order',
      ],
    },
    {
      slug: 'matt',
      displayName: 'Matt',
      cardSquareIds: [
        'first_round_10min', 'sake_spill', 'meet_someone', 'multi_drug', 'escorts_2plus',
        'matt_3drinks', 'group_photo', 'anyone_blackjack', 'toilet_before_okada', 'matt_stallone',
        'anyone_red', 'predict_4plus_drinks_predinner', '__hula__', 'matt_lets_go', 'predict_matt_3_games',
        'free_drink_casino', '10k_hand', 'dealer_recognizes', 'matt_poker_pitch', 'gerwin_disappears',
        'matt_blackjack', 'anyone_tips_dealer', 'predict_matts_color_hits', 'matt_long_table', 'predict_tonio_positive',
      ],
    },
  ],
}
