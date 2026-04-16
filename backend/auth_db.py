import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "auth.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                provider TEXT DEFAULT 'local'
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def create_user(name: str, email: str, password: str, provider: str = 'local') -> None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password, provider) VALUES (?, ?, ?, ?)",
            (name, email, password, provider)
        )
        conn.commit()
    finally:
        conn.close()


def find_user(email: str) -> dict | None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()
