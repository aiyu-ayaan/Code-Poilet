import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { RunModel } from '../models/run.model.js';

type ClientContext = {
  socket: WebSocket;
  subscribedRunId?: string;
};

const clients = new Set<ClientContext>();

function safeSend(socket: WebSocket, payload: unknown) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

async function pushQueueSnapshot(target?: ClientContext) {
  const [queued, running, failed, success] = await Promise.all([
    RunModel.countDocuments({ status: 'queued' }),
    RunModel.countDocuments({ status: 'running' }),
    RunModel.countDocuments({ status: 'failed' }),
    RunModel.countDocuments({ status: 'success' }),
  ]);
  const snapshot = { queued, running, failed, success, maxConcurrentRuns: env.MAX_CONCURRENT_RUNS };

  if (target) {
    safeSend(target.socket, { type: 'queue_snapshot', payload: snapshot });
    return;
  }

  for (const client of clients) {
    safeSend(client.socket, { type: 'queue_snapshot', payload: snapshot });
  }
}

export async function publishQueueUpdate() {
  await pushQueueSnapshot();
}

export async function publishRunUpdate(runId: string, event: string) {
  const run = await RunModel.findOne({ runId }).lean();
  if (!run) {
    return;
  }

  for (const client of clients) {
    if (!client.subscribedRunId || client.subscribedRunId === runId) {
      safeSend(client.socket, {
        type: 'run_update',
        event,
        payload: run,
      });
    }
  }
}

async function sendInitial(target: ClientContext) {
  await pushQueueSnapshot(target);

  if (target.subscribedRunId) {
    const run = await RunModel.findOne({ runId: target.subscribedRunId }).lean();
    if (run) {
      safeSend(target.socket, { type: 'run_update', event: 'snapshot', payload: run });
    }
  }
}

export function initLiveGateway(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', (socket) => {
    const client: ClientContext = { socket };
    clients.add(client);

    safeSend(socket, { type: 'connected' });
    void sendInitial(client);

    socket.on('message', async (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string; runId?: string };

        if (message.type === 'subscribe_run' && message.runId) {
          client.subscribedRunId = message.runId;
          await sendInitial(client);
          return;
        }

        if (message.type === 'unsubscribe_run') {
          client.subscribedRunId = undefined;
          await pushQueueSnapshot(client);
        }
      } catch (error) {
        logger.warn({ err: error }, 'Invalid websocket payload');
      }
    });

    socket.on('close', () => {
      clients.delete(client);
    });

    socket.on('error', (error) => {
      logger.warn({ err: error }, 'WebSocket client error');
      clients.delete(client);
    });
  });

  logger.info('Live WebSocket gateway ready at /live');
}
