# Mars Space: Design Plan v2

Branch: `feature/design-v2`. This file is the plan; each stage ends with a tick and a commit.

## 1. The idea: the school is a crewed mission to Mars

Mars Space is a coding course, so the whole product is one story: **a crew is training for a mission to Mars.**
Every screen keeps its normal, plain label (nobody should have to decode a metaphor to find "Attendance"),
but the look, the small labels above the titles, the illustrations and the numbers all speak the story.

| Real thing | In the story | Where you feel it |
|---|---|---|
| Student | Crew member, with a **rank** | Cadet, Pilot, Navigator, Commander (earned with XP) |
| Group | A crew | "Your crew", room and launch time |
| Lesson | A launch window | "Next launch in 2 h 10 min" |
| Attendance | Mission log | ticks and crosses in a log, % = "mission readiness" |
| Mars Coins | Credits | coin icon everywhere |
| Battle Arena | Simulator | bot levels Intern to Senior keep their names |
| Shop | Supply depot | picture cards, a cart called "cargo" in the eyebrow text |
| Teacher | Mission commander | their own "station" |
| Admin | Mission Control | control room |
| Finance | Logistics | ledger bay |

XP (shown to the student): `10 per lesson attended + 25 per battle won`.
Ranks: **Cadet** 0, **Pilot** 100, **Navigator** 300, **Commander** 700.

## 2. One look per working role, three looks for the student

Only students choose. Everyone else gets one carefully designed look, because staff work in it all day.
Each look is a different **layout and structure**, not just a colour set.

### Student: three designs (a "Design" switch in the top corner, remembered in the browser)

1. **Cockpit** (dark, HUD). No sidebar. A top HUD bar: rank badge with an XP ring, coins, bell.
   Navigation is a floating **dock** at the bottom (app-like, great on phones).
   Home: a large "Next launch" panel with a ring, three circular gauges (readiness, coins, wins),
   the mission log, one big button to the simulator.
2. **Mars Base** (warm and light, illustrated). A slim icon rail on the left. A hero banner with a
   layered Martian landscape drawn in SVG (dunes, two moons, a rover that slowly drives).
   Cards are soft "habitat modules". Progress is shown as dune-shaped bars. Friendly and playful.
3. **Console** (code editor). A file-tree **explorer** on the left (`mars-space/` folders), editor
   **tabs** with a path on top, the home page is a terminal: `$ mars status`, lines with bars made of
   characters, key: value rows. For students who like code.

### Staff: one design each

* **Admin = Mission Control.** A top command bar with a **global search** (type a name, see students
  with group and payment status at once), a left icon rail grouped as Crew / Operations / Money / System,
  a status board with live (pulsing) indicators and an alerts column. Deep slate with amber signals.
* **Teacher = Commander's Station.** A **top navigation bar** (few pages, so no sidebar), home is a day
  **timeline**: today's launches in order, who is not marked yet, the coin pool. Light, clean, teal accent.
* **Finance = Logistics Bay.** A ledger look: a wide labelled sidebar, tabular numbers, a cash-flow chart
  with a clear legend, a debtors queue. Light, cool paper with emerald.

## 3. Building blocks (shared, so everything stays consistent)

* **Tokens**: colours, fonts, corners, shadows per skin (`data-skin` on `<html>`), as already done for colours.
* **Skins**: `cockpit`, `base`, `console` (student), `control` (admin), `station` (teacher), `bay` (finance).
* **Shells** (page frames): `DockShell`, `RailShell`, `ExplorerShell`, `ControlShell`, `TopNavShell`, `LedgerShell`.
* **Components**: `Eyebrow` (small label above a title), `Gauge` (ring), `RankBadge`, `Panel`, `MissionLog`,
  `Horizon` (the SVG landscape), `StarfieldBackdrop`, `CommandSearch`, `Timeline`.
* All new text exists in ru, uz and en before it ships (`npm run check-i18n` must stay clean).
* Motion is small and calm: gauges fill once, the rover drives slowly, the cursor blinks.
  Everything respects `prefers-reduced-motion`.
* Every layout works at phone width (the cockpit dock and the console explorer collapse).

## 4. Data the new screens need

`GET /api/student/overview` (students only): rank and XP, readiness (attendance %), coin balance, battle
wins, the **next launch** (the next lesson of the student's groups, in Tashkent time), the last five log entries.
No design screen shows invented numbers.

## 5. Stages (in this order)

- [x] **A. Foundation.** Skins and shells registry, role to skin, the student "Design" switch, `Eyebrow`, `Gauge`, `RankBadge`.
- [x] **B. Student overview API** with tests.
- [x] **C. Student: Cockpit** (shell + home).
- [x] **D. Student: Mars Base** (shell + home + Horizon illustration).
- [x] **E. Student: Console** (shell + home).
- [x] **F. Admin: Mission Control** (shell, command search, status board).
- [x] **G. Teacher: Commander's Station** (shell, timeline home).
- [x] **H. Finance: Logistics Bay** (shell, ledger overview).
- [x] **I. Polish.** Phone widths, reduced motion, translations, the login page in the story, screenshots of every role and design.

## 6. Done means

`npm run lint`, `npm run build`, `npm run check-i18n` clean; all `test-*` suites green; every role and
every student design opened in the browser at desktop and phone width and looked at; nothing shows invented data.
