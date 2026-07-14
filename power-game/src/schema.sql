-- POWER 2.0 schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS politicians (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  party TEXT NOT NULL DEFAULT 'Independent',
  state TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  theme_song TEXT DEFAULT '',

  -- resources
  power NUMERIC NOT NULL DEFAULT 10,
  funds NUMERIC NOT NULL DEFAULT 1000,
  state_influence NUMERIC NOT NULL DEFAULT 0,   -- 0-100, per state
  national_influence NUMERIC NOT NULL DEFAULT 0,
  reputation NUMERIC NOT NULL DEFAULT 0,

  last_power_update TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- current standing
  current_office TEXT DEFAULT NULL,   -- 'house' | 'senate' | 'president' | NULL
  current_office_state TEXT DEFAULT NULL,
  current_office_seat INTEGER DEFAULT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Past titles held, for the profile page
CREATE TABLE IF NOT EXISTS title_history (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  state TEXT,
  seat_number INTEGER,
  term_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_end TIMESTAMPTZ
);

-- A race = a seat up for election
CREATE TABLE IF NOT EXISTS races (
  id SERIAL PRIMARY KEY,
  office_type TEXT NOT NULL,      -- 'house' | 'senate' | 'president'
  state TEXT,                     -- NULL for president
  seat_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'closed'
  entry_cost_power NUMERIC NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL,
  winner_id INTEGER REFERENCES politicians(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  vote_share NUMERIC NOT NULL DEFAULT 0,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(race_id, politician_id)
);

CREATE TABLE IF NOT EXISTS actions_log (
  id SERIAL PRIMARY KEY,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,   -- 'rally' | 'ad' | 'fundraise' | 'attack_ad'
  detail TEXT,
  power_cost NUMERIC NOT NULL DEFAULT 0,
  funds_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sponsor_id INTEGER NOT NULL REFERENCES politicians(id),
  status TEXT NOT NULL DEFAULT 'house_vote', -- 'house_vote'|'senate_vote'|'president_desk'|'signed'|'vetoed'|'failed'
  house_yes INTEGER NOT NULL DEFAULT 0,
  house_no INTEGER NOT NULL DEFAULT 0,
  senate_yes INTEGER NOT NULL DEFAULT 0,
  senate_no INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  chamber TEXT NOT NULL,   -- 'house' | 'senate'
  vote TEXT NOT NULL,      -- 'yes' | 'no'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bill_id, politician_id)
);

CREATE INDEX IF NOT EXISTS idx_politicians_state ON politicians(state);
CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
CREATE INDEX IF NOT EXISTS idx_candidates_race ON candidates(race_id);
