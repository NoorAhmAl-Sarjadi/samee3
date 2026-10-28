package app.samee3.quran;

import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import android.app.*;
import android.content.*;
import android.os.Looper;
import android.view.*;
import android.widget.*;
import android.webkit.*;
import java.lang.reflect.*;
import java.net.URL;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
@LooperMode(LooperMode.Mode.PAUSED)
public class NativeAppTest {
    private static Button button(View view,String text){if(view instanceof Button&&text.equals(((Button)view).getText().toString()))return (Button)view;if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){Button found=button(group.getChildAt(i),text);if(found!=null)return found;}}return null;}
    private static <T> T field(Object object,String name)throws Exception{Field field=object.getClass().getDeclaredField(name);field.setAccessible(true);return (T)field.get(object);}
    private static void await(MainActivity activity,String text)throws Exception{long until=System.currentTimeMillis()+15000;while(System.currentTimeMillis()<until){org.robolectric.Shadows.shadowOf(Looper.getMainLooper()).idle();if(button(activity.getWindow().getDecorView(),text)!=null)return;Thread.sleep(30);}fail("Missing native control "+text);}
    @Test public void allSevenBundledReadingsHaveEveryPageSurahAndCorrectJuz()throws Exception {
        Context context=RuntimeEnvironment.getApplication();
        for(String id:QuranData.IDS){QuranData book=QuranData.load(context,id);assertEquals(id,book.id);assertEquals(604,book.pages.length());assertEquals(114,book.surahs.length());for(int p=0;p<604;p++)assertTrue(book.pages.getJSONArray(p).length()>0);assertEquals(9,book.juzStarts.getJSONObject(10).getInt("surah"));}
    }
    @Test public void nativeHomeReaderPaginationAndBookmarkWorkWithoutWebView()throws Exception {
        var controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();
        assertNotNull(button(activity.getWindow().getDecorView(),"كل أقسام سميع"));
        button(activity.getWindow().getDecorView(),"المصحف").performClick();await(activity,"حفظ علامة في هذه الصفحة");
        button(activity.getWindow().getDecorView(),"التالية").performClick();button(activity.getWindow().getDecorView(),"حفظ علامة في هذه الصفحة").performClick();
        assertEquals(2,activity.getSharedPreferences("samee3_native_v1",0).getInt("page:hafs",0));assertEquals(2,activity.getSharedPreferences("samee3_native_v1",0).getInt("bookmark:hafs",0));
        button(activity.getWindow().getDecorView(),"السابقة").performClick();button(activity.getWindow().getDecorView(),"فتح العلامة المحفوظة").performClick();assertEquals(2,activity.getSharedPreferences("samee3_native_v1",0).getInt("page:hafs",0));controller.pause().stop().destroy();
    }
    @Test public void audioCatalogsNeverSubstituteAnotherReading()throws Exception {
        Context context=RuntimeEnvironment.getApplication();for(String id:QuranData.IDS){var rows=QuranData.audio(context,id);assertTrue(rows.length()>0);for(int i=0;i<rows.length();i++){var row=rows.getJSONObject(i);assertTrue(AudioService.safeAudioUrl(new URL(row.getString("server"))));assertTrue(row.getJSONArray("surahs").length()>0);assertTrue(row.getString("id").matches("[0-9]+-[0-9]+"));}}
        assertFalse(AudioService.safeAudioUrl(new URL("http://server8.mp3quran.net/001.mp3")));assertFalse(AudioService.safeAudioUrl(new URL("https://mp3quran.net.evil.example/001.mp3")));assertFalse(AudioService.safeAudioUrl(new URL("https://user:password@mp3quran.net/001.mp3")));
    }
    @Test public void webSectionsDisallowLocalFilesMixedContentAndArbitraryNavigation()throws Exception {
        Intent intent=new Intent(RuntimeEnvironment.getApplication(),WebActivity.class).putExtra("path","//evil.example");var controller=Robolectric.buildActivity(WebActivity.class,intent).setup();WebActivity activity=controller.get();WebView web=field(activity,"web");
        assertEquals("https://samee3.vercel.app/",web.getUrl());assertFalse(web.getSettings().getAllowFileAccess());assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,web.getSettings().getMixedContentMode());assertNull(org.robolectric.Shadows.shadowOf(web).getJavascriptInterface("Samee3NativeDownloads"));controller.pause().stop().destroy();
    }
    @Test public void pausingPendingAudioPreventsLatePlayback()throws Exception {
        org.robolectric.shadows.ShadowMediaPlayer.setMediaInfoProvider(source -> new org.robolectric.shadows.ShadowMediaPlayer.MediaInfo(60000,100));
        Context context=RuntimeEnvironment.getApplication();var reciter=QuranData.audio(context,"hafs").getJSONObject(0);int surah=reciter.getJSONArray("surahs").getInt(0);
        var controller=Robolectric.buildService(AudioService.class).create();AudioService service=controller.get();
        Intent play=new Intent(context,AudioService.class).setAction(AudioService.PLAY).putExtra("reading","hafs").putExtra("readerId",reciter.getString("id")).putExtra("reader",reciter.getString("name")).putExtra("server",reciter.getString("server")).putExtra("surah",surah).putExtra("surahs",reciter.getJSONArray("surahs").toString());
        service.onStartCommand(play,0,1);service.onStartCommand(new Intent(context,AudioService.class).setAction(AudioService.PAUSE),0,2);
        org.robolectric.Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(200));android.media.MediaPlayer player=field(service,"player");assertNotNull(player);assertFalse(player.isPlaying());
        service.onStartCommand(new Intent(context,AudioService.class).setAction(AudioService.TOGGLE),0,3);assertTrue(player.isPlaying());service.onStartCommand(new Intent(context,AudioService.class).setAction(AudioService.STOP),0,4);controller.destroy();
    }
}
