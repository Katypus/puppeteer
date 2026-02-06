from db import Base, engine
import models  # must import so SQLAlchemy registers models

Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully")