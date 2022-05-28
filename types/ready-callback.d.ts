declare module 'ready-callback' {
  interface ReadyOptions {}
  export class Ready {
    constructor(potions: ReadyOptions);
    start(): void;
    ready(fn: (error: Error) => void): void;
  }
}
