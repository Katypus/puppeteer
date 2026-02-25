import json
import time
import random
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from backend.llama_functs import running_prompt, summarize_page, query_llama, build_prompt, validate_action, execute_action
from db import SessionLocal
from models import User, Persona
import uuid
import json

# -------------------------
# CONFIG
# -------------------------

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3"

ALLOWED_ACTIONS = {"click", "scroll", "wait", "search", "exit"}

# -------------------------
# MAIN TEST
# -------------------------

def main():
    
    # use db session local to get Brad from database
    session = SessionLocal()
    persona = get_persona_by_name(session, "Brad")
    print(persona.name, persona.persona_json)

    driver = webdriver.Chrome()

    driver.get("https://duckduckgo.com")
    time.sleep(15)
    page = summarize_page(driver)
    print("\nPAGE SUMMARY:\n", json.dumps(page, indent=2))
    prompt = running_prompt(persona, page)
    print("\nPROMPT:\n", json.dumps(prompt, indent=2))
    action = query_llama(prompt)
    if not validate_action(action):
        print("❌ Invalid action from model")
        driver.quit()
        return
    execute_action(driver, action)
    for i in range(0, 5):
        time.sleep(15)

        page = summarize_page(driver)
        print("\nPAGE SUMMARY:\n", json.dumps(page, indent=2))

        prompt = running_prompt(persona, page)
        print("\nPROMPT:\n", json.dumps(prompt, indent=2))
        action = query_llama(prompt)

        if not validate_action(action):
            print("❌ Invalid action from model")
            driver.quit()
            return

        execute_action(driver, action)
    driver.quit()

def get_persona_by_name(session, name: str):
    return (
        session.query(Persona)
        .filter(Persona.name == name)
        .first()
    )
if __name__ == "__main__":
    main()