import os
from dotenv import load_dotenv

load_dotenv()  # reads .env into environment variables

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Check your .env file.")
