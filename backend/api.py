from fastapi import FastAPI
from .browser_controller import run_session

app = FastAPI()

@app.get("/browse")
def browse():
    run_session()
    return {"status": "Browsing session complete"}
