from backend.persona_crud import create_persona, list_private_personas, list_public_personas
import uuid

def main():
    print("1 = Create persona")
    print("2 = List my personas")
    print("3 = Browse public personas")
    choice = input("> ")
    id = "e3e07f73-b687-4f56-95ee-b4bc4c82a1d5" # existing ID in users database

    if choice == "1":
        name = input("Name: ")
        description = input("Description: ")
        persona_json = {"interests": input("What do they like? ").split(",")}
        is_public = input("Make public? (y/n): ").lower() == "y"

        p = create_persona(id, name, description, persona_json, is_public)
        print("Created:", p.id, p.name)

    elif choice == "2":
        personas = list_private_personas(id)
        for p in personas:
            print(f"{p.id}: {p.name} ({'public' if p.is_public else 'private'})")

    elif choice == "3":
        personas = list_public_personas()
        for p in personas:
            print(f"{p.id}: {p.name} by user {p.owner_id}")

if __name__ == "__main__":
    main()
