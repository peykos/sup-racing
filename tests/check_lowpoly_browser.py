#!/usr/bin/env python3
"""Exit-code gate for the real-browser opt-in low-poly suite (not a renderer mock)."""
import argparse,json,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('report',type=Path);a=p.parse_args()
d=json.loads(a.report.read_text());checks=d.get('checks',[]);failed=[c for c in checks if not c.get('pass')]
required={'Real WebGL and water shader render','Ready menu and five GLB racers','Select leo','Select maya','Select noa','Keyboard auto paddles move the board','Full one-lap race via normal steering and paddling inputs','Results and ranking displayed','portrait menu fits','landscape menu fits','desktop menu fits','No JavaScript errors'}
missing=required-{c.get('name') for c in checks}
ok=d.get('pass') is True and len(checks)>=30 and not failed and not missing and d.get('info',{}).get('webGL',0)>=1 and not d.get('errors')
print(json.dumps({'classification':'FORMAL_BROWSER_QA_PASS' if ok else 'FORMAL_BROWSER_QA_FAIL','checks':len(checks),'passed':len(checks)-len(failed),'failed':failed,'missing':sorted(missing),'url':d.get('url'),'timestamp':d.get('timestamp')},ensure_ascii=False,indent=2))
sys.exit(0 if ok else 1)
