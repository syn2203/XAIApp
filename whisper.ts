import { NativeModules, Platform } from 'react-native';

type WhisperResult = {
  text: string;
  confidence: number;
};

type WhisperNativeModule = {
  checkPermission: () => Promise<boolean>;
  initializeModel: (modelPath: string) => Promise<boolean>;
  startRecording: () => Promise<WhisperResult>;
  stopRecording: () => Promise<boolean>;
  release: () => Promise<boolean>;
};

const nativeModule: WhisperNativeModule | null =
  Platform.OS === 'android'
    ? (NativeModules.WhisperModule as WhisperNativeModule)
    : null;

function ensureAvailable(): WhisperNativeModule {
  if (!nativeModule) {
    throw new Error('Whisper 功能仅支持 Android 设备。');
  }
  return nativeModule;
}

/**
 * 检查是否有录音权限
 */
export async function checkPermission(): Promise<boolean> {
  return ensureAvailable().checkPermission();
}

/**
 * 初始化 Whisper 模型
 * @param modelPath 模型文件路径，例如 'ggml-tiny-q5.bin'
 */
export async function initializeModel(
  modelPath: string = 'ggml-tiny-q5.bin',
): Promise<boolean> {
  return ensureAvailable().initializeModel(modelPath);
}

/**
 * 开始录音并返回转写结果（停止录音时自动返回）
 */
export async function startRecording(): Promise<WhisperResult> {
  return ensureAvailable().startRecording();
}

/**
 * 停止录音
 */
export async function stopRecording(): Promise<boolean> {
  return ensureAvailable().stopRecording();
}

/**
 * 释放资源
 */
export async function release(): Promise<boolean> {
  return ensureAvailable().release();
}

