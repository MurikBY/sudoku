import importlib
import sys
from pathlib import Path
from types import ModuleType

DEPLOY_DIR = Path(__file__).resolve().parents[2] / "deploy"


# The deploy scripts run as plain files on the host and import each other from deploy/.
def load_deploy_script(name: str) -> ModuleType:
    if str(DEPLOY_DIR) not in sys.path:
        sys.path.insert(0, str(DEPLOY_DIR))
    return importlib.import_module(name)
