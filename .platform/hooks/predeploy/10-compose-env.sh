#!/bin/bash
set -euo pipefail
# EB escapes $ in generated .env values. Compose performs the expansion here;
# restore literal dollars without logging secrets or splitting on spaces/equals.
python3 - <<'PY'
from pathlib import Path
env = Path('/var/app/staging/.env')
if env.exists():
    data = env.read_text()
    env.write_text(data.replace('$$', '$'))
    env.chmod(0o600)
PY
