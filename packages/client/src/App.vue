<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme-overrides="themeOverrides"
  >
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { zhCN, dateZhCN, type GlobalThemeOverrides } from 'naive-ui'

/**
 * @description 定义全局视觉主题，统一页面色彩、圆角与阴影风格
 */
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3a7bff',
    primaryColorHover: '#5a91ff',
    primaryColorPressed: '#2d63d9',
    primaryColorSuppl: '#3a7bff',
    infoColor: '#3692ff',
    successColor: '#22a06b',
    warningColor: '#d98c0f',
    errorColor: '#d04d6d',
    borderRadius: '14px',
    borderRadiusSmall: '10px',
    fontFamily:
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SF Pro Display", "Helvetica Neue", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Cascadia Code", monospace',
  },
  Layout: {
    siderColor: 'rgba(255, 255, 255, 0.78)',
    headerColor: 'rgba(255, 255, 255, 0.72)',
    color: 'transparent',
  },
  Card: {
    color: 'rgba(255, 255, 255, 0.82)',
    colorModal: '#ffffff',
    borderColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: '20px',
    boxShadow: '0 12px 32px rgba(12, 28, 61, 0.08)',
    titleTextColor: '#0f172a',
  },
  Button: {
    borderRadiusLarge: '12px',
    borderRadiusMedium: '12px',
    borderRadiusSmall: '10px',
    fontWeight: '600',
    heightLarge: '44px',
    heightMedium: '38px',
  },
  Input: {
    borderRadius: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
    colorFocus: '#ffffff',
    borderHover: '1px solid rgba(58, 123, 255, 0.6)',
    boxShadowFocus: '0 0 0 4px rgba(58, 123, 255, 0.14)',
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '12px',
      },
    },
  },
  Menu: {
    itemBorderRadius: '12px',
    itemColorActive: 'rgba(58, 123, 255, 0.15)',
    itemColorActiveCollapsed: 'rgba(58, 123, 255, 0.18)',
    itemTextColorActive: '#2f63f3',
    itemTextColorActiveHover: '#2f63f3',
    arrowColor: 'rgba(71, 85, 105, 0.72)',
  },
  DataTable: {
    thColor: 'rgba(148, 163, 184, 0.14)',
    tdColorHover: 'rgba(58, 123, 255, 0.06)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    thTextColor: '#334155',
    tdTextColor: '#0f172a',
  },
  Tag: {
    borderRadius: '999px',
  },
}
</script>
