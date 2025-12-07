package com.aiotapp.automation

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Path
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Minimal accessibility service used to perform gestures and paste text
 * inside other apps. Must be enabled by the user in system settings.
 */
class AutomationService : AccessibilityService() {
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    Log.d(TAG, "AutomationService connected")
  }

  override fun onDestroy() {
    super.onDestroy()
    instance = null
    Log.d(TAG, "AutomationService destroyed")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    // Not used: we only dispatch gestures on demand from JS.
  }

  override fun onInterrupt() {
    // No-op
  }

  private fun dispatchGestureWithCallback(
      gesture: GestureDescription,
      callback: (Boolean) -> Unit
  ) {
    mainHandler.post {
      val accepted =
          dispatchGesture(
              gesture,
              object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                  super.onCompleted(gestureDescription)
                  callback(true)
                }

                override fun onCancelled(gestureDescription: GestureDescription?) {
                  super.onCancelled(gestureDescription)
                  callback(false)
                }
              },
              null,
          )

      if (!accepted) {
        callback(false)
      }
    }
  }

  private fun buildGesture(path: Path, durationMs: Long): GestureDescription {
    val safeDuration = durationMs.coerceAtLeast(1L)
    val stroke = GestureDescription.StrokeDescription(path, 0, safeDuration)
    return GestureDescription.Builder().addStroke(stroke).build()
  }

  private fun gestureForTap(x: Float, y: Float, durationMs: Long): GestureDescription {
    val path = Path().apply { moveTo(x, y) }
    return buildGesture(path, durationMs)
  }

  private fun gestureForSwipe(
      startX: Float,
      startY: Float,
      endX: Float,
      endY: Float,
      durationMs: Long,
  ): GestureDescription {
    val path = Path().apply {
      moveTo(startX, startY)
      lineTo(endX, endY)
    }
    return buildGesture(path, durationMs)
  }

  private fun pasteInternal(text: String, callback: (Boolean) -> Unit) {
    mainHandler.post {
      val target =
          rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
              ?: rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY)

      if (target == null) {
        callback(false)
        return@post
      }

      val args = Bundle().apply {
        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
      }
      val setOk = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
      if (setOk) {
        callback(true)
        return@post
      }

      val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newPlainText("automation", text))
      val pasteOk = target.performAction(AccessibilityNodeInfo.ACTION_PASTE)
      callback(pasteOk)
    }
  }

  companion object {
    private const val TAG = "AutomationService"

    @Volatile private var instance: AutomationService? = null

    fun isRunning(): Boolean = instance != null

    private fun withService(action: (AutomationService) -> Unit): Boolean {
      val service = instance ?: return false
      action(service)
      return true
    }

    fun tap(
        x: Float,
        y: Float,
        durationMs: Long = 60L,
        callback: (Boolean) -> Unit,
    ): Boolean =
        withService { service ->
          service.dispatchGestureWithCallback(service.gestureForTap(x, y, durationMs), callback)
        }

    fun swipe(
        startX: Float,
        startY: Float,
        endX: Float,
        endY: Float,
        durationMs: Long = 120L,
        callback: (Boolean) -> Unit,
    ): Boolean =
        withService { service ->
          service.dispatchGestureWithCallback(
              service.gestureForSwipe(startX, startY, endX, endY, durationMs),
              callback,
          )
        }

    fun pasteText(text: String, callback: (Boolean) -> Unit): Boolean =
        withService { service -> service.pasteInternal(text, callback) }
  }
}
