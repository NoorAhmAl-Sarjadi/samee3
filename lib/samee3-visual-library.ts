
export type Scene = {
  id: string
  name: string
  group: string
  source: string
  emoji: string
  tint: string
}

const ROOT = 'https://mixkit.co/free-stock-video/'

// كل صف يربط مشهدًا بمقطع محدد من Mixkit.
// تنزيل الفيديو يتم من صفحته الأصلية.
const data: Array<[
  string, string, string, string, string, string
]> = [
  ['water-stone','مياه فوق الصخور','المياه','a-continues-flow-of-water-over-a-smooth-stone-in-51665/','💧','#204f62'],
  ['water-river','ماء النهر الشفاف','المياه','a-continuous-flow-of-the-river-water-over-the-smooth-51666/','💧','#236a7e'],
  ['river-shore','مياه هادئة','المياه','calm-crystal-clear-waters-gently-flow-by-the-river-shore-51593/','🌊','#23677d'],
  ['river-flow','النهر بين المروج','المياه','a-small-river-flowing-freely-in-the-wilderness-of-the-51573/','🏞️','#315f54'],
  ['river-forest','نهر الغابات','المياه','river-passing-through-a-forest-full-of-trees-51447/','🏞️','#305b49'],
  ['river-aerial','نهر من السماء','المياه','river-in-nature-seen-from-high-in-the-air-44636/','🏞️','#285c60'],
  ['river-slow','ماء بين الصخور','المياه','water-in-slow-motion-flows-down-the-river-creating-a-51600/','🌊','#276176'],
  ['river-birds','نهر وطيور','المياه','river-in-the-middle-of-a-forest-full-of-seagulls-51446/','🕊️','#356979'],
  ['river-top','النهر من أعلى','المياه','flying-low-over-a-large-river-in-nature-43609/','🏞️','#3c6c6c'],

  ['sea-waves','تموجات مياه البحر','البحار','waves-in-the-water-1164/','🌊','#20597a'],
  ['sea-beach','الأمواج على الشاطئ','البحار','waves-coming-to-the-beach-5016/','🌊','#356a82'],
  ['sea-rock','موج عند الصخور','البحار','waves-hitting-a-small-cliff-in-the-sea-51453/','🌊','#266d79'],
  ['sea-sunset','أمواج الغروب','البحار','waves-of-the-sea-arriving-at-a-beach-44482/','🌅','#9a635d'],
  ['sea-overhead','الأمواج من الأعلى','البحار','waves-crash-on-the-shore-1078/','🌊','#346e87'],
  ['sea-empty','بحر هادئ','البحار','waves-at-an-empty-beach-1930/','🏖️','#2d7790'],
  ['sea-slow','موج ناعم','البحار','waves-moving-slowly-towards-the-sea-shore-51456/','🌊','#41667c'],
  ['sea-foam','أمواج ورغوة','البحار','foamy-waves-on-the-shore-of-a-beach-44506/','🌊','#2e7485'],

  ['fall-small','شلال صغير','الشلالات','small-waterfall-523/','💦','#2e6670'],
  ['fall-rock','شلال على صخرة','الشلالات','waterfall-landscape-572/','💦','#3d7a79'],
  ['fall-green','شلال وخضرة','الشلالات','cascading-waterfall-and-rock-face-100209/','🌿','#386956'],
  ['fall-river','شلال النهر','الشلالات','waterfall-in-a-river-4321/','💦','#386876'],
  ['fall-forest','شلال الغابة','الشلالات','waterfall-in-a-forest-538/','💦','#32685a'],
  ['fall-rocks','شلال على الصخور','الشلالات','water-from-a-rocky-waterfall-falling-to-the-bottom-of-25547/','💦','#396b75'],
  ['fall-lake','شلال وبحيرة','الشلالات','waterfall-landing-in-a-small-body-of-water-526/','💦','#2e606c'],

  ['flower-orchid','قطرات فوق الأوركيد','الأزهار','water-splash-on-orchid-petals-100923/','🌸','#985c80'],
  ['flower-field','أزهار الحقل','الأزهار','flowers-in-nature-2854/','🌼','#757e52'],
  ['flower-purple','الزهور البنفسجية','الأزهار','purple-flowers-being-moved-by-the-wind-1869/','💜','#66577d'],
  ['flower-purple2','ورد يتحرك في النسيم','الأزهار','purple-flowers-moving-with-the-wind-1878/','💐','#69547d'],
  ['flower-yellow','زهور صفراء','الأزهار','yellow-flowers-1248/','🌻','#9a864b'],
  ['flower-pink','أزهار وردية على شجرة','الأزهار','little-pink-flowers-on-a-tree-1870/','🌸','#986c85'],

  ['sky-plane','السحاب من الطائرة','السماء','sky-through-a-plane-window-4368/','✈️','#50799f'],
  ['sky-wing','جناح الطائرة والسحاب','السماء','looking-at-the-clouds-from-a-plane-window-2684/','✈️','#6687a3'],
  ['sky-flight','التحليق وسط السحاب','السماء','clouds-and-blue-sky-background-2408/','☁️','#739cbc'],
  ['sky-white','الغيوم البيضاء','السماء','white-clouds-in-the-sky-passing-3142/','☁️','#7aa8c0'],
  ['sky-moving','سحاب يتحرك','السماء','white-clouds-in-motion-3140/','☁️','#82a8b9'],
  ['sky-fluffy','غيوم السماء الزرقاء','السماء','fluffy-clouds-against-clear-blue-sky-100704/','🌤️','#7da9c7'],
  ['sky-blue','صفاء السماء','السماء','small-clouds-moving-in-the-sky-1646/','☁️','#76a5ca'],
  ['sky-cloud','السحاب عن قرب','السماء','close-up-of-white-clouds-moving-in-the-sky-51112/','☁️','#77a8bb'],
  ['sky-wind','السحاب والرياح','السماء','clouds-in-the-sky-flowing-with-the-wind-21584/','🌤️','#667d9b'],
  ['sky-passing','غيوم تمر سريعًا','السماء','white-clouds-moving-across-a-clear-blue-sky-51102/','☁️','#70a1bf'],
  ['sky-cloudy','سماء غائمة','السماء','cloudy-sky-118/','🌥️','#637e96'],

  ['forest-quiet','غابة هادئة','الغابات','quiet-forest-3005/','🌲','#3f6c4f'],
  ['forest-morning','شمس بين الأشجار','الغابات','forest-during-the-morning-3012/','🌳','#4e7551'],
  ['forest-tall','أشجار شاهقة','الغابات','sunlight-through-tall-trees-in-a-forest-520/','🌲','#315d4a'],
  ['forest-green','الغابة الخضراء','الغابات','a-forest-with-trees-and-grass-3010/','🌿','#457455'],
  ['forest-walk','طريق الغابة','الغابات','view-to-the-trees-of-a-dense-forest-on-a-41572/','🌿','#3f6852'],

  ['snow-forest','ثلج الغابة','الشتاء','snowflakes-in-a-forest-2853/','❄️','#68859a'],
  ['snow-pine','تساقط الثلج','الشتاء','snow-falling-in-a-pine-forest-3352/','❄️','#859ba9'],
  ['rain-window','قطرات المطر','الشتاء','window-on-a-rainy-day-2846/','🌧️','#596d89'],
  ['ice-river','ذوبان الجليد','الشتاء','ice-thawing-on-a-river-2572/','🧊','#7d97a2'],
]

export const SCENES: Scene[] = [
  {
    id: 'flowers-demo',
    name: 'تجربة فورية · زهور حقيقية',
    group: 'الأزهار',
    source:
      'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video',
    emoji: '🌸',
    tint: '#936d86',
  },
  ...data.map(
    ([id, name, group, slug, emoji, tint]) => ({
      id,
      name,
      group,
      source: ROOT + slug,
      emoji,
      tint,
    })
  ),
]

export const GROUPS = [
  'الكل',
  ...new Set(SCENES.map(scene => scene.group)),
]
