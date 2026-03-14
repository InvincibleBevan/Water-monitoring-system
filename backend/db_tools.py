import sqlite3
import os

DB_PATH = 'water_quality.db'

def _connect():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError("DB file not found")
    conn = sqlite3.connect(DB_PATH)
    return conn

def print_telemetry_info():
    try:
        conn = _connect()
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(telemetry_data)")
        columns = cursor.fetchall()
        print("Columns in telemetry_data:")
        for col in columns:
            print(col)

        cursor.execute("SELECT * FROM telemetry_data LIMIT 1")
        print("\nSample Data:", cursor.fetchone())
    except FileNotFoundError as e:
        print(e)
    except Exception as e:
        print("Error query DB:", e)
    finally:
        try:
            conn.close()
        except Exception:
            pass

def ensure_ai_columns():
    try:
        conn = _connect()
        cursor = conn.cursor()
        # Add missing columns if they don't exist — SQLite will raise if they already do
        try:
            cursor.execute("ALTER TABLE telemetry_data ADD COLUMN ai_label TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE telemetry_data ADD COLUMN ai_score REAL")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE telemetry_data ADD COLUMN ai_is_anomaly BOOLEAN")
        except sqlite3.OperationalError:
            pass
        conn.commit()
        print("Success: Checked/added AI columns to telemetry_data (if needed)")
    except FileNotFoundError as e:
        print(e)
    except Exception as e:
        print(f"Error updating DB: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass
