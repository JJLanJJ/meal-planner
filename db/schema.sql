CREATE TABLE IF NOT EXISTS weekly_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_label TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  ingredients_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  total_time_minutes INTEGER,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  servings INTEGER DEFAULT 3,
  image_category TEXT,
  ingredients_json TEXT NOT NULL,
  pantry_items_json TEXT,
  extra_items_json TEXT,
  steps_json TEXT NOT NULL,
  tips TEXT
);

CREATE TABLE IF NOT EXISTS pantry_staples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT
);
