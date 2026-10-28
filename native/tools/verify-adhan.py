#!/usr/bin/env python3
"""Verify the complete adhan download library and the two offline APK recordings."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--require-all', action='store_true', help='Require all 21 public download files')
args = parser.parse_args()
catalog = json.loads((root / 'native/shared/adhan-catalog.json').read_text())
voices = catalog['voices']
assert len(voices) == 21
assert sum(not voice['fajr'] for voice in voices) == 20
assert sum(voice['fajr'] for voice in voices) == 1
assert len({voice['id'] for voice in voices}) == 21
assert len({voice['sha256'] for voice in voices}) == 21
checked = 0
for voice in voices:
    candidates = [root / 'public/android/adhan' / (voice['id'] + '.mp3')]
    if voice['bundled']:
        candidates.append(root / 'native/shared/adhan' / (voice['id'] + '.mp3'))
    for path in candidates:
        if not path.exists() and not args.require_all and 'public' in path.parts:
            continue
        content = path.read_bytes()
        assert len(content) == voice['bytes'], path
        assert hashlib.sha256(content).hexdigest() == voice['sha256'], path
        checked += 1
print(json.dumps({'voices': 20, 'fajrRecordings': 1, 'verifiedFiles': checked}))
