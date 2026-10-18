import sys
from pathlib import Path

repository_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repository_root / "backend"))

# Vercel may import the root-level app.py first; the API needs backend/app instead.
existing_app_module = sys.modules.get("app")
if existing_app_module is not None and not hasattr(existing_app_module, "__path__"):
    del sys.modules["app"]

from app.main import app

app.frontend("/", directory="frontend/dist")
