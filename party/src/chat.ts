import { CHAT_HISTORY_MAX, TICK_HZ, type ChatMessage } from "@liminal/shared";

export interface ChatState {
  version: number;
  messages: ChatMessage[];
}

export class ChatLedger {
  private readonly lastSentTick = new Map<string, number>();
  private messages: ChatMessage[] = [];
  private version = 0;

  commit(
    senderId: string,
    senderName: string,
    text: string,
    tick: number,
  ): ChatMessage | null {
    const lastTick = this.lastSentTick.get(senderId);
    if (lastTick !== undefined && tick - lastTick < TICK_HZ) return null;

    this.lastSentTick.set(senderId, tick);
    this.version += 1;
    const message = { seq: this.version, senderId, senderName, text };
    this.messages.push(message);
    if (this.messages.length > CHAT_HISTORY_MAX) {
      this.messages = this.messages.slice(-CHAT_HISTORY_MAX);
    }
    return message;
  }

  state(): ChatState {
    return { version: this.version, messages: [...this.messages] };
  }
}
