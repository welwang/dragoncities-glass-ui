"""Build a source release from the repository's tracked files."""
from pathlib import Path
import hashlib
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
version = (root / 'VERSION').read_text(encoding='utf-8').splitlines()[0]
if not re.fullmatch(r'\d+\.\d+\.\d+', version):
    raise SystemExit('VERSION must start with a semantic version such as 1.0.1.')
tracked = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode('utf-8').split('\0')
files = sorted(name for name in tracked if name and name != 'SHA256SUMS')
if not files:
    raise SystemExit('No tracked source files. Add the release files to Git first.')
checksums = [hashlib.sha256((root / name).read_bytes()).hexdigest() + '  ' + name for name in files]
(root / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n', encoding='utf-8', newline='\n')
output = root / 'dist'
output.mkdir(exist_ok=True)
archive = output / f'DragonCities-Glass-UI-v{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    for name in sorted(files + ['SHA256SUMS']):
        entry = zipfile.ZipInfo(f'dragoncities-glass-ui-{version}/{name}')
        entry.create_system = 3
        entry.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        package.writestr(entry, (root / name).read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / (archive.name + '.sha256')).write_text(digest + '  ' + archive.name + '\n', encoding='utf-8', newline='\n')
print(f'Built {archive.name} ({archive.stat().st_size} bytes)')
print(f'SHA256 {digest}')
