/// <reference types="vite/client" />

declare module "*?worker&url" {
  const workerUrl: string;
  export default workerUrl;
}

declare module "*?url" {
  const assetUrl: string;
  export default assetUrl;
}
