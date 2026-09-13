# مصحف سميع — Complete Quran Web App Foundation

Static PWA foundation for Samee3. The core Quran viewer uses server-hosted KFQC SVG mushaf pages from quranpedia/quran-svg for five supported KFQC layouts and local KFGQPC-derived JSON fallback for all six local riwayat.

## Run
No build system is required.

Upload the project root to GitHub/Vercel. The entrypoint is `index.html`.

## Important
- Do not commit service-account keys or private credentials.
- Firebase Authentication/Firestore are configured client-side; access control is enforced by Firestore Rules.
- Audio is fetched from MP3Quran's public API.
- The repository does not bundle 604 SVG pages; pages are fetched on demand and can be cached by the browser.

## Next integration areas
- Full Firestore sync helpers and auth screens.
- Download manager with IndexedDB and storage quotas.
- Full tafsir/translation catalogue and license metadata.
- Complete hadith catalogue with verified source/licensing metadata.
- Prayer notification scheduling.
