"""Creates isolated container-test credentials, never reads the real .env files."""
from pathlib import Path
from secrets import token_hex

root = Path(__file__).resolve().parents[1]
target = root / '.env.docker.local'
password = token_hex(24)
with target.open('x', encoding='utf-8') as file:
    file.write(
        f'POSTGRES_PASSWORD={password}\n'
        f'DATABASE_URL=postgresql://moneymind:{password}@postgres:5432/moneymind\n'
        'CLIENT_URL=http://localhost:8080\nDB_SSL=false\nTRUST_PROXY_HOPS=1\n'
        f'JWT_ACCESS_SECRET={token_hex(32)}\nAI_SERVICE_TOKEN={token_hex(32)}\n'
        'GEMINI_API_KEY=\nGEMINI_MODEL=gemini-3.5-flash-lite\n'
    )
print('Created .env.docker.local with new isolated credentials (not displayed).')
