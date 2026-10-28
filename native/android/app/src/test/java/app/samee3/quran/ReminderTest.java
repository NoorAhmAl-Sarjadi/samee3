package app.samee3.quran;

import android.app.*;
import android.content.*;
import android.os.Looper;
import android.webkit.WebView;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.time.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@LooperMode(LooperMode.Mode.PAUSED)
public class ReminderTest {
    private Context context;
    @Before public void reset() {
        context = RuntimeEnvironment.getApplication();
        ReminderSettings.prefs(context).edit().clear().commit();
        org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);
    }
    private JSONObject settings() throws Exception { return new JSONObject().put("timezone", "Asia/Muscat"); }
    private long instant(String value) { return ZonedDateTime.parse(value).toInstant().toEpochMilli(); }

    @Test public void firstInstallDoesNotOptUsersIntoAnyReminder() {
        JSONObject value = ReminderSettings.read(context);
        for (String key : ReminderScheduler.KEYS) assertFalse(ReminderScheduler.enabled(value, key));
        ReminderScheduler.reschedule(context);
        for (String key : ReminderScheduler.KEYS) assertEquals(0, ReminderSettings.prefs(context).getLong("next:" + key, 0));
    }

    @Test public void hadithRemindersRespectDailyWindowAndDoNotWakeUserAtNight() throws Exception {
        JSONObject value = ReminderSettings.normalize(settings().put("hadith", true).put("hadithHours", 3).put("hadithStart", 8).put("hadithEnd", 22));
        assertEquals(instant("2026-10-29T11:00:00+04:00"), ReminderScheduler.next(context, value, "hadith", instant("2026-10-29T08:00:01+04:00")));
        assertEquals(instant("2026-10-30T08:00:00+04:00"), ReminderScheduler.next(context, value, "hadith", instant("2026-10-29T21:30:00+04:00")));
        value.put("hadithHours", 24);
        assertEquals(instant("2026-10-30T08:00:00+04:00"), ReminderScheduler.next(context, value, "hadith", instant("2026-10-29T08:00:01+04:00")));
    }

    @Test public void dailyAndWeeklySchedulesUseSelectedTimezoneAndHandleMidnight() throws Exception {
        JSONObject value = ReminderSettings.normalize(settings().put("quran", true).put("quranTime", "00:05").put("libraryTime", "19:00"));
        assertEquals(instant("2026-10-30T00:05:00+04:00"), ReminderScheduler.next(context, value, "quran", instant("2026-10-29T23:59:00+04:00")));
        assertEquals(instant("2026-10-30T19:00:00+04:00"), ReminderScheduler.next(context, value, "library", instant("2026-10-29T23:59:00+04:00")));
        assertEquals(instant("2026-11-06T19:00:00+04:00"), ReminderScheduler.next(context, value, "library", instant("2026-10-30T20:00:00+04:00")));
    }

    @Test public void disablingCategoryCancelsItsAlreadyScheduledAlarm() throws Exception {
        ReminderSettings.save(context, settings().put("quran", true)); ReminderScheduler.reschedule(context);
        assertTrue(ReminderSettings.prefs(context).getLong("next:quran", 0) > System.currentTimeMillis());
        ReminderSettings.save(context, settings().put("quran", false)); ReminderScheduler.reschedule(context);
        assertEquals(0, ReminderSettings.prefs(context).getLong("next:quran", 0));
    }

    @Test public void changingLocationOrMethodInvalidatesOldPrayerTimes() throws Exception {
        JSONObject value = settings().put("prayer", true).put("latitude", 23.588).put("longitude", 58.3829).put("method", 8);
        ReminderSettings.save(context, value);
        String identity = ReminderSettings.prayerIdentity(ReminderSettings.read(context));
        ReminderSettings.prefs(context).edit().putString("calendarIdentity", identity).putString("calendarUntil", "2027-01-31")
                .putString("calendar", new JSONArray().put(new JSONObject().put("Fajr", System.currentTimeMillis() + 60_000)).toString()).commit();
        assertTrue(ReminderScheduler.next(context, ReminderSettings.read(context), "Fajr", System.currentTimeMillis()) > 0);
        value.put("method", 4); ReminderSettings.save(context, value);
        assertEquals(-1, ReminderScheduler.next(context, ReminderSettings.read(context), "Fajr", System.currentTimeMillis()));
        assertEquals("", ReminderSettings.prefs(context).getString("calendarUntil", ""));
    }

    @Test public void notificationsContainActualHadithAndTapTargetsItsExactText() throws Exception {
        ReminderReceiver.show(context, "hadith", true);
        Notification item = org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).getNotification(499);
        assertNotNull(item);
        String text = item.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).toString();
        assertTrue(text.contains("صحيح البخاري")); assertTrue(text.length() > 50);
        Intent tap = org.robolectric.Shadows.shadowOf(item.contentIntent).getSavedIntent();
        assertEquals(AndroidActivity.class.getName(), tap.getComponent().getClassName());
        assertTrue(tap.getStringExtra("path").startsWith("/notifications/hadith?id=bukhari-"));
        assertEquals(0, ReminderSettings.prefs(context).getInt("hadithIndex", 0));
    }

    @Test public void obsoleteAndLatePrayerAlarmsDoNotPostMisleadingNotifications() throws Exception {
        JSONObject value = settings().put("prayer", true).put("latitude", 23.588).put("longitude", 58.3829);
        ReminderSettings.save(context, value);
        long late = System.currentTimeMillis() - 10 * 60_000;
        ReminderSettings.prefs(context).edit().putLong("next:Fajr", late).commit();
        Intent alarm = new Intent(context, ReminderReceiver.class).setAction(ReminderScheduler.ACTION).putExtra("key", "Fajr").putExtra("at", late);
        new ReminderReceiver().onReceive(context, alarm);
        assertEquals(0, org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).size());
    }

    @Test public void androidLauncherUsesOriginalWebsiteWhileOfflineReaderRemainsNative() throws Exception {
        var controller = Robolectric.buildActivity(AndroidActivity.class).setup();
        AndroidActivity activity = controller.get();
        java.lang.reflect.Field field = WebActivity.class.getDeclaredField("web"); field.setAccessible(true);
        WebView web = (WebView) field.get(activity);
        assertEquals("https://samee3.vercel.app/", web.getUrl()); assertTrue(web.getSettings().getJavaScriptEnabled());
        assertFalse(web.getSettings().getAllowFileAccess()); assertTrue(activity.originalDesign());
        assertTrue(web.getSettings().getUserAgentString().contains("SAMEE3Android/1.1"));
        assertTrue(WebActivity.trusted(android.net.Uri.parse("https://samee3.vercel.app/notifications")));
        assertFalse(WebActivity.trusted(android.net.Uri.parse("https://samee3.vercel.app.evil.example/")));
        controller.pause().stop().destroy();
    }

    @Test public void prayerCalendarUsesExplicitServerOffsetsAndRejectsWrongDates() throws Exception {
        JSONArray rows = new JSONArray();
        for (int day = 1; day <= 30; day++) {
            String date = String.format(java.util.Locale.US, "2026-04-%02d", day);
            JSONObject times = new JSONObject();
            for (String key : ReminderSettings.PRAYERS) times.put(key, date + "T04:30:00+03:00");
            rows.put(new JSONObject().put("date", new JSONObject().put("gregorian", new JSONObject().put("date", String.format(java.util.Locale.US, "%02d-04-2026", day))))
                    .put("meta", new JSONObject().put("timezone", "Africa/Cairo")).put("timings", times));
        }
        JSONObject source = new JSONObject().put("code", 200).put("data", rows);
        JSONArray parsed = PrayerRefreshJob.parseMonth(source, YearMonth.of(2026, 4), "Africa/Cairo");
        assertEquals(Instant.parse("2026-04-30T01:30:00Z").toEpochMilli(), parsed.getJSONObject(29).getLong("Fajr"));
        rows.getJSONObject(29).getJSONObject("timings").put("Fajr", "2026-05-01T04:30:00+03:00");
        try { PrayerRefreshJob.parseMonth(source, YearMonth.of(2026, 4), "Africa/Cairo"); fail("Wrong prayer date accepted"); } catch (java.io.IOException expected) {}
    }

    @Test @Config(sdk = 33) public void deniedAndroid13PermissionDoesNotPretendToSendNotifications() throws Exception {
        org.robolectric.Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(android.Manifest.permission.POST_NOTIFICATIONS);
        ReminderSettings.save(context, settings().put("quran", true)); ReminderScheduler.reschedule(context);
        assertFalse(ReminderScheduler.allowed(context));
        ReminderReceiver.show(context, "hadith", true);
        assertEquals(0, org.robolectric.Shadows.shadowOf(context.getSystemService(NotificationManager.class)).size());
        assertEquals(0, ReminderSettings.prefs(context).getLong("next:quran", 0));
        org.robolectric.Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS);
        ReminderScheduler.reschedule(context); assertTrue(ReminderScheduler.allowed(context));
        assertTrue(ReminderSettings.prefs(context).getLong("next:quran", 0) > System.currentTimeMillis());
    }
}
