# PinePal database: entity relationship diagram

The MySQL database `pinepal_db` (Aiven, MySQL 8.4), as it is live on 2026-11-17 (8 tables).
GitHub draws the diagram below. To open it elsewhere, paste the `mermaid` block into
[mermaid.live](https://mermaid.live), or reverse-engineer the live database in MySQL Workbench
(Database > Reverse Engineer).

Solid lines are enforced foreign keys. The dotted line is a logical link with no foreign key:
`audit_logs` is partitioned by month, and MySQL does not allow foreign keys on partitioned tables.

```mermaid
erDiagram
    users ||--|| user_credentials : "has password (CASCADE)"
    users |o--o| farmers : "is login of (SET NULL)"
    farmers |o--o{ mobile_scans : "owns (RESTRICT, ON UPDATE CASCADE)"
    users |o--o{ mobile_scans : "saved by staff (SET NULL)"
    users |o--o{ login_history : "signs in (SET NULL)"
    users |o..o{ audit_logs : "acts (logical, no FK)"

    users {
        int id PK
        varchar username UK "3-50 chars"
        varchar email UK "optional"
        enum role "admin, officer, farmer"
        varchar name
        varchar municipality
        timestamp created_at
    }
    user_credentials {
        int user_id PK, FK
        varchar password_hash "bcrypt only (CHECK)"
        datetime updated_at
    }
    farmers {
        varchar farmer_id PK "F001, F002, ..."
        int user_id FK, UK "null until the farmer has a login"
        varchar full_name
        varchar farm_name
        varchar municipality
        decimal farm_latitude
        decimal farm_longitude
        decimal farm_size_ha "> 0"
        tinyint is_active "deactivate, never delete"
        datetime registered_at
    }
    mobile_scans {
        varchar scan_uuid PK "made on the phone"
        varchar farmer_id FK "null for a staff scan"
        int saved_by FK "staff account"
        varchar saved_by_name
        varchar farm_name "where the scan was taken"
        varchar municipality
        decimal latitude
        decimal longitude
        datetime scanned_at
        varchar predicted_label "one of 6 labels (CHECK)"
        decimal confidence "0 to 1"
        varchar second_label
        decimal second_confidence
        varchar image_source "Camera, Gallery, Web"
        varchar image_path
        datetime synced_at
        varchar verified_label "officer's answer"
        varchar verified_by
        datetime verified_at
        text notes
        varchar farmer_feedback "correct, incorrect"
        varchar farmer_label "farmer's answer"
    }
    login_history {
        int id PK
        int user_id FK
        varchar username "as typed"
        tinyint success
        varchar reason
        enum platform "web, mobile"
        varchar ip_address
        varchar user_agent
        datetime created_at
    }
    audit_logs {
        bigint id PK
        datetime created_at PK "partition key (monthly)"
        enum category "activity, login, data"
        varchar table_name
        varchar action
        varchar record_id
        int actor_id "users.id"
        varchar actor_label
        varchar ip_address
        char request_id
        varchar summary
        varchar path
        smallint status_code
        int duration_ms
        varchar platform
        varchar user_agent
        json old_values
        json new_values
    }
    scan_daily_stats {
        date day PK
        varchar municipality PK
        varchar label PK
        int scans "kept by triggers"
    }
    diseases {
        int id PK
        varchar name UK
        text symptoms
        text treatment_guide
    }
```

## Relationships

| From | To | Cardinality | On delete | Why |
| --- | --- | --- | --- | --- |
| `user_credentials.user_id` | `users.id` | 1 : 1 | CASCADE | The password hash is split from `users` (vertical partition), so pages that read users never carry it. |
| `farmers.user_id` | `users.id` | 0..1 : 0..1 (unique) | SET NULL | A farmer may have no login yet; removing a login keeps the farmer and their scans. |
| `mobile_scans.farmer_id` | `farmers.farmer_id` | 1 : many | RESTRICT, ON UPDATE CASCADE | A farmer with scans can't be deleted (deactivate instead). Null for a scan staff saved for no farmer. |
| `mobile_scans.saved_by` | `users.id` | 1 : many | SET NULL | Which staff account saved a web scan. |
| `login_history.user_id` | `users.id` | 1 : many | SET NULL | Sign-in history survives account deletion. |
| `audit_logs.actor_id` | `users.id` | 1 : many | none (logical) | Partitioned tables can't have foreign keys; the log must also outlive deleted accounts. |

`diseases` and `scan_daily_stats` stand alone. Scan labels are limited to the six model labels
by CHECK constraints rather than a foreign key, and `scan_daily_stats` is a summary of
`mobile_scans` kept up to date by triggers.

## Normalization notes

The design is in third normal form apart from these deliberate copies:

- `mobile_scans.farm_name`, `municipality`, `latitude`, `longitude` record where the scan was
  taken. They are a snapshot at scan time, so they stay correct if the farm's details change later.
- `mobile_scans.saved_by_name` keeps the staff member's name on the scan if their account is removed.
- `users.municipality` mirrors `farmers.municipality` for farmer accounts, kept in step by the
  backend (`sync_user_municipality` in `backend/farmers.py`).
- `scan_daily_stats` is a derived summary table, maintained only by triggers, so dashboard totals
  don't count every scan.

The first version's `scans` and `admin_reviews` tables and two one-off copies made before data
clean-ups were dropped on 2026-11-17 (`backend/migrate_drop_legacy.py`); their rows are kept in
the backups made before that.

Definitions: `backend/schema.sql` and the `backend/migrate_*.py` scripts.
