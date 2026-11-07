import os
from pathlib import Path

from dotenv import dotenv_values


def settings() -> dict[str, str]:
    """Server-only settings. Development reloads local edits on each request."""
    local = dotenv_values(Path(__file__).resolve().parents[1] / '.env')
    def value(name: str, default: str = '') -> str:
        if os.getenv('NODE_ENV') == 'production':
            return os.getenv(name, default).strip()
        return (os.getenv(name) or local.get(name) or default).strip()
    return {
        'token': value('AI_SERVICE_TOKEN'),
        'api_key': value('GEMINI_API_KEY'),
        'model': value('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    }
