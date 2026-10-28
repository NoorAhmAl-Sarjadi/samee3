package app.samee3.quran;

import android.app.job.*;
import android.content.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.*;

/** Caches three months from the same prayer source/method used by the website. */
public final class PrayerRefreshJob extends JobService {
    static final int PERIODIC = 701, REFRESH = 702;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private Future<?> task;

    public static void schedule(Context context) {
        JobScheduler jobs = context.getSystemService(JobScheduler.class);
        if (jobs == null) return;
        JSONObject settings = ReminderSettings.read(context);
        if (!settings.optBoolean("prayer") || !settings.has("latitude")) { jobs.cancel(PERIODIC); jobs.cancel(REFRESH); return; }
        JobInfo info = new JobInfo.Builder(PERIODIC, new ComponentName(context, PrayerRefreshJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(12 * 60 * 60_000L).build();
        jobs.schedule(info);
        if (!ReminderSettings.prayerIdentity(settings).equals(ReminderSettings.prefs(context).getString("calendarIdentity", ""))
                || System.currentTimeMillis() - ReminderSettings.prefs(context).getLong("calendarUpdated", 0) > 24 * 60 * 60_000L) refresh(context);
    }

    public static void refresh(Context context) {
        JobScheduler jobs = context.getSystemService(JobScheduler.class);
        if (jobs != null) jobs.schedule(new JobInfo.Builder(REFRESH, new ComponentName(context, PrayerRefreshJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(0).setBackoffCriteria(60_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
    }

    @Override public boolean onStartJob(JobParameters params) {
        task = worker.submit(() -> {
            boolean retry = false;
            try { updateCalendar(this); }
            catch (Exception error) { retry = true; ReminderSettings.prefs(this).edit().putString("calendarError", "تعذر تحديث مواقيت الأذان. تحقق من الإنترنت وأعد المحاولة.").apply(); }
            jobFinished(params, retry);
        });
        return true;
    }

    @Override public boolean onStopJob(JobParameters params) { if (task != null) task.cancel(true); return true; }
    @Override public void onDestroy() { worker.shutdownNow(); super.onDestroy(); }

    static void updateCalendar(Context context) throws Exception {
        JSONObject settings = ReminderSettings.read(context);
        if (!settings.optBoolean("prayer") || !settings.has("latitude")) return;
        String identity = ReminderSettings.prayerIdentity(settings);
        ZoneId zone = ZoneId.of(settings.getString("timezone"));
        YearMonth start = YearMonth.now(zone);
        JSONArray days = new JSONArray();
        String until = "";
        for (int i = 0; i < 3; i++) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
            YearMonth month = start.plusMonths(i);
            String address = "https://api.aladhan.com/v1/calendar/" + month.getYear() + "/" + month.getMonthValue()
                    + "?latitude=" + settings.getDouble("latitude") + "&longitude=" + settings.getDouble("longitude")
                    + "&method=" + settings.getInt("method") + "&school=" + settings.getInt("school")
                    + "&timezonestring=" + URLEncoder.encode(zone.getId(), "UTF-8") + "&iso8601=true";
            JSONObject response = fetch(address);
            JSONArray monthDays = parseMonth(response, month, zone.getId());
            for (int day = 0; day < monthDays.length(); day++) {
                JSONObject value = monthDays.getJSONObject(day); days.put(value); until = value.getString("date");
            }
        }
        // Never write an old location's response over a newer selection or re-enable a disabled reminder.
        JSONObject current = ReminderSettings.read(context);
        if (Thread.currentThread().isInterrupted() || !current.optBoolean("prayer") || !identity.equals(ReminderSettings.prayerIdentity(current))) return;
        ReminderSettings.prefs(context).edit().putString("calendar", days.toString()).putString("calendarIdentity", identity)
                .putString("calendarUntil", until).putLong("calendarUpdated", System.currentTimeMillis()).remove("calendarError").apply();
        for (String key : ReminderSettings.PRAYERS) ReminderScheduler.schedule(context, key, System.currentTimeMillis());
    }

    static JSONArray parseMonth(JSONObject response, YearMonth month, String timezone) throws Exception {
        if (response.optInt("code") != 200) throw new IOException("Prayer source unavailable");
        JSONArray rows = response.getJSONArray("data"), days = new JSONArray();
        if (rows.length() != month.lengthOfMonth()) throw new IOException("Incomplete month");
        for (int day = 0; day < rows.length(); day++) {
            JSONObject row = rows.getJSONObject(day), result = new JSONObject();
            LocalDate date = LocalDate.parse(row.getJSONObject("date").getJSONObject("gregorian").getString("date"), DateTimeFormatter.ofPattern("dd-MM-uuuu"));
            if (!date.equals(month.atDay(day + 1))) throw new IOException("Unexpected prayer date");
            if (!timezone.equals(row.getJSONObject("meta").getString("timezone"))) throw new IOException("Unexpected timezone");
            result.put("date", date.toString());
            for (String prayer : ReminderSettings.PRAYERS) {
                // The API supplies the UTC offset for each date. This also works on an older
                // phone whose bundled timezone database predates a country's DST changes.
                OffsetDateTime time = OffsetDateTime.parse(row.getJSONObject("timings").getString(prayer));
                if (!time.toLocalDate().equals(date) && !(prayer.equals("Isha") && time.toLocalDate().equals(date.plusDays(1)))) throw new IOException("Prayer instant belongs to another day");
                result.put(prayer, time.toInstant().toEpochMilli());
            }
            days.put(result);
        }
        return days;
    }

    private static JSONObject fetch(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(15_000); connection.setReadTimeout(20_000); connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json");
        try {
            if (connection.getResponseCode() != 200) throw new IOException("HTTP " + connection.getResponseCode());
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] block = new byte[8192]; int count;
                while ((count = input.read(block)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
                    output.write(block, 0, count); if (output.size() > 2 * 1024 * 1024) throw new IOException("Response too large");
                }
                return new JSONObject(output.toString("UTF-8"));
            }
        } finally { connection.disconnect(); }
    }
}
