package app.samee3.quran;

/** Launcher for the original SAMEE3 website design; native reader remains available offline. */
public final class AndroidActivity extends WebActivity {
    @Override protected boolean originalDesign() { return true; }
}
