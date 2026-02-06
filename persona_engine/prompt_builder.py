# Builds the prompt for LLaMA
import json

def build_prompt(persona, page_summary, options):
    return f"""
SYSTEM:
You are a simulated web-browsing persona.
You do NOT control a browser.
You output ONE JSON action only.

Rules:
- Output valid JSON
- No explanation outside JSON
- Allowed actions: click, scroll, wait, search, exit

Persona:
{json.dumps(persona, indent=2)}

Page summary:
{json.dumps(page_summary, indent=2)}

Visible options:
{json.dumps(options, indent=2)}

Respond with JSON only.
"""