
#!/usr/bin/env python3
"""Discover and verify complete Alafasy riwayat mushafs."""

from __future__ import annotations

import concurrent.futures
import html
import json
import re
import sys

from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

TARGET = Path(
    'lib/alafasy-riwayat-manifest.json'
)

MIDAD_PROFILE = (
    'https://midad.com/scholar/1042'
)

MP3_API = (
    'https://mp3quran.net/api/v3/'
    'reciters?language=ar'
)

SURAHS = ','.join(
    str(i) for i in range(1, 115)
)

SURAHS_SET = set(range(1, 115))

TIMEOUT = (7, 16)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 '
        '(compatible; SAMEE3-Mushaf-Integrity/2.0)'
    )
}

ALLOWED_NAMES = {
    'حفص عن عاصم',
    'شعبة عن عاصم',
    'ابن ذكوان عن ابن عامر',
    'الدوري عن الكسائي',
    'الدوري عن أبي عمرو',
    'خلف العاشر',
    'ورش عن نافع',
    'قالون عن نافع',
    'السوسي عن أبي عمرو',
    'البزي عن ابن كثير',
    'قنبل عن ابن كثير',
    'أبو الحارث عن الكسائي',
    'رويس عن يعقوب',
    'روح عن يعقوب',
    'خلف عن حمزة',
    'هشام عن ابن عامر',
    'ابن وردان عن أبي جعفر',
    'ابن جماز عن أبي جعفر',
    'إسحاق عن خلف العاشر',
    'إدريس عن خلف العاشر',
}


def normalize(value: str) -> str:
    value = re.sub(
        '[أإآ]', 'ا', value
    )
    value = re.sub(
        r'[\u064b-\u065f\u0670\u0640]',
        '',
        value
    )
    return re.sub(
        r'\s+', ' ', value
    ).strip().lower()


def is_alafasy(name: str) -> bool:
    n = normalize(name)
    return (
        'مشاري' in n and
        'العفاسي' in n
    )


def request_page(
    url: str
) -> tuple[str, BeautifulSoup]:

    r = requests.get(
        url,
        headers=HEADERS,
        timeout=TIMEOUT
    )

    r.raise_for_status()

    if len(r.content) > 5_000_000:
        raise RuntimeError(
            'HTML page too large'
        )

    return (
        r.text,
        BeautifulSoup(
            r.text,
            'html.parser'
        )
    )


def full_numbers(text: str) -> bool:
    try:
        parts = [
            int(x.strip())
            for x in text.split(',')
            if x.strip()
        ]
    except ValueError:
        return False

    return (
        len(parts) == 114 and
        set(parts) == SURAHS_SET
    )


@lru_cache(maxsize=5000)
def mp3_ok(url: str) -> bool:
    try:
        u = urlparse(url)

        if (
            u.scheme != 'https'
            or not u.hostname
            or u.username
            or u.password
        ):
            return False

        with requests.get(
            url,
            headers={
                **HEADERS,
                'Range': 'bytes=0-1023'
            },
            timeout=TIMEOUT,
            stream=True,
            allow_redirects=True
        ) as resp:

            if resp.status_code not in (
                200, 206
            ):
                return False

            final = urlparse(resp.url)

            if (
                final.scheme != 'https'
                or not final.hostname
            ):
                return False

            mime = resp.headers.get(
                'Content-Type', ''
            ).lower()

            if any(
                x in mime
                for x in (
                    'text/html',
                    'application/json',
                    'text/plain'
                )
            ):
                return False

            head = next(
                resp.iter_content(
                    chunk_size=1024
                ),
                b''
            )

            return (
                len(head) > 8
                and (
                    head.startswith(b'ID3')
                    or (
                        head[0] == 0xff
                        and
                        (head[1] & 0xe0) == 0xe0
                    )
                    or head[4:8] == b'ftyp'
                )
            )

    except requests.RequestException:
        return False


