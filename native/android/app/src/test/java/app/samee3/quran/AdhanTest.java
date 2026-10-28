package app.samee3.quran;

import android.app.*;
import android.content.*;
import android.media.MediaPlayer;
import android.os.Looper;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.io.File;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@LooperMode(LooperMode.Mode.PAUSED)
public class AdhanTest {
    private Context context;
    @Before public void reset() { context = RuntimeEnvironment.getApplication(); ReminderSettings.prefs(context).edit().clear().commit(); }

    @Test public void twentyDistinctVoicesAndOneFajrRecordingHaveVerifiedSourceMetadata() throws Exception {
        JSONObject catalog = AdhanFiles.catalog(context); JSONArray voices = catalog.getJSONArray("voices");
        assertEquals(21, voices.length()); int ordinary = 0, fajr = 0; Set<String> hashes = new HashSet<>();
        for (int i = 0; i < voices.length(); i++) {
            JSONObject voice = voices.getJSONObject(i); if (voice.getBoolean("fajr")) fajr++; else ordinary++;
            assertTrue(hashes.add(voice.getString("sha256"))); assertTrue(voice.getLong("bytes") > 1000);
            assertTrue(voice.getDouble("durationSeconds") > 30);
            assertTrue(AdhanFiles.safeUrl(voice.getString("sourceUrl"), catalog.getString("sourceCommit")));
        }
        assertEquals(20, ordinary); assertEquals(1, fajr);
        assertFalse(AdhanFiles.safeUrl("https://samee3.vercel.app.evil.example/file.mp3", catalog.getString("sourceCommit")));
        assertFalse(AdhanFiles.safeUrl("http://samee3.vercel.app/android/adhan/ali-mulla.mp3", catalog.getString("sourceCommit")));
        assertFalse(AdhanFiles.validId(context, "../../private"));
    }

    @Test public void bundledAdhanAndFajrAreUsableWithoutAnyNetworkOrAccount() throws Exception {
        for (String id : new String[]{"ali-mulla", "makkah-fajr"}) {
            File file = AdhanFiles.ensure(context, id);
            assertTrue(file.isFile()); assertEquals(AdhanFiles.voice(context, id).getLong("bytes"), file.length());
        }
        assertEquals("makkah-fajr", AdhanFiles.selected(context, "Fajr"));
        assertEquals("ali-mulla", AdhanFiles.selected(context, "Dhuhr"));
    }

    @Test public void stoppingPreviewWhilePreparingPreventsLatePlayback() throws Exception {
        org.robolectric.shadows.ShadowMediaPlayer.setMediaInfoProvider(source -> new org.robolectric.shadows.ShadowMediaPlayer.MediaInfo(180000, 100));
        var controller = Robolectric.buildService(AdhanService.class).create(); AdhanService service = controller.get();
        service.onStartCommand(new Intent(context, AdhanService.class).setAction(AdhanService.PREVIEW).putExtra("voice", "ali-mulla"), 0, 1);
        java.lang.reflect.Field field = AdhanService.class.getDeclaredField("player"); field.setAccessible(true);
        long until = System.currentTimeMillis() + 10000;
        while (field.get(service) == null && System.currentTimeMillis() < until) { org.robolectric.Shadows.shadowOf(Looper.getMainLooper()).idle(); Thread.sleep(20); }
        MediaPlayer player = (MediaPlayer) field.get(service); assertNotNull(player);
        service.onStartCommand(new Intent(context, AdhanService.class).setAction(AdhanService.STOP), 0, 2);
        org.robolectric.Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(300));
        assertFalse(AdhanService.playing()); assertNull(field.get(service)); controller.destroy();
    }

    @Test public void aCurrentExactPrayerAlarmStartsFullAdhanAndProvidesAnOpenAction() throws Exception {
        org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);
        ReminderSettings.save(context, new JSONObject().put("prayer", true).put("fullAdhan", true));
        long now = System.currentTimeMillis(); ReminderSettings.prefs(context).edit().putLong("next:Fajr", now).commit();
        new ReminderReceiver().onReceive(context, new Intent(context, ReminderReceiver.class).setAction(ReminderScheduler.ACTION)
                .putExtra("key", "Fajr").putExtra("at", now).putExtra("exact", true));
        Intent started = org.robolectric.Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService();
        assertNotNull(started); assertEquals(AdhanService.class.getName(), started.getComponent().getClassName());
        assertEquals("Fajr", started.getStringExtra("prayer"));
    }

    @Test public void anInexactFallbackPostsNotificationWithoutAnIllegalBackgroundMediaStart() throws Exception {
        org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);
        ReminderSettings.save(context, new JSONObject().put("prayer", true).put("fullAdhan", true));
        long now = System.currentTimeMillis(); ReminderSettings.prefs(context).edit().putLong("next:Fajr", now).commit();
        new ReminderReceiver().onReceive(context, new Intent(context, ReminderReceiver.class).setAction(ReminderScheduler.ACTION)
                .putExtra("key", "Fajr").putExtra("at", now).putExtra("exact", false));
        assertNull(org.robolectric.Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedService());
        assertEquals(1, org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).size());
    }
}
