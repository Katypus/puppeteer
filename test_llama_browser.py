import json
import time
import random
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

# -------------------------
# CONFIG
# -------------------------

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.1:8b"

ALLOWED_ACTIONS = {"click", "scroll", "wait", "search", "exit"}

# -------------------------
# LLaMA QUERY
# -------------------------

def query_llama(prompt: str) -> dict:
    r = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.6,
                "num_ctx": 2048
            }
        },
        timeout=30
    )
    r.raise_for_status()

    raw = r.json()["response"]
    print("\nRAW MODEL OUTPUT:\n", raw)

    return json.loads(raw)

# -------------------------
# PAGE SUMMARY
# -------------------------

def summarize_page(driver):
    links = [
        el.text.strip()
        for el in driver.find_elements(By.TAG_NAME, "a")
        if el.text.strip()
    ]

    return {
        "url": driver.current_url,
        "title": driver.title,
        "links": links[:5]
    }

# -------------------------
# PROMPT BUILDER
# -------------------------

def build_prompt(page_summary):
    return f"""
SYSTEM:
You are a simulated browsing persona.
You do NOT control a browser.
You output ONE JSON action only.

Rules:
- Output valid JSON
- No explanation outside JSON
- Allowed actions: click, scroll, wait, search, exit

Persona:
- Interests: gardening, local news
- Behavior: casual, curious
- Patience: medium

Current page:
{json.dumps(page_summary, indent=2)}

Choose ONE action.

Respond with JSON only.
"""

# -------------------------
# ACTION VALIDATION
# -------------------------

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
    target = action.get("target", "")

    print("\nEXECUTING ACTION:", action)

    if kind == "click":
        elements = driver.find_elements(
            By.XPATH, f"//a[contains(text(), '{target}')]"
        )
        if elements:
            elements[0].click()

    elif kind == "scroll":
        driver.execute_script("window.scrollBy(0, 600);")

    elif kind == "wait":
        time.sleep(random.uniform(2, 5))

    elif kind == "search":
        box = driver.find_element(By.NAME, "q")
        box.clear()
        box.send_keys(target)
        box.send_keys(Keys.RETURN)

    elif kind == "exit":
        return False

    return True

# -------------------------
# MAIN TEST
# -------------------------

def main():
    driver = webdriver.Chrome()
    driver.get("https://duckduckgo.com")

    time.sleep(2)

    page = summarize_page(driver)
    print("\nPAGE SUMMARY:\n", json.dumps(page, indent=2))

    prompt = build_prompt(page)
    action = query_llama(prompt)

    if not validate_action(action):
        print("❌ Invalid action from model")
        driver.quit()
        return

    execute_action(driver, action)

    time.sleep(5)
    driver.quit()

if __name__ == "__main__":
    main()