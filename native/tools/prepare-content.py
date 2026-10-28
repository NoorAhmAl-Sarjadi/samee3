#!/usr/bin/env python3
"""Build native assets from SAMEE3's existing Quran sources; never rewrite verse text."""
from pathlib import Path
import concurrent.futures, gzip, hashlib, json, re, shutil, time, urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'native' / 'shared'
CACHE = ROOT.parent / 'qa' / 'native-sources'
READINGS = [('hafs',1,'حفص عن عاصم'),('warsh',4,'ورش عن نافع'),('qalun',7,'قالون عن نافع'),
            ('douri',6,'الدوري عن أبي عمرو'),('shubah',9,'شعبة عن عاصم'),('sousi',10,'السوسي عن أبي عمرو'),('bazzi',5,'البزي عن ابن كثير')]
REMOTE_IDS = dict(hafs=1,warsh=2,qalun=5,douri=13,shubah=15,sousi=7,bazzi=4)

def read_url(url, cache):
    if cache.exists(): return cache.read_bytes()
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'Mozilla/5.0 SAMEE3 Native Content Builder'})
            with urllib.request.urlopen(req,timeout=60) as response:
                data=response.read(24*1024*1024)
            json.loads(data)
            cache.parent.mkdir(parents=True,exist_ok=True);cache.write_bytes(data)
            return data
        except Exception:
            if attempt==2: raise
            time.sleep(attempt+1)

def canonical_ranges():
    source=(ROOT/'lib/quran/juz-boundaries.ts').read_text()
    return [list(map(int,row.split(','))) for row in re.findall(r'\[(\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+)\]',source)]

