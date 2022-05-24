declare module 'get-ready' {
  export function ready(callback: () => void): void;
  export function mixin(obj: any): void;
}
