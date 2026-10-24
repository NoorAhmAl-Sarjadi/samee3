"""Prepare the committed local page assets from the 604-page source PDFs.
Usage: python3 scripts/build-riwaya-pages.py /path/to/source-pdfs
Requires PyMuPDF. It is a maintenance tool, not a deployment dependency.
"""
import fitz, gzip, hashlib, json, pathlib, re, sys
source = pathlib.Path(sys.argv[1])
output = pathlib.Path(__file__).resolve().parents[1] / 'data/mushaf'
output.mkdir(parents=True, exist_ok=True)
manifest = {}
for riwaya in ['sousi', 'bazzi']:
    pdf = fitz.open(source / f'{riwaya}.pdf')
    assert len(pdf) == 604
    entries, glyphs = [], {}
    with open(output / f'{riwaya}.pack', 'wb') as stream:
        for page in pdf:
            blocks = [block[:4] for block in page.get_text('blocks') if block[4].strip()]
            assert blocks
            bounds = fitz.Rect(min(b[0] for b in blocks)-7, min(b[1] for b in blocks)-7, max(b[2] for b in blocks)+7, max(b[3] for b in blocks)+7) & page.rect
            page.set_cropbox(bounds)
            svg = page.get_svg_image(text_as_path=True)
            names = {}
            def keep_glyph(match):
                original_id = re.search(r'id="([^"]+)"', match[0])[1]
                shape = re.sub(r' id="[^"]+"', '', match[0])
                key = 'g' + hashlib.sha256(shape.encode()).hexdigest()[:20]
                names[original_id] = key
                glyphs[key] = shape.replace('<path ', f'<path id="{key}" ', 1)
                return ''
            svg = re.sub(r'<path id="font_[^"]+"[^>]+/>', keep_glyph, svg)
            svg = re.sub(r'#(font_\d+_\d+)', lambda m: '#' + names[m[1]], svg)
            svg = re.sub(r' data-text="[^"]*"', '', svg)
            packed = gzip.compress(svg.encode(), compresslevel=9)
            entries.append({'offset': stream.tell(), 'length': len(packed), 'width': round(bounds.width,2), 'height': round(bounds.height,2)})
            stream.write(packed)
    (output / f'{riwaya}.glyphs.gz').write_bytes(gzip.compress(json.dumps(glyphs,separators=(',',':')).encode(),compresslevel=9))
    manifest[riwaya] = entries
    print(riwaya, len(entries), 'pages', len(glyphs), 'glyphs', (output / f'{riwaya}.pack').stat().st_size, 'bytes', flush=True)
(output / 'index.json').write_text(json.dumps(manifest,separators=(',',':')))
