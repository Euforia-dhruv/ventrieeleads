import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../middleware/auth';
import { logger } from '../core/logger';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  workspaceId?: string;
  isAlive?: boolean;
  subscriptions?: Set<string>;
}

interface WSMessage {
  type: string;
  channel?: string;
  data?: any;
  id?: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedSocket, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const socket = ws as AuthenticatedSocket;
        if (socket.isAlive === false) {
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, 30000);

    logger.info('WebSocket server initialized on /ws');
  }

  private async handleConnection(ws: AuthenticatedSocket, req: any): Promise<void> {
    ws.isAlive = true;
    ws.subscriptions = new Set();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded && decoded.id) {
          ws.userId = decoded.id;
          ws.workspaceId = decoded.workspace_id;
          this.addClient(ws);
          ws.send(
            JSON.stringify({ type: 'connected', data: { userId: decoded.id, workspaceId: decoded.workspace_id } }),
          );
          logger.info(`WebSocket client connected: user=${decoded.id}`);
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid token' } }));
        ws.close(1008, 'Invalid token');
        return;
      }
    } else {
      ws.send(JSON.stringify({ type: 'connected', data: { anonymous: true } }));
    }

    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (_error) {
        ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid message format' } }));
      }
    });

    ws.on('close', () => {
      this.removeClient(ws);
      logger.info(`WebSocket client disconnected: user=${ws.userId || 'anonymous'}`);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket client error:', error);
      this.removeClient(ws);
    });
  }

  private handleMessage(ws: AuthenticatedSocket, message: WSMessage): void {
    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          ws.subscriptions?.add(message.channel);
          ws.send(JSON.stringify({ type: 'subscribed', channel: message.channel }));
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          ws.subscriptions?.delete(message.channel);
          ws.send(JSON.stringify({ type: 'unsubscribed', channel: message.channel }));
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', data: { message: `Unknown message type: ${message.type}` } }));
    }
  }

  private addClient(ws: AuthenticatedSocket): void {
    if (!ws.workspaceId) return;
    if (!this.clients.has(ws.workspaceId)) {
      this.clients.set(ws.workspaceId, new Set());
    }
    this.clients.get(ws.workspaceId)!.add(ws);
  }

  private removeClient(ws: AuthenticatedSocket): void {
    if (ws.workspaceId) {
      const workspaceClients = this.clients.get(ws.workspaceId);
      if (workspaceClients) {
        workspaceClients.delete(ws);
        if (workspaceClients.size === 0) {
          this.clients.delete(ws.workspaceId);
        }
      }
    }
  }

  broadcast(workspaceId: string, channel: string, data: any): void {
    const workspaceClients = this.clients.get(workspaceId);
    if (!workspaceClients) return;

    const message = JSON.stringify({ type: 'broadcast', channel, data, timestamp: Date.now() });

    workspaceClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.subscriptions?.has(channel)) {
        ws.send(message);
      }
    });
  }

  broadcastToAll(channel: string, data: any): void {
    const message = JSON.stringify({ type: 'broadcast', channel, data, timestamp: Date.now() });

    this.clients.forEach((workspaceClients) => {
      workspaceClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN && ws.subscriptions?.has(channel)) {
          ws.send(message);
        }
      });
    });
  }

  sendToUser(userId: string, channel: string, data: any): void {
    this.clients.forEach((workspaceClients) => {
      workspaceClients.forEach((ws) => {
        if (ws.userId === userId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'message', channel, data, timestamp: Date.now() }));
        }
      });
    });
  }

  getClientCount(): number {
    let count = 0;
    this.clients.forEach((clients) => {
      count += clients.size;
    });
    return count;
  }

  getWorkspaceClientCount(workspaceId: string): number {
    return this.clients.get(workspaceId)?.size || 0;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss?.clients.forEach((ws) => ws.close(1001, 'Server shutting down'));
    this.wss?.close();
    this.clients.clear();
  }
}

export const wsManager = new WebSocketManager();
