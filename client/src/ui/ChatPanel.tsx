import { useEffect, useRef, useState } from "react";
import { CHAT_HISTORY_MAX, CHAT_TEXT_MAX } from "@liminal/shared";
import type { Room } from "../net/useRoom.js";
import "./chat-panel.css";

interface ChatPanelProps {
  room: Pick<Room, "chatMessages" | "sendChat" | "welcome">;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function ChatPanel({ room }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = room.chatMessages.slice(-CHAT_HISTORY_MAX);

  const openChat = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      if (event.code !== "KeyM" || isTypingTarget(event.target)) return;
      event.preventDefault();
      if (open) setOpen(false);
      else openChat();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, open]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    room.sendChat(text);
    setDraft("");
  };

  return (
    <aside className={`chat-panel ${open ? "chat-panel--open" : ""}`} aria-label="Session chat">
      <button className="chat-panel__toggle" type="button" aria-expanded={open} onClick={openChat}>
        <span aria-hidden="true">⌁</span>
        Chat · M
      </button>
      {open && (
        <div className="chat-panel__body">
          <div className="chat-panel__header">
            <span>Close-range channel</span>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
              M / Esc
            </button>
          </div>
          <div className="chat-panel__messages" role="log" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 && <p className="chat-panel__empty">Only the hum answers.</p>}
            {messages.map((message) => (
              <p
                className={message.senderId === room.welcome?.selfId ? "chat-panel__message--self" : undefined}
                key={message.seq}
              >
                <strong>{message.senderName}</strong>
                <span>{message.text}</span>
              </p>
            ))}
            <div ref={endRef} />
          </div>
          <form
            className="chat-panel__form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="chat-panel__label" htmlFor="session-chat">
              Message your partner
            </label>
            <input
              id="session-chat"
              ref={inputRef}
              maxLength={CHAT_TEXT_MAX}
              autoComplete="off"
              placeholder="Say something…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" aria-label="Send message" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
