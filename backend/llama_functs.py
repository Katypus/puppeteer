import json
import time
import random
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from urllib.parse import urlparse


# -------------------------
# PAGE SUMMARY
# -------------------------

def summarize_page(driver, max_links=5):
    noise_keywords = {
        "images", "videos", "news", "maps", "shopping",
        "sign in", "privacy", "terms", "settings",
        "feedback", "about", "advertise"
    }

    seen_urls = set()
    clean_links = []

    for el in driver.find_elements(By.TAG_NAME, "a"):
        text = el.text.strip()
        href = el.get_attribute("href")

        # Basic validation
        if not text or not href:
            continue

        if not href.startswith("http"):
            continue

        # Remove DuckDuckGo internal navigation
        if "duckduckgo.com" in href:
            continue

        # Remove short or noisy anchor text
        if len(text) < 20:
            continue

        if any(keyword in text.lower() for keyword in noise_keywords):
            continue

        # Deduplicate by URL
        if href in seen_urls:
            continue

        seen_urls.add(href)

        # Compress long anchor text
        if len(text) > 120:
            text = text[:117] + "..."

        clean_links.append({
            "text": text,
            "url": href
        })

        if len(clean_links) >= max_links:
            break

    return {
        "url": driver.current_url,
        "title": driver.title[:100],
        "links": clean_links
    }

    

# -------------------------
# LLaMA QUERY
# -------------------------

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3"

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
                "num_ctx": 4096,
                "max_tokens": 50
            } 
        },
        timeout=120
    )
    response.raise_for_status()

    raw = response.json()["response"]

    # IMPORTANT: enforce JSON-only output
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"LLaMA returned invalid JSON:\n{raw}")

# -------------------------
# PROMPT BUILDER
# -------------------------

def build_prompt(persona, page_summary):
    return f"""
SYSTEM:
You are a web-browsing persona.
You output ONE JSON action only.

RULES:
- Output valid JSON
- Define an action and a target
- No explanation outside JSON
- Allowed actions: click, scroll, wait, search, exit

Persona details:
Age: {json.dumps(persona.age)}
Race: {json.dumps(persona.race)}
Gender: {json.dumps(persona.gender)}

Persona interests:
{json.dumps(persona.interests, indent=2)}

Page summary:
{json.dumps(page_summary, indent=2)}

Make browsing decisions this person would make. Respond with JSON only.
"""

def running_prompt(persona, page_summary):
    return f"""
    Persona details: {json.dumps(persona.age)} year old {json.dumps(persona.race)} {json.dumps(persona.gender)}
    Interests: {json.dumps(persona.interests, indent=2)}
    Page summary: {json.dumps(page_summary, indent=2)}
    Make browsing decisions this person would make. Respond with JSON only.
    """
# -------------------------
# ACTION VALIDATION
# -------------------------

# Defines the action contract for personas
ALLOWED_ACTIONS = {"click", "scroll", "wait", "search", "exit"}

def validate_action(action: dict) -> bool:
    return (
        isinstance(action, dict)
        and action.get("action") in ALLOWED_ACTIONS
    )

# -------------------------
# SELENIUM EXECUTION
# -------------------------

def execute_action(driver, action):
    kind = action["action"]
    print("ACTION RECEIVED:", action)

    if kind == "click":
        text = action.get("target", "")
        links = driver.find_elements("xpath", f"//a[contains(text(), '{text}')]")
        if links:
            links[0].click()

    elif kind == "scroll":
        driver.execute_script("window.scrollBy(0, 500);")

    elif kind == "wait":
        time.sleep(random.uniform(2, 5))

    elif kind == "search":
        box = driver.find_element("name", "q")
        box.send_keys(action["target"])
        box.submit()

    elif kind == "exit":
        return False

    return True