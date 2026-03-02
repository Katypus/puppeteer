from fastapi import FastAPI, HTTPException
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
MODEL_NAME = "phi3"

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

def build_prompt(persona: Persona, page: PageSummary) -> str:
    return f"""
You are a web browsing persona.

Persona:
- Name, Age, Gender, Race: {persona.name}, {persona.age}, {persona.gender}, {persona.race}
- Interests: {persona.interests}
- Political Index (0 is left, 10 is right): {persona.political_index}
- Risk tolerance: {persona.risk}

Current Page:
- URL: {page.url}
- Title: {page.title}
- Links: {page.links}

Choose ONE action and respond ONLY in JSON:

{{
  "action": "click" | "scroll" | "back",
  "target": "string",
  "reason": "string"
}}

Ensure the JSON is complete and properly closed.
Return valid JSON only.
"""


# -----------------------
# Ollama Query
# -----------------------

async def query_llama(prompt: str) -> str:
    timeout = httpx.Timeout(60.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "format": "json",   # 👈 important
                "options": {
                    "temperature": 0.3,
                    "num_predict": 75
                }
            }
        )
    print("LLAMA RAW RESPONSE:", response.text)  # 🔥 Debug print
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="LLM request failed")

    return response.json()["response"]


# -----------------------
# POST /decide
# -----------------------

@app.post("/decide", response_model=Decision)
async def decide(req: DecideRequest):

    prompt = build_prompt(req.persona, req.page)

    raw_output = await query_llama(prompt)

    try:
        parsed = json.loads(raw_output)
        decision = Decision(**parsed)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Invalid JSON from LLM",
                "raw_output": raw_output
            }
        )

    # 🔥 Print to console for testing
    print("\n===== DECISION =====")
    print(decision)
    print("====================\n")

    return decision