# backend/persona_engine.py
import random

def next_action(persona):
    interests = persona["interests"]
    interest = random.choice(interests)
    queries = [
        f"latest {interest} news",
        f"best {interest} blogs",
        f"forums about {interest}",
    ]
    return random.choice(queries)
