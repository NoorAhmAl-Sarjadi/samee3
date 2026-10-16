/**
 * مراجعة مصادر برامج التقييم والتدخل — 2026-10-14.
 * أسماء المحاور هنا تلخيص تعريفي منشور علنًا، وليست بروتوكولات تصحيح أو بنودًا رسمية.
 * فتح المصدر للقراءة مجانا لا يعني السماح بنسخه أو نقله إلى منصة تجارية.
 */
const profile = (status, topics, resources, note) => ({
  status, topics, resources: resources.map(([name,url,type]) => ({name,url,type})), note,
  officialItemsIncluded: false, reviewedAt: '2026-10-14',
})
const published = 'توجد معلومات أو مواد مجانية رسمية، لكنها لا تمثل القائمة الكاملة المرخصة'
const restricted = 'القائمة الرسمية الكاملة غير متاحة لإعادة النشر مجانا على نحو مُتحقق منه'
const framework = 'برنامج أو أسلوب تدخل، وليس قائمة تقييم معيارية مستقلة واحدة'
const R = (name,url,type='official') => [name,url,type]
export const SOURCE_PROFILES = {
  portage: profile('paid_checklist', ['التطور المعرفي','التواصل واللغة','النمو البدني','مهارات الرعاية الذاتية','التفاعل واللعب'],[
    R('الجهة الوطنية لبورتاج: أنشطة الخطوات الصغيرة','https://www.portage.org.uk/support/resources/parent-list/317'),
    R('قائمة Portage SEND الرسمية (للشراء)','https://www.portage.org.uk/news/portage-send-best-practice-assessment-checklist','licensed')],restricted),
  lovaas: profile('framework_resources', ['التقليد','الطلب الوظيفي','اتباع التعليمات','تقليد الأصوات والكلمات','المفاهيم المجردة','المحادثة','الاندماج في المجموعة'],[
    R('لوفاس: تدرج مهارات التدخل','https://lovaas.com/lovaas-method/who-is-it-for/'),
    R('تقرير حكومي عن منهج لوفاس','https://ies.ed.gov/ncee/wwc/Docs/InterventionReports/wwc_lovaas_082410.pdf','public_report')],framework),
  help: profile('paid_checklist', ['الإدراك','اللغة والتواصل','الحركة الكبرى','الحركة الدقيقة','التطور الاجتماعي والانفعالي','الرعاية الذاتية'],[
    R('ناشر دليل HELP','https://www.vort.com/','publisher')],restricted),
  teacch: profile('framework_resources', ['الجداول البصرية','تنظيم البيئة','تنظيم المهمة','أنظمة العمل','الدعم البصري','الاستقلالية'],[
    R('الموارد المجانية لبرنامج TEACCH بجامعة نورث كارولينا','https://teacch.com/resources/')],framework),
  pecs: profile('official_free_resources', ['المرحلة 1: التبادل','المرحلة 2: المثابرة والمسافة','المرحلة 3: التمييز بين الصور','المرحلة 4: بناء الجملة','المرحلة 5: الاستجابة للسؤال','المرحلة 6: التعليق'],[
    R('المراحل الست الرسمية','https://pecsusa.com/pecs/'),
    R('نماذج تقدم وأهداف IEP ومواد PECS مجانية','https://pecsusa.com/free-materials/')],published),
  vbmapp: profile('paid_checklist', ['المحطات النمائية في التواصل واللغة','عوائق اللغة والتعلم','تقييم الانتقال','مهارات داعمة'],[
    R('الناشر الرسمي: شرح محتوى الأداة وتسعير البروتوكول','https://avbpress.com/','publisher'),
    R('مواد VB-MAPP الإضافية وأمثلة أهداف IEP متاحة مجانا للقراءة','https://avbpress.com/vb-mapp-supplementary-material/')],restricted),
  abllsr: profile('paid_checklist', ['المهارات اللغوية والتعلم المبكر','التفاعل الاجتماعي','الأكاديميات الأولية','العناية بالذات','الحركة'],[
    R('الناشر: شرح 544 مهارة و25 مجالا','https://partingtonbehavioranalysts.com/pages/client-assessment','publisher'),
    R('منع استنساخ بنود ABLLS-R دون إذن مكتوب','https://partingtonbehavioranalysts.com/pages/faqs','rights')],restricted),
  afls: profile('paid_checklist', ['المهارات الحياتية الأساسية','المهارات المنزلية','المشاركة المجتمعية','مهارات المدرسة','المهارات المهنية','الاستقلال المعيشي'],[
    R('الناشر: المجالات الستة','https://partingtonbehavioranalysts.com/pages/ablls-r-afls-compatibility','publisher'),
    R('منع استنساخ بنود AFLS دون إذن مكتوب','https://partingtonbehavioranalysts.com/pages/faqs','rights')],restricted),
  esdm: profile('paid_checklist', ['التواصل واللغة','التفاعل الاجتماعي','اللعب','الانتباه والإدراك','التقليد','المهارات الحركية','الاستقلالية'],[
    R('الموقع الرسمي: المنشورات وقائمة المنهج المدفوعة','https://www.esdm.co/publications','publisher')],restricted),
  prt: profile('framework_resources', ['الدافعية','المبادرة الاجتماعية','الاستجابة للإشارات المتعددة','الإدارة الذاتية','التعميم'],[
    R('وحدات التدخل المبنية على الأدلة AFIRM','https://afirm.fpg.unc.edu/','training')],framework),
  floortime: profile('official_free_resources', ['التنظيم والاهتمام بالعالم','التفاعل وبناء العلاقة','التواصل ثنائي الاتجاه','حل المشكلات الاجتماعية','اللعب الرمزي','الربط المنطقي بين الأفكار'],[
    R('ICDL: القدرات الانفعالية النمائية الست','https://www.icdl.com/dir/terms'),
    R('ICDL: أداة فحص منزلية مجانية','https://www.icdl.com/dir/fedcs/functional-emotional-developmental-levels-basic-chart'),
    R('ICDL: توجيهات كتابة أهداف الخطط الفردية','https://www.icdl.com/parents/educational-interventions')],published),
  hanen: profile('framework_resources', ['المشاركة الأسرية','التواصل الاستجابي','تبادل الأدوار','اللغة في الروتين اليومي'],[
    R('Hanen: البرامج الرسمية','https://hanen.org/programs'),
    R('Hanen: مراجعة بحثية وأهداف عامة','https://www.hanen.org/information-tips/who-we-are-research/it-takes-two-to-talk-research-summary')],framework),
  scerts: profile('framework_resources', ['التواصل الاجتماعي','التنظيم الانفعالي','الدعم التفاعلي والبيئي'],[
    R('SCERTS: تعريف المحاور الثلاثة','https://scerts.com/'),
    R('Brookes: نماذج ربط الأهداف بالمجالات','https://brookespublishing.com/resource-library/linking-transactional-support-goals-to-social-communication-and-emotional-regulation-goals/')],framework),
  jasper: profile('framework_resources', ['الانتباه المشترك','اللعب الرمزي','الانخراط المشترك','تنظيم السلوك والانفعال'],[
    R('JASPER: تعريف المجالات الأربعة','https://www.jaspertraining.org/about'),
    R('الدليل السريري الرسمي (للشراء)','https://www.jaspertraining.org/manual','licensed')],framework),
  peak: profile('paid_checklist', ['التدريب المباشر','تعميم المهارة','التكافؤ والعلاقات المشتقة','تحويل الوظيفة'],[
    R('الناشر الرسمي: الوحدات الأربعة','https://emergentlearningpress.com/products/peak-administration-manual','publisher'),
    R('قائمة المنتجات والدليل المدفوع','https://emergentlearningpress.com/collections/aba','publisher')],restricted),
  verbal_behavior: profile('framework_resources', ['الطلب Mand','التسمية Tact','التكرار Echoic','الحوار Intraverbal','الاستجابة للمستمع'],[
    R('مواد AVB Press للتثقيف في السلوك اللفظي','https://avbpress.com/vb-mapp-supplementary-material/','training')],framework),
  precision: profile('framework_resources', ['تعريف الأداء','القياس المتكرر','الطلاقة','سرعة الاستجابة','مراجعة قرارات التدريس'],[
    R('مركز IRIS: تصميم التقييم ومتابعة التقدم','https://iris.peabody.vanderbilt.edu/','training')],framework),
  social_stories: profile('official_free_resources', ['وصف الموقف الاجتماعي','وجهات النظر','الاستجابات المرنة','تنظيم التوقعات'],[
    R('كارول جراي: موارد Social Stories مجانية باشتراك بريد إلكتروني','https://carolgraysocialstories.com/carols-club/')],published),
  structured: profile('framework_resources', ['تنظيم المساحة','الجدول البصري','نظام العمل','بنية المهمة','قابلية التنبؤ'],[
    R('TEACCH: موارد التعليم المنظم','https://teacch.com/resources/')],framework),
  task_analysis: profile('framework_resources', ['اختيار مهارة مركبة','تحديد خطوات المهمة','تعزيز الاستقلالية','التسلسل الأمامي أو الخلفي','تعميم الأداء'],[
    R('AFIRM: موارد ممارسات التدخل','https://afirm.fpg.unc.edu/')],framework),
  sensory: profile('framework_resources', ['التحمل الحسي','المشاركة الوظيفية','تنظيم البيئة','التكيف مع المدخلات الحسية'],[
    R('الجمعية الأمريكية للعلاج الوظيفي','https://www.aota.org/','professional')],framework),
  carolina: profile('paid_checklist', ['المهارات الشخصية والاجتماعية','الإدراك','التواصل','الحركة الدقيقة','الحركة الكبرى'],[
    R('الناشر: شرح المجالات الخمسة والبرنامج','https://brookespublishing.com/product/the-carolina-curriculum/','publisher'),
    R('فصول معاينة مجانية عند الناشر','https://brookespublishing.com/setting/the-carolina-curriculum/','sample')],restricted),
  unified: profile('independent_original', ['13 مجالا عربيا مستقلا منشأ داخل المنصة'],[
    R('CDC: موارد نمو مجانية مرجعية وليست مصدرًا حرفيًا لأهداف المنصة','https://www.cdc.gov/act-early/resources/','background')],
    'هذا بنك عربي مستقل غير مقنن، وليس نسخة من أي برنامج أو اختبار رسمي.'),
}
export function sourceProfileFor(id){ return SOURCE_PROFILES[id]||null }
