import { getApiBaseUrl } from './api';

export interface LiveMessage<T = unknown> {
  type: string;
  event?: string;
  payload?: T;
}

export function getLiveSocketUrl() {
  const apiBase = getApiBaseUrl();
  const apiUrl = new URL(apiBase, window.location.origin);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}/live`;
}

export function connectLiveSocket(onMessage: (message: LiveMessage) => void) {
  const socket = new WebSocket(getLiveSocketUrl());

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as LiveMessage;
      onMessage(data);
    } catch {
      // ignore malformed payloads
    }
  };

  return socket;
}
