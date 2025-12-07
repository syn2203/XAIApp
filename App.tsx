import React, { useState } from 'react';
import { NewAppScreen } from '@react-native/new-app-screen';
import {
  Alert,
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
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  isServiceRunning,
  openAccessibilitySettings,
  openApp as openTargetApp,
  pasteText as pasteIntoFocusedField,
  swipe as swipeGesture,
  tap as tapGesture,
} from './automation';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent isDarkMode={isDarkMode} />
    </SafeAreaProvider>
  );
}

function AppContent({ isDarkMode }: { isDarkMode: boolean }) {
  const safeAreaInsets = useSafeAreaInsets();
  const [screen, setScreen] = useState<'home' | 'automation'>('home');
  const [packageName, setPackageName] = useState('com.example.app');
  const [tapX, setTapX] = useState('540');
  const [tapY, setTapY] = useState('1200');
  const [swipeStartX, setSwipeStartX] = useState('200');
  const [swipeStartY, setSwipeStartY] = useState('1200');
  const [swipeEndX, setSwipeEndX] = useState('200');
  const [swipeEndY, setSwipeEndY] = useState('600');
  const [textToPaste, setTextToPaste] = useState('自动填充内容');
  const [serviceEnabled, setServiceEnabled] = useState<boolean | null>(null);
  const [statusText, setStatusText] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const autojsSnippet = `"auto"; // 确保开启无障碍
console.show(); // 可选：显示日志

const TARGET = {
  name: "示例App",
  pkg: "com.example.app",
  entryText: "登录",
};

auto.waitFor(); // 等待无障碍
app.launchPackage(TARGET.pkg);
text(TARGET.entryText).waitFor();

// 点击并输入示例
text("登录").findOne().click();
id("username_input_id").findOne().setText("your_username");
id("password_input_id").findOne().setText("your_password");
text("确认").findOne().click();

toast("自动化完成");`;

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
          : '无障碍未开启，点击“打开无障碍设置”并启用 AIotApp 自动化服务。',
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
      setStatusText('已跳转到无障碍设置，请启用 “AIotApp 自动化服务” 后返回。');
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

  const handleTap = async () => {
    if (!ensureAndroid()) {
      return;
    }
    const x = Number(tapX);
    const y = Number(tapY);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      Alert.alert('请输入有效的点击坐标');
      return;
    }
    setBusyAction('tap');
    try {
      const ok = await tapGesture(x, y, 90);
      setStatusText(
        ok
          ? `已发送点击 (${x}, ${y})，确保目标界面已打开。`
          : '点击失败，请检查无障碍是否开启。',
      );
    } catch (error) {
      console.error('下发点击手势失败', error);
      setStatusText('发送点击失败，请检查权限。');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSwipe = async () => {
    if (!ensureAndroid()) {
      return;
    }
    const values = [
      swipeStartX,
      swipeStartY,
      swipeEndX,
      swipeEndY,
    ].map(Number);
    if (values.some(v => Number.isNaN(v))) {
      Alert.alert('请输入有效的滑动坐标');
      return;
    }
    const [sx, sy, ex, ey] = values;
    setBusyAction('swipe');
    try {
      const ok = await swipeGesture(sx, sy, ex, ey, 200);
      setStatusText(
        ok
          ? `已发送滑动 (${sx}, ${sy}) → (${ex}, ${ey})，用于翻页/滚动等操作。`
          : '滑动失败，检查无障碍权限。',
      );
    } catch (error) {
      console.error('下发滑动手势失败', error);
      setStatusText('发送滑动失败，请检查权限。');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePaste = async () => {
    if (!ensureAndroid()) {
      return;
    }
    setBusyAction('paste');
    try {
      const ok = await pasteIntoFocusedField(textToPaste);
      setStatusText(
        ok
          ? '已尝试粘贴到当前焦点输入框，请确保光标在目标输入框。'
          : '粘贴失败，请确认无障碍权限已开启。',
      );
    } catch (error) {
      console.error('粘贴文本失败', error);
      setStatusText('粘贴失败，请确认权限。');
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
    <View
      style={tw.style(
        'flex-1',
        isDarkMode ? 'bg-slate-900' : 'bg-slate-100',
      )}
    >
      <View
        style={tw.style(
          'px-4 pb-3',
          isDarkMode ? 'bg-slate-800' : 'bg-white',
          { paddingTop: safeAreaInsets.top },
        )}
      >
        <Text
          style={tw.style(
            'text-lg font-semibold',
            isDarkMode ? 'text-white' : 'text-slate-900',
          )}
        >
          {screen === 'home'
            ? 'Tailwind 样式已启用'
            : '跨应用自动化（Android）'}
        </Text>
        <Text
          style={tw.style(
            'text-sm mt-1',
            isDarkMode ? 'text-slate-300' : 'text-slate-600',
          )}
        >
          {screen === 'home'
            ? '现在可以直接在 React Native 中使用类如 px-4、bg-slate-800 等工具类。'
            : '通过内置无障碍服务启动并操作其他应用，同时提供 Auto.js 代码示例。'}
        </Text>
      </View>
      {screen === 'home' ? (
        <View style={tw`flex-1`}>
          <View style={tw`p-4 gap-3`}>
            <Text
              style={tw.style(
                'text-base font-medium',
                isDarkMode ? 'text-slate-100' : 'text-slate-900',
              )}
            >
              快速查看跨应用自动化
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-5',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              点击下方按钮跳转到自动化说明页，体验一键启动其他 APP 并执行点击、滑动、粘贴等操作。
            </Text>
            <TouchableOpacity
              onPress={() => setScreen('automation')}
              style={tw.style(
                'rounded-xl py-3 px-4',
                isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600',
              )}
            >
              <Text style={tw`text-center text-white text-base font-semibold`}>
                打开自动化控制页
              </Text>
            </TouchableOpacity>
          </View>
          <View style={tw`flex-1`}>
            <NewAppScreen
              templateFileName="App.tsx"
              safeAreaInsets={safeAreaInsets}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`p-4 pb-10 gap-4`}
        >
          <TouchableOpacity
            onPress={() => setScreen('home')}
            style={tw.style(
              'self-start rounded-full px-3 py-1.5',
              isDarkMode ? 'bg-slate-700' : 'bg-slate-200',
            )}
          >
            <Text
              style={tw.style(
                'text-sm font-medium',
                isDarkMode ? 'text-slate-100' : 'text-slate-800',
              )}
            >
              ← 返回主页面
            </Text>
          </TouchableOpacity>

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
              Android 需要在系统中开启“AIotApp 自动化服务”才能执行跨应用点击、滑动、粘贴等操作。
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

          <View
            style={tw.style(
              'rounded-2xl p-4 gap-4',
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
              步骤 3：执行自动化动作
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              下面的动作通过无障碍手势下发，适用于无 Root 设备。请确保目标界面已打开。
            </Text>

            <View style={tw`gap-2`}>
              <Text
                style={tw.style(
                  'text-sm font-semibold',
                  isDarkMode ? 'text-slate-100' : 'text-slate-800',
                )}
              >
                点击：坐标 (x, y)
              </Text>
              <View style={tw`flex-row gap-2`}>
                <TextInput
                  value={tapX}
                  onChangeText={setTapX}
                  keyboardType="numeric"
                  placeholder="x"
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                  style={inputStyle}
                />
                <TextInput
                  value={tapY}
                  onChangeText={setTapY}
                  keyboardType="numeric"
                  placeholder="y"
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                  style={inputStyle}
                />
              </View>
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handleTap}
                style={tw.style(
                  'rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text style={tw`text-center text-white text-base font-semibold`}>
                  发送点击
                </Text>
              </TouchableOpacity>
            </View>

            <View style={tw`gap-2`}>
              <Text
                style={tw.style(
                  'text-sm font-semibold',
                  isDarkMode ? 'text-slate-100' : 'text-slate-800',
                )}
              >
                滑动：起点 → 终点
              </Text>
              <View style={tw`flex-row gap-2`}>
                <TextInput
                  value={swipeStartX}
                  onChangeText={setSwipeStartX}
                  keyboardType="numeric"
                  placeholder="start x"
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                  style={inputStyle}
                />
                <TextInput
                  value={swipeStartY}
                  onChangeText={setSwipeStartY}
                  keyboardType="numeric"
                  placeholder="start y"
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                  style={inputStyle}
                />
              </View>
              <View style={tw`flex-row gap-2`}>
                <TextInput
                  value={swipeEndX}
                  onChangeText={setSwipeEndX}
                  keyboardType="numeric"
                  placeholder="end x"
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                  style={inputStyle}
                />
                <TextInput
                  value={swipeEndY}
                  onChangeText={setSwipeEndY}
                  keyboardType="numeric"
                  placeholder="end y"
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                  style={inputStyle}
                />
              </View>
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handleSwipe}
                style={tw.style(
                  'rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text style={tw`text-center text-white text-base font-semibold`}>
                  发送滑动
                </Text>
              </TouchableOpacity>
            </View>

            <View style={tw`gap-2`}>
              <Text
                style={tw.style(
                  'text-sm font-semibold',
                  isDarkMode ? 'text-slate-100' : 'text-slate-800',
                )}
              >
                文本粘贴到当前焦点输入框
              </Text>
              <TextInput
                value={textToPaste}
                onChangeText={setTextToPaste}
                placeholder="例如：自动输入的账号/指令"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#94a3b8'}
                style={inputStyle}
              />
              <TouchableOpacity
                disabled={anyBusy}
                onPress={handlePaste}
                style={tw.style(
                  'rounded-xl py-3 px-4',
                  isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600',
                  anyBusy ? 'opacity-70' : undefined,
                )}
              >
                <Text style={tw`text-center text-white text-base font-semibold`}>
                  粘贴文本
                </Text>
              </TouchableOpacity>
              <Text
                style={tw.style(
                  'text-xs leading-5',
                  isDarkMode ? 'text-slate-400' : 'text-slate-500',
                )}
              >
                粘贴前请让目标输入框获得焦点（比如先手动点击输入框），然后再点击“粘贴文本”。
              </Text>
            </View>

            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-emerald-200' : 'text-emerald-700',
              )}
            >
              {statusText
                ? `最新状态：${statusText}`
                : '最新状态将显示在这里，便于确认指令是否下发成功。'}
            </Text>
          </View>

          <View
            style={tw.style(
              'rounded-2xl p-4 gap-3',
              isDarkMode ? 'bg-slate-800' : 'bg-slate-900',
            )}
          >
            <Text
              style={tw.style(
                'text-lg font-semibold',
                isDarkMode ? 'text-white' : 'text-slate-50',
              )}
            >
              进阶：Auto.js 脚本版本
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-200' : 'text-slate-200',
              )}
            >
              如果你更熟悉 Auto.js，可以复制下面的脚本，按需替换包名、控件 id 或文案，保存后即可一键运行。
            </Text>
            <View
              style={tw.style(
                'rounded-xl p-4',
                isDarkMode ? 'bg-slate-900' : 'bg-black',
              )}
            >
              <Text
                selectable
                style={tw.style(
                  'text-xs leading-5 text-slate-100',
                  { fontFamily: 'Menlo' },
                )}
              >
                {autojsSnippet}
              </Text>
            </View>
          </View>

          <View
            style={tw.style(
              'rounded-2xl p-4',
              isDarkMode ? 'bg-slate-800' : 'bg-white',
              isDarkMode ? undefined : tw`border border-slate-200`,
            )}
          >
            <Text
              style={tw.style(
                'text-sm font-semibold mb-2',
                isDarkMode ? 'text-white' : 'text-slate-900',
              )}
            >
              使用小贴士
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              • 开启无障碍后再下发指令，若无响应可再次刷新状态。
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              • 坐标基于物理像素，需按设备分辨率填写；滑动持续时间可在 automation.ts 内调整。
            </Text>
            <Text
              style={tw.style(
                'text-sm leading-6',
                isDarkMode ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              • iOS 受系统限制无法后台控制其他 App，可使用深度链接/快捷指令替代。
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default App;
