package app.samee3.quran;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.*;
import java.time.*;
import java.util.*;

/** One pending alarm per category; no timers, running WebView, or logged-in user. */
public final class ReminderScheduler {
    public static final String ACTION = "app.samee3.quran.REMINDER";
    public static final String[] KEYS = {"quran", "morning", "evening", "hadith", "audio", "library", "Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"};
    private ReminderScheduler() {}

    public static boolean allowed(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager != null && manager.areNotificationsEnabled()
                && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }

    public static boolean exactAllowed(Context context) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        return manager != null && (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms());
    }

    public static boolean enabled(JSONObject settings, String key) {
        if (key.equals("morning") || key.equals("evening")) return settings.optBoolean("adhkar");
        if (Arrays.asList(ReminderSettings.PRAYERS).contains(key)) return ReminderSettings.prayerEnabled(settings, key);
        return settings.optBoolean(key);
    }

    public static synchronized void reschedule(Context context) {
        for (String key : KEYS) schedule(context, key, System.currentTimeMillis());
        PrayerRefreshJob.schedule(context);
    }

    static PendingIntent pending(Context context, String key, long at) {
        int code = Arrays.asList(KEYS).indexOf(key);
        if (code < 0) throw new IllegalArgumentException("Unknown category");
        return PendingIntent.getBroadcast(context, 300 + code,
                new Intent(context, ReminderReceiver.class).setAction(ACTION).setData(android.net.Uri.parse("samee3://reminder/" + key)).putExtra("key", key).putExtra("at", at).putExtra("exact", Arrays.asList(ReminderSettings.PRAYERS).contains(key) && exactAllowed(context)),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static synchronized void schedule(Context context, String key, long now) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        PendingIntent intent = pending(context, key, 0);
        alarms.cancel(intent);
        ReminderSettings.prefs(context).edit().remove("next:" + key).apply();
        JSONObject settings = ReminderSettings.read(context);
        if (!allowed(context) || !enabled(settings, key)) return;
        long at = next(context, settings, key, now);
        if (at <= now) return;
        intent = pending(context, key, at);
        ReminderSettings.prefs(context).edit().putLong("next:" + key, at).apply();
        // Only prayer notifications need precise timing. Daily reading reminders may be batched.
        try {
            if (Arrays.asList(ReminderSettings.PRAYERS).contains(key) && exactAllowed(context)) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
            } else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        } catch (SecurityException revoked) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        }
    }

    public static long next(Context context, JSONObject settings, String key, long now) {
        ZoneId zone = ZoneId.of(settings.optString("timezone", ZoneId.systemDefault().getId()));
        ZonedDateTime current = Instant.ofEpochMilli(now).atZone(zone);
        if (Arrays.asList(ReminderSettings.PRAYERS).contains(key)) {
            if (!ReminderSettings.prayerIdentity(settings).equals(ReminderSettings.prefs(context).getString("calendarIdentity", ""))) return -1;
            try {
                JSONArray calendar = new JSONArray(ReminderSettings.prefs(context).getString("calendar", "[]"));
                long next = Long.MAX_VALUE;
                for (int i = 0; i < calendar.length(); i++) {
                    long candidate = calendar.getJSONObject(i).optLong(key, -1);
                    if (candidate > now && candidate < next) next = candidate;
                }
                return next == Long.MAX_VALUE ? -1 : next;
            } catch (JSONException ignored) { return -1; }
        }
        for (int day = 0; day < 9; day++) {
            LocalDate date = current.toLocalDate().plusDays(day);
            if (key.equals("library") && date.getDayOfWeek() != DayOfWeek.FRIDAY) continue;
            if (key.equals("hadith")) {
                for (int hour = settings.optInt("hadithStart", 8); hour < settings.optInt("hadithEnd", 22); hour += settings.optInt("hadithHours", 3)) {
                    long candidate = date.atTime(hour, 0).atZone(zone).toInstant().toEpochMilli();
                    if (candidate > now) return candidate;
                }
            } else {
                String property = key.equals("morning") ? "morningTime" : key.equals("evening") ? "eveningTime" : key + "Time";
                long candidate = date.atTime(LocalTime.parse(settings.optString(property))).atZone(zone).toInstant().toEpochMilli();
                if (candidate > now) return candidate;
            }
        }
        return -1;
    }
}
