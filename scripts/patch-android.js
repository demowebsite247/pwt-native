// `npx cap add android`-er pore chalate hobe.
// Kaj: (1) Android permissions + Foreground Service manifest-e boshay
//      (2) MainActivity: app khulle-i shob permission chay
//      (3) PwtService: screen bondho/background-e-o app jeno jibito thake
const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
const javaDir = path.join(androidDir, 'app/src/main/java/com/pwt/offlinetalk');

if (!fs.existsSync(manifestPath)) {
  console.error('android/ folder nai. Age `npx cap add android` chalan.');
  process.exit(1);
}

// ---------- Manifest ----------
let m = fs.readFileSync(manifestPath, 'utf8');
if (!m.includes('PwtService')) {
  const perms = `
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
`;
  m = m.replace('<application', perms + '\n    <application');
  m = m.replace(
    '</application>',
    `    <service
            android:name=".PwtService"
            android:exported="false"
            android:foregroundServiceType="microphone" />
    </application>`
  );
  fs.writeFileSync(manifestPath, m);
  console.log('Manifest patched');
} else {
  console.log('Manifest already patched');
}

// ---------- MainActivity ----------
fs.mkdirSync(javaDir, { recursive: true });
fs.writeFileSync(
  path.join(javaDir, 'MainActivity.java'),
  `package com.pwt.offlinetalk;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
  private static final int REQ_PERMS = 7001;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    askAllPermissions();
  }

  // App khulle-i ekshathe shob permission chay
  private void askAllPermissions() {
    ArrayList<String> need = new ArrayList<>();
    need.add(Manifest.permission.RECORD_AUDIO);
    if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS);
    if (Build.VERSION.SDK_INT >= 31) need.add(Manifest.permission.BLUETOOTH_CONNECT);

    ArrayList<String> missing = new ArrayList<>();
    for (String p : need) {
      if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
    }
    if (missing.isEmpty()) {
      onPermissionsReady();
    } else {
      ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), REQ_PERMS);
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == REQ_PERMS) onPermissionsReady();
  }

  private boolean micGranted() {
    return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        == PackageManager.PERMISSION_GRANTED;
  }

  private void onPermissionsReady() {
    startKeepAlive();
    askBatteryExemption();
  }

  private void startKeepAlive() {
    if (!micGranted()) return; // Android 14: mic permission chhara service chalano jay na
    try {
      Intent i = new Intent(this, PwtService.class);
      ContextCompat.startForegroundService(this, i);
    } catch (Exception ignored) {}
  }

  // Battery saver jeno app-ke ghum parie na dey
  private void askBatteryExemption() {
    try {
      PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
      if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        i.setData(Uri.parse("package:" + getPackageName()));
        startActivity(i);
      }
    } catch (Exception ignored) {}
  }

  @Override
  public void onResume() {
    super.onResume();
    startKeepAlive();
  }

  @Override
  public void onPause() {
    super.onPause();
    // Background-e gele-o WebView (WebRTC/audio) jeno chaltei thake
    try {
      getBridge().getWebView().onResume();
      getBridge().getWebView().resumeTimers();
    } catch (Exception ignored) {}
  }
}
`
);

// ---------- Foreground Service ----------
fs.writeFileSync(
  path.join(javaDir, 'PwtService.java'),
  `package com.pwt.offlinetalk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class PwtService extends Service {
  private static final String CHANNEL_ID = "pwt_live";
  private PowerManager.WakeLock wakeLock;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "PWT Live", NotificationManager.IMPORTANCE_LOW);
      ch.setDescription("PWT chalu ache — kotha shunte pabe");
      nm.createNotificationChannel(ch);
    }

    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);

    Notification.Builder b = Build.VERSION.SDK_INT >= 26
        ? new Notification.Builder(this, CHANNEL_ID)
        : new Notification.Builder(this);
    Notification n = b
        .setContentTitle("PWT")
        .setContentText("Walkie-talkie chalu ache")
        .setSmallIcon(android.R.drawable.ic_btn_speak_now)
        .setContentIntent(pi)
        .setOngoing(true)
        .build();

    if (Build.VERSION.SDK_INT >= 30) {
      startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
    } else {
      startForeground(1, n);
    }

    if (wakeLock == null) {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pwt:live");
      wakeLock.setReferenceCounted(false);
      wakeLock.acquire();
    }
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
`
);
console.log('Java files written');
