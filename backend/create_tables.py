import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from database import Base, engine
import models  # must import so SQLAlchemy registers models
Base.metadata.drop_all(engine)
Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully")