# spin up a Chromium browser and run a scripted session.
from playwright.sync_api import sync_playwright

def run_session():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://news.google.com/")
        print("Title:", page.title())
        browser.close()

if __name__ == "__main__":
    run_session()
