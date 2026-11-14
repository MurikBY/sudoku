import { useCallback, useEffect, useRef } from "react";

import { partyWebSocketUrl } from "@/api/parties";
import type { PartyWsEvent } from "@/api/types";

export type PartySocketHandlers = {
  onEvent: (event: PartyWsEvent) => void;
  onConnectError: (error: unknown) => void;
};

export function usePartySocket() {
  const socketRef = useRef<WebSocket | null>(null);
  // disconnect bumps this so a ticket that arrives after leave cannot open a socket.
  const attemptRef = useRef(0);

  const disconnect = useCallback(() => {
    attemptRef.current += 1;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket !== null) {
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }
  }, []);

  const connect = useCallback(
    (partyId: string, handlers: PartySocketHandlers) => {
      disconnect();
      const attempt = attemptRef.current;
      void (async () => {
        let url: string;
        try {
          url = await partyWebSocketUrl(partyId);
        } catch (err) {
          if (attemptRef.current === attempt) {
            handlers.onConnectError(err);
          }
          return;
        }
        if (attemptRef.current !== attempt) {
          return;
        }
        let socket: WebSocket;
        try {
          socket = new WebSocket(url);
        } catch (err) {
          // A network failure arrives as onclose; a throw here is a bad URL or a blocked socket.
          handlers.onConnectError(err);
          return;
        }
        socketRef.current = socket;
        socket.onmessage = (message) => {
          handlers.onEvent(JSON.parse(String(message.data)) as PartyWsEvent);
        };
        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }
        };
      })();
    },
    [disconnect],
  );

  useEffect(() => disconnect, [disconnect]);

  return { connect, disconnect };
}
