-- DBPA Tracker
-- In Hostinger phpMyAdmin: select your database first, then import this file.
-- Do not create the database here. Create it in hPanel and grant the user access.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS options (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  field_key VARCHAR(40) NOT NULL,
  label VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_options_field_label (field_key, label),
  KEY idx_options_field (field_key, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  number VARCHAR(40) NOT NULL,
  strata VARCHAR(120) NOT NULL DEFAULT '',
  name VARCHAR(255) NOT NULL,
  owner VARCHAR(100) NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT '',
  program VARCHAR(100) NOT NULL DEFAULT '',
  stage VARCHAR(100) NOT NULL DEFAULT '',
  status VARCHAR(100) NOT NULL DEFAULT '',
  start_date DATE NULL,
  review VARCHAR(255) NOT NULL DEFAULT '',
  due_date DATE NULL,
  engineer VARCHAR(100) NOT NULL DEFAULT '',
  priority VARCHAR(40) NOT NULL DEFAULT '',
  issued_as VARCHAR(80) NOT NULL DEFAULT '',
  revision VARCHAR(40) NOT NULL DEFAULT '',
  issue_date DATE NULL,
  notes TEXT NULL,
  issued_only TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_projects_number (number),
  KEY idx_projects_status (status),
  KEY idx_projects_owner (owner),
  KEY idx_projects_due (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS issuances (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  issued_as VARCHAR(80) NOT NULL,
  revision VARCHAR(40) NOT NULL DEFAULT '',
  issue_date DATE NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_issuances_project (project_id, sort_order),
  CONSTRAINT fk_issuances_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO options (field_key, label, sort_order) VALUES
  ('owner', 'Unassigned', 0),
  ('owner', 'Stella', 1),
  ('owner', 'Jelly', 2),
  ('category', 'WP Design', 0),
  ('program', 'Revit', 0),
  ('program', 'CAD/SKP', 1),
  ('program', 'REVIT/SKP', 2),
  ('stage', 'Scoping', 0),
  ('stage', 'Drafting', 1),
  ('stage', 'Review', 2),
  ('stage', 'Issued', 3),
  ('status', 'New Job', 0),
  ('status', 'In Progress', 1),
  ('status', 'On Hold', 2),
  ('status', 'Approved', 3),
  ('status', 'For Update / Revision', 4),
  ('status', 'Waiting for Approval', 5),
  ('status', 'Upcoming Projects', 6),
  ('status', 'Completed', 7),
  ('engineer', 'Demo engineer A', 0),
  ('engineer', 'Demo engineer B', 1),
  ('priority', 'Low', 0),
  ('priority', 'Normal', 1),
  ('priority', 'High', 2),
  ('priority', 'Urgent', 3);
