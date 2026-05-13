/// <reference types="vite/client" />

declare global {
  interface Window {
    copyTextToClipboard: (text: string) => void;
  }
}
export {};
