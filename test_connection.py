from config import DATABASE_URL
from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1;"))
        print("Database connected successfully:", list(result))
except Exception as e:
    print("Database connection FAILED:", e)
