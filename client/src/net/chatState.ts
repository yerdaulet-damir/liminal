import { CHAT_HISTORY_MAX, type ChatMessage } from "@liminal/shared";

export interface VersionedChat {
  version: number;
  messages: ChatMessage[];
}

export class ChatStore {
  private version = 0;
  private messages: ChatMessage[] = [];

  applyState(version: number, messages: ChatMessage[]): boolean {
    if (version <= this.version) return false;
    this.version = version;
    this.messages = messages.slice(-CHAT_HISTORY_MAX);
    return true;
  }

  applyEvent(message: ChatMessage): boolean {
    if (message.seq !== this.version + 1) return false;
    this.version = message.seq;
    this.messages = [...this.messages, message].slice(-CHAT_HISTORY_MAX);
    return true;
  }

  state(): VersionedChat {
    return { version: this.version, messages: [...this.messages] };
  }
}
