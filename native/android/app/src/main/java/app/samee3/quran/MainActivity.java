package app.samee3.quran;

import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private static final ExecutorService FILE_IO=Executors.newFixedThreadPool(2);
    private static final Set<String> IN_FLIGHT_DOWNLOADS=ConcurrentHashMap.newKeySet();
    private final Handler main=new Handler(Looper.getMainLooper());
    private LinearLayout root,body,bar;private TextView status;private ScrollView scroll;
    private SharedPreferences preferences;private QuranData data;private String reading="hafs";private int page=1,screen=0,request=0;
    private float fontSize=30;private boolean night=false,awake=true;private Typeface uiFont,quranFont;
    private SeekBar playerSeek;
    private final Runnable playbackClock=new Runnable(){public void run(){if(!isDestroyed()&&screen==2&&playerSeek!=null){int total=AudioService.duration();playerSeek.setMax(Math.max(1,total));if(!playerSeek.isPressed())playerSeek.setProgress(AudioService.position());if(total>0)status.setText(clock(AudioService.position())+" / "+clock(total));}main.postDelayed(this,1000);}};
    private String clock(int millis){int seconds=millis/1000;return String.format(Locale.US,"%d:%02d",seconds/60,seconds%60);}
    private Typeface quranTypeface(String font)throws Exception {
        if(Build.VERSION.SDK_INT>=29){android.graphics.fonts.FontFamily primary=new android.graphics.fonts.FontFamily.Builder(new android.graphics.fonts.Font.Builder(getAssets(),"fonts/"+font).build()).build();android.graphics.fonts.FontFamily fallback=new android.graphics.fonts.FontFamily.Builder(new android.graphics.fonts.Font.Builder(getAssets(),"fonts/AmiriQuran-Regular.ttf").build()).build();return new Typeface.CustomFallbackBuilder(primary).addCustomFallback(fallback).setSystemFallback("serif").build();}
        return Typeface.createFromAsset(getAssets(),"fonts/"+font);
    }
    private static final int GOLD=0xff8a642d,GREEN=0xff194f43,PAPER=0xfffaf8f3;
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(true);
        preferences=getSharedPreferences("samee3_native_v1",MODE_PRIVATE);
        reading=preferences.getString("reading","hafs");if(!Arrays.asList(QuranData.IDS).contains(reading))reading="hafs";
        page=Math.max(1,Math.min(604,preferences.getInt("page:"+reading,1)));fontSize=preferences.getFloat("font",30);night=preferences.getBoolean("night",false);awake=preferences.getBoolean("awake",true);
        try{uiFont=Typeface.createFromAsset(getAssets(),"fonts/Tajawal-Regular.ttf");}catch(Exception ignored){}
        frame();home();main.post(playbackClock);
    }
    private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private int foreground(){return night?0xfff4ecd9:0xff24201b;}
    private TextView label(String value,float size){TextView text=new TextView(this);text.setText(value);text.setTextSize(size);text.setTextColor(foreground());text.setPadding(dp(8),dp(8),dp(8),dp(8));text.setTextDirection(View.TEXT_DIRECTION_RTL);if(uiFont!=null)text.setTypeface(uiFont);return text;}
    private Button button(String title,Runnable click){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setTextSize(15);b.setTextColor(GREEN);if(uiFont!=null)b.setTypeface(uiFont);b.setMinHeight(dp(50));b.setOnClickListener(v->click.run());return b;}
    private void frame(){
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);root.setFitsSystemWindows(true);root.setBackgroundColor(night?0xff172520:PAPER);
        TextView header=label("مصحف سميع",25);header.setGravity(Gravity.CENTER);header.setTextColor(night?0xffe1be76:GREEN);root.addView(header);
        bar=new LinearLayout(this);for(String name:new String[]{"الرئيسية","المصحف","التلاوات","الأقسام"}){final int i=bar.getChildCount();bar.addView(button(name,()->{if(i==0)home();else if(i==1)loadReader();else if(i==2)audioScreen();else sections();}),new LinearLayout.LayoutParams(0,dp(54),1));}root.addView(bar);
        scroll=new ScrollView(this);scroll.setFillViewport(true);body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(15),dp(8),dp(15),dp(24));scroll.addView(body);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        status=label("",12);status.setGravity(Gravity.CENTER);root.addView(status);setContentView(root);applyAwake();
    }
    private void clear(int target,String title){screen=target;request++;body.removeAllViews();body.addView(label(title,23));scroll.scrollTo(0,0);status.setText("");applyAwake();}
    private void applyAwake(){if(awake&&screen==1)getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
    private void text(String value){body.addView(label(value,17));}
    private void home(){clear(0,"القرآن معك دون إنترنت");
        body.addView(button("فتح تصميم سميع الأساسي",()->web("/")));body.addView(button("إعدادات الإشعارات والتذكيرات",()->web("/notifications")));
        text("الروايات السبع وصفحات القرآن الـ٦٠٤ موجودة داخل التطبيق. التلاوات تحتاج اتصالًا أول مرة، ويمكن حفظها على جهازك.");
        body.addView(button("متابعة القراءة — صفحة "+page,()->loadReader()));body.addView(button("استماع التلاوات وحفظها",()->audioScreen()));
        body.addView(button("المحتوى الصوتي المحفوظ",this::downloads));body.addView(button("الإعدادات",this::settings));
        body.addView(button("كل أقسام سميع",this::sections));body.addView(button("مصادر القرآن وحقوق الخطوط",()->{new AlertDialog.Builder(this).setTitle("المصادر").setMessage("النصوص من مصادر مشروع سميع: Quranpedia، والنسخ المحلية للسوسي والبزي. التلاوات من MP3Quran. نص الآيات محفوظ كما نُشر في المصدر دون تعديل؛ العرض النصي يختلف عن صورة الصفحة المطبوعة.").setPositiveButton("حسنًا",null).show();}));
    }
    private void loadReader(){
        clear(1,"تحميل المصحف…");final int token=request;final String selected=reading;
        worker.execute(()->{try{QuranData loaded=QuranData.load(this,selected);main.post(()->{if(token!=request||isDestroyed())return;data=loaded;try{String font=reading.equals("sousi")?"sousi-source.ttf":reading.equals("bazzi")?"bazzi-source.otf":reading.equals("warsh")?"UthmanicWarsh-v-3.0.ttf":reading.equals("qalun")?"UthmanicQaloun-v-3.0.ttf":reading.equals("douri")?"UthmanicDouri-V20.ttf":reading.equals("shubah")?"UthmanicShubah-v-3.0.ttf":"UthmanicHafs-v-3.0.ttf";quranFont=quranTypeface(font);}catch(Exception ignored){}renderPage();});}catch(Exception e){main.post(()->{if(token==request){body.removeAllViews();text("تعذر قراءة بيانات المصحف. أعد المحاولة.");body.addView(button("إعادة المحاولة",this::loadReader));}});}});
    }
    private void readingMenu(Runnable after){new AlertDialog.Builder(this).setTitle("اختر الرواية").setSingleChoiceItems(QuranData.NAMES,Arrays.asList(QuranData.IDS).indexOf(reading),(dialog,index)->{if(!reading.equals(QuranData.IDS[index]))startService(new Intent(this,AudioService.class).setAction(AudioService.PAUSE));reading=QuranData.IDS[index];page=preferences.getInt("page:"+reading,1);preferences.edit().putString("reading",reading).apply();dialog.dismiss();after.run();}).setNegativeButton("إغلاق",null).show();}
    private void savePage(){preferences.edit().putString("reading",reading).putInt("page:"+reading,page).apply();}
    private void renderPage(){
        if(data==null)return;clear(1,data.name);savePage();
        LinearLayout tools=new LinearLayout(this);tools.addView(button("الرواية",()->readingMenu(this::loadReader)),new LinearLayout.LayoutParams(0,-2,1));tools.addView(button("الفهرس",this::indexMenu),new LinearLayout.LayoutParams(0,-2,1));tools.addView(button("الصفحة",this::pageDialog),new LinearLayout.LayoutParams(0,-2,1));tools.addView(button("بحث",this::search),new LinearLayout.LayoutParams(0,-2,1));body.addView(tools);
        status.setText(data.name+" · صفحة "+page+" من ٦٠٤ · محفوظة داخل التطبيق");pager();
        JSONArray verses=data.pages.optJSONArray(page-1);int previous=0;
        for(int i=0;i<verses.length();i++){
            JSONObject verse=verses.optJSONObject(i);int surah=verse.optInt("s"),number=verse.optInt("a");
            if(surah!=previous){TextView title=label("سورة "+data.surahName(surah),24);title.setGravity(Gravity.CENTER);title.setTextColor(night?0xffe1be76:GOLD);body.addView(title);
                if(number==1&&surah!=9&&!data.bismillah.isEmpty()&&(surah!=1||!QuranData.fold(verse.optString("text")).startsWith("بسم"))){TextView b=label(data.bismillah,fontSize-3);if(quranFont!=null)b.setTypeface(quranFont);b.setGravity(Gravity.CENTER);body.addView(b);}previous=surah;}
            TextView content=label(verse.optString("text"),fontSize);if(quranFont!=null)content.setTypeface(quranFont);content.setLineSpacing(dp(12),1.2f);content.setTextIsSelectable(true);content.setPadding(dp(12),dp(13),dp(12),dp(6));body.addView(content);
            TextView numberLabel=label("﴿"+number+"﴾",14);numberLabel.setTextColor(night?0xffe1be76:GOLD);numberLabel.setGravity(Gravity.CENTER);body.addView(numberLabel);
        }
        pager();body.addView(button("حفظ علامة في هذه الصفحة",()->{preferences.edit().putInt("bookmark:"+reading,page).apply();toast("حُفظت العلامة لهذه الرواية");}));
        body.addView(button("فتح العلامة المحفوظة",()->{int saved=preferences.getInt("bookmark:"+reading,0);if(saved==0)toast("لا توجد علامة لهذه الرواية");else{page=saved;renderPage();}}));
        body.addView(button("الصفحة المصوّرة والتفسير وأدوات الموقع",()->web("/mushaf?riwaya="+reading+"&page="+page)));
    }
    private void pager(){LinearLayout row=new LinearLayout(this);Button previous=button("السابقة",()->{if(page>1){page--;renderPage();}}),next=button("التالية",()->{if(page<604){page++;renderPage();}});previous.setEnabled(page>1);next.setEnabled(page<604);row.addView(previous,new LinearLayout.LayoutParams(0,-2,1));TextView n=label(page+" / 604",16);n.setTextDirection(View.TEXT_DIRECTION_LTR);n.setGravity(Gravity.CENTER);row.addView(n,new LinearLayout.LayoutParams(0,-2,1));row.addView(next,new LinearLayout.LayoutParams(0,-2,1));body.addView(row);}
    private void pageDialog(){EditText input=new EditText(this);input.setInputType(2);input.setText(String.valueOf(page));new AlertDialog.Builder(this).setTitle("رقم الصفحة من ١ إلى ٦٠٤").setView(input).setPositiveButton("فتح",(d,w)->{try{int n=Integer.parseInt(input.getText().toString());if(n<1||n>604)throw new Exception();page=n;renderPage();}catch(Exception e){toast("أدخل رقم صفحة صحيحًا");}}).setNegativeButton("إلغاء",null).show();}
    private void indexMenu(){new AlertDialog.Builder(this).setTitle("فهرس القرآن").setItems(new String[]{"السور","الأجزاء"},(d,choice)->{JSONArray list=choice==0?data.surahs:data.juzStarts;String[] names=new String[list.length()];for(int i=0;i<names.length;i++){JSONObject item=list.optJSONObject(i);names[i]=(choice==0?item.optString("name"):"الجزء "+item.optInt("number"))+" — صفحة "+item.optInt("page");}new AlertDialog.Builder(this).setTitle(choice==0?"السور":"الأجزاء").setItems(names,(dialog,index)->{page=list.optJSONObject(index).optInt("page");renderPage();}).show();}).show();}
    private void search(){EditText input=new EditText(this);input.setSingleLine(true);input.setHint("ابحث في نص الرواية المختارة");new AlertDialog.Builder(this).setTitle("البحث في القرآن").setView(input).setPositiveButton("بحث",(dialog,which)->{String term=QuranData.fold(input.getText().toString());if(term.length()<2){toast("اكتب حرفين على الأقل");return;}final QuranData source=data;clear(4,"نتائج البحث");final int token=request;worker.execute(()->{ArrayList<String> labels=new ArrayList<>();ArrayList<Integer> pages=new ArrayList<>();outer:for(int p=0;p<604;p++){JSONArray rows=source.pages.optJSONArray(p);for(int i=0;i<rows.length();i++){JSONObject v=rows.optJSONObject(i);if(QuranData.fold(v.optString("text")).contains(term)){labels.add(source.surahName(v.optInt("s"))+" : "+v.optInt("a")+"\n"+v.optString("text"));pages.add(p+1);if(labels.size()>=100)break outer;}}}main.post(()->{if(token!=request)return;body.removeAllViews();text("النتائج: "+labels.size()+" — تعرض أول ١٠٠ نتيجة");for(int i=0;i<labels.size();i++){final int p=pages.get(i);body.addView(button(labels.get(i),()->{page=p;renderPage();}));}body.addView(button("العودة إلى الصفحة",this::renderPage));});});}).setNegativeButton("إلغاء",null).show();}
    private JSONArray reciters;
    private int selectedReader=0,selectedSurah=1;
    private void audioScreen(){
        clear(2,"تلاوات القرآن");text(QuranData.NAMES[Arrays.asList(QuranData.IDS).indexOf(reading)]);body.addView(button("تغيير الرواية",()->readingMenu(this::audioScreen)));
        try{reciters=QuranData.audio(this,reading);String saved=preferences.getString("reader:"+reading,"");selectedReader=0;for(int i=0;i<reciters.length();i++)if(reciters.optJSONObject(i).optString("id").equals(saved))selectedReader=i;
            JSONObject reciter=reciters.optJSONObject(selectedReader);body.addView(button("القارئ: "+reciter.optString("name"),()->{String[] names=new String[reciters.length()];for(int i=0;i<names.length;i++)names[i]=reciters.optJSONObject(i).optString("name");new AlertDialog.Builder(this).setTitle("اختيار القارئ").setItems(names,(d,index)->{preferences.edit().putString("reader:"+reading,reciters.optJSONObject(index).optString("id")).apply();audioScreen();}).show();}));
            JSONArray available=reciter.getJSONArray("surahs");if(!contains(available,selectedSurah))selectedSurah=available.optInt(0);
            final QuranData source=QuranData.load(this,reading);body.addView(button("السورة: "+source.surahName(selectedSurah),()->{String[] names=new String[available.length()];for(int i=0;i<names.length;i++)names[i]=source.surahName(available.optInt(i));new AlertDialog.Builder(this).setTitle("اختيار السورة").setItems(names,(d,index)->{selectedSurah=available.optInt(index);audioScreen();}).show();}));
            body.addView(button("تشغيل التلاوة",()->play(reciter,source)));body.addView(button("إيقاف مؤقت / متابعة",()->startService(new Intent(this,AudioService.class).setAction(AudioService.TOGGLE))));body.addView(button("إيقاف التلاوة",()->startService(new Intent(this,AudioService.class).setAction(AudioService.STOP))));
            playerSeek=new SeekBar(this);playerSeek.setMax(Math.max(1,AudioService.duration()));playerSeek.setProgress(AudioService.position());playerSeek.setContentDescription("موضع تشغيل التلاوة");playerSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int n,boolean user){}public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){startService(new Intent(MainActivity.this,AudioService.class).setAction(AudioService.SEEK).putExtra("position",(long)b.getProgress()));}});body.addView(playerSeek);
            File local=AudioService.localFile(this,reading,reciter.optString("id"),selectedSurah);text(local.exists()?"هذه التلاوة محفوظة وتعمل دون إنترنت.":"التلاوة تحتاج اتصالًا. يمكنك حفظها للاستماع دون إنترنت.");
            body.addView(button(local.exists()?"التلاوة محفوظة على الجهاز":"تنزيل هذه التلاوة",()->download(reciter,selectedSurah,source.surahName(selectedSurah))));
            body.addView(button("المحتوى الصوتي المحفوظ",this::downloads));
            text("التلاوة تستمر عند قفل الشاشة. تحكم بها من إشعار التشغيل، وأوقفها من زر الإيقاف.");
        }catch(Exception e){text("تعذر فتح فهرس التلاوات.");}
    }
    private static boolean contains(JSONArray list,int n){for(int i=0;i<list.length();i++)if(list.optInt(i)==n)return true;return false;}
    private void play(JSONObject reciter,QuranData source){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},51);
        Intent intent=new Intent(this,AudioService.class).setAction(AudioService.PLAY).putExtra("reading",reading).putExtra("readerId",reciter.optString("id")).putExtra("reader",reciter.optString("name")).putExtra("server",reciter.optString("server")).putExtra("surah",selectedSurah).putExtra("surahs",reciter.optJSONArray("surahs").toString());startForegroundService(intent);toast("جارٍ تجهيز التلاوة…");}
    private void download(JSONObject reciter,int surah,String name){final String id=reading,reader=reciter.optString("id"),server=reciter.optString("server");File file=AudioService.localFile(this,id,reader,surah);if(file.exists()){toast("التلاوة محفوظة بالفعل");return;}if(!IN_FLIGHT_DOWNLOADS.add(file.getPath())){toast("التلاوة قيد التنزيل بالفعل");return;}toast("بدأ تنزيل سورة "+name);status.setText("جارٍ تنزيل سورة "+name+"…");
        FILE_IO.execute(()->{File temp=new File(file.getPath()+".part");try{file.getParentFile().mkdirs();URL url=new URL(server+String.format(Locale.US,"%03d.mp3",surah));if(!AudioService.safeAudioUrl(url))throw new IOException("Unapproved source");HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(20000);connection.setInstanceFollowRedirects(false);int code=connection.getResponseCode();if(code!=200)throw new IOException("HTTP "+code);String mime=connection.getContentType();if(mime!=null&&mime.contains("text/"))throw new IOException("Not audio");try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(temp)){byte[] block=new byte[32768];int n;long count=0;while((n=in.read(block))!=-1){out.write(block,0,n);count+=n;if(count>300L*1024*1024)throw new IOException("Too large");}if(count<1024)throw new IOException("Empty audio");}finally{connection.disconnect();}if(!temp.renameTo(file))throw new IOException("Save failed");main.post(()->{if(isDestroyed())return;status.setText("تم حفظ سورة "+name);toast("اكتمل التنزيل؛ التلاوة متاحة دون إنترنت");});}catch(Exception e){temp.delete();main.post(()->{if(isDestroyed())return;status.setText("تعذر التنزيل. تأكد من الاتصال والمساحة المتاحة.");toast("لم يكتمل تنزيل التلاوة");});}finally{IN_FLIGHT_DOWNLOADS.remove(file.getPath());}});
    }
    private void downloads(){clear(5,"التلاوات المحفوظة");File directory=new File(getFilesDir(),"audio");ArrayList<File> files=new ArrayList<>();collect(directory,files);if(files.isEmpty())text("لا توجد تلاوات محفوظة بعد. اختر تلاوة ثم اضغط تنزيل.");for(File file:files){String relative=directory.toPath().relativize(file.toPath()).toString();body.addView(button(relative,()->new AlertDialog.Builder(this).setTitle(relative).setItems(new String[]{"مشاركة الملف","حذف من الجهاز"},(dialog,choice)->{if(choice==0)AppFileProvider.share(this,file,"audio/mpeg");else new AlertDialog.Builder(this).setMessage("حذف هذه التلاوة فقط من الجهاز؟").setPositiveButton("حذف",(d,w)->{file.delete();downloads();}).setNegativeButton("إلغاء",null).show();}).show()));}}
    private void collect(File folder,ArrayList<File> out){File[] children=folder.listFiles();if(children==null)return;for(File file:children){if(file.isDirectory())collect(file,out);else if(file.getName().endsWith(".mp3"))out.add(file);}}
    private void sections(){clear(3,"كل أقسام سميع");String[][] sections={{"المصحف المصوّر والتفسير","/mushaf"},{"فهرس السور والروايات","/surahs"},{"المكتبة الصوتية الكاملة","/audio"},{"الأذكار والتسبيح","/adhkar"},{"الأحاديث النبوية","/hadith"},{"مواقيت الصلاة والقبلة","/prayer"},{"المكتبة الشرعية","/islamic-library"},{"تصميم الآيات المرئية","/visual-ayahs"},{"الدخول والملف الشخصي","/profile"},{"التواصل مع الإدارة","/messages"}};text("هذه الأقسام تفتح من موقع سميع داخل التطبيق، وتحتاج اتصالًا حسب المحتوى. القارئ والتلاوات المحفوظة يعملان محليًا.");for(String[] item:sections)body.addView(button(item[0],()->web(item[1])));}
    private void settings(){clear(6,"إعدادات القراءة");body.addView(button(night?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي",()->{night=!night;preferences.edit().putBoolean("night",night).apply();frame();settings();}));body.addView(button(awake?"إلغاء إبقاء الشاشة مضاءة أثناء القراءة":"إبقاء الشاشة مضاءة أثناء القراءة",()->{awake=!awake;preferences.edit().putBoolean("awake",awake).apply();settings();}));text("حجم خط القرآن");SeekBar size=new SeekBar(this);size.setMin(22);size.setMax(48);size.setProgress((int)fontSize);size.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar bar,int value,boolean fromUser){fontSize=value;preferences.edit().putFloat("font",fontSize).apply();}public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}});body.addView(size);text("سميع 1.1.0 — Android 8 أو أحدث. القرآن مخزّن داخل التطبيق، والتنزيلات الصوتية لا تُحذف عند تحديثه بنفس توقيعه.");}
    private void web(String path){startService(new Intent(this,AudioService.class).setAction(AudioService.PAUSE));startActivity(new Intent(this,AndroidActivity.class).putExtra("path",path));}
    private void toast(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
    @Override public void onBackPressed(){if(screen!=0)home();else new AlertDialog.Builder(this).setMessage("إغلاق التطبيق؟ ستستمر التلاوة إن كانت تعمل. يمكنك إيقافها من الإشعار.").setPositiveButton("إغلاق",(d,w)->finish()).setNegativeButton("متابعة",null).show();}
    @Override public void onDestroy(){super.onDestroy();request++;main.removeCallbacksAndMessages(null);worker.shutdown();}
}
