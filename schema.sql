PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  logo_key TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_centers_created ON centers(created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  center_id TEXT REFERENCES centers(id),
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin','center_admin','supervisor','specialist')),
  specialty TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  photo_key TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_center ON users(center_id,role,active);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS login_limits (
  id TEXT PRIMARY KEY,
  failed INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT DEFAULT '',
  guardian_name TEXT DEFAULT '',
  guardian_phone TEXT DEFAULT '',
  diagnosis TEXT DEFAULT '',
  iq_score TEXT DEFAULT '',
  case_summary TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(center_id, code)
);
CREATE INDEX IF NOT EXISTS idx_children_center ON children(center_id,active,name);

CREATE TABLE IF NOT EXISTS child_tests (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  child_id TEXT NOT NULL REFERENCES children(id),
  test_name TEXT NOT NULL,
  result TEXT NOT NULL,
  test_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tests_child ON child_tests(center_id,child_id);

CREATE TABLE IF NOT EXISTS assignments (
  center_id TEXT NOT NULL REFERENCES centers(id),
  child_id TEXT NOT NULL REFERENCES children(id),
  specialist_id TEXT NOT NULL REFERENCES users(id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(child_id,specialist_id)
);
CREATE INDEX IF NOT EXISTS idx_assign_specialist ON assignments(center_id,specialist_id);

CREATE TABLE IF NOT EXISTS session_records (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  child_id TEXT NOT NULL REFERENCES children(id),
  specialist_id TEXT NOT NULL REFERENCES users(id),
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
  goals TEXT NOT NULL,
  activities TEXT DEFAULT '',
  child_response TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  next_plan TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_center_month ON session_records(center_id,started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_specialist ON session_records(center_id,specialist_id,started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_child ON session_records(center_id,child_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  center_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_center ON audit_logs(center_id,created_at DESC);

-- Additive upgrade for Taheel +. Existing tables and data remain unchanged.
CREATE TABLE IF NOT EXISTS staff_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), center_id TEXT NOT NULL REFERENCES centers(id), gender TEXT NOT NULL DEFAULT 'male' CHECK(gender IN ('male','female')), employee_code TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS session_revisions (id TEXT PRIMARY KEY,center_id TEXT NOT NULL REFERENCES centers(id),session_id TEXT NOT NULL REFERENCES session_records(id),edited_by TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL DEFAULT '',before_json TEXT NOT NULL,after_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_session_revision ON session_revisions(center_id,session_id,created_at);
CREATE TABLE IF NOT EXISTS session_reviews (session_id TEXT PRIMARY KEY REFERENCES session_records(id),center_id TEXT NOT NULL REFERENCES centers(id),status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','needs_review','archived')),note TEXT NOT NULL DEFAULT '',updated_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS session_numbers (session_id TEXT PRIMARY KEY REFERENCES session_records(id),center_id TEXT NOT NULL REFERENCES centers(id),session_number INTEGER NOT NULL CHECK(session_number BETWEEN 1 AND 25));
CREATE TABLE IF NOT EXISTS case_notes (id TEXT PRIMARY KEY,center_id TEXT NOT NULL REFERENCES centers(id),child_id TEXT NOT NULL REFERENCES children(id),author_id TEXT NOT NULL REFERENCES users(id),note TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_case_notes ON case_notes(center_id,child_id,created_at);

-- Additive evaluation module: safe to apply on an existing Turso database.
CREATE TABLE IF NOT EXISTS assessment_settings (center_id TEXT PRIMARY KEY REFERENCES centers(id),specialist_enabled INTEGER NOT NULL DEFAULT 0 CHECK(specialist_enabled IN (0,1)));
CREATE TABLE IF NOT EXISTS assessment_records (id TEXT PRIMARY KEY,center_id TEXT NOT NULL REFERENCES centers(id),child_id TEXT NOT NULL REFERENCES children(id),program_id TEXT NOT NULL,catalog_version TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','completed','approved')),plan_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,finalized_at TEXT,approved_at TEXT,approved_by TEXT REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_assessments_center_child ON assessment_records(center_id,child_id,created_at DESC);
CREATE TABLE IF NOT EXISTS assessment_answers (assessment_id TEXT NOT NULL REFERENCES assessment_records(id),goal_id TEXT NOT NULL,rating TEXT NOT NULL CHECK(rating IN ('mastered','assisted','not_mastered','not_tested','not_applicable')),note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(assessment_id,goal_id));

-- إعداد مكتبة البنود الخاصة بكل مركز؛ البنود المستخرجة لا تعتمد تلقائيًا.
CREATE TABLE IF NOT EXISTS assessment_library_items (center_id TEXT NOT NULL REFERENCES centers(id),program_id TEXT NOT NULL,goal_id TEXT NOT NULL,domain_id TEXT NOT NULL,domain_name TEXT NOT NULL,title TEXT NOT NULL,source_file TEXT NOT NULL,source_page INTEGER NOT NULL,source_number TEXT NOT NULL DEFAULT '',review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved')),reviewed_by TEXT,reviewed_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(center_id,program_id,goal_id));
CREATE INDEX IF NOT EXISTS idx_assessment_library_program ON assessment_library_items(center_id,program_id,review_status);
CREATE TABLE IF NOT EXISTS assessment_catalog_snapshots (assessment_id TEXT PRIMARY KEY REFERENCES assessment_records(id),domains_json TEXT NOT NULL);

-- منصة تأهيل +: مكتبة واحدة يراجعها مدير المنصة؛ لا تتكرر لكل مركز.
CREATE TABLE IF NOT EXISTS assessment_global_library_items (
 program_id TEXT NOT NULL, goal_id TEXT NOT NULL, domain_id TEXT NOT NULL, domain_name TEXT NOT NULL, title TEXT NOT NULL,
 source_file TEXT NOT NULL,source_page INTEGER NOT NULL DEFAULT 0,source_number TEXT NOT NULL DEFAULT '',
 source_paragraph INTEGER NOT NULL DEFAULT 0,source_section TEXT NOT NULL DEFAULT '',age_label TEXT NOT NULL DEFAULT '',review_flags TEXT NOT NULL DEFAULT '[]',
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved')),
 reviewed_by TEXT REFERENCES users(id),reviewed_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(program_id,goal_id));
CREATE INDEX IF NOT EXISTS idx_assessment_global_library ON assessment_global_library_items(program_id,review_status);

-- Independent per-specialist evaluation delegation. Viewing approved plans is separate from evaluation rights.
CREATE TABLE IF NOT EXISTS assessment_specialist_permissions (
 center_id TEXT NOT NULL REFERENCES centers(id),specialist_id TEXT NOT NULL REFERENCES users(id),
 can_evaluate INTEGER NOT NULL DEFAULT 0 CHECK(can_evaluate IN (0,1)),
 changed_by TEXT REFERENCES users(id),updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(center_id,specialist_id)
);

-- Optional goal edits: audit trail for the platform administrator only.
CREATE TABLE IF NOT EXISTS assessment_library_changes (
 id TEXT PRIMARY KEY,program_id TEXT NOT NULL,goal_id TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),
 actor_name TEXT NOT NULL,old_title TEXT NOT NULL,new_title TEXT NOT NULL,old_domain TEXT NOT NULL,new_domain TEXT NOT NULL,
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_assessment_library_changes ON assessment_library_changes(program_id,goal_id,changed_at DESC);
