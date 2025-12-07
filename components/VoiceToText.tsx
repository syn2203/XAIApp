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
  checkPermission,
  isAvailable,
  startListening,
  stopListening,
  cancelListening,
  destroy,
} from '../speechRecognition';

interface VoiceToTextProps {
  onTextGenerated: (text: string) => void;
}

/**
 * 录音转文字组件
 * 点击录音按钮，将语音转换为文字
 * 使用Android原生SpeechRecognizer，支持离线识别（首次需要下载语言包）
 */
export default function VoiceToText({ onTextGenerated }: VoiceToTextProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSpeechAvailable, setIsSpeechAvailable] = useState<boolean | null>(null);

  // 组件加载时检查权限和可用性
  useEffect(() => {
    if (Platform.OS === 'android') {
      checkInitialState();
    }

    // 组件卸载时清理
    return () => {
      if (isRecording) {
        cancelListening().catch(console.error);
      }
      destroy().catch(console.error);
    };
  }, [isRecording]);

  const checkInitialState = async () => {
    try {
      const [permission, available] = await Promise.all([
        checkPermission(),
        isAvailable(),
      ]);
      setHasPermission(permission);
      setIsSpeechAvailable(available);
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
      // 每次点击都重新校验权限与可用性，避免直接失败
      const [permission, available] = await Promise.all([
        checkPermission(),
        isAvailable(),
      ]);
      setHasPermission(permission);
      setIsSpeechAvailable(available);

      let granted = permission;
      if (!granted) {
        granted = await handleRequestPermission();
      }
      if (!granted) {
        return;
      }

      let speechAvailable = available;
      // Some devices report不可用 before权限授予，权限拿到后再复查一次
      if (!speechAvailable) {
        speechAvailable = await isAvailable();
        setIsSpeechAvailable(speechAvailable);
      }

      if (!speechAvailable) {
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
        // 将生成的文字传递给父组件
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

  const handleStopRecording = async () => {
    try {
      if (isRecording) {
        await stopListening();
        setIsRecording(false);
        setIsProcessing(true);
        // 停止后会自动触发onResults回调，这里不需要额外处理
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
        await cancelListening();
        setIsRecording(false);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('取消录音失败', error);
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
      <Text
        style={tw.style(
          'text-lg font-semibold',
          isDarkMode ? 'text-white' : 'text-slate-900',
        )}
      >
        语音输入
      </Text>
      <Text
        style={tw.style(
          'text-sm leading-6',
          isDarkMode ? 'text-slate-300' : 'text-slate-700',
        )}
      >
        点击录音按钮，说出您的指令，系统将自动转换为文字。使用Android原生语音识别，支持离线使用。
      </Text>

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

      {/* 可用性提示 */}
      {isSpeechAvailable === false && (
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
          disabled={isProcessing || hasPermission === false || isSpeechAvailable === false}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          onLongPress={isRecording ? handleCancel : undefined}
          style={tw.style(
            'w-20 h-20 rounded-full items-center justify-center',
            isRecording
              ? 'bg-red-500'
              : isDarkMode
                ? 'bg-indigo-500'
                : 'bg-indigo-600',
            isProcessing || hasPermission === false || isSpeechAvailable === false
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
            'rounded-xl p-3 gap-2',
            isDarkMode ? 'bg-slate-700' : 'bg-slate-50',
          )}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <Text
              style={tw.style(
                'text-sm font-semibold',
                isDarkMode ? 'text-slate-200' : 'text-slate-700',
              )}
            >
              识别结果：
            </Text>
            <TouchableOpacity onPress={handleClear}>
              <Text
                style={tw.style(
                  'text-xs',
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-600',
                )}
              >
                清除
              </Text>
            </TouchableOpacity>
          </View>
          <Text
            style={tw.style(
              'text-base leading-6',
              isDarkMode ? 'text-white' : 'text-slate-900',
            )}
          >
            {transcribedText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
