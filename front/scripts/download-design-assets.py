import concurrent.futures
import json
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parents[2]
sources = json.loads((root / 'docs/figma-asset-sources.json').read_text())
destination = root / 'front/public/figma-assets'
destination.mkdir(parents=True, exist_ok=True)

def download(item):
    name, url = item
    target = destination / name
    if not target.exists():
        with urllib.request.urlopen(url, timeout=45) as response:
            target.write_bytes(response.read())
    return name

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    results = list(pool.map(download, sources.items()))
print(f'Downloaded {len(results)} original Figma assets')

fonts = root / 'front/public/fonts'
fonts.mkdir(parents=True, exist_ok=True)
base = 'https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/'
for name, path in [('PretendardVariable.woff2', 'packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2'), ('LICENSE.txt', 'LICENSE')]:
    with urllib.request.urlopen(base + path, timeout=45) as response:
        (fonts / name).write_bytes(response.read())
print('Downloaded Pretendard v1.3.9 and license')
