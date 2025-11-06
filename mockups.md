## Tip Pool Tracker – Dark UI Mockups

### 1. Shift Detail (Dashboard View)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Header Bar                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  Total Earnings    $705.50             Shift Duration    5:00 PM → 2:30 AM│  │
│  │  Effective Hourly  $67.19/hr           Tips (quick input) [   $327   ]     │  │
│  │  Badges: [Day/Mid] [Night] [Parties ×2] [Chump ✓] [Tips Pending ✖]        │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────────────┤
│  Section Tabs: [Overview] [Cuts] [Enhancements] [Coworkers & Parties] [Charts] │
├───────────────────────────────────────────────────────────────────────────────┤
│  Overview Content                                                             │
│  ┌────────────────────────────┬──────────────────────────────┬────────────────┤
│  │ Summary Card               │ Income Breakdown Card        │ Shift Badges   │
│  │ • Net earnings             │ • Donut chart (tips, wage,   │ • Parties: 2   │
│  │ • Hours worked             │   overtime, chump, swindle)  │ • Tip status   │
│  │ • Hourly rate (hover ⇒     │ • Net adjustments w/ legend  │ • Notes badge  │
│  │   breakdown)               │                              │               │
│  └────────────────────────────┴──────────────────────────────┴────────────────┘
│  Shift Notes Panel (free text + quick tags: Busy, Event, Weather)             │
│  Alerts Row (e.g., “Party tips pending payout”, “Swindle net +$75”)           │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 2. Cuts Accordion (Advanced)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Cuts                                                                          │
│ ▼ Day Cut                                                                     │
│   ┌───────────────────────────────┬────────────────────────────┬────────────┐│
│   │ My Tip Amount [  $175  ]      │ Total Pool (optional) [   ]│ Hours Me   ││
│   │ Status: Confirmed             │ Participants (chips)       │ [ 4.0h ]    ││
│   │ ▸ More Details (hidden)       │                              │            ││
│   └───────────────────────────────┴────────────────────────────┴────────────┘│
│ ▼ Mid Cut                                                                     │
│   (same structure; suggestions pulled from coworker list + timeframe)        │
│ ▼ Party – Johnson Wedding                                                     │
│   ┌──────────────────────┬───────────────────────┬──────────────────────────┐│
│   │ My Tip Amount [ ≈74 ]│ Gratuity [ 800 ]      │ Cash [   ] Credit [   ]  ││
│   │ Status: Estimated    │ Auto calc: tips/hour (with override)              ││
│   │ Participants (chips) │ Weighted by timeline (auto)                       ││
│   └──────────────────────┴───────────────────────┴──────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3. Coworkers & Parties Panel

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Coworkers                                                                     │
│ ┌───────────────────────────────┬───────────────────────────────┐             │
│ │ + Add Coworker                │ Search directory…             │             │
│ ├───────────────────────────────┼───────────────────────────────┤             │
│ │ Ian      [Pit] [16:00] → [02:30]   • confirmed, core shift     │             │
│ │ ALLEN    [Mid] [17:00] → [ ? slider 01:30 | 02:30 | 02:30 ]    │             │
│ │ BILL     [Ser] [17:00] → [~02:00]   • estimation badge          │             │
│ │ ZOE      [Deck] [18:00] → [02:30]   • autopopulated from history│             │
│ └───────────────────────────────┴───────────────────────────────┘             │
│ Parties                                                                       │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │ + Add Party                                                                │ │
│ │ ├───────────────────────────────────────────────────────────────────────┤ │
│ │ │ Johnson Wedding  • 8:00P–1:00A  • Gratuity ≈800  • Cut: Night (auto)  │ │
│ │ │   Notes: Setup heavy, help: ALLEN 25%, ZOE 20%                        │ │
│ │ │   ▸ Expand (packages, contacts, raw tips)                             │ │
│ │ ├───────────────────────────────────────────────────────────────────────┤ │
│ │ │ Corporate Lunch  • 12:00P–2:00P  • Gratuity 230  • Cut: Day           │ │
│ │ │   Notes: Offsite extension, minimal bar use                           │ │
│ │ └───────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 4. Enhancements Drawer

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Enhancements / Adjustments                                                    │
│ ┌───────────────────┬────────────────────────────┬───────────────────────────┐│
│ │ Wage (always on)  │ Overtime (optional input)  │ Chump Lottery              ││
│ │ Rate [ $5.00 ]     │ Amount [   ]               │ Played? (toggle)           ││
│ │ Hours [ 10.5 ]     │ Notes [   ]                │ Pot $45.75  Result Lost    ││
│ │ Total $52.50       │                            │ EV $11.43  Profit -$11.43  ││
│ ├───────────────────┴────────────────────────────┴───────────────────────────┤│
│ │ Consideration Items (list)                                                 ││
│ │ • + Add item -> {from, amount, reason}                                     ││
│ ├───────────────────────────────────────────────────────────────────────────┤│
│ │ Swindle Ledger (table)                                                     ││
│ │ From ▼House  → To ▼Night  Amount [ 80 ]  Note [Manager bump]  [Save]      ││
│ │ From ▼Night  → To ▼Me     Amount [ 65 ]  Note [Party payout] [Save]       ││
│ │ Net Summary: House -60, Night +15, Me +75 (with green/red chips)          ││
└───────────────────────────────────────────────────────────────────────────────┘
```

### 5. Charts Workspace

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Charts                                                                       │
│ Filters: [Timeframe ▾Week] [Shift Type ▾Night] [Parties ▾All]                │
│ ┌────────────────────────────┬───────────────────────────────────────────────┐│
│ │ Area Chart (Tips & Earnings per Hour)                                      ││
│ │ • Tooltip shows party icons, cut transitions                               ││
│ ├────────────────────────────┴───────────────────────────────────────────────┤│
│ │ Histogram (Hourly Earnings Distribution)                                   ││
│ │ • Overlay current shift vs trailing 30 shifts                               ││
│ ├───────────────────────────────────────────────────────────────────────────┤│
│ │ Stacked Bar (Income Streams per Recent Shift)                              ││
│ │ • Interactable bars; click → drill into shift                              ││
│ └───────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────┘
```

### 6. Color & Styling Notes

- **Palette:** Charcoal base (#12141A), glass panels (#1B1F2A @ 85% opacity), accents in electric cyan (#4DD0E1) and magenta (#FF5C93).
- **Typography:** Sans-serif with high contrast; headings in semi-bold, body light. Neon glow on primary CTAs.
- **Components:**
  - Pills for statuses (`Pending`, `Estimated`, `Confirmed`).
  - Accordion cards with subtle scale + glow on hover.
  - Charts in muted tones with active line highlighting.
- **Icons:** Lightweight line icons for cuts, parties, coworkers, adjustments. Tooltips explaining estimated vs pending.

### 7. Interaction Highlights

- Tips quick input automatically syncs with Day/Mid/Night cards, prompts user to “assign to cut” if ambiguous.
- Coworker row supports quick duplication (“Use usual closing crew”).
- Party cards show linkage to cuts with breadcrumb (e.g., “Feeds: [Day Cut]”).
- Swindle ledger updates net summary and highlights impacted entities in real time.
- Charts respond to hover over shift cards (sync with summary metrics).

These mockups serve as the blueprint for implementing the dark, sleek redesign while preserving flexibility for partial data entry and advanced tip-pool logic.
