import json
import time
import random
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from urllib.parse import urlparse

# -------------------------
# LLaMA QUERY
# -------------------------

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3"

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