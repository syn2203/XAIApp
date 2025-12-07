package com.aiotapp.automation

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AutomationModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

  override fun getName(): String = "AutomationModule"

  @ReactMethod
  fun isAccessibilityServiceRunning(promise: Promise) {
    promise.resolve(AutomationService.isRunning())
  }

  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    try {
      val intent =
          Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
      appContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_SETTINGS_FAILED", e)
    }
  }

  @ReactMethod
  fun openApp(packageName: String, promise: Promise) {
    try {
      val launchIntent = appContext.packageManager.getLaunchIntentForPackage(packageName)
      if (launchIntent == null) {
        promise.resolve(false)
        return
      }
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      appContext.startActivity(launchIntent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_APP_FAILED", e)
    }
  }

  @ReactMethod
  fun tap(x: Double, y: Double, durationMs: Double, promise: Promise) {
    val started =
        AutomationService.tap(x.toFloat(), y.toFloat(), durationMs.toLong()) { success ->
          promise.resolve(success)
        }

    if (!started) {
      promise.reject(
          "SERVICE_NOT_RUNNING", "Accessibility service is not enabled, open settings to allow it.")
    }
  }

  @ReactMethod
  fun swipe(
      startX: Double,
      startY: Double,
      endX: Double,
      endY: Double,
      durationMs: Double,
      promise: Promise,
  ) {
    val started =
        AutomationService.swipe(
            startX.toFloat(),
            startY.toFloat(),
            endX.toFloat(),
            endY.toFloat(),
            durationMs.toLong()) { success ->
              promise.resolve(success)
            }

    if (!started) {
      promise.reject(
          "SERVICE_NOT_RUNNING", "Accessibility service is not enabled, open settings to allow it.")
    }
  }

  @ReactMethod
  fun pasteText(text: String, promise: Promise) {
    val started = AutomationService.pasteText(text) { success -> promise.resolve(success) }

    if (!started) {
      promise.reject(
          "SERVICE_NOT_RUNNING",
          "Accessibility service is not enabled, open settings to allow it.",
      )
    }
  }
}
