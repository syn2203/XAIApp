import {NativeModules, Platform} from 'react-native';

type AutomationNativeModule = {
  isAccessibilityServiceRunning: () => Promise<boolean>;
  openAccessibilitySettings: () => Promise<boolean>;
  openApp: (packageName: string) => Promise<boolean>;
  tap: (x: number, y: number, durationMs: number) => Promise<boolean>;
  swipe: (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    durationMs: number,
  ) => Promise<boolean>;
  pasteText: (text: string) => Promise<boolean>;
};

const nativeModule: AutomationNativeModule | null =
  Platform.OS === 'android'
    ? (NativeModules.AutomationModule as AutomationNativeModule)
    : null;

function ensureAvailable(): AutomationNativeModule {
  if (!nativeModule) {
    throw new Error('自动化功能仅支持已开启无障碍的 Android 设备。');
  }
  return nativeModule;
}

export async function isServiceRunning(): Promise<boolean> {
  return ensureAvailable().isAccessibilityServiceRunning();
}

export async function openAccessibilitySettings(): Promise<boolean> {
  return ensureAvailable().openAccessibilitySettings();
}

export async function openApp(packageName: string): Promise<boolean> {
  return ensureAvailable().openApp(packageName);
}

export async function tap(
  x: number,
  y: number,
  durationMs = 80,
): Promise<boolean> {
  return ensureAvailable().tap(x, y, durationMs);
}

export async function swipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  durationMs = 150,
): Promise<boolean> {
  return ensureAvailable().swipe(startX, startY, endX, endY, durationMs);
}

export async function pasteText(text: string): Promise<boolean> {
  return ensureAvailable().pasteText(text);
}