def make_reading(entry):
    key,number,label=entry
    if key in ('sousi','bazzi'):
        raw=gzip.decompress((ROOT/'data/mushaf'/f'{key}.text.json.gz').read_bytes())
        source=f'../data/mushaf/{key}.text.json.gz'
    else:
        source=f'https://api.quranpedia.net/v1/mushafs/{number}'
        raw=read_url(source,CACHE/f'{key}.json')
    doc=json.loads(raw)
    if 'surahs' not in doc: doc=doc['data']
    assert len(doc['surahs'])==114,key
    ranges=canonical_ranges(); assert len(ranges)==30
    pages=[[] for _ in range(604)];surahs=[];by_ref={};seen=set()
    for surah in doc['surahs']:
        sid=int(surah['id']);first=605
        for item in surah['ayahs']:
            ayah=int(item['number']);page=int(item['page_number']);text=item['text']
            assert 1<=page<=604 and isinstance(text,str) and text.strip(),(key,sid,ayah)
            assert (sid,ayah) not in seen,(key,sid,ayah)
            seen.add((sid,ayah));first=min(first,page)
            refs=[int(x) for x in (item.get('number_in_hafs') or ([ayah] if key=='hafs' else []))]
            reference=refs[0] if refs else ayah
            juz=max(i+1 for i,r in enumerate(ranges) if (sid,reference)>=(r[0],r[1]))
            verse={'s':sid,'a':ayah,'text':text,'juz':juz,'refs':refs}
            pages[page-1].append(verse)
            for ref in refs: by_ref[(sid,ref)]=(sid,ayah,page)
        surahs.append({'number':sid,'name':str(surah['name']).removeprefix('سورة ').strip(),'page':first})
    assert all(pages),key
    for page in pages: page.sort(key=lambda v:(v['s'],v['a']))
    juz_starts=[]
    for i,r in enumerate(ranges):
        location=by_ref.get((r[0],r[1]))
        # Some readings do not number the opening basmalah as 1:1.
        # Juz 1 still starts on their first Fatiha page, before its first verse.
        if i==0 and location is None:
            first=pages[0][0];location=(first['s'],first['a'],1)
        assert location,(key,'missing juz mapping',i+1)
        juz_starts.append({'number':i+1,'surah':location[0],'ayah':location[1],'page':location[2]})
    result={'schema':1,'id':key,'name':label,'bismillah':doc.get('bismillah',''),
            'surahs':surahs,'juzStarts':juz_starts,'pages':pages,
            'source':source,'sourceSha256':hashlib.sha256(raw).hexdigest()}
    path=OUT/'content'/f'{key}.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    print(key,len(seen),'verses, 604 pages',path.stat().st_size,'bytes',flush=True)
    return {'id':key,'name':label,'verses':len(seen),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceSha256':result['sourceSha256'],'source':source}

def make_audio(entry):
    key,_,_=entry;source=f'https://mp3quran.net/api/v3/reciters?language=ar&rewaya={REMOTE_IDS[key]}'
    doc=json.loads(read_url(source,CACHE/f'audio-{key}.json'));items=[]
    for reciter in doc.get('reciters',[]):
        for m in reciter.get('moshaf',[]):
            if int(m.get('rewaya_id',0))!=REMOTE_IDS[key]:continue
            server=m.get('server','')
            from urllib.parse import urlparse
            url=urlparse(server)
            if url.scheme!='https' or not url.hostname.endswith('.mp3quran.net'):continue
            surahs=[int(x) for x in m.get('surah_list','').split(',') if x.isdigit() and 1<=int(x)<=114]
            if not surahs:continue
            items.append({'id':str(reciter['id'])+'-'+str(m['id']),'name':reciter['name']+' — '+m['name'],
                          'server':server.rstrip('/')+'/', 'surahs':surahs})
    assert items,('missing audio catalogue',key)
    return key,items

def main():
    OUT.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        readings=list(pool.map(make_reading,READINGS))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        audio=dict(pool.map(make_audio,READINGS))
    (OUT/'audio-catalog.json').write_text(json.dumps(audio,ensure_ascii=False,separators=(',',':')))
    (OUT/'catalog.json').write_text(json.dumps({'schema':1,'readings':readings},ensure_ascii=False,indent=2))
    for name in ['UthmanicHafs-v-3.0.ttf','AmiriQuran-Regular.ttf','Tajawal-Regular.ttf','Tajawal-Bold.ttf','sousi-source.ttf','bazzi-source.otf']:
        dest=OUT/'fonts'/name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(ROOT/'public/fonts'/name,dest)
    # Additional publisher fonts; exact checksums are pinned for regeneration.
    dest=OUT/'fonts'/'UthmanicWarsh-v-3.0.ttf'
    if not dest.exists():dest.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/quran-ws/quran-text/main/data/fonts/UthmanicWarsh-v-3.0.ttf',timeout=30).read())
    assert hashlib.sha256(dest.read_bytes()).hexdigest()=='b644f1c6665baa95c9c0ab40b01a7f3e89edc42a0f50d3b244318a843bec81a9'
    dest=OUT/'fonts'/'UthmanicQaloun-v-3.0.ttf'
    if not dest.exists():dest.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/quran-ws/quran-text/main/data/fonts/UthmanicQaloun-v-3.0.ttf',timeout=30).read())
    assert hashlib.sha256(dest.read_bytes()).hexdigest()=='3bf3432429f3bbde673982af2aab9b7a1a7329e295dce250bd96842c2a368ba9'
    dest=OUT/'fonts'/'UthmanicDouri-V20.ttf'
    if not dest.exists():dest.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/quran-ws/quran-text/main/data/fonts/UthmanicDouri-V20.ttf',timeout=30).read())
    assert hashlib.sha256(dest.read_bytes()).hexdigest()=='3a862f8e4ba9b7fd024e2b74981026eb5a901cb292e2b43766795112a35a6b45'
    dest=OUT/'fonts'/'UthmanicShubah-v-3.0.ttf'
    if not dest.exists():dest.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/quran-ws/quran-text/main/data/fonts/UthmanicShubah-v-3.0.ttf',timeout=30).read())
    assert hashlib.sha256(dest.read_bytes()).hexdigest()=='634a7252b619b934f2e507480d517b8f339503bbf08dded35315a9c1f2be495d'
    for notice in (ROOT/'public/fonts').glob('*.txt'):
        shutil.copyfile(notice,OUT/'fonts'/notice.name)
    (OUT/'SOURCES.txt').write_text('بيانات القرآن من مصادر مشروع سميع نفسها. النص محفوظ دون تطبيع أو حذف تشكيل.\n'
        'Quranpedia: https://quranpedia.net — https://api.quranpedia.net/v1\n'
        'المصادر المحلية للسوسي والبزي موجودة في data/mushaf في المستودع الأصلي.\n'
        'التلاوات وبيانات القراء: MP3Quran https://mp3quran.net\n'
        'الخطوط: ملفات public/fonts من المشروع الأصلي؛ راجع حقوق الناشرين المرفقة بها.\n')
    print('Native content ready: all seven riwayat, each with 604 offline pages.',flush=True)

if __name__=='__main__':main()
