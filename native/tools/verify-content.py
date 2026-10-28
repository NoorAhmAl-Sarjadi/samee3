#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,gzip

NATIVE=Path(__file__).resolve().parents[1]
SHARED=NATIVE/'shared'
catalog=json.loads((SHARED/'catalog.json').read_text())['readings']
total=0
for row in catalog:
    path=SHARED/'content'/f"{row['id']}.json";raw=path.read_bytes();book=json.loads(raw)
    assert hashlib.sha256(raw).hexdigest()==row['sha256']
    assert book['id']==row['id'] and len(book['pages'])==604 and len(book['surahs'])==114 and len(book['juzStarts'])==30
    verses={}
    for page,items in enumerate(book['pages'],1):
        assert items,(row['id'],page)
        for verse in items:
            key=(verse['s'],verse['a']);assert key not in verses
            assert verse['text'].strip() and 1<=verse['s']<=114 and verse['a']>=1 and 1<=verse['juz']<=30
            verses[key]=(page,verse['text'],verse['refs'])
    assert len(verses)==row['verses'];total+=len(verses)
    for start in book['juzStarts']:
        assert verses[(start['surah'],start['ayah'])][0]==start['page']
    assert book['juzStarts'][10]['surah']==9
    # When this tool runs inside the original repository, additionally compare
    # every Unicode codepoint with the source snapshot used for the build.
    webroot=NATIVE.parent
    source=webroot/'data/mushaf'/f"{row['id']}.text.json.gz"
    cached=webroot.parent/'qa/native-sources'/f"{row['id']}.json"
    original=gzip.decompress(source.read_bytes()) if source.exists() else cached.read_bytes() if cached.exists() else None
    if original is not None:
        assert hashlib.sha256(original).hexdigest()==row['sourceSha256']
        data=json.loads(original);data=data.get('data',data)
        for surah in data['surahs']:
            for verse in surah['ayahs']:
                current=verses[(int(surah['id']),int(verse['number']))]
                assert current[0]==int(verse['page_number']) and current[1]==verse['text']
    print(row['id'],len(verses),'verses, 604 pages verified')
assert len(catalog)==7
audio=json.loads((SHARED/'audio-catalog.json').read_text())
for row in catalog:
    assert audio[row['id']]
    for reciter in audio[row['id']]:
        assert reciter['server'].startswith('https://') and reciter['surahs']
        assert all(1<=number<=114 for number in reciter['surahs'])
print('Verified',total,'verses across seven published reading counts.')
