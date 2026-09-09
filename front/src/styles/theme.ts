import '@emotion/react';

declare module '@emotion/react' {
  export interface Theme {
    colors: {
      semo: string;
      semoDark: string;
      lightBlue: string;
      lightGreen: string;
      green: string;
      lightRed: string;
      red: string;
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
    };
    typography: {
      fontFamily: string;
    };
    shadow: {
      toast: string;
      focus: string;
    };
  }
}

export const theme = {
  colors: {
    semo: '#006fff',
    semoDark: '#0056c2',
    lightBlue: '#cfe4ff',
    lightGreen: '#f0fdf4',
    green: '#22c55e',
    lightRed: '#fff0eb',
    red: '#ff4d00',
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
  },
  typography: {
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  shadow: {
    toast: '4px 4px 10px 0 rgb(0 0 0 / 20%)',
    focus: '2px 2px 20px 0 rgb(154 198 255 / 45%)',
  },
} as const;