def verify_urls(
    tracks: dict[str, str],
    label: str
) -> bool:

    expected = {
        f'{n:03d}'
        for n in range(1, 115)
    }

    if (
        len(tracks) != 114
        or set(tracks) != expected
    ):
        print(
            f'SKIP {label}: '
            'not exactly 114 tracks'
        )
        return False

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=12
    ) as pool:

        results = list(
            pool.map(
                mp3_ok,
                tracks.values()
            )
        )

    failed = [
        s for s, passed in zip(
            tracks, results
        )
        if not passed
    ]

    if failed:
        print(
            f'SKIP {label}: '
            f'invalid tracks: {failed[:10]}'
        )

    return not failed


def name_from_midad(
    title: str,
    narration: str
) -> str | None:

    title_n = normalize(title)
    narr_n = normalize(narration)

    excluded = (
        'قراءة صلاة',
        'نادرة',
        'مصحف معلم',
        'تراويح',
        'ترجمة',
        'بالتوسط',
        'بالقصر',
        '1424',
        '1430'
    )

    if any(
        x in title_n
        for x in excluded
    ):
        return None

    for name in sorted(
        ALLOWED_NAMES,
        key=len,
        reverse=True
    ):
        if normalize(name) == narr_n:
            return name

    if 'خلف العاشر' in title_n:
        return 'خلف العاشر'

    if (
        'حفص' in title_n
        and 'ورش' not in title_n
    ):
        return 'حفص عن عاصم'

    if 'شعبة' in title_n:
        return 'شعبة عن عاصم'

    if 'ابن ذكوان' in title_n:
        return 'ابن ذكوان عن ابن عامر'

    return None


def media_candidates(
    text: str,
    soup: BeautifulSoup,
    page_url: str
) -> list[str]:

    found: list[str] = []

    for tag in soup.find_all(
        ['audio', 'source', 'a', 'meta']
    ):
        for prop in (
            'src',
            'href',
            'content',
            'data-src',
            'data-url',
            'data-audio',
            'data-audio-url'
        ):
            value = tag.get(prop)

            if isinstance(value, str):
                found.append(value)

    raw = html.unescape(
        text
    ).replace('\\/', '/')

    found.extend(
        re.findall(
            r'https?://[^\s"\'<>\\]+?'
            r'\.(?:mp3|m4a)'
            r'(?:\?[^\s"\'<>\\]*)?',
            raw,
            flags=re.I
        )
    )

    answer: list[str] = []

    for value in found:
        url = urljoin(
            page_url,
            html.unescape(value)
        )

        parsed = urlparse(url)

        if (
            parsed.scheme == 'https'
            and parsed.hostname
            and re.search(
                r'\.(?:mp3|m4a)$',
                parsed.path,
                re.I
            )
            and not parsed.username
            and not parsed.password
            and url not in answer
        ):
            answer.append(url)

    return answer


def find_track_url(
    recitation_url: str
) -> str | None:

    try:
        raw, page = request_page(
            recitation_url
        )

        candidates = media_candidates(
            raw,
            page,
            recitation_url
        )

        return next(
            (
                url
                for url in candidates
                if mp3_ok(url)
            ),
            None
        )

    except (
        requests.RequestException,
        RuntimeError
    ):
        return None


