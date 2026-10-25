CREATE DATABASE IF NOT EXISTS pinepal_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE pinepal_db;

CREATE TABLE IF NOT EXISTS users (
  id int(11) NOT NULL AUTO_INCREMENT,
  email varchar(150) NULL,
  username varchar(50) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role enum('admin','officer','farmer') NOT NULL DEFAULT 'farmer',
  name varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS diseases (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(150) NOT NULL,
  symptoms text DEFAULT NULL,
  treatment_guide text DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS scans (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  image_url varchar(255) NOT NULL,
  cultivar varchar(100) DEFAULT NULL,
  lot_reference varchar(100) DEFAULT NULL,
  predicted_class varchar(150) NOT NULL,
  confidence decimal(5,2) DEFAULT NULL,
  timestamp timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_scans_user (user_id),
  CONSTRAINT fk_scans_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS admin_reviews (
  review_id int(11) NOT NULL AUTO_INCREMENT,
  scan_id int(11) NOT NULL,
  verified_correct tinyint(1) DEFAULT NULL,
  corrected_label varchar(150) DEFAULT NULL,
  reviewer_id int(11) NOT NULL,
  reviewed_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (review_id),
  KEY fk_review_scan (scan_id),
  KEY fk_review_admin (reviewer_id),
  CONSTRAINT fk_review_admin FOREIGN KEY (reviewer_id) REFERENCES users (id),
  CONSTRAINT fk_review_scan FOREIGN KEY (scan_id) REFERENCES scans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
