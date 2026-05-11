-- =====================================================================
-- LoanGuard Database Schema — v2
-- Çalıştırma: DBeaver > Loanguard DB > SQL Editor
-- =====================================================================

-- ========================= USERS =========================
CREATE TABLE IF NOT EXISTS users (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT    UNIQUE NOT NULL,
  username      TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= PROFILES (1-1) =========================
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Kimlik
  first_name       TEXT,
  last_name        TEXT,
  phone            TEXT,
  avatar_url       TEXT,

  -- Demografik (ML & analiz için)
  age              INT,
  marital_status   TEXT,           -- bekar | evli | dul | boşanmış
  employment_type  TEXT,           -- maaşlı | serbest | işsiz | emekli
  education        TEXT,           -- ilkokul | lise | üniversite | yükseklisans
  dependents       INT DEFAULT 0,
  city             TEXT,
  monthly_income   NUMERIC,        -- Aylık gelir
  risk_tolerance   TEXT,           -- Düşük | Orta | Yüksek

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= FINANCIAL PERIODS (AY/YIL BAZLI) =========================
CREATE TABLE IF NOT EXISTS financial_periods (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  month      INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year       INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, month, year)
);

-- ========================= FINANCIAL ENTRIES (GELİR/GİDER) =========================
CREATE TABLE IF NOT EXISTS financial_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID REFERENCES financial_periods(id) ON DELETE CASCADE,

  type            TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  category        TEXT    NOT NULL,
  amount          NUMERIC NOT NULL DEFAULT 0,

  -- Analiz için kritik kolonlar
  is_fixed        BOOLEAN DEFAULT FALSE,  -- Sabit gider mi? (kira, fatura) → sabitlik oranı
  is_loan_payment BOOLEAN DEFAULT FALSE,  -- Kredi taksiti mi? → DTI hesabı

  note            TEXT,                   -- Kullanıcı notu

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= GOALS =========================
CREATE TABLE IF NOT EXISTS goals (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    REFERENCES users(id) ON DELETE CASCADE,

  title            TEXT    NOT NULL,
  category         TEXT,                  -- acil_fon | tatil | ev | araç | eğitim | diğer
  description      TEXT,

  target_amount    NUMERIC NOT NULL,
  current_amount   NUMERIC DEFAULT 0,
  monthly_target   NUMERIC,               -- Aylık katkı hedefi

  deadline         DATE,
  is_completed     BOOLEAN DEFAULT FALSE,

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= ALERTS (AKILLI UYARI SİSTEMİ) =========================
CREATE TABLE IF NOT EXISTS alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,

  rule_id      TEXT    NOT NULL,   -- low_savings | high_dti | no_emergency | ...
  level        TEXT    NOT NULL CHECK (level IN ('red', 'yellow', 'green')),
  title        TEXT    NOT NULL,
  message      TEXT    NOT NULL,

  is_read      BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,

  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= INVESTMENT PROFILES (RİSK PROFİLİ) =========================
CREATE TABLE IF NOT EXISTS investment_profiles (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID    UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  risk_score               INT,                      -- 0-100 arası ham skor
  risk_level               TEXT,                     -- conservative | moderate | aggressive
  questionnaire_answers    JSONB,                    -- Anket cevapları
  recommended_instruments  JSONB,                    -- Önerilen araçlar listesi

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= MONTHLY REPORTS (CACHE) =========================
CREATE TABLE IF NOT EXISTS reports (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID    REFERENCES users(id) ON DELETE CASCADE,

  month          INT     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           INT     NOT NULL CHECK (year BETWEEN 2000 AND 2100),

  health_score   NUMERIC,                -- Hesaplanan finansal sağlık skoru
  summary_data   JSONB,                  -- Tüm metrikler (dti, tasarruf vs.)
  insights       JSONB,                  -- AI tarafından üretilen yorumlar

  generated_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, month, year)
);

-- ========================= CREDIT ANALYSES (ML ÇIKTILARI) =========================
CREATE TABLE IF NOT EXISTS credit_analyses (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID    REFERENCES users(id) ON DELETE CASCADE,

  approval_probability NUMERIC,
  shap_factors         JSONB,
  counterfactuals      JSONB,

  analyzed_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= CHAT HISTORY =========================
CREATE TABLE IF NOT EXISTS chat_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,

  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content    TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================================
-- INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username         ON users(username);
CREATE INDEX IF NOT EXISTS idx_financial_periods_user ON financial_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_period ON financial_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_goals_user             ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user            ON alerts(user_id, is_dismissed, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_user      ON chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_analyses_user   ON credit_analyses(user_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user           ON reports(user_id, year DESC, month DESC);

-- =====================================================================
-- Doğrulama:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- =====================================================================
