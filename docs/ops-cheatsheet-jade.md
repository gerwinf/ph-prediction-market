# Jade — Ops cheatsheet (May 24 PBA semis)

Para sa Sunday game. I-bookmark mo 'to sa phone para easy reference habang nagvenue ka.

## Step 1 — Magsign in sa /ops

1. Buksan mo: `https://<prod-url>/ops` (Gerwin will text you the URL)
2. **Ops secret:** `hula-pba-may24-7f3k9` — paste mo lang, pindutin **Continue**
3. Saved sa phone — once lang gawin

## Step 2 — Piliin ang fixture

Dropdown sa taas:

- **Ginebra vs Rain or Shine — Sun May 24** — kung yan ang ino-ops mo
- **TNT vs Meralco — Sun May 24** — kung yan naman

Yung dropdown lang ang pindutin, automatic mag-switch ang match.

## Step 3 — Mag-fire ng events

Bawat tile = isang bagay na pwedeng mangyari sa game. Pag nangyari, pindutin mo. Mag-pop ka, magiging green, may **✓ fired** sa baba — yan ang signal na pumasok na sa cards ng players.

**Important:** isang beses lang per game ang bawat tile. Kapag napindot mo na, hindi mo na maulit (yan ang protection laban sa double-fire).

---

## Anong pipindutin kelan — quick reference

### Pre-game / Q1 (unang 12 mins)

| Pindutin pag... | Tile |
|---|---|
| Coach tumawag ng TO sa unang 3 mins | **Timeout sa unang 3 mins** |
| Sino mang player nag-3 sa unang minuto | **3-ball sa unang minute** |
| Q1 buzzer, leader (Ginebra) | **Ginebra wins Q1** |
| Q1 buzzer, leader (RoS / TNT / Meralco) | yung katumbas na "wins Q1" tile |

### Q2 (12 → 24 min)

| Pindutin pag... | Tile |
|---|---|
| Belga 10+ rebounds | **Beau Belga 10+ rebounds** |
| Mikey 5+ threes (count throughout, fire pag pasok yung pang-5) | **Mikey Williams 5+ threes** |
| HALF buzzer, Ginebra leading | **Ginebra leads at half** |
| HALF buzzer, RoS leading | **Rain or Shine leads at half** |
| HALF buzzer, tabla | **Tabla sa half** |

### Q3 (24 → 36 min)

| Pindutin pag... | Tile |
|---|---|
| 35+ points sa isang quarter | **35+ points sa isang quarter** |
| Q3 buzzer, margin > 15 puntos | **Margin > 15 pagkatapos Q3** |
| 5th lead change ng game | **5+ lead changes** |

### Q4 / clutch time (36 → 48 min)

| Pindutin pag... | Tile |
|---|---|
| Brownlee 3 sa Q4 | **Brownlee clutch 3 sa Q4** |
| Oftana 3 sa Q4 | **Oftana clutch 3 sa Q4** |
| Mamuyac clutch basket | **Mamuyac clutch basket Q4** |
| FT pasok sa clutch (last 2 mins) | **Pasok ang clutch FT** |
| FT sablay sa clutch | **Sablay ang clutch FT** |
| Player na-fouled out | **May player na nag-foul out** |
| Buzzer-beater (kahit anong quarter) | **Buzzer beater any quarter** |
| Q4 buzzer, winner ang Ginebra | **Ginebra wins Q4** |
| Q4 buzzer, winner ang TNT | **TNT wins Q4** |

### Final

| Pindutin pag... | Tile |
|---|---|
| Combined points 200+ | **Combined points 200+** |
| Combined points under 180 | **Combined points under 180** |
| Game went to overtime | **OT, may dagdag laro** |

---

## Player scoring tiles

Fire mo lang ITO kapag CROSSED na yung threshold. Hindi need to be exact — kapag dumaan na, pindutin.

**25+ points:**
- Brownlee → **Brownlee scores 25+**
- Mikey → **Mikey Williams scores 25+**
- RoS import → **RoS import scores 25+**
- TNT import → **TNT import scores 25+**
- Meralco import → **Meralco import scores 25+**

**20+ points:**
- Standhardinger → **Standhardinger scores 20+**
- Pogoy → **Roger Pogoy scores 20+**
- Newsome → **Newsome scores 20+**

**Specific plays:**
- Brownlee dunk → **Brownlee dunks**
- Newsome poster dunk → **Newsome poster dunk**
- Hodge block → **Cliff Hodge monster block**
- Scottie Thompson 10 pts/10 reb/10 ast → **Scottie Thompson triple-dub**
- Asistio 3+ threes → **Anton Asistio 3+ threes**

---

## Drama / kalokohan tiles (fire any time)

| Pag nangyari... | Tile |
|---|---|
| Technical foul kay Brownlee | **Brownlee technical foul** |
| Flagrant foul tinawag | **Flagrant foul tinawag** |
| Player o coach na-eject | **Player o coach na-eject** |
| Bench banatan / staredown | **Banatang bench / staredown** |
| Coach challenge | **Coach challenge sa ref** |
| Travel tinawag | **Travel tinawag** |
| Goaltending tinawag | **Goaltending tinawag** |
| No-look pass pumasok | **No-look pass, pasok ang basket** |
| Behind-the-back assist | **Behind-the-back assist** |
| Steal → fastbreak | **Steal → fastbreak** |
| Air ball | **Air ball — nakakapaktol** |
| Poster dunk (any player) | **Poster dunk** |
| 4-point play | **4-point play (sino man)** |
| And-one play | **And-one play** |

---

## Pag may mali — relax lang

- **Wrong tile na-fire?** Walang undo, pero hindi rin nakakasira — yung cards na may yung tile, mag-light up lang. 5 testers lang, walang panic.
- **Match ID nag-error?** Pumunta sa "Custom (type below)" sa dropdown at i-type ang tamang ID (text Gerwin pag hindi sigurado).
- **/ops nag-prompt ulit ng secret?** Pindutin mo lang ulit yung password. Pag nangyari sa kalagitnaan ng game, that's a bad-secret 401 — i-call mo agad si Gerwin.

---

## Pre-game checklist (15 mins before tip-off)

- [ ] `/ops` bukas sa phone, may secret na in
- [ ] Tamang fixture selected sa dropdown
- [ ] WiFi or 5G stable (mas safe ang mobile data sa venue)
- [ ] Battery > 50%
- [ ] Game stream open sa ibang tab/phone so you see what's happening
- [ ] Gerwin's number naka-favorite (in case of issues)

Good luck. Pindutin lang ang totoong nangyayari. Pag may doubt, **don't fire** — better na walang event than maling event.