def discover_midad(
    existing: dict[str, dict]
) -> list[dict]:

    try:
        _, profile = request_page(
            MIDAD_PROFILE
        )

    except (
        requests.RequestException,
        RuntimeError
    ) as exc:
        print(
            f'Midad unavailable: {exc}'
        )
        return []

    collections: dict[str, str] = {}

    profile_text = profile.get_text(
        ' ', strip=True
    )

    for tag in profile.find_all(
        'a',
        href=True
    ):
        href = tag['href']

        matched = re.search(
            r'/collection/(\d+)(?:/|$)',
            href
        )

        if (
            matched
            and is_alafasy(profile_text)
        ):
            collections[
                matched.group(1)
            ] = urljoin(
                MIDAD_PROFILE,
                href
            )

    output: list[dict] = []

    for collection_id, url in (
        collections.items()
    ):
        key = f'midad-{collection_id}'

        if key in existing:
            continue

        try:
            raw, page = request_page(
                url
            )

            heading = page.find('h1')

            title = (
                heading.get_text(
                    ' ', strip=True
                )
                if heading
                else ''
            )

            content = page.get_text(
                ' ', strip=True
            )

            if (
                not is_alafasy(title)
                or '114 سورة' not in content
            ):
                continue

            narration = ''

            narr_match = re.search(
                r'الرواية\s*:\s*(.{2,75}?)'
                r'(?=\s+(?:المصدر|'
                r'\d+\s+محرم|'
                r'\d+\s+صفر|'
                r'\d+\s+رمضان))',
                content
            )

            if narr_match:
                narration = (
                    narr_match.group(1).strip()
                )

            riwaya = name_from_midad(
                title,
                narration
            )

            if not riwaya:
                print(
                    f'SKIP Midad '
                    f'{collection_id}: '
                    'ambiguous narration'
                )
                continue

            links = []

            for a in page.select(
                'a[href*="/recitation/"]'
            ):
                m = re.search(
                    r'/recitation/(\d+)',
                    a.get('href', '')
                )

                if m:
                    link = urljoin(
                        url,
                        a.get('href', '')
                    )

                    if link not in links:
                        links.append(link)

            if len(links) != 114:
                print(
                    f'SKIP Midad '
                    f'{collection_id}: '
                    f'{len(links)} tracks'
                )
                continue

            a = find_track_url(
                links[0]
            )

            z = find_track_url(
                links[-1]
            )

            if not a or not z:
                print(
                    f'SKIP Midad '
                    f'{collection_id}: '
                    'no playable URLs'
                )
                continue

            with concurrent.futures.ThreadPoolExecutor(
                max_workers=10
            ) as pool:

                mid = list(
                    pool.map(
                        find_track_url,
                        links[1:-1]
                    )
                )

            urls = [a, *mid, z]

            if any(
                x is None for x in urls
            ):
                print(
                    f'SKIP Midad '
                    f'{collection_id}: '
                    'missing audio'
                )
                continue

            tracks = {
                f'{i:03d}': track
                for i, track in enumerate(
                    urls, 1
                )
            }

            if not verify_urls(
                tracks, key
            ):
                continue

            output.append({
                'key': key,

                'id': (
                    2_000_000
                    + int(collection_id)
                ),

                'name': 'إصدار مداد',
                'riwaya': riwaya,

                'server': (
                    '/api/audio/'
                    'alafasy-riwayat/'
                    f'{key}/'
                ),

                'surah_total': 114,
                'surah_list': SURAHS,
                'source_url': url,
                'tracks': tracks,
            })

            print(
                f'ADDED {key} — '
                f'مصحف الروايات — {riwaya}'
            )

        except (
            requests.RequestException,
            RuntimeError
        ) as exc:

            print(
                f'SKIP Midad '
                f'{collection_id}: {exc}'
            )

    return output


def mp3quran_riwaya(
    name: str
) -> str | None:

    raw = normalize(name)

    for value in sorted(
        ALLOWED_NAMES,
        key=len,
        reverse=True
    ):
        if normalize(value) in raw:
            return value

    return None


