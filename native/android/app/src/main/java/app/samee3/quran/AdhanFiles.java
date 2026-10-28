package app.samee3.quran;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** Verified recordings only. A page selects an ID, never an arbitrary download URL. */
public final class AdhanFiles {
    private static JSONObject catalog;
    private static final ExecutorService IO = Executors.newFixedThreadPool(2);
    private static final Map<String, Object> LOCKS = new ConcurrentHashMap<>();
    private static final Set<String> IN_FLIGHT = ConcurrentHashMap.newKeySet();
    private static final Map<String, String> STATES = new ConcurrentHashMap<>();
    private AdhanFiles() {}

    public static synchronized JSONObject catalog(Context context) throws Exception {
        if (catalog == null) try (InputStream input = context.getAssets().open("adhan-catalog.json"); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] block = new byte[8192]; int n;
            while ((n = input.read(block)) != -1) output.write(block, 0, n);
            catalog = new JSONObject(output.toString("UTF-8"));
        }
        return catalog;
    }

    public static JSONObject voice(Context context, String id) throws Exception {
        if (id == null || !id.matches("[a-z0-9-]{1,60}")) throw new IOException("Invalid voice");
        JSONArray rows = catalog(context).getJSONArray("voices");
        for (int i = 0; i < rows.length(); i++) if (id.equals(rows.getJSONObject(i).getString("id"))) return rows.getJSONObject(i);
        throw new IOException("Unknown voice");
    }

    public static boolean validId(Context context, String id) { try { voice(context, id); return true; } catch (Exception ignored) { return false; } }
    private static File file(Context context, String id) { return new File(new File(context.getFilesDir(), "adhan"), id + ".mp3"); }
    public static boolean available(Context context, String id) { try { return file(context, id).isFile() || voice(context, id).optBoolean("bundled"); } catch (Exception ignored) { return false; } }

    public static String selected(Context context, String prayer) {
        JSONObject settings = ReminderSettings.read(context);
        String id = settings.optString(prayer.equals("Fajr") ? "fajrVoice" : "adhanVoice", prayer.equals("Fajr") ? "makkah-fajr" : "ali-mulla");
        return available(context, id) ? id : prayer.equals("Fajr") ? "makkah-fajr" : "ali-mulla";
    }

    public static void download(Context context, String id) {
        Context app = context.getApplicationContext();
        if (!validId(app, id) || !IN_FLIGHT.add(id)) return;
        STATES.put(id, "downloading");
        IO.execute(() -> { try { ensure(app, id); STATES.put(id, "ready"); }
            catch (Exception error) { STATES.put(id, "error"); }
            finally { IN_FLIGHT.remove(id); } });
    }

    public static JSONObject states(Context context) {
        JSONObject value = new JSONObject();
        try { JSONArray rows = catalog(context).getJSONArray("voices");
            for (int i = 0; i < rows.length(); i++) { String id = rows.getJSONObject(i).getString("id"); value.put(id, available(context, id) ? "ready" : STATES.getOrDefault(id, "missing")); }
        } catch (Exception ignored) {}
        return value;
    }

    public static File ensure(Context context, String id) throws Exception {
        if (!validId(context, id)) throw new IOException("Unknown voice");
        synchronized (LOCKS.computeIfAbsent(id, key -> new Object())) { return ensureLocked(context, id); }
    }

    private static File ensureLocked(Context context, String id) throws Exception {
        JSONObject voice = voice(context, id);
        File complete = file(context, id);
        if (complete.isFile() && matches(complete, voice)) return complete;
        if (complete.exists()) complete.delete();
        complete.getParentFile().mkdirs();
        File temporary = new File(complete.getPath() + ".part");
        try {
            if (voice.optBoolean("bundled")) {
                try (InputStream input = context.getAssets().open("adhan/" + id + ".mp3")) { copy(input, temporary, voice.getLong("bytes")); }
            } else {
                Exception last = null;
                for (String key : new String[]{"url", "sourceUrl"}) {
                    try { downloadUrl(voice.getString(key), temporary, voice.getLong("bytes"), catalog(context).getString("sourceCommit")); last = null; break; }
                    catch (Exception error) { last = error; temporary.delete(); }
                }
                if (last != null) throw last;
            }
            if (!matches(temporary, voice) || !temporary.renameTo(complete)) throw new IOException("Audio verification failed");
            return complete;
        } finally { if (temporary.exists()) temporary.delete(); }
    }

    static boolean safeUrl(String address, String commit) {
        try {
            URI uri = new URI(address);
            if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getFragment() != null || uri.getQuery() != null) return false;
            return ("samee3.vercel.app".equals(uri.getHost()) && uri.getPath().matches("/android/adhan/[a-z0-9-]+\\.mp3"))
                    || ("raw.githubusercontent.com".equals(uri.getHost()) && commit.matches("[a-f0-9]{40}") && uri.getPath().startsWith("/Kiwifu/adhan-mp3/" + commit + "/") && uri.getPath().endsWith(".mp3"));
        } catch (Exception ignored) { return false; }
    }

    private static void downloadUrl(String address, File output, long size, String commit) throws Exception {
        if (!safeUrl(address, commit)) throw new IOException("Unapproved audio source");
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(12_000); connection.setReadTimeout(20_000); connection.setInstanceFollowRedirects(false);
        try { if (connection.getResponseCode() != 200) throw new IOException("Audio unavailable");
            try (InputStream input = connection.getInputStream()) { copy(input, output, size); }
        } finally { connection.disconnect(); }
    }

    private static void copy(InputStream input, File file, long expected) throws IOException {
        if (expected < 1000 || expected > 12 * 1024 * 1024) throw new IOException("Invalid audio size");
        try (OutputStream output = new FileOutputStream(file)) {
            byte[] block = new byte[16384]; int n; long bytes = 0;
            while ((n = input.read(block)) != -1) { if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException(); bytes += n; if (bytes > expected) throw new IOException("Audio too large"); output.write(block, 0, n); }
            if (bytes != expected) throw new IOException("Incomplete audio");
        }
    }

    private static boolean matches(File file, JSONObject voice) throws Exception {
        if (file.length() != voice.getLong("bytes")) return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) { byte[] block = new byte[16384]; int n; while ((n = input.read(block)) != -1) digest.update(block, 0, n); }
        StringBuilder hex = new StringBuilder(); for (byte value : digest.digest()) hex.append(String.format(Locale.US, "%02x", value & 255));
        return hex.toString().equals(voice.getString("sha256"));
    }
}
