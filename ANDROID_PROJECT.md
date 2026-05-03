# Peek Guard Android Project Blueprint

This section provides the native Android implementation logic for Peek Guard. 
To build the real app, utilize these architectural blocks in Android Studio (Kotlin).

## 1. Project Structure
```text
com.peekguard.ai
├── app
│   ├── src
│   │   ├── main
│   │   │   ├── java/com/peekguard/ai
│   │   │   │   ├── activity/MainActivity.kt (UI Controls)
│   │   │   │   ├── service/DetectionService.kt (Foreground Service)
│   │   │   │   ├── service/PeekOverlayService.kt (Black Screen Logic)
│   │   │   │   ├── analyzer/FaceAnalyzer.kt (ML Kit Logic)
│   │   │   │   └── util/NotificationHelper.kt
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/layout/activity_main.xml
```

## 2. Manifest Permissions (Critical)
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE" />

    <application>
        <service android:name=".service.DetectionService" 
                 android:foregroundServiceType="camera" />
        <service android:name=".service.PeekOverlayService" />
        <service android:name=".service.MyAccessibilityService"
                 android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.view.InputMethod" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

## 3. Core Detection Logic (Kotlin)
```kotlin
// In DetectionService.kt, run Camera in background without preview
fun startGhostMonitoring() {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    cameraProviderFuture.addListener({
        val preview = Preview.Builder().build() // We build but DON'T attach to a SurfaceView
        val imageAnalysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            
        imageAnalysis.setAnalyzer(executor, FaceAnalyzer { count ->
            if (count > threshold) {
                // Trigger Overlay & Audio
                showPrivacyOverlay()
                playWarningVoice()
            } else {
                hidePrivacyOverlay() // AUTO-RESUME
            }
        })
        
        // Use a dummy LifecycleOwner if needed for background persistence
        cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, imageAnalysis)
    }, ContextCompat.getMainExecutor(context))
}
```

## 4. Overlay Implementation (Anti-Peek)
```kotlin
// service/PeekOverlayService.kt
class PeekOverlayService : Service() {
    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View

    override function onCreate() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayView = View(this).apply {
            setBackgroundColor(Color.BLACK)
        }
        
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )
        windowManager.addView(overlayView, params)
    }
}
```

## 5. Automatic App Detection (Accessibility Service)
Taaki buttons na dabane padein, Android mein `AccessibilityService` use karke hum detect karenge ki kaunsa app khula hai.

```kotlin
// service/AppDetectionService.kt
class AppDetectionService : AccessibilityService() {
    private var isUniversalModeEnabled = true // Configurable from UI

    override function onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            // "Global Shield" Logic:
            // Every window change triggers the security check if the protection toggle is ON.
            // This ensures WhatsApp, Gallery, Browser, and system settings are all covered.
            
            if (isUniversalModeEnabled) {
                startDetectionService()
            }
        }
    }

    private fun startDetectionService() {
        val intent = Intent(this, DetectionService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
}
```

## 7. Hidden Sensor Logic (No Camera Preview)
User ko camera nahi dikhna chahiye, sirf detection honi chahiye. Iske liye `Preview` use na karein, sirf `ImageAnalysis` use karein:

```kotlin
// In DetectionService.kt
private fun setupInvisibleSensor() {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
    cameraProviderFuture.addListener({
        val cameraProvider = cameraProviderFuture.get()
        
        // Analysis only - NO surface/preview attached
        val imageAnalysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            
        imageAnalysis.setAnalyzer(executor) { image ->
            // AI Detection logic here
            processImageForDistance(image)
            image.close()
        }

        // Bind without a preview use case
        cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, imageAnalysis)
    }, ContextCompat.getMainExecutor(this))
}
```

## 6. WebView Permission Fix (Mandatory for Apps)
Agar aap app mein convert kar rahe hain, toh sirf Manifest se kaam nahi chalega. `WebChromeClient` mein ye code dalna zaroori hai taaki WebView camera access de sake:

```kotlin
// In your MainActivity.kt where WebView is initialized
webView.webChromeClient = object : WebChromeClient() {
    override fun onPermissionRequest(request: PermissionRequest) {
        // Bina iske WebView camera permission block kar dega
        request.grant(request.resources)
    }
}

// --- CRITICAL FIX FOR CAMERA IN APPS ---
// Force WebView to treat your URL as a Secure Origin (Required for Camera/AI)
// Without this, 'getUserMedia' will be undefined or always return "Permission Denied" on Android devices.
// WebViews block media access on pure HTTP for security.
webView.settings.apply {
    javaScriptEnabled = true
    databaseEnabled = true
    domStorageEnabled = true
    mediaPlaybackRequiresUserGesture = false
}

// Ensure hardware acceleration is ON for AI performance
webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
```

## 8. WebView Debugging (Logcat)
Agar registration ya scanning fail ho rahi hai, toh Chrome DevTools se check karein:
1. Android phone ko USB se laptop mein connect karein.
2. Home screen par Developer Options > USB Debugging ON karein.
3. Chrome browser mein `chrome://inspect/#devices` kholien.
4. Console mein errors dekhein. Agar `Permissions denied` aa raha hai toh check karein ki HTTPS use kar rahe hain ya nahi.
