import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import tw from 'twrnc';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import VoiceToText from './components/VoiceToText';
import CommandExecutor from './components/CommandExecutor';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [commandText, setCommandText] = useState('');

  const handleTextGenerated = (text: string) => {
    console.log('Generated Text:', text);
    setCommandText(text);
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView
        edges={['top', 'bottom']}
        style={tw.style(
          'flex-1',
          isDarkMode ? 'bg-slate-900' : 'bg-slate-100',
        )}
      >
        <View
          style={tw.style(
            'px-4 pb-3',
            isDarkMode ? 'bg-slate-800' : 'bg-white',
          )}
        >
          <Text
            style={tw.style(
              'text-lg font-semibold',
              isDarkMode ? 'text-white' : 'text-slate-900',
            )}
          >
            XAI 语音助手
          </Text>
          <Text
            style={tw.style(
              'text-sm mt-1',
              isDarkMode ? 'text-slate-300' : 'text-slate-600',
            )}
          >
            通过语音输入指令，自动执行应用操作和自动化任务。
          </Text>
        </View>

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`p-4 pb-10 gap-4`}
        >
          {/* 转写文字显示区域 */}
          {commandText ? (
            <View
              style={tw.style(
                'rounded-2xl p-4 gap-2',
                isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50',
                isDarkMode ? undefined : tw`border border-indigo-200`,
              )}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <Text
                  style={tw.style(
                    'text-base font-semibold',
                    isDarkMode ? 'text-indigo-200' : 'text-indigo-800',
                  )}
                >
                  📝 转写文字
                </Text>
                <Text
                  style={tw.style(
                    'text-xs',
                    isDarkMode ? 'text-indigo-300' : 'text-indigo-600',
                  )}
                >
                  {new Date().toLocaleTimeString()}
                </Text>
              </View>
              <Text
                style={tw.style(
                  'text-lg leading-7 mt-2',
                  isDarkMode ? 'text-white' : 'text-slate-900',
                )}
              >
                {commandText}
              </Text>
            </View>
          ) : (
            <View
              style={tw.style(
                'rounded-2xl p-4',
                isDarkMode ? 'bg-slate-800/50' : 'bg-slate-100',
              )}
            >
              <Text
                style={tw.style(
                  'text-sm text-center',
                  isDarkMode ? 'text-slate-400' : 'text-slate-500',
                )}
              >
                转写文字将显示在这里
              </Text>
            </View>
          )}

          {/* 录音转文字组件 */}
          <VoiceToText onTextGenerated={handleTextGenerated} />

          {/* 命令执行组件 */}
          <CommandExecutor commandText={commandText} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
