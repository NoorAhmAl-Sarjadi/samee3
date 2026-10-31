
#!/usr/bin/env python3
"""Safely integrate verified Alafasy mushafs."""

from pathlib import Path

PAGE = Path('app/audio/page.tsx')

MARKER = 'SAMEE3_ALAFASY_FIVE_MUSHAFS_V1'


def once(text: str, old: str, new: str) -> str:
    n = text.count(old)

    if n != 1:
        raise RuntimeError(
            f'Expected precisely one anchor '
            f'({n} found): {old[:100]!r}'
        )

    return text.replace(old, new, 1)


def main() -> None:
    if not PAGE.is_file():
        raise SystemExit(
            'Missing app/audio/page.tsx. No changes made.'
        )

    page = PAGE.read_text('utf-8')

    if MARKER in page:
        print(
            'Existing V1 integration detected. '
            'V2 uses the updated catalog.'
        )
        return

    if 'alafasyFullMushafsForRiwaya' in page:
        raise RuntimeError(
            'Custom Alafasy integration found; '
            'inspect manually instead of applying twice.'
        )

    page = once(
        page,

        "import { KHUTBAH_SCHOLARS, libraryAudioSource } "
        "from '@/lib/audio-catalog'",

        "import { KHUTBAH_SCHOLARS, libraryAudioSource } "
        "from '@/lib/audio-catalog'\n"
        "// SAMEE3_ALAFASY_FIVE_MUSHAFS_V1\n"
        "import { alafasyFullMushafsForRiwaya, "
        "extendRiwayatWithAlafasy } "
        "from '@/lib/alafasy-five-mushafs'"
    )

    page = once(
        page,

        'const nextRiwayat = '
        'Array.isArray(riwayatData.riwayat) '
        '? riwayatData.riwayat : []',

        'const nextRiwayat = extendRiwayatWithAlafasy(\n'
        '        Array.isArray(riwayatData.riwayat) '
        '? riwayatData.riwayat : []\n'
        '      )'
    )

    page = once(
        page,

        '        // SAMEE3 COLLECTED ALAFASY: '
        'only expose this Hafs recording as a separate reciter.',

        '        // Verified Alafasy riwayat editions.\n'
        '        nextReciters.unshift('
        '...alafasyFullMushafsForRiwaya(activeRiwaya))\n'
        '        // SAMEE3 COLLECTED ALAFASY: '
        'only expose this Hafs recording as a separate reciter.'
    )

    page = once(
        page,

        "        setReciters([])\n"
        "        setError('تعذر تحميل قراء الرواية المحددة.')",

        "        const fallback = "
        "alafasyFullMushafsForRiwaya(activeRiwaya)\n"
        "        setReciters(fallback)\n"
        "        if (fallback.length === 0) "
        "setError('تعذر تحميل قراء الرواية المحددة.')"
    )

    PAGE.write_text(page, 'utf-8')

    print(
        'Integrated verified Alafasy riwayat '
        'with current audio library.'
    )


if __name__ == '__main__':
    main()
