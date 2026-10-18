import sys
from pathlib import Path

repository_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repository_root / "backend"))

from app.main import app

app.frontend("/", directory="frontend/dist")
