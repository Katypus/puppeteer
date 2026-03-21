from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Literal
from models import Persona
import httpx
import json
from fastapi.middleware.cors import CORSMiddleware
from personas import router as personas_router
from schema import PersonaPost, PersonaGet, PageSummary, Decision, DecideRequest

app = FastAPI()
app.include_router(personas_router)
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "persona"

# allows CORS settings for our extension to call the API without issues
app.add_middleware(
    CORSMiddleware,
    allow_origins=["moz-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------
# Prompt Builder
# -----------------------

def build_prompt(persona: Persona, page: PageSummary, history: list) -> str:
    return f"""
    Persona:
    Name: {persona.name}
    Age: {persona.age}
    Interests: {persona.interests}
    Political Index (left to right): {persona.politics}
    
    Page:
    URL: {page.url}
    Title: {page.title}
    Links: {page.links[:5]}

    (Recent actions: {history[-2:]})
    """

# got rid of risk to simplify the prompt
# -----------------------
# Ollama Query
# -----------------------

async def query_llama(prompt: str) -> str:
    # adjust timeout here
    timeout = httpx.Timeout(120.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "format": "json",   # 👈 important
                "options": {
                    "temperature": 0.0,
                    "num_predict": 50,
                    "stop": ["\n\n", "\n```", "```"]
                }
            }
        )
    print("LLAMA RAW RESPONSE:", response.text)  # 🔥 Debug print
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="LLM request failed")

    return response.json()["response"]

#TODO: update this method
def validate_decision(d: Decision) -> Decision:
    # conditional requirements
    if d.action == "search" and not isinstance(d.value, str):
        raise ValueError("search requires string 'value' query")
    if d.action == "click" and d.target is None:
        raise ValueError("click requires 'target'")
    if d.action == "type" and (d.target is None or not isinstance(d.value, str)):
        raise ValueError("type requires 'target' and string 'value'")
    return d

# -----------------------
# POST /decide
# -----------------------

@app.post("/decide", response_model=Decision)
async def decide(req: DecideRequest):
    req.page.links = [f"{i+1}. {link}" for i, link in enumerate(req.page.links)]

    prompt = build_prompt(req.persona, req.page, req.history)
    print(prompt)  # 🔥 Debug print

    raw_output = await query_llama(prompt)

    try:
        parsed = json.loads(raw_output)
        decision = Decision.model_validate(parsed)
        validate_decision(decision)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Invalid JSON from LLM",
                "raw_output": raw_output,
                "exception": str(e)
            }
        )

    # 🔥 Print to console for testing
    print("\n===== DECISION =====")
    print(decision)
    print("====================\n")

    return decision

# For exception handling
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )