# defines execute_action: function to perform actions in browser
import time
import random

def execute_action(driver, action):
    kind = action["action"]

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