"""Show MySQL using the indexes and partitions from migrate_optimization.py (a demo).

    python explain_indexes.py

For each query the app really runs, it prints MySQL's EXPLAIN: which index it picks (key),
how many rows it expects to read (rows), and for audit_logs which monthly partitions it
opens. Each query is also run once with the index switched off (IGNORE INDEX), so you can
see the difference. With a few hundred rows both are fast; the rows column shows what
changes as the tables grow.

Read only: it changes nothing.
"""
import os

from dotenv import load_dotenv

from database import connect

load_dotenv()

# (what the app does, the query, the index it should use)
QUERIES = [
    ("Scans in a date range (dashboard, scan list, export), newest first",
     "SELECT * FROM mobile_scans WHERE scanned_at >= '2026-10-01' AND scanned_at < '2026-11-01' "
     "ORDER BY scanned_at DESC",
     "idx_mobile_scans_scanned_at"),
    ("Scans with a given diagnosis (the map's disease filter)",
     "SELECT scan_uuid, latitude, longitude FROM mobile_scans "
     "WHERE COALESCE(verified_label, predicted_label) = 'Fruit_Rot'",
     "idx_scans_final_label_date"),
    ("One farmer's scans, newest first (farmer page, phone sync)",
     "SELECT * FROM mobile_scans WHERE farmer_id = 'F-0001' ORDER BY scanned_at DESC",
     "idx_scans_farmer_date"),
    ("Audit logs of one user (the User filter)",
     "SELECT * FROM audit_logs WHERE actor_id = 1 ORDER BY created_at DESC LIMIT 25",
     "idx_audit_logs_actor_date"),
]

PARTITION_QUERY = (
    "Audit logs for one month (the date filter): only that month's partition is read",
    "SELECT * FROM audit_logs WHERE created_at >= '2026-11-01' AND created_at < '2026-12-01'",
)


def explain(cursor, sql):
    cursor.execute("EXPLAIN " + sql)
    return cursor.fetchone()


def show(label, row):
    print(f"   {label:16} key={row['key'] or 'none (reads the whole table)'}, "
          f"rows={row['rows']}, type={row['type']}")


def main():
    connection = connect(admin=True, database=os.getenv("DB_NAME"))
    cursor = connection.cursor(__import__("pymysql").cursors.DictCursor)

    print("INDEXES\n")
    for title, sql, index in QUERIES:
        print(f"* {title}")
        print(f"  {sql}")
        show("with index:", explain(cursor, sql))
        table = sql.split(" FROM ")[1].split()[0]
        show("without it:", explain(cursor, sql.replace(f"FROM {table}", f"FROM {table} IGNORE INDEX ({index})", 1)))
        print()

    title, sql = PARTITION_QUERY
    print("PARTITIONS\n")
    print(f"* {title}")
    print(f"  {sql}")
    row = explain(cursor, sql)
    print(f"   partitions read: {row['partitions']}")
    cursor.execute(
        "SELECT COUNT(*) AS n FROM information_schema.PARTITIONS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'"
    )
    print(f"   (out of {cursor.fetchone()['n']} monthly partitions)")
    connection.close()


if __name__ == "__main__":
    main()
