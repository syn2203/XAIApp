package com.xaiapp.speech

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import android.app.Activity
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.UiThreadUtil

class SpeechRecognitionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var speechRecognizer: SpeechRecognizer? = null
  private var currentPromise: Promise? = null
  private var isListening = false

  companion object {
    private const val TAG = "SpeechRecognition"
  }

  override fun getName(): String = "SpeechRecognitionModule"

  init {
    reactContext.addActivityEventListener(this)
  }

  /**
   * 检查是否有录音权限
   */
  @ReactMethod
  fun checkPermission(promise: Promise) {
    val permission = Manifest.permission.RECORD_AUDIO
    val result =
        ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED
    promise.resolve(result)
  }

  /**
   * 检查语音识别是否可用
   */
  @ReactMethod
  fun isAvailable(promise: Promise) {
    val available = SpeechRecognizer.isRecognitionAvailable(reactContext)
    promise.resolve(available)
  }

  /**
   * 开始语音识别
   */
  @ReactMethod
  fun startListening(language: String, promise: Promise) {
    if (isListening) {
      promise.reject("ALREADY_LISTENING", "Speech recognition is already in progress")
      return
    }

    val permission = Manifest.permission.RECORD_AUDIO
    if (reactContext.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("PERMISSION_DENIED", "RECORD_AUDIO permission is required")
      return
    }

    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      promise.reject("NOT_AVAILABLE", "Speech recognition is not available on this device")
      return
    }

    // SpeechRecognizer must be created and used on the main thread
    UiThreadUtil.runOnUiThread {
      try {
        currentPromise = promise
        isListening = true

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).apply {
          setRecognitionListener(createRecognitionListener())
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        speechRecognizer?.startListening(intent)
        Log.d(TAG, "Started listening for speech recognition")
      } catch (e: Exception) {
        Log.e(TAG, "Error starting speech recognition", e)
        isListening = false
        currentPromise = null
        promise.reject("START_FAILED", "Failed to start speech recognition: ${e.message}", e)
      }
    }
  }

  /**
   * 停止语音识别
   */
  @ReactMethod
  fun stopListening(promise: Promise) {
    if (!isListening) {
      promise.resolve(false)
      return
    }

    UiThreadUtil.runOnUiThread {
      try {
        speechRecognizer?.stopListening()
        isListening = false
        promise.resolve(true)
        Log.d(TAG, "Stopped listening for speech recognition")
      } catch (e: Exception) {
        Log.e(TAG, "Error stopping speech recognition", e)
        promise.reject("STOP_FAILED", "Failed to stop speech recognition: ${e.message}", e)
      }
    }
  }

  /**
   * 取消语音识别
   */
  @ReactMethod
  fun cancelListening(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        speechRecognizer?.cancel()
        isListening = false
        currentPromise?.reject("CANCELLED", "Speech recognition was cancelled")
        currentPromise = null
        promise.resolve(true)
        Log.d(TAG, "Cancelled speech recognition")
      } catch (e: Exception) {
        Log.e(TAG, "Error cancelling speech recognition", e)
        promise.reject("CANCEL_FAILED", "Failed to cancel speech recognition: ${e.message}", e)
      }
    }
  }

  /**
   * 销毁语音识别器
   */
  @ReactMethod
  fun destroy(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        speechRecognizer?.destroy()
        speechRecognizer = null
        isListening = false
        currentPromise = null
        promise.resolve(true)
        Log.d(TAG, "Destroyed speech recognizer")
      } catch (e: Exception) {
        Log.e(TAG, "Error destroying speech recognizer", e)
        promise.reject("DESTROY_FAILED", "Failed to destroy speech recognizer: ${e.message}", e)
      }
    }
  }

  private fun createRecognitionListener(): RecognitionListener {
    return object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {
        Log.d(TAG, "Ready for speech")
      }

      override fun onBeginningOfSpeech() {
        Log.d(TAG, "Beginning of speech")
      }

      override fun onRmsChanged(rmsdB: Float) {
        // 可以用于显示音量指示器
      }

      override fun onBufferReceived(buffer: ByteArray?) {
        // 部分结果，通常不使用
      }

      override fun onEndOfSpeech() {
        Log.d(TAG, "End of speech")
        isListening = false
      }

      override fun onError(error: Int) {
        isListening = false
        val errorMessage = when (error) {
          SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
          SpeechRecognizer.ERROR_CLIENT -> "Client side error"
          SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
          SpeechRecognizer.ERROR_NETWORK -> "Network error"
          SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
          SpeechRecognizer.ERROR_NO_MATCH -> "No match found"
          SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer service is busy"
          SpeechRecognizer.ERROR_SERVER -> "Server error"
          SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
          else -> "Unknown error: $error"
        }

        Log.e(TAG, "Recognition error: $errorMessage")
        currentPromise?.reject("RECOGNITION_ERROR", errorMessage)
        currentPromise = null
      }

      override fun onResults(results: Bundle?) {
        isListening = false
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val confidence = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)

        if (matches != null && matches.isNotEmpty()) {
          val text = matches[0]
          val conf = if (confidence != null && confidence.isNotEmpty()) confidence[0] else 0f

          Log.d(TAG, "Recognition result: $text (confidence: $conf)")

          val result: WritableMap = Arguments.createMap().apply {
            putString("text", text)
            putDouble("confidence", conf.toDouble())
          }

          currentPromise?.resolve(result)
        } else {
          currentPromise?.reject("NO_RESULTS", "No recognition results")
        }
        currentPromise = null
      }

      override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (matches != null && matches.isNotEmpty()) {
          Log.d(TAG, "Partial result: ${matches[0]}")
        }
      }

      override fun onEvent(eventType: Int, params: Bundle?) {
        // 其他事件
      }
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    // 不需要处理
  }

  override fun onNewIntent(intent: Intent) {
    // 不需要处理
  }
}
