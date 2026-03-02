from database import Base, engine
import models as models  # must import so SQLAlchemy registers models
Base.metadata.drop_all(engine)
Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully")