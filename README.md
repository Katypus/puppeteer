# puppeteer

your_project/
│
├── .env # contains DATABASE_URL (not committed)
├── .gitignore
├── requirements.txt
│
├── config.py # loads env variables (including DATABASE_URL)
├── db.py # SQLAlchemy engine + SessionLocal + Base
├── models.py # SQLAlchemy ORM models
│
├── create_tables.py # run once to create DB schema
├── test_connection.py # verify DB connectivity
├── test_db_ops.py # verify DB read/write works
│
├── backend/
│ ├── **init**.py
│ ├── api.py # FastAPI endpoints (personas, auth later)
│ ├── persona_crud.py # create/list/publish personas
│ └── user_auth.py # login/register (later)
│
├── persona_engine/
│ ├── **init**.py
│ ├── persona_schema.py # defines expected persona JSON structure
│ ├── decision_engine.py # rule-based reasoning → "what to browse next"
│ ├── llm_adapter.py # optional — interface to local LLM (GPT4All, llama.cpp)
│ └── memory.py # persona remembers past browsing (later)
│
└── browser/
├── **init**.py
├── playwright_runner.py # starts Chromium + profile storage + cookies
├── browsing_loop.py # runs persona decisions in the browser
└── browser_utils.py # scrolling, clicking, timing, etc.
