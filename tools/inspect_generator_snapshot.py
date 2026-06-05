import json
import sys
from pathlib import Path

project_id = sys.argv[1] if len(sys.argv) > 1 else 'p_d9060eb6c417438b'
db_path = Path('backend/storage/ava_db.json')
if not db_path.exists():
    db_path = Path('storage/ava_db.json')
if not db_path.exists():
    raise SystemExit('ava_db.json not found. Run from project root C:\\file\\ava studio or backend/storage.')

db = json.loads(db_path.read_text(encoding='utf-8'))
s = db.get('snapshots', {}).get(project_id, {}).get('generator', {})
d = s.get('data', s)
print('project=', project_id)
print('job=', json.dumps(d.get('job'), ensure_ascii=False, indent=2))
print('result=', json.dumps(d.get('result'), ensure_ascii=False, indent=2))
print('resultUrl=', d.get('resultUrl'))
gallery = d.get('gallery') or []
print('gallery_count=', len(gallery))
print('gallery_refs=')
for i, x in enumerate(gallery):
    print(i, x.get('label') or x.get('title'), x.get('createdAt'), x.get('apiPath') or x.get('url'))
