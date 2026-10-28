package app.samee3.quran;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.*;
import org.json.JSONObject;
import java.util.concurrent.*;

/** Full adhan playback with foreground/lock-screen controls and cancellation of late starts. */
public final class AdhanService extends Service {
    public static final String PLAY = "app.samee3.quran.ADHAN_PLAY", PREVIEW = "app.samee3.quran.ADHAN_PREVIEW", STOP = "app.samee3.quran.ADHAN_STOP";
    private static volatile AdhanService active;
    private static final String CHANNEL = "samee3-adhan-playback-v1";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private MediaPlayer player;
    private AudioFocusRequest focus;
    private MediaSession session;
    private PowerManager.WakeLock preparingWake;
    private int generation;
    private String voiceName = "الأذان", label = "الأذان";
    private boolean foreground, started;
    private final BroadcastReceiver noisy = new BroadcastReceiver(){@Override public void onReceive(Context context, Intent intent){finishPlayback();}};

    public static boolean playing() { AdhanService service = active; return service != null && service.foreground; }
    public static boolean start(Context context, String prayer) {
        try { context.startForegroundService(new Intent(context, AdhanService.class).setAction(PLAY).putExtra("prayer", prayer)); return true; }
        catch (RuntimeException denied) { return false; }
    }
    public static void stop(Context context) { context.stopService(new Intent(context, AdhanService.class)); }

    @Override public void onCreate() {
        super.onCreate(); active = this;
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        NotificationChannel channel = new NotificationChannel(CHANNEL, "تشغيل الأذان المختار", NotificationManager.IMPORTANCE_LOW);
        channel.setSound(null, null); getSystemService(NotificationManager.class).createNotificationChannel(channel);
        session = new MediaSession(this, "Samee3Adhan");
        session.setCallback(new MediaSession.Callback() { @Override public void onStop() { finishPlayback(); } @Override public void onPause() { finishPlayback(); } });
        session.setActive(true);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || STOP.equals(intent.getAction())) { finishPlayback(); return START_NOT_STICKY; }
        if (!PLAY.equals(intent.getAction()) && !PREVIEW.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        releasePlayer(); started = false; int token = ++generation;
        String prayer = intent.getStringExtra("prayer"); if (prayer == null) prayer = "Dhuhr";
        String id = PREVIEW.equals(intent.getAction()) ? intent.getStringExtra("voice") : AdhanFiles.selected(this, prayer);
        if (!AdhanFiles.validId(this, id)) { stopSelf(); return START_NOT_STICKY; }
        try { voiceName = AdhanFiles.voice(this, id).getString("name"); } catch (Exception ignored) {}
        label = PREVIEW.equals(intent.getAction()) ? "معاينة صوت الأذان" : "حان وقت الصلاة";
        startForeground(780, notification("جارٍ تجهيز " + voiceName)); foreground = true;
        session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, label).putString(MediaMetadata.METADATA_KEY_ARTIST, voiceName).build());
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_STOP | PlaybackState.ACTION_PAUSE).setState(PlaybackState.STATE_BUFFERING, 0, 0).build());
        preparingWake = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "samee3:adhan-prepare");
        preparingWake.acquire(90_000);
        main.postDelayed(() -> { if (token == generation && !started) finishPlayback(); }, 75_000);
        worker.execute(() -> {
            try { java.io.File file = AdhanFiles.ensure(this, id);
                main.post(() -> { if (token == generation && foreground) prepare(file, token); });
            } catch (Exception error) { main.post(() -> { if (token == generation) finishPlayback(); }); }
        });
        return START_NOT_STICKY;
    }

    private void prepare(java.io.File file, int token) {
        try {
            AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes)
                    .setOnAudioFocusChangeListener(change -> { if (change < 0) finishPlayback(); }).build();
            if (getSystemService(AudioManager.class).requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { finishPlayback(); return; }
            player = new MediaPlayer(); player.setAudioAttributes(attributes); player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            float volume = ReminderSettings.read(this).optInt("adhanVolume", 70) / 100f; player.setVolume(volume, volume);
            player.setDataSource(file.getAbsolutePath());
            player.setOnPreparedListener(prepared -> {
                if (token != generation || prepared != player || !foreground) return;
                prepared.start(); started = true; releasePreparingWake();
                session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_STOP | PlaybackState.ACTION_PAUSE).setState(PlaybackState.STATE_PLAYING, 0, 1).build());
                getSystemService(NotificationManager.class).notify(780, notification(voiceName));
                main.postDelayed(() -> { if (token == generation) finishPlayback(); }, 8 * 60_000L);
            });
            player.setOnCompletionListener(completed -> { if (token == generation) finishPlayback(); });
            player.setOnErrorListener((failed, what, extra) -> { if (token == generation) finishPlayback(); return true; });
            player.prepareAsync();
        } catch (Exception error) { finishPlayback(); }
    }

    private Notification notification(String text) {
        Intent route = new Intent(this, AndroidActivity.class).putExtra("path", "/notifications").addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(this, 780, route, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 781, new Intent(this, AdhanService.class).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle(label).setContentText(text)
                .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PUBLIC)
                .addAction(new Notification.Action.Builder(null, "إيقاف الأذان", stop).build())
                .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0)).build();
    }

    private void releasePreparingWake() { if (preparingWake != null && preparingWake.isHeld()) preparingWake.release(); preparingWake = null; }
    private void releasePlayer() {
        started = false; releasePreparingWake();
        if (player != null) { player.setOnPreparedListener(null); player.setOnCompletionListener(null); player.setOnErrorListener(null); try { player.release(); } catch (Exception ignored) {} player = null; }
        if (focus != null) { getSystemService(AudioManager.class).abandonAudioFocusRequest(focus); focus = null; }
    }
    private void finishPlayback() { generation++; main.removeCallbacksAndMessages(null); releasePlayer(); foreground = false; if (session != null) session.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_STOPPED, 0, 0).build()); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); }
    @Override public void onDestroy() { generation++; main.removeCallbacksAndMessages(null); releasePlayer(); foreground = false; active = null; try{unregisterReceiver(noisy);}catch(Exception ignored){} worker.shutdownNow(); if (session != null) session.release(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
