-- STATESMAN 2.0 schema. Applied by scripts/init-db.js (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row world clock + economy
CREATE TABLE IF NOT EXISTS world (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_tick_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_daily_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_number INTEGER NOT NULL DEFAULT 0,
  next_cycle_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  growth DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  unemployment DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  deficit DOUBLE PRECISION NOT NULL DEFAULT 4.0,
  bill_counter INTEGER NOT NULL DEFAULT 1000
);

-- Players and NPCs share one table. NPCs have user_id NULL.
CREATE TABLE IF NOT EXISTS politicians (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_npc BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  party TEXT NOT NULL,                 -- 'D' | 'R' | 'I'
  state TEXT NOT NULL,
  district INTEGER,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  positions JSONB NOT NULL,            -- { issue: -3..3 }

  hours DOUBLE PRECISION NOT NULL DEFAULT 16,
  funds DOUBLE PRECISION NOT NULL DEFAULT 0,
  pc DOUBLE PRECISION NOT NULL DEFAULT 0,       -- political capital
  credibility DOUBLE PRECISION NOT NULL DEFAULT 70,
  approval DOUBLE PRECISION NOT NULL DEFAULT 50,
  party_standing DOUBLE PRECISION NOT NULL DEFAULT 10,
  last_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pol_state ON politicians(state);

-- Name recognition per state, 0-100
CREATE TABLE IF NOT EXISTS recognition (
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (politician_id, state)
);

-- Every elected/appointed office is a seat.
-- chamber: 'house' | 'senate' | 'president' | 'cabinet' | 'court'
CREATE TABLE IF NOT EXISTS seats (
  id SERIAL PRIMARY KEY,
  chamber TEXT NOT NULL,
  state TEXT,
  district INTEGER,
  senate_class INTEGER,
  post TEXT,                           -- cabinet post key, or court seat number
  holder_id INTEGER REFERENCES politicians(id) ON DELETE SET NULL,
  since TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seats_holder ON seats(holder_id);

CREATE TABLE IF NOT EXISTS title_history (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  term_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_end TIMESTAMPTZ
);

-- Public record of position changes (flip-flops)
CREATE TABLE IF NOT EXISTS position_record (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  issue TEXT NOT NULL,
  from_pos DOUBLE PRECISION NOT NULL,
  to_pos DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS races (
  id SERIAL PRIMARY KEY,
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  cycle INTEGER NOT NULL,
  phase TEXT NOT NULL DEFAULT 'filing',  -- filing | primary | general | closed
  filing_closes_at TIMESTAMPTZ NOT NULL,
  primary_closes_at TIMESTAMPTZ NOT NULL,
  general_closes_at TIMESTAMPTZ NOT NULL,
  winner_id INTEGER REFERENCES politicians(id),
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_races_phase ON races(phase);

CREATE TABLE IF NOT EXISTS candidates (
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  party TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'filed',  -- filed | nominee | lost_primary | withdrawn | won | lost
  primary_share DOUBLE PRECISION,
  general_share DOUBLE PRECISION,
  electoral_votes INTEGER,
  PRIMARY KEY (race_id, politician_id)
);

-- Per-race, per-state campaign strength
CREATE TABLE IF NOT EXISTS campaign (
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  awareness DOUBLE PRECISION NOT NULL DEFAULT 0,
  gotv DOUBLE PRECISION NOT NULL DEFAULT 0,
  bloc_boost JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (race_id, politician_id, state)
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  sponsor_id INTEGER REFERENCES politicians(id),
  origin TEXT NOT NULL,                -- 'house' | 'senate' | 'executive'
  kind TEXT NOT NULL,                  -- 'policy' | 'appropriation' | 'executive_order'
  issue TEXT,
  target DOUBLE PRECISION,
  prev_position DOUBLE PRECISION,
  approp_state TEXT,
  approp_amount DOUBLE PRECISION,
  status TEXT NOT NULL,                -- house_floor | senate_floor | president | override | law | failed | vetoed | tabled | struck | repealed
  stage_deadline TIMESTAMPTZ,
  filibuster BOOLEAN NOT NULL DEFAULT false,
  tally JSONB NOT NULL DEFAULT '{}',   -- { house: {yes,no,missed}, senate: {...}, override_house, override_senate }
  whip JSONB NOT NULL DEFAULT '{}',    -- { "D:house": {line:'yes', hard:true}, ... }
  history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  became_law_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

CREATE TABLE IF NOT EXISTS bill_votes (
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,                 -- house | senate | override_house | override_senate
  vote TEXT NOT NULL,                  -- yes | no | missed
  alignment DOUBLE PRECISION,                   -- 0..1 how well this vote served the member's constituents
  against_whip BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bill_id, politician_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_votes_pol ON bill_votes(politician_id, created_at);

-- Backroom deals: a player paid to flip an NPC's vote
CREATE TABLE IF NOT EXISTS vote_deals (
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  npc_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  by_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  PRIMARY KEY (bill_id, npc_id)
);

CREATE TABLE IF NOT EXISTS national_policy (
  issue TEXT PRIMARY KEY,
  position DOUBLE PRECISION NOT NULL,
  law_id INTEGER REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS appropriations (
  id SERIAL PRIMARY KEY,
  state TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  bill_id INTEGER REFERENCES bills(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Party offices: 'D:chair', 'D:house_leader', 'D:house_whip', 'D:senate_leader', 'D:senate_whip', ...
CREATE TABLE IF NOT EXISTS party_roles (
  role TEXT PRIMARY KEY,
  holder_id INTEGER REFERENCES politicians(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS role_endorsements (
  endorser_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  candidate_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  PRIMARY KEY (endorser_id, role)
);
CREATE TABLE IF NOT EXISTS parties (
  code TEXT PRIMARY KEY,
  treasury DOUBLE PRECISION NOT NULL DEFAULT 0,
  dues DOUBLE PRECISION NOT NULL DEFAULT 0       -- per day, paid by player members
);
CREATE TABLE IF NOT EXISTS party_endorsements (  -- chair endorses a candidate in a primary
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  party TEXT NOT NULL,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  PRIMARY KEY (race_id, party)
);

CREATE TABLE IF NOT EXISTS nominations (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,                  -- cabinet | court
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  nominee_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  president_id INTEGER REFERENCES politicians(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | withdrawn
  deadline TIMESTAMPTZ NOT NULL,
  yes INTEGER NOT NULL DEFAULT 0,
  no INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nomination_votes (
  nomination_id INTEGER NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  PRIMARY KEY (nomination_id, politician_id)
);

CREATE TABLE IF NOT EXISTS court_cases (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  filed_by INTEGER REFERENCES politicians(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | upheld | struck
  deadline TIMESTAMPTZ NOT NULL,
  uphold INTEGER NOT NULL DEFAULT 0,
  strike INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS case_votes (
  case_id INTEGER NOT NULL REFERENCES court_cases(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,                  -- uphold | strike
  PRIMARY KEY (case_id, politician_id)
);

-- Dirt
CREATE TABLE IF NOT EXISTS skeletons (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  severity INTEGER NOT NULL,           -- 1..5
  public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dossiers (
  owner_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  skeleton_id INTEGER NOT NULL REFERENCES skeletons(id) ON DELETE CASCADE,
  found_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, skeleton_id)
);

-- Temporary approval modifiers (scandals, town halls, initiatives)
CREATE TABLE IF NOT EXISTS approval_mods (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inbox_pol ON inbox(politician_id, created_at DESC);

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  headline TEXT NOT NULL,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions_log (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
