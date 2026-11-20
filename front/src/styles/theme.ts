import '@emotion/react';

declare module '@emotion/react' {
  export interface Theme {
    colors: {
      semo: string;
      semoDark: string;
      semoHover: string;
      paleBlue: string;
      surface: string;
      lightBlue: string;
      lightGreen: string;
      green: string;
      lightRed: string;
      red: string;
      lightAmber: string;
      amber: string;
      gray: {
        50: string;
        100: string;
        200: string;
        300: string;
        500: string;
        700: string;
        900: string;
      };
      background: string;
      foreground: string;
      overlayWhite: string;
      overlayBlack: string;
      overlayWhiteSoft: string;
      overlaySemo: string;
      overlayDim: string;
      overlayBlackSoft: string;
      overlayDark: string;
      overlayScrim: string;
    };
    typography: {
      fontFamily: string;
    };
    shadow: {
      toast: string;
      focus: string;
      carouselNav: string;
      modal: string;
      card: string;
      cardHover: string;
    };
  }
}

export const theme = {
  colors: {
    semo: '#006fff',
    semoDark: '#0056c2',
    semoHover: '#005ee0',
    paleBlue: '#eaf3ff',
    surface: '#f8f8f8',
    lightBlue: '#cfe4ff',
    lightGreen: '#f0fdf4',
    green: '#22c55e',
    lightRed: '#fff0eb',
    red: '#ff4d00',
    lightAmber: '#fef3c7',
    amber: '#f59e0b',
    gray: {
      50: '#fdfdfd',
      100: '#f4f4f4',
      200: '#dfe2e7',
      300: '#c9ccd2',
      500: '#858a99',
      700: '#636c7f',
      900: '#101010',
    },
    background: '#ffffff',
    foreground: '#101010',
    overlayWhite: 'rgb(255 255 255 / 85%)',
    overlayBlack: 'rgb(0 0 0 / 50%)',
    // 관리자 콘솔 모달·배경 스크림용 알파 색상. 값은 기존 하드코딩 색을 토큰화한 것이다.
    overlayWhiteSoft: 'rgb(255 255 255 / 10%)',
    overlaySemo: 'rgb(0 111 255 / 10%)',
    overlayDim: 'rgb(17 24 39 / 46%)',
    overlayBlackSoft: 'rgb(0 0 0 / 20%)',
    overlayDark: 'rgb(16 16 16 / 60%)',
    overlayScrim: 'rgb(17 17 17 / 20%)',
  },
  typography: {
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  shadow: {
    toast: '4px 4px 10px 0 rgb(0 0 0 / 20%)',
    focus: '2px 2px 20px 0 rgb(154 198 255 / 45%)',
    carouselNav: '0 1px 3px rgb(0 0 0 / 70%)',
    // 관리자 모달/카드 그림자 — 기존 하드코딩 값을 토큰화했다.
    modal: '0 20px 48px rgb(17 24 39 / 22%)',
    card: '0 4px 12px rgb(0 0 0 / 15%)',
    cardHover: '0 12px 28px rgb(27 33 44 / 18%)',
  },
} as const;
