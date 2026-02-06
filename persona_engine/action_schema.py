# Defines the action contract for personas
ALLOWED_ACTIONS = {"click", "scroll", "wait", "search", "exit"}

def validate_action(action: dict) -> bool:
    return (
        isinstance(action, dict)
        and action.get("action") in ALLOWED_ACTIONS
    )