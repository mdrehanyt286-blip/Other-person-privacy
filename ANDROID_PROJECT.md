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
// analyzer/FaceAnalyzer.kt
class FaceAnalyzer(private val onFacesDetected: (Int) -> Unit) : ImageAnalysis.Analyzer {
    private val options = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
        .build()
    private val detector = FaceDetection.getClient(options)

    @UnstableApi
    override function analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image ?: return
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        
        detector.process(image)
            .addOnSuccessListener { faces ->
                onFacesDetected(faces.size)
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }
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

// Ensure hardware acceleration is ON for AI performance
webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

// Allow Media Playback without interaction (Auto-start camera)
webView.settings.mediaPlaybackRequiresUserGesture = false
```
