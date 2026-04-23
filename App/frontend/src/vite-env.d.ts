/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_API_PROXY_TARGET?: string;
}

declare module '*.png' {
  const src: string;
  export default src;
}
