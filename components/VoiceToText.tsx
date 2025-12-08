import React, { useState, useEffect } from 'react';
import {
  Alert,
  Platform,
  PermissionsAndroid,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import {
  checkPermission as checkSpeechPermission,
  isAvailable,
  startListening,
  stopListening,
  cancelListening,
  destroy,
} from '../speechRecognition';
import {
  checkPermission as checkWhisperPermission,
  initializeModel,
  startRecording as whisperStartRecording,
  stopRecording as whisperStopRecording,
  release as whisperRelease,
} from '../whisper';

interface VoiceToTextProps {
  onTextGenerated: (text: string) => void;
}

type Engine = 'google' | 'whisper';

/**
 * 录音转文字组件
 * 支持两种引擎：
 * 1. Google SpeechRecognizer - Android 原生，需要网络或语言包
 * 2. Whisper - 完全离线，使用 ggml-tiny-q5.bin 模型
 */
export default function VoiceToText({ onTextGenerated }: VoiceToTextProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const [engine, setEngine] = useState<Engine>('whisper'); // 默认使用 Whisper
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSpeechAvailable, setIsSpeechAvailable] = useState<boolean | null>(
    null,
  );
  const [whisperInitialized, setWhisperInitialized] = useState(false);
  const [isInitializingWhisper, setIsInitializingWhisper] = useState(false);

  // 组件加载时初始化
  useEffect(() => {
    if (Platform.OS === 'android') {
      initializeWhisper();
      checkInitialState();
    }

    // 组件卸载时清理
    return () => {
      if (isRecording) {
        if (engine === 'google') {
          cancelListening().catch(console.error);
          destroy().catch(console.error);
        } else {
          whisperStopRecording().catch(console.error);
          whisperRelease().catch(console.error);
        }
      }
    };
  }, []);

  // 初始化 Whisper 模型
  const initializeWhisper = async () => {
    try {
      setIsInitializingWhisper(true);
      const hasPermission = await checkWhisperPermission();
      setHasPermission(hasPermission);

      if (!hasPermission) {
        setIsInitializingWhisper(false);
        return;
      }

      const initialized = await initializeModel('ggml-tiny-q5.bin');
      setWhisperInitialized(initialized);

      if (!initialized) {
        console.warn('Whisper 模型初始化失败，将使用 Google SpeechRecognizer');
        setEngine('google');
      }
    } catch (error: any) {
      console.error('初始化 Whisper 失败', error);
      setWhisperInitialized(false);
      setEngine('google'); // 回退到 Google
    } finally {
      setIsInitializingWhisper(false);
    }
  };

  const checkInitialState = async () => {
    try {
      if (engine === 'google') {
        const [permission, available] = await Promise.all([
          checkSpeechPermission(),
          isAvailable(),
        ]);
        setHasPermission(permission);
        setIsSpeechAvailable(available);
      } else {
        const permission = await checkWhisperPermission();
        setHasPermission(permission);
      }
    } catch (error) {
      console.error('检查语音识别状态失败', error);
    }
  };

  const handleRequestPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: '录音权限',
          message: '需要录音权限才能使用语音识别功能',
          buttonNeutral: '稍后询问',
          buttonNegative: '拒绝',
          buttonPositive: '允许',
        },
      );

      const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      setHasPermission(hasPermission);

      if (!hasPermission) {
        Alert.alert(
          '权限被拒绝',
          '需要录音权限才能使用语音识别功能，请在设置中授予权限。',
        );
      }
      return hasPermission;
    } catch (error) {
      console.error('请求权限失败', error);
      Alert.alert('错误', '无法请求录音权限');
      return false;
    }
  };

  const handleStartRecording = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('提示', '语音识别功能目前仅支持 Android 设备');
      return;
    }

    try {
      // 检查权限
      let granted = hasPermission;
      if (granted === null || granted === false) {
        if (engine === 'whisper') {
          granted = await checkWhisperPermission();
        } else {
          granted = await checkSpeechPermission();
        }
        setHasPermission(granted);

        if (!granted) {
          granted = await handleRequestPermission();
        }
        if (!granted) {
          return;
        }
      }

      // Whisper 引擎
      if (engine === 'whisper') {
        if (!whisperInitialized) {
          Alert.alert('提示', 'Whisper 模型未初始化，请稍候...');
          return;
        }

        setIsRecording(true);
        setTranscribedText('');
        setIsProcessing(false);

        // 开始录音（异步等待转写结果）
        whisperStartRecording()
          .then(result => {
            setIsRecording(false);
            setIsProcessing(false);
            if (result && result.text) {
              setTranscribedText(result.text);
              onTextGenerated(result.text);
            }
          })
          .catch((error: any) => {
            console.error('Whisper 转写失败', error);
            setIsRecording(false);
            setIsProcessing(false);
            handleWhisperError(error);
          });
        return;
      }

      // Google SpeechRecognizer 引擎
      const [permission, available] = await Promise.all([
        checkSpeechPermission(),
        isAvailable(),
      ]);
      setHasPermission(permission);
      setIsSpeechAvailable(available);

      if (!available) {
        Alert.alert(
          '不可用',
          '语音识别功能在此设备上不可用，请检查是否已安装Google语音服务。',
        );
        return;
      }

      setIsRecording(true);
      setTranscribedText('');
      setIsProcessing(false);

      // 开始语音识别（默认使用中文）
      const result = await startListening('zh-CN');

      setIsRecording(false);
      setIsProcessing(false);

      if (result && result.text) {
        setTranscribedText(result.text);
        onTextGenerated(result.text);
      }
    } catch (error: any) {
      console.error('语音识别失败', error);
      setIsRecording(false);
      setIsProcessing(false);

      let errorMessage = '语音识别失败，请重试';
      const code = error?.code;
      const message: string = error?.message || '';

      if (code === 'PERMISSION_DENIED') {
        setHasPermission(false);
        errorMessage = '权限不足，请授予录音权限';
      } else if (code === 'NOT_AVAILABLE') {
        setIsSpeechAvailable(false);
        errorMessage = '语音识别不可用，请检查是否安装 Google 语音服务';
      } else if (code === 'NO_RESULTS' || message.includes('No match')) {
        errorMessage = '未识别到语音，请重试';
      } else if (code === 'ALREADY_LISTENING') {
        errorMessage = '正在录音中，请先停止或稍后重试';
      } else if (code === 'START_FAILED') {
        errorMessage = '录音启动失败，请重试或重启应用';
      } else if (code === 'RECOGNITION_ERROR') {
        if (message?.includes('Network')) {
          errorMessage = '网络错误，请检查网络连接';
        } else if (message?.includes('permissions')) {
          errorMessage = '权限不足，请授予录音权限';
          setHasPermission(false);
        } else {
          errorMessage = message || errorMessage;
        }
      } else if (code === 'CANCELLED') {
        errorMessage = '录音已取消';
      } else if (message) {
        errorMessage = message;
      }
      Alert.alert('错误', errorMessage);
    }
  };

  const handleWhisperError = (error: any) => {
    let errorMessage = '语音识别失败，请重试';
    const code = error?.code;
    const message: string = error?.message || '';

    if (code === 'LIBRARY_NOT_LOADED') {
      errorMessage = 'Whisper 库未加载，请重启应用';
      setEngine('google'); // 回退到 Google
    } else if (code === 'MODEL_NOT_FOUND' || code === 'INIT_FAILED') {
      errorMessage = 'Whisper 模型加载失败，切换到 Google 语音识别';
      setEngine('google');
      initializeWhisper(); // 尝试重新初始化
    } else if (code === 'NO_AUDIO') {
      errorMessage = '未检测到音频，请重新录音';
    } else if (code === 'TRANSCRIBE_ERROR') {
      errorMessage = `转写失败: ${message}`;
    } else if (message) {
      errorMessage = message;
    }

    Alert.alert('错误', errorMessage);
  };

  const handleStopRecording = async () => {
    try {
      if (isRecording) {
        if (engine === 'whisper') {
          await whisperStopRecording();
          setIsRecording(false);
          setIsProcessing(true);
          // 转写结果会在 startRecording 的 promise 中返回
        } else {
          await stopListening();
          setIsRecording(false);
          setIsProcessing(true);
        }
      }
    } catch (error) {
      console.error('停止录音失败', error);
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (isRecording) {
        if (engine === 'whisper') {
          await whisperStopRecording();
        } else {
          await cancelListening();
        }
        setIsRecording(false);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('取消录音失败', error);
    }
  };

  const handleSwitchEngine = () => {
    if (engine === 'whisper') {
      setEngine('google');
      checkInitialState();
    } else {
      setEngine('whisper');
      if (!whisperInitialized) {
        initializeWhisper();
      }
    }
  };

  const handleClear = () => {
    setTranscribedText('');
  };

  return (
    <View
      style={tw.style(
        'rounded-2xl p-4 gap-3',
        isDarkMode ? 'bg-slate-800' : 'bg-white',
        isDarkMode ? undefined : tw`border border-slate-200`,
      )}
    >
      <View style={tw`flex-row items-center justify-between`}>
        <Text
          style={tw.style(
            'text-lg font-semibold',
            isDarkMode ? 'text-white' : 'text-slate-900',
          )}
        >
          语音输入
        </Text>
        <TouchableOpacity
          onPress={handleSwitchEngine}
          style={tw.style(
            'rounded-lg px-3 py-1',
            isDarkMode ? 'bg-slate-700' : 'bg-slate-200',
          )}
        >
          <Text
            style={tw.style(
              'text-xs font-semibold',
              isDarkMode ? 'text-slate-200' : 'text-slate-700',
            )}
          >
            {engine === 'whisper' ? 'Whisper' : 'Google'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text
        style={tw.style(
          'text-sm leading-6',
          isDarkMode ? 'text-slate-300' : 'text-slate-700',
        )}
      >
        {engine === 'whisper'
          ? '使用 Whisper 离线模型进行语音识别，完全本地处理，无需网络。'
          : '使用 Android 原生语音识别，支持离线识别（首次需要下载语言包）。'}
      </Text>

      {/* Whisper 初始化状态 */}
      {engine === 'whisper' && isInitializingWhisper && (
        <View
          style={tw.style(
            'rounded-xl p-3 flex-row items-center gap-2',
            isDarkMode ? 'bg-slate-700' : 'bg-slate-50',
          )}
        >
          <ActivityIndicator
            size="small"
            color={isDarkMode ? '#fff' : '#000'}
          />
          <Text
            style={tw.style(
              'text-sm',
              isDarkMode ? 'text-slate-200' : 'text-slate-700',
            )}
          >
            正在初始化 Whisper 模型...
          </Text>
        </View>
      )}

      {/* Whisper 未初始化提示 */}
      {engine === 'whisper' &&
        !isInitializingWhisper &&
        !whisperInitialized && (
          <View
            style={tw.style(
              'rounded-xl p-3',
              isDarkMode ? 'bg-red-900/30' : 'bg-red-50',
            )}
          >
            <Text
              style={tw.style(
                'text-sm',
                isDarkMode ? 'text-red-200' : 'text-red-800',
              )}
            >
              ❌ Whisper 模型未初始化
            </Text>
            <TouchableOpacity
              onPress={initializeWhisper}
              style={tw.style(
                'mt-2 rounded-lg py-2 px-4',
                isDarkMode ? 'bg-red-700' : 'bg-red-600',
              )}
            >
              <Text style={tw`text-center text-white text-sm font-semibold`}>
                重新初始化
              </Text>
            </TouchableOpacity>
          </View>
        )}

      {/* 权限提示 */}
      {hasPermission === false && (
        <View
          style={tw.style(
            'rounded-xl p-3',
            isDarkMode ? 'bg-amber-900/30' : 'bg-amber-50',
          )}
        >
          <Text
            style={tw.style(
              'text-sm',
              isDarkMode ? 'text-amber-200' : 'text-amber-800',
            )}
          >
            ⚠️ 需要录音权限才能使用语音识别功能
          </Text>
          <TouchableOpacity
            onPress={handleRequestPermission}
            style={tw.style(
              'mt-2 rounded-lg py-2 px-4',
              isDarkMode ? 'bg-amber-700' : 'bg-amber-600',
            )}
          >
            <Text style={tw`text-center text-white text-sm font-semibold`}>
              授予权限
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Google 引擎可用性提示 */}
      {engine === 'google' && isSpeechAvailable === false && (
        <View
          style={tw.style(
            'rounded-xl p-3',
            isDarkMode ? 'bg-red-900/30' : 'bg-red-50',
          )}
        >
          <Text
            style={tw.style(
              'text-sm',
              isDarkMode ? 'text-red-200' : 'text-red-800',
            )}
          >
            ❌ 语音识别功能不可用，请检查是否已安装Google语音服务
          </Text>
        </View>
      )}

      {/* 录音按钮 */}
      <View style={tw`items-center gap-3`}>
        <TouchableOpacity
          disabled={
            isProcessing ||
            hasPermission === false ||
            (engine === 'google' && isSpeechAvailable === false) ||
            (engine === 'whisper' && !whisperInitialized)
          }
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          onLongPress={isRecording ? handleCancel : undefined}
          style={tw.style(
            'w-20 h-20 rounded-full items-center justify-center',
            isRecording
              ? 'bg-red-500'
              : isDarkMode
              ? 'bg-indigo-500'
              : 'bg-indigo-600',
            isProcessing ||
              hasPermission === false ||
              (engine === 'google' && isSpeechAvailable === false) ||
              (engine === 'whisper' && !whisperInitialized)
              ? 'opacity-50'
              : undefined,
          )}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color="white" />
          ) : isRecording ? (
            <View style={tw`w-4 h-4 rounded-full bg-white`} />
          ) : (
            <Text style={tw`text-white text-2xl`}>🎤</Text>
          )}
        </TouchableOpacity>
        <Text
          style={tw.style(
            'text-sm',
            isDarkMode ? 'text-slate-300' : 'text-slate-600',
          )}
        >
          {isRecording
            ? '正在录音，点击停止（长按取消）'
            : isProcessing
            ? '正在识别...'
            : '点击开始录音'}
        </Text>
      </View>

      {/* 识别结果 */}
      {transcribedText ? (
        <View
          style={tw.style(
            'rounded-xl p-4 gap-3',
            isDarkMode ? 'bg-slate-700' : 'bg-slate-50',
            isDarkMode ? undefined : tw`border border-slate-200`,
          )}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              <Text
                style={tw.style(
                  'text-sm font-semibold',
                  isDarkMode ? 'text-slate-200' : 'text-slate-700',
                )}
              >
                ✨ 识别结果
              </Text>
              <View
                style={tw.style(
                  'px-2 py-0.5 rounded',
                  engine === 'whisper'
                    ? isDarkMode
                      ? 'bg-purple-700'
                      : 'bg-purple-100'
                    : isDarkMode
                    ? 'bg-blue-700'
                    : 'bg-blue-100',
                )}
              >
                <Text
                  style={tw.style(
                    'text-xs font-semibold',
                    engine === 'whisper'
                      ? isDarkMode
                        ? 'text-purple-200'
                        : 'text-purple-700'
                      : isDarkMode
                      ? 'text-blue-200'
                      : 'text-blue-700',
                  )}
                >
                  {engine === 'whisper' ? 'Whisper' : 'Google'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClear}>
              <Text
                style={tw.style(
                  'text-xs font-semibold',
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-600',
                )}
              >
                清除
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={tw.style(
              'rounded-lg p-3',
              isDarkMode ? 'bg-slate-800' : 'bg-white',
            )}
          >
            <Text
              style={tw.style(
                'text-base leading-7',
                isDarkMode ? 'text-white' : 'text-slate-900',
              )}
            >
              {transcribedText}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
