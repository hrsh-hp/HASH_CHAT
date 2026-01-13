export interface FileMeta {
  name: string;
  size: number;
  mimeType: string;
  blobUrl?: string;
}

export interface ReplyContext {
  id: string;
  sender: 'local' | 'remote' | 'system';
  content: string;
}

export interface Message {
  id: string;
  sender: 'local' | 'remote' | 'system';
  senderId?: string; // specific peer ID
  content: string;
  timestamp: number;
  type: 'text' | 'file';
  file?: FileMeta;
  status?: 'sending' | 'sent' | 'delivered'; // Track transfer status
  replyTo?: ReplyContext;
  isEdited?: boolean;
  isDeleted?: boolean;
}

export const ConnectionStatus = {
  OFFLINE: 'OFFLINE',
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR'
} as const;

export type ConnectionStatus = typeof ConnectionStatus[keyof typeof ConnectionStatus];

export interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
}