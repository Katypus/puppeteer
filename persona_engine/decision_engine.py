# LLaMA integration lives here

import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.1:8b"

# method that sends llama the prompt and returns the parsed JSON response
def query_llama(prompt: str) -> dict:
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_ctx": 4096
            }
        },
        timeout=30
    )
    response.raise_for_status()

    raw = response.json()["response"]

    # IMPORTANT: enforce JSON-only output
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"LLaMA returned invalid JSON:\n{raw}")