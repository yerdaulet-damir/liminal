import { describe, expect, it } from "vitest";
import {
  CHAT_TEXT_MAX,
  encode,
  parseClientMsg,
  parseMatchClientMsg,
  parseMatchServerMsg,
  parseServerMsg,
  type ClientMsg,
  type MatchClientMsg,
  type MatchServerMsg,
  type ServerMsg,
} from "../src/protocol.js";

describe("game protocol", () => {
  const clientMessages: ClientMsg[] = [
    { t: "join", name: "wanderer", lastVersion: 12, resumeToken: "token_abcdefghijklmnopqrstuvwxyz012345" },
    { t: "move", x: 1, z: 2, ry: 3, lit: true, mic: 0.5 },
    { t: "grab", id: 4 },
    { t: "restart" },
    { t: "chat", text: "stay close" },
  ];
  const serverMessages: ServerMsg[] = [
    {
      t: "welcome",
      selfId: "p1",
      seed: 42,
      version: 7,
      resumeToken: "token_abcdefghijklmnopqrstuvwxyz012345",
    },
    {
      t: "state",
      version: 8,
      phase: "playing",
      level: 0,
      outage: false,
      keysLeft: [1],
      players: [{
        id: "p1",
        name: "one",
        x: 1,
        z: 2,
        ry: 0,
        down: false,
        reviveP: 0,
        noise: 0,
        heard: false,
        lit: true,
        flashlightS: 42,
      }],
      entity: { x: 3, z: 4, mood: "stalk" },
    },
    {
      t: "chat_state",
      version: 2,
      messages: [{ seq: 2, senderId: "p1", senderName: "one", text: "hello" }],
    },
    {
      t: "chat",
      message: { seq: 3, senderId: "p1", senderName: "one", text: "run" },
    },
    { t: "room_full" },
    { t: "session_invalid" },
    { t: "room_unavailable" },
  ];

  it.each(clientMessages)("round-trips client message $t", (message) => {
    expect(parseClientMsg(encode(message))).toEqual(message);
  });

  it.each(serverMessages)("round-trips server message $t", (message) => {
    expect(parseServerMsg(encode(message))).toEqual(message);
  });

  it("rejects unknown and malformed game tags", () => {
    expect(parseClientMsg('{"t":"teleport","x":1}')).toBeNull();
    expect(parseServerMsg('{"t":"state","version":1}')).toBeNull();
    expect(parseClientMsg(`{"t":"chat","text":"${"x".repeat(2_000)}"}`)).toBeNull();
    expect(parseClientMsg('{"t":"join","name":"x","lastVersion":0,"resumeToken":"short"}')).toBeNull();
    expect(
      parseServerMsg(
        '{"t":"welcome","selfId":"p1","seed":1,"version":0,"resumeToken":"short"}',
      ),
    ).toBeNull();
  });

  it("normalizes bounded chat at the untrusted boundary", () => {
    const text = `  ${"x".repeat(CHAT_TEXT_MAX + 20)}  `;
    expect(parseClientMsg(JSON.stringify({ t: "chat", text }))).toEqual({
      t: "chat",
      text: "x".repeat(CHAT_TEXT_MAX),
    });
    expect(parseClientMsg('{"t":"chat","text":"   "}')).toBeNull();
  });
});

describe("matchmaking protocol", () => {
  const clientMessages: MatchClientMsg[] = [
    { t: "find_match" },
    { t: "cancel_match" },
    { t: "match_ack", roomId: "opaque_room_1234567890" },
  ];
  const serverMessages: MatchServerMsg[] = [
    { t: "match_waiting", waiting: 2 },
    { t: "match_found", roomId: "opaque_room_1234567890" },
  ];

  it.each(clientMessages)("round-trips client message $t", (message) => {
    expect(parseMatchClientMsg(encode(message))).toEqual(message);
  });

  it.each(serverMessages)("round-trips server message $t", (message) => {
    expect(parseMatchServerMsg(encode(message))).toEqual(message);
  });

  it("defaults a missing waiting count to one open door", () => {
    expect(parseMatchServerMsg(JSON.stringify({ t: "match_waiting" }))).toEqual({
      t: "match_waiting",
      waiting: 1,
    });
  });

  it("rejects unknown tags and invalid acknowledgements", () => {
    expect(parseMatchClientMsg('{"t":"join"}')).toBeNull();
    expect(parseMatchClientMsg('{"t":"match_ack","roomId":""}')).toBeNull();
    expect(parseMatchClientMsg('{"t":"match_ack","roomId":"guessable-room"}')).toBeNull();
    expect(parseMatchServerMsg('{"t":"match_found","roomId":7}')).toBeNull();
    expect(parseMatchClientMsg(`{"t":"find_match","padding":"${"x".repeat(2_000)}"}`)).toBeNull();
  });
});