def discover_mp3quran(
    existing: dict[str, dict]
) -> list[dict]:

    try:
        resp = requests.get(
            MP3_API,
            headers=HEADERS,
            timeout=TIMEOUT
        )

        resp.raise_for_status()

        reciters = (
            resp.json()['reciters']
        )

        if not isinstance(
            reciters, list
        ):
            raise ValueError(
                'reciters must be an array'
            )

    except (
        requests.RequestException,
        ValueError,
        KeyError
    ) as exc:

        print(
            f'MP3Quran unavailable: {exc}'
        )
        return []

    output = []

    for reciter in reciters:
        if not is_alafasy(
            str(
                reciter.get(
                    'name', ''
                )
            )
        ):
            continue

        for mushaf in reciter.get(
            'moshaf', []
        ):
            if not isinstance(
                mushaf, dict
            ):
                continue

            mushaf_id = mushaf.get('id')

            if (
                type(mushaf_id) is not int
                or mushaf_id < 1
            ):
                continue

            key = (
                f'mp3quran-{mushaf_id}'
            )

            if key in existing:
                continue

            if (
                mushaf.get(
                    'surah_total'
                ) != 114
                or not full_numbers(
                    str(
                        mushaf.get(
                            'surah_list', ''
                        )
                    )
                )
            ):
                continue

            mushaf_name = str(
                mushaf.get(
                    'name', ''
                )
            )

            riwaya = mp3quran_riwaya(
                mushaf_name
            )

            if riwaya == 'حفص عن عاصم':
                markers = (
                    '2024',
                    'الروايات',
                    'العشر'
                )

                if not any(
                    marker in normalize(
                        mushaf_name
                    )
                    for marker in markers
                ):
                    continue

            if not riwaya:
                print(
                    f'SKIP MP3Quran '
                    f'{key}: '
                    'unrecognized narration'
                )
                continue

            server = str(
                mushaf.get(
                    'server', ''
                )
            ).strip()

            parsed = urlparse(
                server
            )

            if (
                parsed.scheme != 'https'
                or not parsed.hostname
                or not parsed.hostname.endswith(
                    'mp3quran.net'
                )
            ):
                print(
                    f'SKIP MP3Quran '
                    f'{key}: '
                    'untrusted server'
                )
                continue

            server = (
                server.rstrip('/') + '/'
            )

            tracks = {
                f'{n:03d}': (
                    f'{server}{n:03d}.mp3'
                )
                for n in range(1, 115)
            }

            if not verify_urls(
                tracks, key
            ):
                continue

            output.append({
                'key': key,

                'id': (
                    3_000_000
                    + mushaf_id
                ),

                'name': 'إصدار MP3Quran',
                'riwaya': riwaya,
                'server': server,
                'surah_total': 114,
                'surah_list': SURAHS,

                'source_url': (
                    'https://www.mp3quran.net/ar'
                ),

                'tracks': {},
            })

            print(
                f'ADDED {key} — '
                f'مصحف الروايات — {riwaya}'
            )

    return output


def main() -> int:

    if TARGET.exists():
        previous = json.loads(
            TARGET.read_text(
                'utf-8'
            )
        )
    else:
        previous = {
            'version': 2,
            'entries': []
        }

    existing = {
        e['key']: e
        for e in previous.get(
            'entries', []
        )
        if (
            isinstance(e, dict)
            and 'key' in e
        )
    }

    new = discover_mp3quran(
        existing
    )

    existing.update({
        entry['key']: entry
        for entry in new
    })

    new_midad = discover_midad(
        existing
    )

    existing.update({
        entry['key']: entry
        for entry in new_midad
    })

    if not new and not new_midad:
        print(
            'No verified new complete '
            'mushafs. Keeping '
            f'{len(existing)} entries.'
        )
        return 0

    output = {
        'version': 2,

        'updatedAt': datetime.now(
            timezone.utc
        ).isoformat(),

        'entries': sorted(
            existing.values(),
            key=lambda e: (
                e['riwaya'],
                e['key']
            )
        )
    }

    temp = TARGET.with_suffix(
        '.tmp'
    )

    temp.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            indent=2
        ) + '\n',
        'utf-8'
    )

    temp.replace(
        TARGET
    )

    print(
        'Saved '
        f'{len(output["entries"])} '
        'verified editions.'
    )

    return 0


if __name__ == '__main__':
    sys.exit(main())
