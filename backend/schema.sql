CREATE DATABASE IF NOT EXISTS pinepal_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE pinepal_db;

CREATE TABLE IF NOT EXISTS users (
  id int(11) NOT NULL AUTO_INCREMENT,
  email varchar(150) NULL,
  username varchar(50) NOT NULL,
  role enum('admin','officer','farmer') NOT NULL DEFAULT 'farmer',
  name varchar(100) NOT NULL,
  -- a farmer's is kept the same as farmers.municipality (sync_user_municipality in farmers.py)
  municipality varchar(100) NOT NULL DEFAULT '',
  -- profile photos (Cloudinary URLs, or a file in backend/uploads locally); NULL = none yet
  avatar_url varchar(500) NULL,
  cover_url varchar(500) NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Passwords, split off from users (vertical partitioning, migrate_optimization.py), so the
-- users row every page reads carries no secret. Only bcrypt hashes are accepted.
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id int(11) NOT NULL,
  password_hash varchar(255) NOT NULL,
  updated_at datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_credentials_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_credentials_bcrypt CHECK (password_hash LIKE '$2_$%')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Forgot password: one row per emailed 6-digit code (password_reset.py). Only a bcrypt hash
-- of the code is kept. A code is done once used_at is set.
CREATE TABLE IF NOT EXISTS password_resets (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  code_hash varchar(255) NOT NULL,
  attempts tinyint NOT NULL DEFAULT 0,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_password_resets_user (user_id, created_at),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_password_resets_bcrypt CHECK (code_hash LIKE '$2_$%'),
  CONSTRAINT chk_password_resets_attempts CHECK (attempts BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS diseases (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(150) NOT NULL,
  symptoms text DEFAULT NULL,
  treatment_guide text DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- One row per farmer. user_id is the farmer's login (one row per farmer account), empty for
-- farmers from the scan data who have no login yet. The farm details start blank at sign up.
-- Farmers are deactivated (is_active = 0), never deleted, so their scans stay.
CREATE TABLE IF NOT EXISTS farmers (
  farmer_id varchar(50) NOT NULL,
  user_id int(11) DEFAULT NULL,
  full_name varchar(100) NOT NULL,
  farm_name varchar(150) NOT NULL DEFAULT '',
  municipality varchar(100) NOT NULL DEFAULT '',
  farm_latitude decimal(10,7) DEFAULT NULL,
  farm_longitude decimal(10,7) DEFAULT NULL,
  farm_size_ha decimal(6,2) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  registered_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (farmer_id),
  UNIQUE KEY uq_farmers_user (user_id),
  KEY idx_farmers_municipality (municipality),
  CONSTRAINT fk_farmers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Scans synced from the mobile app (plus ones added on the web, image_source 'Web').
-- The dashboard, map and analytics all read from this table.
-- A scan belongs to a farmer, and a farmer with scans can't be deleted. A scan staff saved on
-- the web without choosing a farmer has no farmer_id, and saved_by says which staff account saved it.
CREATE TABLE IF NOT EXISTS mobile_scans (
  scan_uuid varchar(36) NOT NULL,
  farmer_id varchar(50) DEFAULT NULL,
  saved_by int(11) DEFAULT NULL,
  saved_by_name varchar(100) DEFAULT NULL,
  farm_name varchar(150) DEFAULT NULL,
  municipality varchar(100) DEFAULT NULL,
  latitude decimal(10,7) NOT NULL,
  longitude decimal(10,7) NOT NULL,
  scanned_at datetime NOT NULL,
  predicted_label varchar(50) NOT NULL,
  confidence decimal(6,4) NOT NULL,
  second_label varchar(50) DEFAULT NULL,
  second_confidence decimal(6,4) DEFAULT NULL,
  image_source varchar(20) NOT NULL,
  image_path varchar(255) NOT NULL DEFAULT '',
  synced_at datetime DEFAULT NULL,
  verified_label varchar(50) DEFAULT NULL,
  verified_by varchar(100) DEFAULT NULL,
  notes text DEFAULT NULL,
  verified_at datetime DEFAULT NULL,
  -- the farmer's own answer from the mobile app, kept apart from the officer's verified_label
  farmer_feedback varchar(10) DEFAULT NULL,
  farmer_label varchar(50) DEFAULT NULL,
  PRIMARY KEY (scan_uuid),
  KEY idx_mobile_scans_scanned_at (scanned_at),
  KEY fk_mobile_scans_farmer (farmer_id),
  CONSTRAINT fk_mobile_scans_saved_by FOREIGN KEY (saved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_mobile_scans_farmer FOREIGN KEY (farmer_id) REFERENCES farmers (farmer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Settings admins change from the web, one row each (app_settings.py): for now the mobile
-- app's download link (app_download_url).
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key varchar(64) NOT NULL,
  setting_value text DEFAULT NULL,
  updated_by int(11) DEFAULT NULL,
  updated_at datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (setting_key),
  KEY fk_app_settings_user (updated_by),
  CONSTRAINT fk_app_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Every sign-in attempt on the web and the mobile app (login_history.py). A trigger copies
-- each row into audit_logs. Only the typed username is kept, never the password.
CREATE TABLE IF NOT EXISTS login_history (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) DEFAULT NULL,
  username varchar(150) NOT NULL,
  success tinyint(1) NOT NULL,
  reason varchar(30) DEFAULT NULL,
  platform enum('web','mobile') NOT NULL,
  ip_address varchar(255) DEFAULT NULL,  -- encrypted (encryption.py)
  user_agent varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_login_history_created (created_at),
  KEY idx_login_history_user (user_id),
  CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Everything that happens: every API request (activity), every sign-in attempt (login) and
-- every change to users, farmers and mobile_scans (data). The triggers that fill it can't be
-- created from this file, so run python migrate_audit_logs.py after setup_db.py.
-- Admins see it on the Audit logs page (audit_logs.py).
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint NOT NULL AUTO_INCREMENT,
  category enum('activity','login','data') NOT NULL DEFAULT 'data',
  action varchar(20) NOT NULL,
  table_name varchar(30) DEFAULT NULL,
  record_id varchar(64) DEFAULT NULL,
  actor_id int(11) DEFAULT NULL,
  actor_label varchar(150) DEFAULT NULL,
  ip_address varchar(255) DEFAULT NULL,  -- encrypted (encryption.py)
  request_id char(32) DEFAULT NULL,
  summary varchar(255) DEFAULT NULL,
  path varchar(255) DEFAULT NULL,
  status_code smallint DEFAULT NULL,
  duration_ms int DEFAULT NULL,
  platform varchar(10) DEFAULT NULL,
  user_agent varchar(255) DEFAULT NULL,
  old_values json DEFAULT NULL,
  new_values json DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_category (category, created_at),
  KEY idx_audit_logs_record (table_name, record_id),
  KEY idx_audit_logs_actor (actor_id),
  KEY idx_audit_logs_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- After setup_db.py, run python migrate_audit_logs.py (triggers) and then
-- python migrate_optimization.py (CHECK rules, indexes, monthly partitions of audit_logs,
-- and the scan_daily_stats table with its triggers), then python create_app_user.py.
