# المصادر وإشعارات النسبة

## صفحات السوسي والبزي

الأصول: مصحف رواية السوسي عن أبي عمرو ومصحف رواية البزي عن ابن كثير، ٦٠٤ صفحات لكل أصل. صور الإسلام ويب المتاحة في ويكيميديا كومنز، والموسومة في المصدر بأنها ملكية عامة. لم يجر تحرير الكلمات أو إعادة رسمها يدويًا. اقتصر تجهيز الصفحات على قص الهوامش الخارجية وحفظ المسارات المتجهة الأصلية وضغطها وفصل الأشكال المتكررة لتقليل الحجم.

- https://commons.wikimedia.org/wiki/File:المصحف_برواية_السوسي_عن_أبي_عمرو.pdf
- https://commons.wikimedia.org/wiki/File:المصحف_برواية_البزي_عن_ابن_كثير.pdf

ملفات الصفحات المعدّة في `data/mushaf` ومُنشئها في `scripts/build-riwaya-pages.py`. لا يلزم Python أو ملفات PDF الأصلية لتشغيل التطبيق.

نص القراءة القابل لتحديد الآيات وبيانات الصفحات من Quranpedia، محفوظ كما نُشر في نسخة JSON مضغوطة:

- https://api.quranpedia.net/v1/mushafs/10 — السوسي
- https://api.quranpedia.net/v1/mushafs/5 — البزي
- بصمة SHA-256 للنص الخام قبل الضغط: السوسي `d74e4eb0c9975d06ddbc745d93bac2456bde9be269767cfe4bd7e15e529eb338`، البزي `574df07c1101501e2ce04fc01f7829ec6a6938374eeeb3fa51518c03e7937ec6`.

## الخطوط

خطوط المصحف من مجمع الملك فهد لطباعة المصحف الشريف، محفوظة بملفاتها الأصلية دون تعديل. إشعارات الترخيص المضمّنة مستخرجة بجوار كل ملف في `public/fonts/*.NOTICE.txt`.

- https://quranpedia.net/assets/fonts/arabic/UthmanicSousi_V20.ttf
- https://quranpedia.net/assets/fonts/arabic/UthmanicBazzi1Ver06.otf
- خط حفص `UthmanicHafs-v-3.0.ttf` من الحزمة المثبتة `@quran.ws/text`، وبجوار الملف نسخة ترخيص الحزمة `CC-BY-4.0-QuranWS.txt`.
- Tajawal وAmiri وAmiri Quran وAref Ruqaa: تراخيص SIL OFL، وإشعاراتها بجوار الخطوط. https://github.com/google/fonts/tree/main/ofl/tajawal — https://github.com/aliftype/amiri — https://github.com/aliftype/aref-ruqaa

## الأذكار والحديث والصوت والكتب

- نصوص الأذكار والتسجيلات الفردية: حصن المسلم لسعيد بن علي بن وهف القحطاني، من مشروع https://github.com/rn0x/Adhkar-json — القراءة الصوتية في هذا المصدر لحمد الدريهم. الملف المحلي نسخة المصدر دون تعديل، وبصمته وعدد أقسامه في `public/data/adhkar-source.json`.
- الأحاديث: مصدر Alfurqan، https://alfurqan.online/docs، مع إظهار اسم الكتاب ورقم الحديث. لا تنسب شروح غير مراجعة إلى الحديث، وملف الشروح المحلية فارغ حتى يعتمد المحتوى ضمن مسار التحرير الموجود.
- التسجيلات القرآنية والتوقيت: https://mp3quran.net/api/v3 — معرّف الرواية في هذه الخدمة يختلف عن معرّفها في Quranpedia. قائمة التسجيلات التي وُجد لها توقيت محفوظة في `data/timing-reads.json`.
- كتب المكتبة وشروحها: روابط المصادر والناشرين وYouTube وIslamhouse وIslamweb وUsul وغيرها داخل `lib/islamic/curriculum.ts` و`lib/islamic/sunniLibrary.ts`. لا تُنسخ ملفات الفيديو داخل المشروع.

لا يُراد بهذه القائمة منح ترخيص جديد لأي مادة أصلية؛ تبقى الحقوق وشروط الاستخدام لأصحاب المصادر.
