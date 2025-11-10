# Bar Tracker System - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [JSON Structure](#json-structure)
4. [Field Definitions](#field-definitions)
5. [Time Formats](#time-formats)
6. [Location System](#location-system)
7. [Cuts Explained](#cuts-explained)
8. [Coworker Tracking](#coworker-tracking)
9. [Income Streams](#income-streams)
10. [Theoretical Analysis](#theoretical-analysis)
11. [Examples](#examples)
12. [Calculation Methods](#calculation-methods)
13. [Best Practices](#best-practices)

---

## Overview

This system tracks restaurant/bar shift earnings with multiple income streams and provides theoretical analysis to identify variance from expected earnings.

### Key Features
- **Multiple tip pools** - Day, Mid, Night, and Party cuts
- **Coworker tracking** - Flexible time logging with probability-based estimates
- **Variance analysis** - Compare actual vs theoretical earnings
- **Multiple income streams** - Tips, wage, overtime, chump, consideration, swindle
- **Performance metrics** - Hourly rates, tip percentages, profit analysis

### Why This System?

You're logging **results, not doing math**. The reality:
- Someone else often calculates the split
- Methods vary (rounding, truncating, etc.)
- You're recording **outcomes**, not formulas

**What you always know:**
- ✅ Your tip amount
- ✅ Your hours worked
- ✅ Cut type (day/mid/party/night)

**What you sometimes know:**
- ⚠️ Total tips (can estimate)
- ⚠️ Total hours (can estimate)
- ⚠️ Coworker details (names, positions, times)

---

## Core Concepts

### 1. Pool Assignment, Not Time Overlap

**The Key Rule:** Bartenders earn towards the pool they're assigned to, regardless of overlap.

- **Day shift bartender** at 4pm-6:30pm → earns **Mid cut** tips
- **Night shift bartender** at 4pm-6:30pm → earns **Night cut** tips
- **Both can work simultaneously** → separate pools, separate tips

This means:
- Night shift can start as early as 3pm if a night bartender arrives
- Night pool runs parallel to Mid pool during overlap
- No conflict because they're separate tip pools
- Tips go to the pool based on **who served the customer**, not what time it is

### 2. Parallel Pools During Overlap

```
Timeline: 3pm → 6:30pm → 2am

3pm-6:30pm:
├── Mid Cut Pool (day bartenders)
└── Night Cut Pool (night bartenders arriving early)

Tips go to respective pools based on who served
```

### 3. Shift Types

**NIGHT SHIFT** (Simple)
- Single tip pool: All night shift bartenders only
- Participants: Anyone classified as "night shift bartender"
- Time range: When first night bartender starts → close
- Could be 3pm-2:30am or 6:30pm-2:30am (depends on schedule)
- Cuts: 1 (just "night")

**DAY SHIFT** (Complex)
- Can have 2-5+ cuts depending on parties
- Day cut: Bartenders + Servers (combined pool)
- Mid cut: Day bartenders only (no servers)
- Party cuts: Depends on timing (separate for each party)

---

## JSON Structure

### Minimal Example

```json
{
  "id": "shift_20241104",
  "date": "2024-11-04",
  "type": "night",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "16:00", "end": "02:30", "hours": 10.5}
  },
  
  "wage": {
    "base": 5.0,
    "hours": 10.5,
    "total": 52.50
  },
  
  "tips": {
    "_total": 327
  },
  
  "cuts": {
    "night": {
      "me": {"tips": 327, "hours": 10.5},
      "total": {"tips": 1350, "hours": 42.0},
      "share": {"pct": 24.22, "people": 4}
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "16:00-02:30", "10.5h"]
    },
    "servers": {}
  },
  
  "earnings": {
    "tips": 327,
    "wage": 52.50,
    "total": 379.50
  },
  
  "summary": {
    "earnings": 379.50,
    "hours": 10.5,
    "hourly": 36.14,
    "tips": {
      "actual": {"total": 327, "perHour": 31.14}
    }
  }
}
```

### Complete Example

```json
{
  "id": "shift_20241104",
  "date": "2024-11-04",
  "type": "night",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "16:00", "end": "02:30", "hours": 10.5},
    "present": {"start": "15:45", "end": "02:45", "hours": 11.0},
    "clock": null,
    "tips": null,
    "working": null
  },
  
  "wage": {
    "base": 5.0,
    "hours": 10.5,
    "total": 52.50
  },
  
  "tips": {
    "_total": 327
  },
  
  "cuts": {
    "night": {
      "time": {"start": "16:00", "end": "02:30", "duration": 10.5},
      "me": {"tips": 327, "hours": 10.5},
      "total": {"tips": 1350, "hours": 42.0},
      "share": {"pct": 24.22, "people": 4, "fullShifts": 4.0, "avgHours": 10.5}
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "16:00-02:30", "10.5h"],
      "ALLEN": ["Mid", "17:00-?[01:30|02:30|02:30]", "9.17h"],
      "BILL": ["Ser", "17:00-?[01:30|02:30|02:30]", "9.17h"],
      "ZOE": ["Deck", "18:00-?[01:30|02:30|02:30]", "7.67h"]
    },
    "servers": {}
  },
  
  "drinking": {
    "items": [
      {
        "name": "Surfside Seltzer",
        "code": "314",
        "abv": 4.5,
        "oz": 12,
        "sbe": 0.9,
        "type": "cocktail",
        "quantity": 4
      },
      {
        "name": "Jameson",
        "code": "5105",
        "abv": 40,
        "oz": 2,
        "sbe": 1.333,
        "type": "shot",
        "quantity": 1
      }
    ],
    "totalSBE": 4.933
  },
  
  "parties": {
    "party_20241104_1": {
      "id": "party_20241104_1",
      "name": "Johnson Wedding Reception",
      "type": "wedding",
      "cutType": "night",
      "location": "Upper",
      "time": {"start": "18:00", "end": "23:00", "duration": 5.0},
      "size": 120,
      "packages": {
        "drink": "Premium Open Bar",
        "food": "Buffet Dinner"
      },
      "contact": {
        "name": "Sarah Johnson",
        "phone": "215-555-0123",
        "email": "sjohnson@email.com"
      },
      "workers": {
        "primary": "Ian",
        "supplement": [
          {"name": "ALLEN", "pctHelp": 25, "note": "Helped with bar setup and first hour"}
        ]
      },
      "tips": {
        "gratuity": 1440.00,
        "partyTip": 20.00,
        "creditTips": 0,
        "cashTips": 15.00,
        "total": 1475.00
      }
    }
  },
  
  "chump": {
    "played": true,
    "amount": {"total": 28.50, "bills": 2.0, "coins": 26.50},
    "players": ["Ian", "ALLEN", "BILL", "ZOE"],
    "forfeits": [],
    "winner": "Ian",
    "stats": {
      "totalPlayers": 4,
      "activePlayers": 4,
      "chanceToWin": 25.0,
      "expectedValue": 7.125,
      "profit": 21.375
    }
  },
  
  "overtime": 87.50,
  
  "consideration": {
    "items": [
      {"from": "JAY", "amount": 100, "reason": "Worked his shift"},
      {"from": "ALLEN", "amount": 50, "reason": "Closed for him"}
    ],
    "net": 150
  },
  
  "swindle": {
    "total": 60,
    "movements": [
      {"from": "House", "to": "Night", "amount": 80},
      {"from": "Customer", "to": "House", "amount": 20},
      {"from": "Night", "to": "Me", "amount": 65},
      {"from": "Mid", "to": "Night", "amount": 15},
      {"from": "Expo", "to": "Night", "amount": 15},
      {"from": "Morgan", "to": "Me", "amount": 10}
    ],
    "net": {
      "House": -60,
      "Customer": -20,
      "Night": 15,
      "Mid": -15,
      "Expo": -15,
      "Morgan": -10,
      "Me": 75
    }
  },
  
  "earnings": {
    "tips": 327,
    "wage": 52.50,
    "overtime": 87.50,
    "chump": 28.50,
    "consideration": 150,
    "swindle": 60,
    "total": 705.50
  },
  
  "theoretical": {
    "cuts": {
      "night": {
        "sharePct": 24.22,
        "pool": {
          "actual": 1350,
          "theoretical": 1335,
          "difference": 15
        },
        "me": {
          "actual": 327,
          "theoretical": 323.57,
          "difference": 3.43
        }
      }
    },
    "variance": {
      "tips": {"actual": 327, "theoretical": 323.57, "difference": 3.43},
      "chump": {"actual": 28.50, "theoretical": 7.125, "difference": 21.375},
      "swindle": {"actual": 60, "theoretical": 63.43, "difference": -3.43}
    },
    "summary": {
      "actualEarnings": 705.50,
      "theoreticalEarnings": 684.13,
      "profit": 21.37,
      "profitPct": 3.12
    }
  },
  
  "summary": {
    "earnings": 705.50,
    "hours": 10.5,
    "hourly": 67.19,
    "tips": {
      "actual": {"total": 327, "perHour": 31.14},
      "theoretical": {"total": 323.57, "perHour": 30.82}
    }
  }
}
```

---

## Field Definitions

### Top Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (format: `shift_YYYYMMDD`) |
| `date` | string | Yes | ISO date format: `YYYY-MM-DD` |
| `type` | string | Yes | `"day"`, `"night"`, or `"double"` |
| `myName` | string | Yes | Your name for coworker tracking |
| `time` | object | Yes | Time tracking with multiple categories |
| `wage` | object | Yes | Hourly wage calculation |
| `tips` | object | Yes | Total tips summary |
| `cuts` | object | Yes | Breakdown of each tip pool |
| `coworkers` | object | Yes | Who you worked with |
| `drinking` | object | Optional | On-shift drinking log |
| `parties` | object | Optional | Party/event details |
| `chump` | object | Optional | Closer lottery game |
| `overtime` | number | Optional | Additional shift premium |
| `consideration` | object | Optional | Side payments |
| `swindle` | object | Optional | Tip reallocations |
| `earnings` | object | Yes | Total income breakdown |
| `theoretical` | object | Optional | Variance analysis |
| `summary` | object | Yes | High-level metrics |

### Time Object

Five categories of time tracking, each with `start`, `end`, and `hours`:

```json
"time": {
  "base": {"start": "16:00", "end": "02:30", "hours": 10.5},
  "present": {"start": "15:45", "end": "02:45", "hours": 11.0},
  "clock": null,
  "tips": null,
  "working": null
}
```

**Categories:**
1. **`base`** - Scheduled shift (default fallback)
2. **`present`** - Actual time on premises
3. **`clock`** - Official time clock (used for wage if present)
4. **`tips`** - Time earning tips (for tip pool calculation)
5. **`working`** - Productive work time

**Default behavior:** Any `null` category defaults to `base`

### Wage Object

```json
"wage": {
  "base": 5.0,
  "hours": 10.5,
  "total": 52.50
}
```

| Field | Description |
|-------|-------------|
| `base` | Hourly wage rate |
| `hours` | Hours to calculate wage (from `clock` or `base`) |
| `total` | Calculated wage: `base × hours` |

### Tips Object

```json
"tips": {
  "_total": 327
}
```

Simple summary of total tip earnings across all cuts.

### Cuts Object

Each cut has a unique key (`day`, `mid`, `night`, `party1`, etc.):

```json
"cuts": {
  "night": {
    "time": {"start": "16:00", "end": "02:30", "duration": 10.5},
    "me": {"tips": 327, "hours": 10.5},
    "total": {"tips": 1350, "hours": 42.0},
    "share": {
      "pct": 24.22,
      "people": 4,
      "fullShifts": 4.0,
      "avgHours": 10.5
    }
  }
}
```

**Cut Fields:**

| Field | Description |
|-------|-------------|
| `time` | When this cut occurred |
| `me.tips` | Your tip amount for this cut |
| `me.hours` | Your hours worked in this cut |
| `total.tips` | Total pool for this cut |
| `total.hours` | Total hours worked by all in this cut |
| `share.pct` | Your percentage (rounded to 2 decimals for display) |
| `share.people` | Number of people in the pool |
| `share.fullShifts` | Equivalent full shifts worked |
| `share.avgHours` | Average hours per person |

### Coworkers Object

```json
"coworkers": {
  "bartenders": {
    "Ian": ["Pit", "16:00-02:30", "10.5h"],
    "ALLEN": ["Mid", "17:00-?[01:30|02:30|02:30]", "9.17h"]
  },
  "servers": {
    "Sarah": ["18:00-01:00", "7.0h"]
  }
}
```

**Bartender Format:** `[location, time, hours]`
- 3 elements
- Location required (see [Location System](#location-system))

**Server Format:** `[time, hours]`
- 2 elements
- No location (servers float)

### Drinking Object (On-Shift Consumption)

```json
"drinking": {
  "items": [
    {
      "name": "Surfside Seltzer",
      "code": "314",
      "abv": 4.5,
      "oz": 12,
      "sbe": 0.9,
      "type": "cocktail",
      "quantity": 4
    },
    {
      "name": "Jameson",
      "code": "5105",
      "abv": 40,
      "oz": 2,
      "sbe": 1.333,
      "type": "shot",
      "quantity": 1
    }
  ],
  "totalSBE": 4.933
}
```

**Item Fields:**

| Field | Description |
|-------|-------------|
| `name` | Product name |
| `code` | Internal system code |
| `abv` | Alcohol by volume (%) |
| `oz` | Ounces per serving |
| `sbe` | Standard Beer Equivalent (12oz @ 5% ABV = 1.0 SBE) |
| `type` | `"beer"`, `"wine"`, `"cocktail"`, or `"shot"` |
| `quantity` | Number consumed |

**SBE Calculation:**
```
SBE = (oz × abv) / (12 × 5)
SBE = (oz × abv) / 60
```

**Examples:**
- 12oz @ 4.5% = (12 × 4.5) / 60 = 0.9 SBE
- 2oz @ 40% = (2 × 40) / 60 = 1.333 SBE
- 5oz wine @ 12% = (5 × 12) / 60 = 1.0 SBE

**Total SBE:**
Sum of (quantity × sbe) for all items:
```
Total = (4 × 0.9) + (1 × 1.333) = 4.933 SBE
```

### Parties Object (Events/Functions)

```json
"parties": {
  "party_20241104_1": {
    "id": "party_20241104_1",
    "name": "Johnson Wedding Reception",
    "type": "wedding",
    "location": "Upper",
    "time": {"start": "18:00", "end": "23:00", "duration": 5.0},
    "size": 120,
    "packages": {
      "drink": "Premium Open Bar",
      "food": "Buffet Dinner"
    },
    "contact": {
      "name": "Sarah Johnson",
      "phone": "215-555-0123",
      "email": "sjohnson@email.com"
    },
    "workers": {
      "primary": "Ian",
      "supplement": [
        {"name": "ALLEN", "pctHelp": 25, "note": "Helped with bar setup and first hour"}
      ]
    },
    "tips": {
      "gratuity": 1440.00,
      "partyTip": 20.00,
      "creditTips": 0,
      "cashTips": 15.00,
      "total": 1475.00
    }
  },
  "party_20241104_2": {
    "id": "party_20241104_2",
    "name": "Smith Birthday",
    "type": "birthday",
    "location": "Deck",
    "time": {"start": "19:00", "end": "22:00", "duration": 3.0},
    "size": 40,
    "packages": {
      "drink": "Beer & Wine Only",
      "food": "Apps Only"
    },
    "contact": {
      "name": "Mike Smith",
      "phone": "215-555-0456",
      "email": null
    },
    "workers": {
      "primary": "ZOE",
      "supplement": []
    },
    "tips": {
      "gratuity": 320.00,
      "partyTip": 0,
      "creditTips": 25.00,
      "cashTips": 0,
      "total": 345.00
    }
  }
}
```

**Party ID Format:** `party_YYYYMMDD_N` (auto-generated, N = sequence number)

**Top-Level Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated unique identifier |
| `name` | string | Easy reference name |
| `type` | string | Event type (see types below) |
| `cutType` | string | How tips are distributed: `"night"` or `"day"` |
| `location` | string | Where party is held (Pit, Mid, Ser, Deck, Upper, Main) |
| `time` | object | Start, end, duration |
| `size` | number | Number of guests |
| `packages` | object | Drink and food package info |
| `contact` | object | Party organizer contact info |
| `workers` | object | Who worked the party |
| `tips` | object | Tip breakdown from party |

**Party Types:**
- `wedding` - Wedding reception
- `birthday` - Birthday party
- `corporate` - Corporate event
- `holiday` - Holiday party
- `anniversary` - Anniversary celebration
- `graduation` - Graduation party
- `retirement` - Retirement party
- `rehearsal` - Rehearsal dinner
- `baby_shower` - Baby shower
- `bridal_shower` - Bridal shower
- `fundraiser` - Fundraising event
**Cut Type (Critical):**

Determines how party tips flow into the tip pool:

```json
"cutType": "night"  // or "day"
```

| Cut Type | How Tips Are Distributed |
|----------|--------------------------|
| `"night"` | **All party tips go to night cut pool** - All night bartenders share based on their total shift hours (not just party hours) |
| `"day"` | **Party tips added to day cut pool** - All day shift workers (bartenders + servers) share based on their hours worked during party time, even if not directly working the party |

**Examples:**

**Night Party (cutType: "night"):**
```json
{
  "cutType": "night",
  "time": {"start": "20:00", "end": "01:00", "duration": 5.0},
  "tips": {"total": 1475.00}
}
```
- Party tips ($1475) go into night cut pool
- All night bartenders share based on total shift hours
- If Ian worked 10.5h and pool total is 42h, Ian gets 25% of everything including party tips

**Day Party (cutType: "day"):**
```json
{
  "cutType": "day",
  "time": {"start": "14:00", "end": "17:00", "duration": 3.0},
  "tips": {"total": 345.00}
}
```
- Party tips ($345) added to the day cut pool (or creates a separate party cut)
- All day workers (bartenders + servers) working during 14:00-17:00 share these tips
- If Ian worked 3h, Sarah worked 2h, Mike worked 1.5h during party time, total = 6.5h
- Ian gets: $345 × (3/6.5) = $159.23
- Sarah gets: $345 × (2/6.5) = $106.15
- Mike gets: $345 × (1.5/6.5) = $79.62
- **Note:** Mike shares party tips even if he wasn't directly serving the party - he was working day shift during party hours

**Packages Object:**
```json
"packages": {
  "drink": "Premium Open Bar | Standard Open Bar | Beer & Wine Only | Cash Bar | None",
  "food": "Plated Dinner | Buffet Dinner | Apps Only | Dessert Only | None"
}
```

**Contact Object:**
```json
"contact": {
  "name": "Sarah Johnson",
  "phone": "215-555-0123",
  "email": "sjohnson@email.com"
}
```

Any field can be `null` if not available.

**Workers Object:**
```json
"workers": {
  "primary": "Ian",
  "supplement": [
    {"name": "ALLEN", "pctHelp": 25, "note": "Helped with bar setup and first hour"},
    {"name": "BILL", "pctHelp": 10, "note": "Covered bathroom break"}
  ]
}
```

| Field | Description |
|-------|-------------|
| `primary` | Main person working the party |
| `supplement` | Array of helpers with their contribution |
| `supplement.name` | Helper's name |
| `supplement.pctHelp` | Percentage of work they contributed (0-100) **for tracking only** |
| `supplement.note` | What they helped with |

**Important:** The `supplement` array is for **tracking who helped**, not for tip distribution. Tips are distributed based on the `cutType`:

- **Night party:** All party tips go to night cut, shared by all night bartenders by hours
- **Day party:** Party tips shared by hours worked during party time

The `pctHelp` field is just for your records to remember who helped and how much.

**Tips Object:**
```json
"tips": {
  "gratuity": 1440.00,
  "partyTip": 20.00,
  "creditTips": 0,
  "cashTips": 15.00,
  "total": 1475.00
}
```

| Field | Description |
|-------|-------------|
| `gratuity` | Automatic gratuity (usually 18-20% of bill) |
| `partyTip` | Additional tip left by party organizer |
| `creditTips` | Tips left on credit card |
| `cashTips` | Cash tips received |
| `total` | Sum of all tip sources |

**Linking to Cuts:**

**IMPORTANT:** How party tips flow depends on `cutType`:

**Night Party Example:**
```json
"parties": {
  "party_20241104_1": {
    "cutType": "night",
    "tips": {"total": 1475.00}
  }
}

"cuts": {
  "night": {
    "me": {"tips": 327, "hours": 10.5},
    "total": {"tips": 2825, "hours": 42.0}
  }
}
```
Party tips ($1475) are added to night pool total ($2825).  
Your share is based on your hours (10.5) vs total hours (42.0).  
You get: $2825 × (10.5/42) = $706.25 total, which includes your portion of party tips.

**Day Party Example:**
```json
"parties": {
  "party_20241104_1": {
    "cutType": "day",
    "time": {"start": "14:00", "end": "17:00", "duration": 3.0},
    "tips": {"total": 345.00}
  }
}

"cuts": {
  "party1": {
    "me": {"tips": 159.23, "hours": 3.0},
    "total": {"tips": 345, "hours": 6.5}
  }
}
```
All day workers present during 14:00-17:00 share this pool (bartenders + servers).  
Ian worked 3h during party, total hours from all day workers during party = 6.5h.  
Ian gets: $345 × (3/6.5) = $159.23.  
Other day workers (even if not serving the party directly) get shares based on their hours during 14:00-17:00.

**Cut naming:**
- Night parties: Tips go into `cuts.night` (no separate party cut)
- Day parties: Each gets its own cut (`cuts.party1`, `cuts.party2`, etc.)

### Chump Object (Closer Lottery)

```json
"chump": {
  "played": true,
  "amount": {"total": 28.50, "bills": 2.0, "coins": 26.50},
  "players": ["Ian", "ALLEN", "BILL", "ZOE"],
  "forfeits": [],
  "winner": "Ian",
  "stats": {
    "totalPlayers": 4,
    "activePlayers": 4,
    "chanceToWin": 25.0,
    "expectedValue": 7.125,
    "profit": 21.375
  }
}
```

**How it works:**
- All closers eligible
- Can forfeit (adjusts odds)
- Winner takes all
- Tracks bills vs coins separately

**Stats auto-calculated:**
- `chanceToWin` = 100% ÷ active players
- `expectedValue` = total amount ÷ active players
- `profit` = actual winnings - expected value

### Overtime

```json
"overtime": 87.50
```

Simple number representing additional shift premium or bonus pay.

### Consideration Object

Track payments for covering shifts or side deals:

```json
"consideration": {
  "items": [
    {"from": "JAY", "amount": 100, "reason": "Worked his shift"},
    {"from": "ALLEN", "amount": 50, "reason": "Closed for him"}
  ],
  "net": 150
}
```

### Swindle Object

Tracks non-standard tip movements and reallocations:

```json
"swindle": {
  "total": 60,
  "movements": [
    {"from": "House", "to": "Night", "amount": 80},
    {"from": "Customer", "to": "House", "amount": 20},
    {"from": "Night", "to": "Me", "amount": 65}
  ],
  "net": {
    "House": -60,
    "Night": 15,
    "Me": 75
  }
}
```

**Common sources:**
- `House` = Management adds/takes
- `Customer` = Outside normal tips
- Pool names = `Day`, `Mid`, `Night`, `Party1`
- `Expo` = Expo/kitchen cut
- Person names = Direct person-to-person

**Net tracking:** Shows who gained/lost from all movements

### Earnings Object

```json
"earnings": {
  "tips": 327,
  "wage": 52.50,
  "overtime": 87.50,
  "chump": 28.50,
  "consideration": 150,
  "swindle": 60,
  "total": 705.50
}
```

**Six income streams:**
1. Tips - Pool cuts
2. Wage - Hourly base pay
3. Overtime - Shift premium
4. Chump - Lottery winnings
5. Consideration - Side payments
6. Swindle - Tip reallocations

**Total = sum of all six**

### Theoretical Object

Compares what you *should* earn vs actual:

```json
"theoretical": {
  "cuts": {
    "night": {
      "sharePct": 24.22,
      "pool": {
        "actual": 1350,
        "theoretical": 1335,
        "difference": 15
      },
      "me": {
        "actual": 327,
        "theoretical": 323.57,
        "difference": 3.43
      }
    }
  },
  "variance": {
    "tips": {"actual": 327, "theoretical": 323.57, "difference": 3.43},
    "chump": {"actual": 28.50, "theoretical": 7.125, "difference": 21.375},
    "swindle": {"actual": 60, "theoretical": 63.43, "difference": -3.43}
  },
  "summary": {
    "actualEarnings": 705.50,
    "theoreticalEarnings": 684.13,
    "profit": 21.37,
    "profitPct": 3.12
  }
}
```

**Purpose:** Separates luck from advantage
- **Tips variance** - Pool rounding, swindle effects
- **Chump variance** - Luck (EV vs actual)
- **Swindle variance** - Reallocation impact

**Note:** Wage, overtime, and consideration are NOT shown in variance (they're deterministic, always match actual).

### Summary Object

```json
"summary": {
  "earnings": 705.50,
  "hours": 10.5,
  "hourly": 67.19,
  "tips": {
    "actual": {"total": 327, "perHour": 31.14},
    "theoretical": {"total": 323.57, "perHour": 30.82}
  }
}
```

High-level performance metrics:
- Overall hourly rate
- Tip rate (actual vs theoretical)

---

## Time Formats

### Coworker Time Strings

**Format:** `"start-end"`

**Three types:**

1. **Exact Time**
   ```
   "16:00-23:00"
   ```
   Definite start and end times.

2. **Estimated End Time**
   ```
   "16:00-~23:00"
   ```
   The `~` indicates the end time is estimated.

3. **Probabilistic End Time**
   ```
   "17:00-?[01:30|02:30|02:30]"
   ```
   Multiple possible end times with probability weights.

### Probability Syntax

The system counts occurrences to determine probability:

| Format | Meaning |
|--------|---------|
| `?[A\|B\|B]` | 33% chance of A, 67% chance of B |
| `?[A\|B\|B\|B]` | 25% chance of A, 75% chance of B |
| `?[A\|B\|C]` | 33% each |
| `?[A\|A\|B]` | 67% chance of A, 33% chance of B |

**Example:**
```
"17:00-?[01:30|02:30|02:30]"
```
- 1 out of 3 ends at 01:30 (33%)
- 2 out of 3 end at 02:30 (67%)
- System calculates mean: `(01:30 + 02:30 + 02:30) / 3 = 01:50`

**System behavior:**
- Auto-calculates mean for unknown times
- Uses mean for hours calculation in coworker array

---

## Location System

### Rules

**Bartenders Only:**
- Always have location (3 elements in array)
- Location determines position

**Servers:**
- No location field (2 elements in array)
- Servers float between areas

### Bartender Locations

**Main Bar Positions:**
| Code | Full Name | When to Use |
|------|-----------|-------------|
| `Pit` | Main-Pit | 3+ bartenders in Main |
| `Mid` | Main-Middle | 3+ bartenders in Main |
| `Ser` | Main-Service | 3+ bartenders in Main |
| `Main` | Main (unspecified) | 2 bartenders in Main (skip Mid) |

**Other Locations:**
| Code | Description |
|------|-------------|
| `Deck` | Deck bar |
| `Upper` | Upper bar |

### Location Logic

**Main Area Implied:**
- Write `"Pit"` not `"Main-Pit"`
- Write `"Mid"` not `"Main-Mid"`
- Write `"Ser"` not `"Main-Ser"`

**Only write `"Main"` when:**
- Not specifying sub-area
- 2 bartenders (no middle position)

### Examples

**3+ Bartenders in Main (specify areas):**
```json
"bartenders": {
  "Ian": ["Pit", "16:00-02:30", "10.5h"],
  "ALLEN": ["Mid", "17:00-02:30", "9.5h"],
  "BILL": ["Ser", "17:00-02:30", "9.5h"]
}
```

**2 Bartenders in Main (skip middle):**
```json
"bartenders": {
  "Ian": ["Pit", "16:00-02:30", "10.5h"],
  "BILL": ["Ser", "17:00-02:30", "9.5h"]
}
```

**Multiple Locations:**
```json
"bartenders": {
  "Ian": ["Pit", "16:00-02:30", "10.5h"],
  "ALLEN": ["Mid", "17:00-02:30", "9.5h"],
  "ZOE": ["Deck", "18:00-02:30", "8.5h"],
  "SARAH": ["Upper", "19:00-01:00", "6.0h"]
}
```

**Servers (no location):**
```json
"servers": {
  "Mike": ["18:00-01:00", "7.0h"],
  "Sarah": ["19:00-~00:30", "5.5h"]
}
```

---

## Cuts Explained

### Cut Types

#### 1. DAY CUT
- **Participants:** Bartenders + Servers
- **Time range:** Open (10am) → End of day cut (typically 4pm)
- **Split method:** Combined pool, hours-based
- **Reality:** You often only know your amount, not the math behind it
- **Can estimate:** Total pool by estimating hours worked by others

#### 2. MID CUT (Middle Cut)
- **Participants:** Day shift bartenders ONLY (no servers)
- **Time range:** End of day cut → End of mid (e.g., 4pm - 6:30pm)
- **Runs parallel** to night shift if night bartenders arrive during this time
- **Servers keep own tips** during this period (not in pool)

#### 3. PARTY CUTS (Party 1, Party 2, etc.)
- **Participants:** Depends on timing
  - During day shift hours: Bartenders + Servers working during party
  - During night shift hours: Added to night bartender pool
- **Multiple parties:** Each gets separate cut/payout
- **Hours counted:** Only hours actually worked during party timeframe

#### 4. NIGHT CUT
- **Participants:** Night shift bartenders only
- **Time range:** When first night bartender starts → close
- **Pool is separate** from day/mid even during overlap
- **Single pool:** All night bartenders share

### Typical Cut Scenarios

**Scenario 1: Night Shift Only**
```json
"cuts": {
  "night": {"me": {"tips": 327, "hours": 10.5}}
}
```
Cuts received: 1 (night)

**Scenario 2: Day Shift, No Parties**
```json
"cuts": {
  "day": {"me": {"tips": 85, "hours": 4.0}},
  "mid": {"me": {"tips": 120, "hours": 4.0}}
}
```
Cuts received: 2 (day, mid)

**Scenario 3: Day Shift with 2 Parties**
```json
"cuts": {
  "day": {"me": {"tips": 85, "hours": 4.0}},
  "mid": {"me": {"tips": 120, "hours": 2.5}},
  "party1": {"me": {"tips": 75, "hours": 2.0}},
  "party2": {"me": {"tips": 50, "hours": 1.5}}
}
```
Cuts received: 4 (day, mid, party1, party2)

**Scenario 4: Double Shift with 2 Parties**
```json
"cuts": {
  "day": {"me": {"tips": 85, "hours": 4.0}},
  "mid": {"me": {"tips": 120, "hours": 2.5}},
  "party1": {"me": {"tips": 75, "hours": 2.0}},
  "party2": {"me": {"tips": 50, "hours": 1.5}},
  "night": {"me": {"tips": 280, "hours": 8.5}}
}
```
Cuts received: 5 (day, mid, party1, party2, night)

---

## Coworker Tracking

### Why Track Coworkers?

- **Estimate total hours** when you don't know exact splits
- **Remember who worked** for future reference
- **Validate your estimates** against actual coworker counts
- **Build dataset** over time to improve estimates

### Flexible Coworker Logging

**If you worked NIGHT SHIFT:**
```json
"coworkers": {
  "bartenders": {
    "Ian": ["Pit", "16:00-02:30", "10.5h"],
    "ALLEN": ["Mid", "17:00-?[01:30|02:30|02:30]", "9.17h"]
  },
  "servers": {}
}
```

**If you worked DOUBLE SHIFT:**
```json
"coworkers": {
  "bartenders": {
    "Ian": ["Pit", "10:00-02:30", "16.5h"],
    "BILL": ["Pit", "10:00-18:00", "8.0h"],
    "ALLEN": ["Mid", "17:00-02:30", "9.5h"]
  },
  "servers": {
    "Sarah": ["10:00-16:00", "6.0h"],
    "Mike": ["11:00-16:00", "5.0h"]
  }
}
```

### What You Track Per Person

- Name
- Role (Bartender/Server)
- Location (Bar positions for bartenders only)
- Start time
- End time OR "Unknown" + estimated end
- Flag: Is end time actual or estimated?

---

## Income Streams

### Income vs Consumption

The system tracks both **income** (what you earn) and **consumption** (what you drink on shift).

**Income Streams (6):**
1. Tips
2. Wage
3. Overtime
4. Chump
5. Consideration
6. Swindle

**Consumption Tracking:**
- Drinking (on-shift alcohol, tracked in SBE)

---

### 1. Tips (Primary)

From tip pool cuts. Sum of all cuts:
```
tips = day + mid + party1 + party2 + night
```

**Tracked in:**
- `tips._total`
- `earnings.tips`
- `summary.tips.actual.total`

### 2. Wage (Base Pay)

Hourly wage × hours worked:
```
wage = base_rate × hours
```

**Uses `clock` hours if available, else `base` hours**

```json
"wage": {
  "base": 5.0,
  "hours": 10.5,
  "total": 52.50
}
```

### 3. Overtime (Shift Premium)

Additional pay for working extra or covering shifts:
```json
"overtime": 87.50
```

Simple number, no calculation needed.

### 4. Chump (Closer Lottery)

Winner-takes-all game among closers:
```json
"chump": {
  "amount": {"total": 28.50},
  "winner": "Ian",
  "stats": {
    "expectedValue": 7.125,
    "profit": 21.375
  }
}
```

**Profit = actual winnings - expected value**

### 5. Consideration (Side Payments)

Negotiated payments for covering shifts:
```json
"consideration": {
  "items": [
    {"from": "JAY", "amount": 100, "reason": "Worked his shift"}
  ],
  "net": 100
}
```

### 6. Swindle (Tip Reallocations)

Non-standard tip movements:
```json
"swindle": {
  "total": 60,
  "movements": [
    {"from": "House", "to": "Night", "amount": 80},
    {"from": "Night", "to": "Me", "amount": 65}
  ]
}
```

**Net effect on you:**
```
swindle.net.Me = sum of (to: "Me") - sum of (from: "Me")
```

---

## Theoretical Analysis

### Purpose

Compare what you **should** earn vs **actual** earnings to identify:
- Rounding effects
- Pool allocation errors
- Luck vs skill in chump
- Swindle impact

### Structure

```json
"theoretical": {
  "cuts": { ... },
  "variance": { ... },
  "summary": { ... }
}
```

### Cuts Analysis

For each cut, shows:
```json
"night": {
  "sharePct": 24.22,
  "pool": {
    "actual": 1350,
    "theoretical": 1335,
    "difference": 15
  },
  "me": {
    "actual": 327,
    "theoretical": 323.57,
    "difference": 3.43
  }
}
```

**Share percentage:**
- Your hours ÷ total hours
- Shown once (doesn't change between actual/theoretical)

**Pool difference:**
- How much extra came into pool (from swindle, rounding, etc.)

**Your difference:**
- How much extra you received

### Variance Analysis

Only shows **3 components that can vary:**

```json
"variance": {
  "tips": {"actual": 327, "theoretical": 323.57, "difference": 3.43},
  "chump": {"actual": 28.50, "theoretical": 7.125, "difference": 21.375},
  "swindle": {"actual": 60, "theoretical": 63.43, "difference": -3.43}
}
```

**NOT shown (always match actual):**
- Wage (deterministic: rate × hours)
- Overtime (fixed bonus)
- Consideration (negotiated amount)

### Conservation Equation

```
Actual Tips + Actual Swindle = Theoretical Tips + Theoretical Swindle
```

This must balance. If it doesn't, there's a tracking error.

**In the example:**
```
327 + 60 = 323.57 + 63.43
387 = 387 ✓
```

### Summary

```json
"summary": {
  "actualEarnings": 705.50,
  "theoreticalEarnings": 684.13,
  "profit": 21.37,
  "profitPct": 3.12
}
```

**Theoretical Total Includes:**
- Theoretical tips
- Theoretical chump (EV)
- Theoretical swindle
- Actual wage (deterministic)
- Actual overtime (deterministic)
- Actual consideration (deterministic)

**Profit Breakdown:**
- Tips: +$3.43 (rounding in your favor)
- Chump: +$21.38 (lucky win)
- Swindle: -$3.43 (gave away slightly more)
- **Net: +$21.37 (mostly luck!)**

---

## Examples

### Common Drink Codes

Reference for frequently consumed items:

| Name | Code | ABV | Oz | SBE | Type |
|------|------|-----|----|----|------|
| Surfside Seltzer | 314 | 4.5% | 12 | 0.9 | cocktail |
| Budweiser | 101 | 5.0% | 12 | 1.0 | beer |
| Jameson | 5105 | 40% | 2 | 1.333 | shot |
| Tito's Vodka | 5201 | 40% | 2 | 1.333 | shot |
| House Wine (Red) | 301 | 12% | 5 | 1.0 | wine |
| House Wine (White) | 302 | 12% | 5 | 1.0 | wine |
| IPA (7%) | 115 | 7.0% | 12 | 1.4 | beer |
| Light Beer | 102 | 4.2% | 12 | 0.84 | beer |

---

### Example 1: Simple Night Shift

```json
{
  "id": "shift_20241104",
  "date": "2024-11-04",
  "type": "night",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "18:00", "end": "02:30", "hours": 8.5}
  },
  
  "wage": {
    "base": 5.0,
    "hours": 8.5,
    "total": 42.50
  },
  
  "tips": {
    "_total": 280
  },
  
  "cuts": {
    "night": {
      "me": {"tips": 280, "hours": 8.5},
      "total": {"tips": 1120, "hours": 34.0},
      "share": {"pct": 25.0, "people": 4}
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "18:00-02:30", "8.5h"],
      "ALLEN": ["Mid", "18:00-02:30", "8.5h"],
      "BILL": ["Ser", "18:00-02:30", "8.5h"],
      "ZOE": ["Deck", "18:00-02:30", "8.5h"]
    },
    "servers": {}
  },
  
  "earnings": {
    "tips": 280,
    "wage": 42.50,
    "total": 322.50
  },
  
  "summary": {
    "earnings": 322.50,
    "hours": 8.5,
    "hourly": 37.94,
    "tips": {
      "actual": {"total": 280, "perHour": 32.94}
    }
  }
}
```

### Example 2: Day Shift with Parties

```json
{
  "id": "shift_20241105",
  "date": "2024-11-05",
  "type": "day",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "10:00", "end": "18:00", "hours": 8.0}
  },
  
  "wage": {
    "base": 5.0,
    "hours": 8.0,
    "total": 40.0
  },
  
  "tips": {
    "_total": 330
  },
  
  "cuts": {
    "day": {
      "me": {"tips": 85, "hours": 4.0},
      "total": {"tips": 950, "hours": 45.0},
      "share": {"pct": 8.89, "people": 9}
    },
    "mid": {
      "me": {"tips": 120, "hours": 2.5},
      "total": {"tips": 480, "hours": 16.0},
      "share": {"pct": 15.63, "people": 4}
    },
    "party1": {
      "me": {"tips": 75, "hours": 2.0},
      "total": {"tips": 300, "hours": 8.0},
      "share": {"pct": 25.0, "people": 4}
    },
    "party2": {
      "me": {"tips": 50, "hours": 1.5},
      "total": {"tips": 200, "hours": 6.0},
      "share": {"pct": 25.0, "people": 4}
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "10:00-18:00", "8.0h"],
      "BILL": ["Ser", "10:00-18:00", "8.0h"]
    },
    "servers": {
      "Sarah": ["10:00-16:00", "6.0h"],
      "Mike": ["11:00-16:00", "5.0h"],
      "Jenny": ["12:00-16:00", "4.0h"]
    }
  },
  
  "earnings": {
    "tips": 330,
    "wage": 40.0,
    "total": 370.0
  },
  
  "summary": {
    "earnings": 370.0,
    "hours": 8.0,
    "hourly": 46.25,
    "tips": {
      "actual": {"total": 330, "perHour": 41.25}
    }
  }
}
```

### Example 3: Night Shift with Chump and Theoretical

```json
{
  "id": "shift_20241106",
  "date": "2024-11-06",
  "type": "night",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "17:00", "end": "02:30", "hours": 9.5}
  },
  
  "wage": {
    "base": 5.0,
    "hours": 9.5,
    "total": 47.50
  },
  
  "tips": {
    "_total": 295
  },
  
  "cuts": {
    "night": {
      "me": {"tips": 295, "hours": 9.5},
      "total": {"tips": 1180, "hours": 38.0},
      "share": {"pct": 25.0, "people": 4}
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "17:00-02:30", "9.5h"],
      "ALLEN": ["Mid", "17:00-02:30", "9.5h"],
      "BILL": ["Ser", "17:00-02:30", "9.5h"],
      "ZOE": ["Deck", "17:00-02:30", "9.5h"]
    },
    "servers": {}
  },
  
  "chump": {
    "played": true,
    "amount": {"total": 45.75, "bills": 5.0, "coins": 40.75},
    "players": ["Ian", "ALLEN", "BILL", "ZOE"],
    "forfeits": [],
    "winner": "ALLEN",
    "stats": {
      "totalPlayers": 4,
      "activePlayers": 4,
      "chanceToWin": 25.0,
      "expectedValue": 11.4375,
      "profit": -11.4375
    }
  },
  
  "earnings": {
    "tips": 295,
    "wage": 47.50,
    "chump": 0,
    "total": 342.50
  },
  
  "theoretical": {
    "cuts": {
      "night": {
        "sharePct": 25.0,
        "pool": {
          "actual": 1180,
          "theoretical": 1180,
          "difference": 0
        },
        "me": {
          "actual": 295,
          "theoretical": 295,
          "difference": 0
        }
      }
    },
    "variance": {
      "tips": {"actual": 295, "theoretical": 295, "difference": 0},
      "chump": {"actual": 0, "theoretical": 11.4375, "difference": -11.4375},
      "swindle": {"actual": 0, "theoretical": 0, "difference": 0}
    },
    "summary": {
      "actualEarnings": 342.50,
      "theoreticalEarnings": 353.94,
      "profit": -11.44,
      "profitPct": -3.23
    }
  },
  
  "summary": {
    "earnings": 342.50,
    "hours": 9.5,
    "hourly": 36.05,
    "tips": {
      "actual": {"total": 295, "perHour": 31.05},
      "theoretical": {"total": 295, "perHour": 31.05}
    }
  }
}
```

**Analysis:** Lost chump, earned $11.44 less than expected (unlucky).

---

### Example 4: Day Shift with 2 Day Parties

```json
{
  "id": "shift_20241107",
  "date": "2024-11-07",
  "type": "day",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "10:00", "end": "23:00", "hours": 13.0}
  },
  
  "wage": {
    "base": 5.0,
    "hours": 13.0,
    "total": 65.0
  },
  
  "tips": {
    "_total": 550
  },
  
  "cuts": {
    "day": {
      "me": {"tips": 85, "hours": 4.0},
      "total": {"tips": 950, "hours": 45.0},
      "share": {"pct": 8.89, "people": 9}
    },
    "party1": {
      "me": {"tips": 207, "hours": 3.0},
      "total": {"tips": 345, "hours": 5.0},
      "share": {"pct": 60.0, "people": 2}
    },
    "party2": {
      "me": {"tips": 138, "hours": 2.0},
      "total": {"tips": 230, "hours": 3.33},
      "share": {"pct": 60.0, "people": 2}
    },
    "mid": {
      "me": {"tips": 120, "hours": 2.5},
      "total": {"tips": 480, "hours": 16.0},
      "share": {"pct": 15.63, "people": 4}
    }
  },
  
  "parties": {
    "party_20241107_1": {
      "id": "party_20241107_1",
      "name": "Smith Birthday",
      "type": "birthday",
      "cutType": "day",
      "location": "Deck",
      "time": {"start": "14:00", "end": "17:00", "duration": 3.0},
      "size": 40,
      "packages": {
        "drink": "Beer & Wine Only",
        "food": "Apps Only"
      },
      "contact": {
        "name": "Mike Smith",
        "phone": "215-555-0456",
        "email": null
      },
      "workers": {
        "primary": "Ian",
        "supplement": [
          {"name": "Sarah", "pctHelp": 40, "note": "Server, helped with food service"}
        ]
      },
      "tips": {
        "gratuity": 320.00,
        "partyTip": 0,
        "creditTips": 25.00,
        "cashTips": 0,
        "total": 345.00
      }
    },
    "party_20241107_2": {
      "id": "party_20241107_2",
      "name": "Corporate Lunch",
      "type": "corporate",
      "cutType": "day",
      "location": "Upper",
      "time": {"start": "12:00", "end": "14:00", "duration": 2.0},
      "size": 25,
      "packages": {
        "drink": "Cash Bar",
        "food": "Plated Lunch"
      },
      "contact": {
        "name": "David Chen",
        "phone": "215-555-0789",
        "email": "dchen@company.com"
      },
      "workers": {
        "primary": "Ian",
        "supplement": []
      },
      "tips": {
        "gratuity": 200.00,
        "partyTip": 30.00,
        "creditTips": 0,
        "cashTips": 0,
        "total": 230.00
      }
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "10:00-23:00", "13.0h"]
    },
    "servers": {
      "Sarah": ["10:00-17:00", "7.0h"],
      "Mike": ["11:00-16:00", "5.0h"]
    }
  },
  
  "earnings": {
    "tips": 550,
    "wage": 65.0,
    "total": 615.0
  },
  
  "summary": {
    "earnings": 615.0,
    "hours": 13.0,
    "hourly": 47.31,
    "tips": {
      "actual": {"total": 550, "perHour": 42.31}
    }
  }
}
```

**Analysis:** 
- Both parties were "day" cutType, so each created separate party cuts
- **Party 1 (14:00-17:00):** Ian worked 3h during party, but Sarah (2h) and Mike (partial overlap) also working day shift share these tips
  - Total hours during party from all day workers = 5h (example shown, would actually include Mike's hours too)
  - Ian got 60% because he worked 3 of the 5 total hours
  - Sarah and Mike share the remaining 40% based on their hours during 14:00-17:00
  - **Key:** Mike shares party tips even though he wasn't serving the party - he was working day shift during party time
- **Party 2 (12:00-14:00):** Similar - all day workers present during those hours share
- The `supplement` field shows who physically helped at the party, but ALL day shift workers during party hours share tips based on hours worked

---

### Example 5: Night Shift with Night Party

```json
{
  "id": "shift_20241108",
  "date": "2024-11-08",
  "type": "night",
  "myName": "Ian",
  
  "time": {
    "base": {"start": "16:00", "end": "02:30", "hours": 10.5}
  },
  
  "wage": {
    "base": 5.0,
    "hours": 10.5,
    "total": 52.50
  },
  
  "tips": {
    "_total": 706.25
  },
  
  "cuts": {
    "night": {
      "me": {"tips": 706.25, "hours": 10.5},
      "total": {"tips": 2825, "hours": 42.0},
      "share": {"pct": 25.0, "people": 4}
    }
  },
  
  "parties": {
    "party_20241108_1": {
      "id": "party_20241108_1",
      "name": "Johnson Wedding Reception",
      "type": "wedding",
      "cutType": "night",
      "location": "Upper",
      "time": {"start": "20:00", "end": "01:00", "duration": 5.0},
      "size": 120,
      "packages": {
        "drink": "Premium Open Bar",
        "food": "Buffet Dinner"
      },
      "contact": {
        "name": "Sarah Johnson",
        "phone": "215-555-0123",
        "email": "sjohnson@email.com"
      },
      "workers": {
        "primary": "Ian",
        "supplement": [
          {"name": "ALLEN", "pctHelp": 30, "note": "Helped at Upper bar during party"},
          {"name": "ZOE", "pctHelp": 20, "note": "Helped with party service"}
        ]
      },
      "tips": {
        "gratuity": 1440.00,
        "partyTip": 20.00,
        "creditTips": 0,
        "cashTips": 15.00,
        "total": 1475.00
      }
    }
  },
  
  "coworkers": {
    "bartenders": {
      "Ian": ["Pit", "16:00-02:30", "10.5h"],
      "ALLEN": ["Mid", "16:00-02:30", "10.5h"],
      "BILL": ["Ser", "16:00-02:30", "10.5h"],
      "ZOE": ["Deck", "16:00-02:30", "10.5h"]
    },
    "servers": {}
  },
  
  "earnings": {
    "tips": 706.25,
    "wage": 52.50,
    "total": 758.75
  },
  
  "summary": {
    "earnings": 758.75,
    "hours": 10.5,
    "hourly": 72.26,
    "tips": {
      "actual": {"total": 706.25, "perHour": 67.26}
    }
  }
}
```

**Analysis:**
- Wedding was "night" cutType, so $1475 party tips went into night pool
- Night pool before party: ~$1350, after party: $2825
- All 4 night bartenders share $2825 equally (10.5h each)
- Ian gets 25% = $706.25 (includes his share of party tips)
- Even though Ian was primary and ALLEN/ZOE helped, all 4 bartenders share equally based on shift hours
- The `supplement` field just tracks who physically helped at the party

---

## Calculation Methods

### Share Percentage

```
Your share % = Your hours / Total pool hours
```

**Example:**
```
Your hours: 10.5
Total hours: 42.0
Share: 10.5 / 42.0 = 0.25 = 25.0%
```

### Your Tip Amount (from percentage)

```
Your tips = Total pool × Your share %
```

**Example:**
```
Total pool: $1350
Your share: 25.0%
Your tips: $1350 × 0.25 = $337.50
```

### Total Pool (from your amount)

```
Total pool = Your tips / Your share %
```

**Example:**
```
Your tips: $327
Your share: 24.22%
Total pool: $327 / 0.2422 = $1350 (approx)
```

### Tip Rate (per hour)

```
Tip rate = Total tips / Hours worked
```

**Example:**
```
Total tips: $327
Hours: 10.5
Tip rate: $327 / 10.5 = $31.14/hour
```

### Hourly Rate (overall)

```
Hourly rate = Total earnings / Hours worked
```

**Example:**
```
Total earnings: $705.50
Hours: 10.5
Hourly rate: $705.50 / 10.5 = $67.19/hour
```

### Chump Expected Value

```
EV = Pot total / Active players
```

**Example:**
```
Pot: $28.50
Players: 4
EV: $28.50 / 4 = $7.125
```

### Chump Profit

```
Profit = Actual winnings - EV
```

**Example (won):**
```
Winnings: $28.50
EV: $7.125
Profit: $28.50 - $7.125 = +$21.375
```

**Example (lost):**
```
Winnings: $0
EV: $7.125
Profit: $0 - $7.125 = -$7.125
```

### Theoretical Pool

```
Theoretical pool = Sum of (all theoretical cuts before swindle)
```

**With swindle:**
```
Actual pool = Theoretical pool + Swindle net to pool
```

### Theoretical Your Share

```
Theoretical your share = Theoretical pool × Your share %
```

**With swindle:**
```
Actual your share = Theoretical your share + Swindle net to you
```

### Drinking SBE Calculation

**Standard Beer Equivalent (SBE):**
```
SBE = (oz × abv%) / 60
```

Where 60 = 12oz × 5% (standard beer)

**Total SBE for shift:**
```
Total SBE = Σ(quantity × sbe) for all items
```

**Example:**
```
Item 1: Surfside (4 × 0.9 SBE) = 3.6 SBE
Item 2: Jameson (1 × 1.333 SBE) = 1.333 SBE
Total: 3.6 + 1.333 = 4.933 SBE
```

**BAC Impact (rough estimate):**
```
Peak BAC ≈ (Total SBE × 0.6 oz / body_weight_lbs) × 100
```

*This is a rough estimate. Actual BAC depends on time, food, metabolism, etc.*

### Party Tip Distribution

**CRITICAL:** Tips distribution depends on `cutType`, NOT on supplement workers.

**Night Party (cutType: "night"):**
```
All party tips → Night cut pool
Shared by ALL night bartenders based on total shift hours
```

**Example:**
```
Party tips: $1475
Night pool before party: $1350
Night pool after party: $2825

Ian's shift: 10.5h
Total night hours: 42h
Ian's share: $2825 × (10.5/42) = $706.25
```

The `supplement` field just tracks who helped physically, but doesn't affect tip splits.

**Day Party (cutType: "day"):**
```
Party tips → Separate party cut (or added to day cut)
Shared by ALL day shift workers (bartenders + servers) working during party hours
Even those not directly serving the party share if they were working day shift
```

**Example:**
```
Party time: 14:00-17:00 (3 hours)
Party tips: $345

Day workers during 14:00-17:00:
- Ian (bartender): 14:00-17:00 (3h) - Working the party at Upper bar
- Sarah (server): 14:00-16:00 (2h) - Working floor, not at party
- Mike (server): 14:00-15:30 (1.5h) - Working floor, not at party
Total hours: 6.5h

Ian gets: $345 × (3/6.5) = $159.23
Sarah gets: $345 × (2/6.5) = $106.15
Mike gets: $345 × (1.5/6.5) = $79.62
```

**Key point:** Sarah and Mike share party tips even though they weren't serving the party. They were working day shift during party hours, so all their tips during that time go into the shared pool, and all party tips go into that same pool.

**Supplement Workers:**

The `supplement` array is for tracking who helped, not for calculating tips:
```json
"supplement": [
  {"name": "ALLEN", "pctHelp": 25, "note": "Helped with bar setup"}
]
```

This just means ALLEN helped with 25% of the physical work (setup, service, etc.), but tips still follow the cutType rules above.

**Linking party to cut:**
```
Night parties: No separate cut, tips go into cuts.night
Day parties:
  - party_20241104_1 → cuts.party1
  - party_20241104_2 → cuts.party2
```

**Summary:**
- **Night party:** Tips added to night pool, shared by all night bartenders by shift hours
- **Day party:** Tips create separate party cut, shared only by party workers by party hours
- **Supplement workers:** For tracking help only, doesn't change tip math

---

## Best Practices

### 1. Always Log These Minimum Fields

**Required every shift:**
- `date`, `type`, `myName`
- `time.base` (at minimum)
- `wage` (base rate and hours)
- `cuts` (at least one)
- `earnings.total`
- `summary` (hours and hourly rate)

### 2. Use Estimated Times When Necessary

Don't wait for perfect information:
```json
"ALLEN": ["Mid", "17:00-~02:00", "9.0h"]
```

Better to have an estimate than nothing.

### 3. Track Coworkers When Possible

Even partial information helps:
```json
"coworkers": {
  "bartenders": {
    "Ian": ["Pit", "16:00-02:30", "10.5h"]
  },
  "servers": {}
}
```

You can fill in more later.

### 4. Use Probability for Uncertain End Times

When you know likely scenarios:
```json
"17:00-?[01:30|02:30|02:30]"
```

System will calculate reasonable mean.

### 5. Add Theoretical Analysis When Swindle Occurs

If tips were reallocated, track it:
```json
"swindle": {
  "movements": [
    {"from": "House", "to": "Night", "amount": 50}
  ]
}
```

Then calculate theoretical to see impact.

### 6. Round for Display, Store Precise Values

**Store:**
```json
"pct": 24.222222222222
```

**Display:**
```
24.22%
```

### 7. Validate Conservation Equation

```
Actual Tips + Actual Swindle = Theoretical Tips + Theoretical Swindle
```

If this doesn't balance, check your tracking.

### 8. Estimate When You Don't Know Exact Totals

**Known:**
- Your amount: $80
- Your hours: 4.0
- Cut type: Day

**Estimate:**
1. Count coworkers: ~9 people
2. Estimate average hours: ~5 each
3. Total hours: ~45
4. Your share: 4/45 = 8.89%
5. Implied pool: $80 / 0.0889 = ~$900

### 9. Use Chump Stats to Track Luck

Over time, your chump profit should average near $0.

**If consistently positive:** You're lucky!
**If consistently negative:** You're unlucky (or forfeiting too often).

### 10. Track Drinking Responsibly

Log what you consume for personal awareness:
```json
"drinking": {
  "items": [
    {"name": "Surfside Seltzer", "code": "314", "abv": 4.5, "oz": 12, "sbe": 0.9, "type": "cocktail", "quantity": 2}
  ],
  "totalSBE": 1.8
}
```

**Monitor patterns:**
- How much do you typically drink per shift?
- Does drinking correlate with tip performance?
- Are you staying safe and in control?

**Recommended limits:**
- Under 2.0 SBE: Minimal impact
- 2.0-4.0 SBE: Moderate consumption
- Over 4.0 SBE: Consider reducing

### 11. Track Party Details for Future Reference

Parties are valuable income sources. Track them well:
```json
"parties": {
  "party_20241104_1": {
    "name": "Johnson Wedding",
    "type": "wedding",
    "size": 120,
    "tips": {"total": 1475.00}
  }
}
```

**Key details to capture:**
- Contact info (for repeat business)
- Package details (what sells well)
- Actual tips vs expected (gratuity calculations)
- Who helped (for fair tip splits)

**Pattern tracking over time:**
- Which party types tip best?
- What's average tip per guest?
- Do certain packages yield higher tips?
- Which locations are most profitable?

### 12. Build a Dataset Over Time

Track multiple shifts to identify patterns:
- Which days are busiest?
- What's your average tip rate?
- How much variance from swindle?
- Is chump worth playing?

---

## Display Formatting Rules

### Percentages
Always 2 decimals:
- `24.222222` → `24.22%`
- `3.124270` → `3.12%`
- `25.0` → `25.0%` (keep trailing zero)

### Money
2 decimals:
- `327` → `$327.00`
- `31.142857` → `$31.14`
- `0.5` → `$0.50`

### Hours
1-2 decimals as needed:
- `10.5` → `10.5h`
- `9.166667` → `9.17h`
- `8.0` → `8.0h`

### Time
24-hour format:
- `16:00` (4:00 PM)
- `02:30` (2:30 AM)
- `23:45` (11:45 PM)

---

## Summary

This system provides:
- **Complete earnings tracking** across 6 income streams
- **Flexible coworker logging** with probability-based estimates
- **Theoretical analysis** to identify variance and luck
- **Performance metrics** for tip rates and hourly earnings
- **Conservation validation** to catch tracking errors

The goal is to **log what you know**, estimate what you don't, and build a dataset over time to improve your understanding of earnings patterns.

**Key principle:** You're recording outcomes, not doing the math. The system adapts to whatever information you have available.
