package app.samee3.quran;

import android.content.*;
import android.app.AlarmManager;
import java.util.Arrays;

/** Rebuild alarms after reboot, clock changes, application updates, or permission grants. */
public final class ReminderSystemReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Arrays.asList(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
                Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
                AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED).contains(intent.getAction())) return;
        ReminderScheduler.reschedule(context);
    }
}
