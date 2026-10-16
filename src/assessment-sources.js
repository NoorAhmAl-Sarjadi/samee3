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
  vbmapp: profile('paid_checklist', ['المحطات النمائية في التواصل واللغة','عوائق اللغة والتعلم','تقييم الانتقال','مهارات داعمة'],[
    R('الناشر الرسمي: شرح محتوى الأداة وتسعير البروتوكول','https://avbpress.com/','publisher'),
    R('مواد VB-MAPP الإضافية وأمثلة أهداف IEP متاحة مجانا للقراءة','https://avbpress.com/vb-mapp-supplementary-material/')],restricted),
  abllsr: profile('paid_checklist', ['المهارات اللغوية والتعلم المبكر','التفاعل الاجتماعي','الأكاديميات الأولية','العناية بالذات','الحركة'],[
    R('الناشر: شرح 544 مهارة و25 مجالا','https://partingtonbehavioranalysts.com/pages/client-assessment','publisher'),
    R('منع استنساخ بنود ABLLS-R دون إذن مكتوب','https://partingtonbehavioranalysts.com/pages/faqs','rights')],restricted),
  esdm: profile('paid_checklist', ['التواصل واللغة','التفاعل الاجتماعي','اللعب','الانتباه والإدراك','التقليد','المهارات الحركية','الاستقلالية'],[
    R('الموقع الرسمي: المنشورات وقائمة المنهج المدفوعة','https://www.esdm.co/publications','publisher')],restricted),
}
export function sourceProfileFor(id){ return SOURCE_PROFILES[id]||null }
