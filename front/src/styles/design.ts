import { theme } from './theme';
export const colors = {
  primary: theme.colors.semo,
  white: theme.colors.background,
  lightBlue: theme.colors.lightBlue,
  green: theme.colors.green,
  lightGreen: theme.colors.lightGreen,
  red: theme.colors.red,
  lightRed: theme.colors.lightRed,
  gray50: theme.colors.gray[50],
  gray100: theme.colors.gray[100],
  gray200: theme.colors.gray[200],
  gray300: theme.colors.gray[300],
  gray500: theme.colors.gray[500],
  gray700: theme.colors.gray[700],
  gray900: theme.colors.gray[900],
  overlayWhite: theme.colors.overlayWhite,
};
export const shadows = {
  toast: theme.shadow.toast,
  focus: theme.shadow.focus,
  carouselNav: theme.shadow.carouselNav,
};
export const mobile = '@media (max-width: 480px)';
