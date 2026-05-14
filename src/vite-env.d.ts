/// <reference types="vite/client" />

declare global {
  interface Window {
    copyCodeBlock: (btn: HTMLElement) => void;
    resultSetPage: (btn: HTMLElement, direction: 'prev' | 'next') => void;
  }
}
export {};
