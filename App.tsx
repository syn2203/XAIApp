import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import tw from 'twrnc';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  isServiceRunning,
  openAccessibilitySettings,
  openApp as openTargetApp,
} from './automation';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [packageName, setPackageName] = useState('com.example.app');
  const [serviceEnabled, setServiceEnabled] = useState<boolean | null>(null);
  const [statusText, setStatusText] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const ensureAndroid = () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        '仅支持 Android',
        '跨应用自动化依赖 Android 无障碍接口，iOS 出于安全限制无法后台控制其他应用。',
      );
      return false;
    }
    return true;
  };

  const handleCheckService = async () => {
    if (!ensureAndroid()) {
      return;
    }
    setBusyAction('check');
    try {
      const enabled = await isServiceRunning();
      setServiceEnabled(enabled);
      setStatusText(
        enabled
          ? '无障碍服务已开启，可直接发送点击/滑动。'
          : '无障碍未开启，点击“打开无障碍设置”并启用 XAIApp 自动化服务。',
      );
    } catch (error) {
      console.error('检查无障碍状态失败', error);
      setStatusText('无法获取无障碍状态，请在系统设置中确认。');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenAccessibilitySettings = async () => {
    if (!ensureAndroid()) {
      return;
    }
    setBusyAction('settings');
    try {
      await openAccessibilitySettings();
      setStatusText('已跳转到无障碍设置，请启用 “XAIApp 自动化服务” 后返回。');
    } catch (error) {
      console.error('打开无障碍设置失败', error);
      setStatusText('无法打开无障碍设置，请手动前往 设置 > 无障碍。');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenTargetApp = async () => {
    if (!ensureAndroid()) {
      return;
    }
    const target = packageName.trim();
    if (!target) {
      Alert.alert('请输入目标包名', '示例：com.example.app');
      return;
    }
    setBusyAction('openApp');
    try {
      const opened = await openTargetApp(target);
      setStatusText(
        opened
          ? `已尝试启动 ${target}，若未跳转请确认已安装该 App。`
          : `未找到 ${target}，请确认包名或安装状态。`,
      );
    } catch (error) {
      console.error('启动目标应用失败', error);
      setStatusText('启动失败，请确认包名或权限。');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenChromeYoutube = async () => {
    if (!ensureAndroid()) {
      return;
    }
    setBusyAction('openYoutube');
    try {
      const youtubeQuery = '硅谷101 视频';
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`;
      const chromeIntentUrl = `intent://${searchUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      const fallbackUrl = searchUrl;
      const canUseIntent = await Linking.canOpenURL(chromeIntentUrl);
      if (canUseIntent) {
        await Linking.openURL(chromeIntentUrl);
      } else {
        await Linking.openURL(fallbackUrl);
      }
      setStatusText('已用 Chrome 打开 YouTube 并搜索“硅谷101 视频”，若未跳转请手动输入该搜索链接。');
    } catch (error) {
      console.error('打开 Chrome/YouTube 失败', error);
      setStatusText('无法打开 Chrome 或 YouTube，请检查是否已安装 Chrome。');
    } finally {
      setBusyAction(null);
    }
  };

  const anyBusy = busyAction !== null;
  const inputStyle = tw.style(
    'flex-1 rounded-xl px-3 py-2 text-base',
    isDarkMode
      ? 'bg-slate-800 text-white border border-slate-700'
      : 'bg-white border border-slate-200 text-slate-900',
  );

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
            跨应用自动化（Android）
          </Text>
          <Text
            style={tw.style(
              'text-sm mt-1',
              isDarkMode ? 'text-slate-300' : 'text-slate-600',
            )}
          >
            通过内置无障碍服务启动并操作其他应用，同时提供 Auto.js 代码示例。
          </Text>
        </View>

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`p-4 pb-10 gap-4`}
        >
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
              步骤 1：开启无障碍
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              Android 需要在系统中开启“XAIApp 自动化服务”才能执行跨应用点击、滑动、粘贴等操作。
            </Text>
            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handleOpenAccessibilitySettings}
                style={tw.style(
                  'flex-1 rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text style={tw`text-center text-white text-sm font-semibold`}>
                  打开无障碍设置
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handleCheckService}
                style={tw.style(
                  'flex-1 rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-slate-700' : 'bg-slate-200',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text
                  style={tw.style(
                    'text-center text-sm font-semibold',
                    isDarkMode ? 'text-white' : 'text-slate-900',
                  )}
                >
                  刷新状态
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-200' : 'text-slate-800',
              )}
            >
              {statusText ||
                (serviceEnabled === null
                  ? '尚未检测无障碍状态。'
                  : serviceEnabled
                    ? '无障碍已开启，可直接下发指令。'
                    : '无障碍未开启，请在系统设置中打开。')}
            </Text>
          </View>

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
              步骤 2：启动目标应用
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              输入目标 App 的包名，点击按钮后会通过 Intent 直接拉起该应用。
            </Text>
            <View style={tw`gap-2`}>
              <TextInput
                value={packageName}
                onChangeText={setPackageName}
                placeholder="com.example.app"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                style={inputStyle}
              />
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handleOpenTargetApp}
                style={tw.style(
                  'rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text style={tw`text-center text-white text-base font-semibold`}>
                  启动指定 App
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handleOpenChromeYoutube}
                style={tw.style(
                  'rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-amber-500' : 'bg-amber-600',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text style={tw`text-center text-white text-base font-semibold`}>
                  Chrome 打开并搜索 YouTube：硅谷101
                </Text>
              </TouchableOpacity>
              <Text
                style={tw.style(
                  'text-xs leading-5',
                  isDarkMode ? 'text-slate-400' : 'text-slate-500',
                )}
              >
                如果系统弹窗提示需要授权启动其他应用，请选择允许。
              </Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
