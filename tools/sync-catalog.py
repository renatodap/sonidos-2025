import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'data.json').read_text())
(root / 'catalog.js').write_text('window.SONIDOS_CATALOG = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
