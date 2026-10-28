package app.samee3.quran;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.*;
import org.json.*;
import java.io.*;
import java.util.UUID;

/** An origin-bound TOP FRAME port. Never exposes addJavascriptInterface to frames. */
final class AndroidBridge {
    static final int PERMISSION_REQUEST = 83;
    private final WebActivity host;
    private WebMessagePort port;
    private String permissionRequest;
    private long lastTest;

    AndroidBridge(WebActivity host) { this.host = host; }

    void attach(WebView web) {
        close();
        try {
            String token = "samee3-native:" + UUID.randomUUID();
            WebMessagePort[] channel = web.createWebMessageChannel();
            port = channel[0];
            port.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                @Override public void onMessage(WebMessagePort source, WebMessage message) {
                    if (source != port || host.isDestroyed() || !WebActivity.trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                    String data = message.getData();
                    if (data == null || data.length() > 32_768) return;
                    try { receive(new JSONObject(data)); } catch (Exception ignored) {}
                }
            });
            String script;
            try (InputStream input = host.getAssets().open("android-bridge.js"); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] data = new byte[4096]; int n;
                while ((n = input.read(data)) != -1) out.write(data, 0, n);
                script = out.toString("UTF-8");
            }
            final WebMessagePort current = port;
            web.evaluateJavascript("(" + script + ")(" + JSONObject.quote(token) + ");", ignored -> {
                if (port == current && !host.isDestroyed() && WebActivity.trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) {
                    web.postWebMessage(new WebMessage(token, new WebMessagePort[]{channel[1]}), Uri.parse("https://samee3.vercel.app"));
                } else channel[1].close();
            });
        } catch (Exception ignored) { close(); }
    }

    private void receive(JSONObject request) throws Exception {
        String id = request.optString("id"), type = request.optString("type");
        if (!id.matches("[a-zA-Z0-9_-]{1,80}")) return;
        switch (type) {
            case "status": reply(id, status(), null); break;
            case "saveSettings":
                ReminderSettings.save(host, request.getJSONObject("payload"));
                ReminderReceiver.channels(host); ReminderScheduler.reschedule(host);
                JSONObject settings = ReminderSettings.read(host);
                if (settings.optBoolean("prayer") && settings.optBoolean("fullAdhan")) {
                    AdhanFiles.download(host, settings.optString("adhanVoice", "ali-mulla")); AdhanFiles.download(host, settings.optString("fajrVoice", "makkah-fajr"));
                }
                reply(id, status(), null); break;
            case "permission":
                if (permissionRequest != null) { reply(id, null, "يوجد طلب إذن مفتوح بالفعل."); break; }
                if (Build.VERSION.SDK_INT >= 33 && host.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    permissionRequest = id;
                    host.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST);
                } else { ReminderScheduler.reschedule(host); reply(id, status(), null); }
                break;
            case "exactPermission":
                if (Build.VERSION.SDK_INT >= 31 && !ReminderScheduler.exactAllowed(host)) {
                    new AlertDialog.Builder(host).setTitle("دقة تنبيهات الصلاة")
                            .setMessage("اسمح لسميع بجدولة التنبيهات الدقيقة من صفحة المنبّهات والتذكيرات. بدون الإذن قد يؤخّر أندرويد تنبيه الصلاة.")
                            .setPositiveButton("فتح الإعدادات", (d, w) -> open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + host.getPackageName()))))
                            .setNegativeButton("لاحقًا", null).show();
                }
                reply(id, status(), null); break;
            case "notificationSettings":
                open(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, host.getPackageName()));
                reply(id, status(), null); break;
            case "refreshPrayer": PrayerRefreshJob.refresh(host); reply(id, status(), null); break;
            case "test":
                if (!ReminderScheduler.allowed(host)) { reply(id, null, "اسمح بإشعارات سميع من إعدادات الهاتف أولًا."); break; }
                if (System.currentTimeMillis() - lastTest < 5_000) { reply(id, null, "انتظر ثواني قبل الاختبار التالي."); break; }
                lastTest = System.currentTimeMillis(); ReminderReceiver.show(host, "hadith", true); reply(id, status(), null); break;
            case "adhanDownload":
                String downloadVoice = request.getJSONObject("payload").optString("id");
                if (!AdhanFiles.validId(host, downloadVoice)) { reply(id, null, "الصوت غير موجود في المكتبة."); break; }
                AdhanFiles.download(host, downloadVoice); reply(id, status(), null); break;
            case "adhanDownloadAll":
                JSONArray voices = AdhanFiles.catalog(host).getJSONArray("voices");
                for (int i = 0; i < voices.length(); i++) AdhanFiles.download(host, voices.getJSONObject(i).getString("id"));
                reply(id, status(), null); break;
            case "adhanPreview":
                String previewVoice = request.getJSONObject("payload").optString("id");
                if (!AdhanFiles.validId(host, previewVoice)) { reply(id, null, "الصوت غير موجود في المكتبة."); break; }
                host.startForegroundService(new Intent(host, AdhanService.class).setAction(AdhanService.PREVIEW).putExtra("voice", previewVoice));
                reply(id, status(), null); break;
            case "adhanStop": AdhanService.stop(host); reply(id, status(), null); break;
            case "share":
                host.startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT, "مصحف سميع").putExtra(Intent.EXTRA_TEXT, "مصحف سميع — القرآن والأذكار والأحاديث ومواقيت الصلاة\nhttps://samee3.vercel.app/"), "مشاركة سميع"));
                reply(id, status(), null); break;
            case "offline": host.startActivity(new Intent(host, MainActivity.class)); reply(id, status(), null); break;
            case "download":
                String path = request.getJSONObject("payload").optString("path");
                if (!path.matches("/android/[a-zA-Z0-9._-]+\\.apk")) { reply(id, null, "رابط التنزيل غير صالح."); break; }
                open(new Intent(Intent.ACTION_VIEW, Uri.parse("https://samee3.vercel.app" + path)));
                reply(id, status(), null); break;
            default: reply(id, null, "الأمر غير متاح.");
        }
    }

    private void open(Intent intent) { try { host.startActivity(intent); } catch (Exception ignored) {} }

    JSONObject status() {
        JSONObject value = new JSONObject();
        try {
            PackageInfo info = host.getPackageManager().getPackageInfo(host.getPackageName(), 0);
            value.put("platform", "android").put("bridgeVersion", 1).put("versionName", info.versionName)
                    .put("versionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode)
                    .put("sdk", Build.VERSION.SDK_INT).put("settings", ReminderSettings.read(host))
                    .put("notificationsAllowed", ReminderScheduler.allowed(host)).put("exactAlarmsAllowed", ReminderScheduler.exactAllowed(host))
                    .put("calendarUntil", ReminderSettings.prefs(host).getString("calendarUntil", ""))
                    .put("calendarError", ReminderSettings.prefs(host).getString("calendarError", ""))
                    .put("adhanDownloads", AdhanFiles.states(host)).put("adhanPlaying", AdhanService.playing());
            JSONObject next = new JSONObject();
            for (String key : ReminderScheduler.KEYS) {
                long at = ReminderSettings.prefs(host).getLong("next:" + key, 0);
                if (at > System.currentTimeMillis()) next.put(key, at);
            }
            value.put("next", next);
        } catch (Exception ignored) {}
        return value;
    }

    void permissionResult(int code) {
        if (code != PERMISSION_REQUEST || permissionRequest == null) return;
        String id = permissionRequest; permissionRequest = null;
        ReminderScheduler.reschedule(host); reply(id, status(), null);
    }

    private void reply(String id, JSONObject data, String error) {
        if (port == null) return;
        try { JSONObject result = new JSONObject().put("id", id).put("ok", error == null);
            if (data != null) result.put("data", data); if (error != null) result.put("error", error);
            port.postMessage(new WebMessage(result.toString()));
        } catch (Exception ignored) {}
    }

    void close() { permissionRequest = null; if (port != null) { port.close(); port = null; } }
}
