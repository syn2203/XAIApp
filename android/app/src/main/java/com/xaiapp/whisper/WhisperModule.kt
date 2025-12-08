package com.xaiapp.whisper

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.UiThreadUtil
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class WhisperModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var audioRecord: AudioRecord? = null
  private var isRecording = false
  private var recordingThread: Thread? = null
  private var recordingPromise: Promise? = null

  companion object {
    private const val TAG = "WhisperModule"
    private const val SAMPLE_RATE = 16000
    private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    private const val BUFFER_SIZE_MULTIPLIER = 2

    private var isLibraryLoaded = false

    init {
      try {
        System.loadLibrary("whisper_bridge")
        isLibraryLoaded = true
        Log.d(TAG, "whisper_bridge library loaded successfully")
      } catch (e: UnsatisfiedLinkError) {
        Log.e(TAG, "Failed to load whisper_bridge library", e)
        isLibraryLoaded = false
        // 不抛出异常，允许应用继续运行
      }
    }
  }

  override fun getName(): String = "WhisperModule"

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
   * 初始化 Whisper 模型
   * @param modelPath 模型文件路径（相对于 assets，例如 'ggml-tiny-q5.bin'）
   */
  @ReactMethod
  fun initializeModel(modelPath: String, promise: Promise) {
    if (!isLibraryLoaded) {
      promise.reject("LIBRARY_NOT_LOADED", "whisper_bridge library is not loaded")
      return
    }

    try {
      // 从 assets 复制模型文件到内部存储
      val modelFile = copyAssetToInternalStorage(modelPath, "ggml-tiny-q5.bin")

      if (modelFile == null || !modelFile.exists()) {
        promise.reject("MODEL_NOT_FOUND", "Model file not found: $modelPath")
        return
      }

      val result = nativeInitializeModel(modelFile.absolutePath)
      if (result) {
        Log.d(TAG, "Whisper model initialized successfully: ${modelFile.absolutePath}")
        promise.resolve(true)
      } else {
        promise.reject("INIT_FAILED", "Failed to initialize Whisper model")
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error initializing model", e)
      promise.reject("INIT_ERROR", "Error initializing model: ${e.message}", e)
    }
  }

  /**
   * 开始录音
   */
  @ReactMethod
  fun startRecording(promise: Promise) {
    if (isRecording) {
      promise.reject("ALREADY_RECORDING", "Recording is already in progress")
      return
    }

    val permission = Manifest.permission.RECORD_AUDIO
    if (ContextCompat.checkSelfPermission(reactContext, permission) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("PERMISSION_DENIED", "RECORD_AUDIO permission is required")
      return
    }

    if (!isLibraryLoaded) {
      promise.reject("LIBRARY_NOT_LOADED", "whisper_bridge library is not loaded")
      return
    }

    try {
      val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
      if (bufferSize == AudioRecord.ERROR_BAD_VALUE || bufferSize == AudioRecord.ERROR) {
        promise.reject("INVALID_BUFFER_SIZE", "Invalid buffer size")
        return
      }

      audioRecord = AudioRecord(
          MediaRecorder.AudioSource.MIC,
          SAMPLE_RATE,
          CHANNEL_CONFIG,
          AUDIO_FORMAT,
          bufferSize * BUFFER_SIZE_MULTIPLIER,
      )

      if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
        promise.reject("RECORD_INIT_FAILED", "Failed to initialize AudioRecord")
        return
      }

      isRecording = true
      val audioData = mutableListOf<Short>()

      recordingPromise = promise
      recordingThread = Thread {
        audioRecord?.startRecording()
        val buffer = ShortArray(bufferSize)

        while (isRecording) {
          val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
          if (read > 0) {
            audioData.addAll(buffer.take(read))
          }
        }

        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        // 转换为 float 数组并调用 Whisper
        val currentPromise = recordingPromise
        recordingPromise = null

        if (audioData.isNotEmpty()) {
          val floatArray = audioData.map { it / 32768.0f }.toFloatArray()
          UiThreadUtil.runOnUiThread {
            transcribeAudio(floatArray, currentPromise ?: promise)
          }
        } else {
          UiThreadUtil.runOnUiThread {
            (currentPromise ?: promise).reject("NO_AUDIO", "No audio data recorded")
          }
        }
      }

      recordingThread?.start()
      // Promise 会在转写完成后在 transcribeAudio 中 resolve
      Log.d(TAG, "Recording started")
    } catch (e: Exception) {
      Log.e(TAG, "Error starting recording", e)
      isRecording = false
      promise.reject("START_RECORDING_FAILED", "Failed to start recording: ${e.message}", e)
    }
  }

  /**
   * 停止录音（转写结果会通过 startRecording 的 promise 返回）
   */
  @ReactMethod
  fun stopRecording(promise: Promise) {
    if (!isRecording) {
      promise.resolve(false)
      return
    }

    isRecording = false
    promise.resolve(true)
    Log.d(TAG, "Recording stopped, waiting for transcription...")
  }

  /**
   * 转写音频数据
   */
  private fun transcribeAudio(audioData: FloatArray, promise: Promise) {
    if (!isLibraryLoaded) {
      promise.reject("LIBRARY_NOT_LOADED", "whisper_bridge library is not loaded")
      return
    }

    try {
      val text = nativeTranscribe(audioData)
      if (text != null && text.isNotEmpty()) {
        val result: WritableMap = Arguments.createMap().apply {
          putString("text", text)
          putDouble("confidence", 1.0) // Whisper 不返回置信度
        }
        promise.resolve(result)
        Log.d(TAG, "Transcription: $text")
      } else {
        promise.reject("NO_RESULTS", "No transcription results")
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error transcribing audio", e)
      promise.reject("TRANSCRIBE_ERROR", "Error transcribing: ${e.message}", e)
    }
  }

  /**
   * 从 assets 复制文件到内部存储
   */
  private fun copyAssetToInternalStorage(assetPath: String, defaultFileName: String): File? {
    return try {
      val internalDir = reactContext.filesDir
      val fileName = if (assetPath.contains("/")) {
        assetPath.substringAfterLast("/")
      } else {
        assetPath
      }
      val modelFile = File(internalDir, fileName)

      // 如果文件已存在，直接返回
      if (modelFile.exists() && modelFile.length() > 0) {
        Log.d(TAG, "Model file already exists: ${modelFile.absolutePath}")
        return modelFile
      }

      // 从 assets 复制
      val inputStream = reactContext.assets.open(assetPath)
      val outputStream = FileOutputStream(modelFile)
      inputStream.copyTo(outputStream)
      inputStream.close()
      outputStream.close()

      Log.d(TAG, "Model file copied to: ${modelFile.absolutePath} (size: ${modelFile.length()} bytes)")
      modelFile
    } catch (e: IOException) {
      Log.e(TAG, "Error copying model file: $assetPath", e)
      null
    }
  }

  /**
   * 释放资源
   */
  @ReactMethod
  fun release(promise: Promise) {
    try {
      isRecording = false
      audioRecord?.stop()
      audioRecord?.release()
      audioRecord = null
      recordingThread?.join(1000)
      if (isLibraryLoaded) {
        nativeRelease()
      }
      promise.resolve(true)
    } catch (e: Exception) {
      Log.e(TAG, "Error releasing resources", e)
      promise.reject("RELEASE_ERROR", "Error releasing: ${e.message}", e)
    }
  }

  // JNI 方法声明
  private external fun nativeInitializeModel(modelPath: String): Boolean
  private external fun nativeTranscribe(audioData: FloatArray): String?
  private external fun nativeRelease()
}
