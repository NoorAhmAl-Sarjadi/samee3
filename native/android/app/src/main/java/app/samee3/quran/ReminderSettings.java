package app.samee3.quran;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.ZoneId;
import java.util.Arrays;

/** Device-local preferences. No account or Firebase permission is required. */
public final class ReminderSettings {
    public static final String[] PRAYERS = {"Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"};
    public static final String[] PRAYER_NAMES = {"الفجر", "الظهر", "العصر", "المغرب", "العشاء"};
    private ReminderSettings() {}

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("samee3_reminders_v1", Context.MODE_PRIVATE);
    }

    public static JSONObject read(Context context) {
        try { return normalize(new JSONObject(prefs(context).getString("settings", "{}"))); }
        catch (Exception ignored) { return normalize(new JSONObject()); }
    }

    public static JSONObject normalize(JSONObject input) {
        JSONObject out = new JSONObject();
        try {
            for (String key : new String[]{"quran", "adhkar", "hadith", "prayer", "audio", "library"})
                out.put(key, input.opt(key) instanceof Boolean && input.optBoolean(key));
            out.put("fullAdhan", input.optBoolean("fullAdhan", true));
            String voice = input.optString("adhanVoice", "ali-mulla"), fajrVoice = input.optString("fajrVoice", "makkah-fajr");
            out.put("adhanVoice", voice.matches("[a-z0-9-]{1,60}") ? voice : "ali-mulla");
            out.put("fajrVoice", fajrVoice.matches("[a-z0-9-]{1,60}") ? fajrVoice : "makkah-fajr");
            out.put("adhanVolume", Math.max(1, Math.min(100, input.optInt("adhanVolume", 70))));
            out.put("quranTime", time(input.optString("quranTime"), "20:00"));
            out.put("morningTime", time(input.optString("morningTime"), "07:00"));
            out.put("eveningTime", time(input.optString("eveningTime"), "17:00"));
            out.put("audioTime", time(input.optString("audioTime"), "13:00"));
            out.put("libraryTime", time(input.optString("libraryTime"), "19:00"));
            int hours = input.optInt("hadithHours", 3);
            out.put("hadithHours", Arrays.asList(1, 2, 3, 4, 6, 12, 24).contains(hours) ? hours : 3);
            int start = input.optInt("hadithStart", 8), end = input.optInt("hadithEnd", 22);
            if (start < 0 || start > 22 || end < 1 || end > 24 || start >= end) { start = 8; end = 22; }
            out.put("hadithStart", start).put("hadithEnd", end);
            String zone = input.optString("timezone", ZoneId.systemDefault().getId());
            try { ZoneId.of(zone); } catch (Exception ignored) { zone = ZoneId.systemDefault().getId(); }
            out.put("timezone", zone);
            // A prayer location is never silently replaced with Muscat or another city.
            double lat = input.optDouble("latitude", Double.NaN), lng = input.optDouble("longitude", Double.NaN);
            if (Double.isFinite(lat) && Double.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                out.put("latitude", lat).put("longitude", lng);
            }
            String city = input.optString("city", "الموقع المختار").trim();
            out.put("city", city.substring(0, Math.min(100, city.length())));
            int method = input.optInt("method", 8);
            out.put("method", Arrays.asList(1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 15, 18, 19, 20, 21, 22, 23).contains(method) ? method : 8);
            out.put("school", input.optInt("school", 0) == 1 ? 1 : 0);
            JSONArray selected = input.optJSONArray("prayers"), prayers = new JSONArray();
            for (String id : PRAYERS) {
                boolean enabled = selected == null;
                if (selected != null) for (int i = 0; i < selected.length(); i++) enabled |= id.equals(selected.optString(i));
                if (enabled) prayers.put(id);
            }
            out.put("prayers", prayers);
        } catch (Exception error) { throw new IllegalStateException(error); }
        return out;
    }

    public static JSONObject save(Context context, JSONObject input) {
        JSONObject value = normalize(input);
        JSONObject previous = read(context);
        // Invalidate schedules immediately when the location/calculation changes.
        if (!prayerIdentity(previous).equals(prayerIdentity(value))) {
            prefs(context).edit().remove("calendar").remove("calendarIdentity").remove("calendarUntil").apply();
        }
        prefs(context).edit().putString("settings", value.toString()).apply();
        return value;
    }

    public static String prayerIdentity(JSONObject value) {
        return value.optString("latitude") + ":" + value.optString("longitude") + ":" + value.optInt("method")
                + ":" + value.optInt("school") + ":" + value.optString("timezone");
    }

    public static boolean prayerEnabled(JSONObject settings, String id) {
        if (!settings.optBoolean("prayer")) return false;
        JSONArray ids = settings.optJSONArray("prayers");
        if (ids != null) for (int i = 0; i < ids.length(); i++) if (id.equals(ids.optString(i))) return true;
        return false;
    }

    private static String time(String value, String fallback) {
        return value.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]") ? value : fallback;
    }
}
