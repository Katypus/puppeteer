# Combine the persona logic with Playwright actions:
from .persona_engine import next_action
from playwright.sync_api import sync_playwright

def simulate_browsing(persona, num_steps=5):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        for _ in range(num_steps):
            query = next_action(persona)
            page.goto(f"https://www.google.com/search?q={query}")
            # Maybe click on a random result:
            links = page.locator("a").all()
            if links:
                links[random.randint(0, min(len(links)-1, 10))].click()
        
        browser.close()
