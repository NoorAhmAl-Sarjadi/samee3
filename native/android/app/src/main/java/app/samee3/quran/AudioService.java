package app.samee3.quran;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.session.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.net.URL;
import java.util.*;

public final class AudioService extends Service {
    public static final String PLAY="play",TOGGLE="toggle",PAUSE="pause",STOP="stop",NEXT="next",PREVIOUS="previous",SEEK="seek";
    private static AudioService active;
    private MediaPlayer player;private MediaSession session;private AudioManager audioManager;private AudioFocusRequest focus;
    private String reading,readerId,readerName,server;private int surah=1;private JSONArray available=new JSONArray();private QuranData data;
    private boolean ready=false,userPaused=false,resumeOnFocus=false;private int sequence=0;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable clock=new Runnable(){public void run(){if(ready){publish();handler.postDelayed(this,1500);}}};
    public static File localFile(Context context,String reading,String reader,int surah){
        if(!Arrays.asList(QuranData.IDS).contains(reading)||!reader.matches("[0-9]+-[0-9]+")||surah<1||surah>114)throw new IllegalArgumentException("Invalid recording identity");
        return new File(context.getFilesDir(),"audio/"+reading+"/"+reader+"/"+String.format(Locale.US,"%03d.mp3",surah));
    }
    public static boolean safeAudioUrl(URL url){String host=url.getHost().toLowerCase(Locale.ROOT);return url.getProtocol().equals("https")&&(host.equals("mp3quran.net")||host.endsWith(".mp3quran.net"))&&url.getUserInfo()==null&&url.getPort()==-1;}
    public static int position(){try{return active!=null&&active.ready?active.player.getCurrentPosition():0;}catch(Exception e){return 0;}}
    public static int duration(){try{return active!=null&&active.ready?active.player.getDuration():0;}catch(Exception e){return 0;}}
    @Override public void onCreate(){super.onCreate();active=this;audioManager=(AudioManager)getSystemService(AUDIO_SERVICE);
        NotificationChannel channel=new NotificationChannel("samee3_playback","تلاوات سميع",NotificationManager.IMPORTANCE_LOW);channel.setDescription("التحكم في التلاوة أثناء قفل الشاشة");((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        session=new MediaSession(this,"Samee3 Quran");session.setCallback(new MediaSession.Callback(){
            public void onPlay(){resume();}public void onPause(){pause(true);}public void onStop(){shutdown();}public void onSkipToNext(){step(1);}public void onSkipToPrevious(){step(-1);}public void onSeekTo(long position){seek(position);}
        });session.setActive(true);
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).setOnAudioFocusChangeListener(change->{
            if(change==AudioManager.AUDIOFOCUS_GAIN){if(player!=null)player.setVolume(1,1);if(resumeOnFocus&&!userPaused){resumeOnFocus=false;resume();}}
            else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK){if(player!=null)player.setVolume(0.2f,0.2f);}
            else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT){resumeOnFocus=ready&&!userPaused;pause(false);}
            else{resumeOnFocus=false;pause(true);}
        }).build();
    }
    @Override public int onStartCommand(Intent intent,int flags,int id){
        if(intent==null){stopSelf();return START_NOT_STICKY;}String action=intent.getAction();
        if(PLAY.equals(action)){
            try{String nextReading=intent.getStringExtra("reading"),nextReader=intent.getStringExtra("readerId"),nextServer=intent.getStringExtra("server");int nextSurah=intent.getIntExtra("surah",1);
                localFile(this,nextReading,nextReader,nextSurah);if(nextServer==null||!safeAudioUrl(new URL(nextServer)))throw new IllegalArgumentException();
                reading=nextReading;readerId=nextReader;server=nextServer;readerName=intent.getStringExtra("reader");surah=nextSurah;available=new JSONArray(intent.getStringExtra("surahs"));data=QuranData.load(this,reading);
                startForeground(31,notification("تجهيز التلاوة…",false));prepare();
            }catch(Exception e){error("تعذر تجهيز هذه التلاوة.");}
        }else if(STOP.equals(action))shutdown();else if(PAUSE.equals(action))pause(true);else if(TOGGLE.equals(action)){if(ready&&player.isPlaying())pause(true);else resume();}else if(NEXT.equals(action))step(1);else if(PREVIOUS.equals(action))step(-1);else if(SEEK.equals(action))seek(intent.getLongExtra("position",0));
        if(player==null&&!PLAY.equals(action))stopSelf();return START_NOT_STICKY;
    }
    private void prepare(){
        int current=++sequence;handler.removeCallbacks(clock);if(player!=null){player.release();player=null;}ready=false;userPaused=false;resumeOnFocus=false;
        try{player=new MediaPlayer();player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());player.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK);
            File local=localFile(this,reading,readerId,surah);if(local.isFile())player.setDataSource(local.getAbsolutePath());else{URL url=new URL(server+String.format(Locale.US,"%03d.mp3",surah));if(!safeAudioUrl(url))throw new IOException("Invalid source");player.setDataSource(url.toString());}
            player.setOnPreparedListener(value->{if(current!=sequence)return;ready=true;session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,"سورة "+data.surahName(surah)).putString(MediaMetadata.METADATA_KEY_ARTIST,readerName).putString(MediaMetadata.METADATA_KEY_ALBUM,data.name).putLong(MediaMetadata.METADATA_KEY_DURATION,value.getDuration()).build());if(!userPaused)resume();else publish();handler.post(clock);});
            player.setOnCompletionListener(value->{if(current==sequence)step(1);});player.setOnErrorListener((value,what,extra)->{if(current==sequence)error("تعذر تشغيل التلاوة. تحقق من الاتصال أو اختر التلاوة المحفوظة.");return true;});player.prepareAsync();handler.postDelayed(()->{if(current==sequence&&!ready)error("انتهت مهلة تجهيز التلاوة. تحقق من الاتصال وأعد المحاولة.");},25000);
        }catch(Exception e){error("لم تتوفر التلاوة. تحقق من الاتصال وأعد المحاولة.");}
    }
    private void resume(){userPaused=false;resumeOnFocus=false;if(!ready||player==null)return;if(audioManager.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)return;try{player.start();publish();}catch(Exception e){error("تعذر متابعة التلاوة.");}}
    private void pause(boolean explicit){if(explicit){userPaused=true;resumeOnFocus=false;}if(player!=null&&ready){try{player.pause();publish();}catch(Exception ignored){}}}
    private void seek(long position){if(ready&&player!=null){player.seekTo(Math.max(0,Math.min(position,player.getDuration())),MediaPlayer.SEEK_CLOSEST);publish();}}
    private void step(int direction){int next=0;for(int i=0;i<available.length();i++){int number=available.optInt(i);if(direction>0&&number>surah&&(next==0||number<next))next=number;if(direction<0&&number<surah&&number>next)next=number;}if(next==0){pause(true);return;}surah=next;startForeground(31,notification("تجهيز التلاوة…",false));prepare();}
    private PendingIntent command(String action,int code){return PendingIntent.getService(this,code,new Intent(this,AudioService.class).setAction(action),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private Notification notification(String line,boolean playing){
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this,"samee3_playback").setSmallIcon(android.R.drawable.ic_media_play).setContentTitle(data==null?"مصحف سميع":"سورة "+data.surahName(surah)).setContentText(line).setContentIntent(open).setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true).setOngoing(playing).setDeleteIntent(command(STOP,5))
            .addAction(android.R.drawable.ic_media_previous,"السابقة",command(PREVIOUS,1)).addAction(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,playing?"إيقاف مؤقت":"متابعة",command(TOGGLE,2)).addAction(android.R.drawable.ic_media_next,"التالية",command(NEXT,3)).addAction(android.R.drawable.ic_menu_close_clear_cancel,"إيقاف",command(STOP,4))
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2)).build();
    }
    private void publish(){if(!ready||player==null)return;boolean playing=player.isPlaying();long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_STOP|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS;session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(playing?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,position(),playing?1:0).build());((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(31,notification(readerName,playing));}
    private void error(String message){android.widget.Toast.makeText(this,message,android.widget.Toast.LENGTH_LONG).show();shutdown();}
    private void shutdown(){sequence++;handler.removeCallbacksAndMessages(null);if(player!=null){player.release();player=null;}ready=false;audioManager.abandonAudioFocusRequest(focus);session.setActive(false);stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onDestroy(){if(active==this)active=null;handler.removeCallbacksAndMessages(null);if(player!=null)player.release();audioManager.abandonAudioFocusRequest(focus);session.release();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
