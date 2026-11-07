"""Build an Elastic Beanstalk source bundle from an explicit allowlist."""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    'docker-compose.yml', 'compose.local.yml', 'README.md',
    'api/Dockerfile', 'api/.dockerignore', 'api/server.js', 'api/package.json', 'api/package-lock.json',
    'ai-service/Dockerfile', 'ai-service/.dockerignore', 'ai-service/requirements.lock',
    'ai-service/requirements.txt', 'ai-service/README.md',
    'client/Dockerfile', 'client/.dockerignore', 'client/nginx.conf', 'client/package.json',
    'client/package-lock.json', 'client/angular.json', 'client/proxy.conf.json',
    'client/tsconfig.json', 'client/tsconfig.app.json', 'client/tsconfig.spec.json',
    'deploy/aws.env.example', 'deploy/create-local-env.py', 'deploy/package-aws.py',
    'deploy/export-database-template.cjs', 'deploy/smoke-local.cjs',
]
TREES = [
    'api/config', 'api/controllers', 'api/middleware', 'api/routes', 'api/services',
    'api/scripts', 'api/migrations', 'api/images', 'api/public', 'api/certs',
    'ai-service/app', 'client/src', 'client/public', 'deploy/db', 'docs',
    '.platform', '.ebextensions',
]
FORBIDDEN_DIRS = {'node_modules', '.venv', '__pycache__', '.git', '.angular', 'artifacts', 'dist'}
SECRET_PATTERN = re.compile(rb'AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}')


def local_secrets():
    values = set()
    for relative in ['api/.env', 'ai-service/.env', '.env.docker.local']:
        path = ROOT / relative
        if not path.exists():
            continue
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            key, sep, value = line.partition('=')
            if sep and re.search(r'(SECRET|TOKEN|PASSWORD|PASS|API_KEY)$', key.strip()):
                value = value.strip().strip('\"\'')
                if len(value) >= 12:
                    values.add(value.encode())
    return values


def main():
    files = {ROOT / name for name in FILES}
    for directory in TREES:
        files.update(path for path in (ROOT / directory).rglob('*') if path.is_file())
    payloads = {}
    secrets = local_secrets()
    for file in sorted(files):
        relative = file.relative_to(ROOT)
        if any(part in FORBIDDEN_DIRS for part in relative.parts):
            continue
        if (file.name.startswith('.env') or file.suffix in {'.log', '.pyc', '.zip'}
                or ('.local.' in file.name and relative.as_posix() != 'compose.local.yml')):
            raise ValueError(f'Forbidden file in allowlist: {relative}')
        if file.is_symlink() or not file.resolve().is_relative_to(ROOT):
            raise ValueError(f'Unexpected link: {relative}')
        data = file.read_bytes()
        if SECRET_PATTERN.search(data) or any(value in data for value in secrets):
            raise ValueError(f'Possible secret detected in {relative}; contents withheld.')
        payloads[relative.as_posix()] = data
    for required in ['docker-compose.yml', 'deploy/db/001-schema.sql', 'deploy/db/002-catalogs.sql',
                     'api/certs/rds-global-bundle.pem', 'docs/aws-deployment.md']:
        if required not in payloads:
            raise ValueError(f'Missing deployment file: {required}')
    manifest = {name: sha256(data).hexdigest() for name, data in payloads.items()}
    payloads['bundle-manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    output = ROOT / 'artifacts' / 'aws'
    output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    target = output / f'MoneyMindV-aws-{stamp}.zip'
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as bundle:
        for name, data in payloads.items():
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
            bundle.writestr(info, data)
    with zipfile.ZipFile(target) as bundle:
        if bundle.testzip() is not None:
            raise ValueError('ZIP checksum verification failed')
        assert all(sha256(bundle.read(name)).hexdigest() == digest for name, digest in manifest.items())
    if target.stat().st_size > 500 * 1024 * 1024:
        raise ValueError('Bundle exceeds the Elastic Beanstalk limit')
    digest = sha256(target.read_bytes()).hexdigest()
    target.with_suffix('.zip.sha256').write_text(f'{digest}  {target.name}\n', encoding='utf-8')
    print(json.dumps({'zip': str(target), 'files': len(payloads), 'bytes': target.stat().st_size,
                      'sha256': digest, 'known_local_secrets_detected': False}, indent=2))


if __name__ == '__main__':
    main()
