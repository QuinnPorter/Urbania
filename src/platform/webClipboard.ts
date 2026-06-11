import type { ClipboardPort } from "./ports";

export class WebClipboard implements ClipboardPort {
  async write(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
  }

  async read(): Promise<string> {
    return navigator.clipboard.readText();
  }
}
