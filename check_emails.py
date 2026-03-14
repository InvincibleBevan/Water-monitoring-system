import sqlite3
import os

db_paths = [
    r'c:\Users\Admin\Desktop\Monitoring-system\backend\water_quality.db',
    r'c:\Users\Admin\Desktop\Monitoring-system\water_quality.db'
]

for db_path in db_paths:
    print(f"--- Checking {db_path} ---")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            print("Tables:", [t[0] for t in tables])
            for table in [t[0] for t in tables]:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  Table '{table}' count: {count}")
                if table == 'users':
                    cursor.execute("SELECT email FROM users")
                    emails = cursor.fetchall()
                    print("  Emails:", [e[0] for e in emails])
        except Exception as e:
            print(f"Error checking {db_path}: {e}")
        finally:
            conn.close()
    else:
        print("File does not exist.")
