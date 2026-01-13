import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import { TerminalLayout } from './components/TerminalLayout';
import { ConnectionManager } from './components/ConnectionManager';
import { ChatInterface } from './components/ChatInterface';
import { LogPanel } from './components/LogPanel';
import { ConnectionStatus } from './types';
import type { Message, LogEntry, ReplyContext } from './types';
import { SYSTEM_MESSAGES } from './constants';
import { ShieldCheck, Wifi, WifiOff, Power, Maximize, Minimize, ScrollText, X } from 'lucide-react';

// Storage Key
const STORAGE_KEY_ID = 'netrunner_id';

// Generate a short, random ID (6 alphanumeric characters)
const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const App: React.FC = () => {
  const [isSystemOn, setIsSystemOn] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.INITIALIZING);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMobileLogs, setShowMobileLogs] = useState(false);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  
  // Initialize ID from storage or generate new one
  const [desiredId, setDesiredId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_ID);
    if (stored) return stored;
    const newId = generateShortId();
    localStorage.setItem(STORAGE_KEY_ID, newId);
    return newId;
  });

  const [peerId, setPeerId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const urlParamsProcessed = useRef<boolean>(false);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Handle Fullscreen Toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      message,
      timestamp: Date.now(),
      type
    }]);
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      sender: 'system',
      content,
      timestamp: Date.now(),
      type: 'text'
    }]);
  }, []);

  const clearLogs = () => {
    setLogs([]);
    addLog('System logs purged.', 'warning');
  };

  const clearChat = () => {
    setMessages([]);
    addLog('Message buffer cleared.', 'warning');
  };

  const setupConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      setStatus(ConnectionStatus.CONNECTED);
      addLog(SYSTEM_MESSAGES.CONNECTED, 'success');
      addSystemMessage(`Encrypted connection established with ${conn.peer}`);
    });

    conn.on('data', (data: any) => {
      if (data) {
        // Typing Signal
        if (data.type === 'typing') {
          setIsRemoteTyping(data.isTyping);
          return;
        }

        // Handle Acknowledgement
        if (data.type === 'ack') {
          setMessages(prev => prev.map(msg => 
            msg.id === data.messageId ? { ...msg, status: 'delivered' } : msg
          ));
          return;
        }

        // Handle Edit
        if (data.type === 'edit') {
           setMessages(prev => prev.map(msg => 
             msg.id === data.messageId ? { ...msg, content: data.content, isEdited: true } : msg
           ));
           return;
        }

        // Handle Delete
        if (data.type === 'delete') {
           setMessages(prev => prev.map(msg => 
             msg.id === data.messageId ? { ...msg, isDeleted: true } : msg
           ));
           return;
        }

        if (data.type === 'text') {
           setIsRemoteTyping(false); 
           setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            sender: 'remote',
            senderId: conn.peer,
            content: data.content,
            timestamp: Date.now(),
            type: 'text',
            replyTo: data.replyTo
          }]);
        } else if (data.type === 'file') {
          setIsRemoteTyping(false);
          const blob = new Blob([data.file], { type: data.mimeType });
          const blobUrl = URL.createObjectURL(blob);
          
          setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            sender: 'remote',
            senderId: conn.peer,
            content: `Received file: ${data.name}`,
            timestamp: Date.now(),
            type: 'file',
            file: {
              name: data.name,
              size: data.size,
              mimeType: data.mimeType,
              blobUrl: blobUrl
            }
          }]);
          addLog(`Received file packet: ${data.name}`, 'success');

          conn.send({
            type: 'ack',
            messageId: data.id
          });
        }
      }
    });

    conn.on('close', () => {
      setStatus(ConnectionStatus.READY);
      connRef.current = null;
      setIsRemoteTyping(false);
      addLog(SYSTEM_MESSAGES.DISCONNECTED, 'warning');
      addSystemMessage('Remote peer terminated connection.');
    });

    conn.on('error', (err) => {
      addLog(`Connection error: ${err.message}`, 'error');
      setStatus(ConnectionStatus.READY);
      setIsRemoteTyping(false);
    });
  }, [addLog, addSystemMessage]);

  const connectToPeer = useCallback((targetId: string) => {
    if (!peerRef.current) return;
    if (statusRef.current === ConnectionStatus.CONNECTED) {
      addLog('Already connected. Terminate current link first.', 'warning');
      return;
    }
    if (targetId === peerId) {
      addLog('Cannot connect to self. Targeting external node required.', 'error');
      return;
    }

    addLog(`Initiating handshake with ${targetId}...`, 'info');
    setStatus(ConnectionStatus.CONNECTING);
    
    try {
      const conn = peerRef.current.connect(targetId);
      setupConnection(conn);
    } catch (err: any) {
      addLog(`Handshake failed: ${err.message || err}`, 'error');
      setStatus(ConnectionStatus.READY);
    }
  }, [addLog, setupConnection, peerId]);

  // Handle Identity Change & Persistence
  const handleIdentityChange = (newId: string) => {
    if (newId === peerId) return;
    addLog(`Re-initializing node with new identity: ${newId}`, 'info');
    localStorage.setItem(STORAGE_KEY_ID, newId);
    setDesiredId(newId);
  };

  const togglePower = () => {
    if (isSystemOn) {
      setIsSystemOn(false);
      setStatus(ConnectionStatus.OFFLINE);
      setPeerId('');
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      connRef.current = null;
      addLog('SYSTEM SHUTDOWN SEQUENCE INITIATED...', 'warning');
      addSystemMessage('System offline.');
    } else {
      setIsSystemOn(true);
      addLog('SYSTEM BOOT SEQUENCE INITIATED...', 'success');
    }
  };

  // Typing Handler
  const handleTyping = (isTyping: boolean) => {
    if (connRef.current && status === ConnectionStatus.CONNECTED) {
      connRef.current.send({
        type: 'typing',
        isTyping
      });
    }
  };

  useEffect(() => {
    if (!isSystemOn) {
      return;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    setStatus(ConnectionStatus.INITIALIZING);
    setPeerId('');
    setIsRemoteTyping(false);
    
    addLog(SYSTEM_MESSAGES.PEER_INIT);
    
    const peer = new Peer(desiredId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setStatus(ConnectionStatus.READY);
      addLog(`Identity confirmed: ${id}`, 'success');
    });

    peer.on('connection', (conn) => {
      if (connRef.current) {
        conn.close();
        addLog('Rejected concurrent connection attempt', 'warning');
        return;
      }
      setupConnection(conn);
      addLog(`Incoming handshake from: ${conn.peer}`, 'warning');
    });

    peer.on('error', (err: any) => {
      console.error(err);
      if (err.type === 'unavailable-id') {
        addLog(`ID Collision: "${desiredId}" is already in use.`, 'error');
      } else {
        addLog(`PROTOCOL ERROR: ${err.message || 'Unknown error'}`, 'error');
      }
      setStatus(ConnectionStatus.ERROR);
    });

    return () => {
      peer.destroy();
    };
  }, [desiredId, addLog, setupConnection, isSystemOn]);

  // Handle URL connection parameters
  useEffect(() => {
    if (status === ConnectionStatus.READY && !urlParamsProcessed.current) {
      const params = new URLSearchParams(window.location.search);
      const targetParam = params.get('connect');
      
      if (targetParam) {
        urlParamsProcessed.current = true;
        addLog(`Found target coordinates in URL: ${targetParam}`, 'info');
        setTimeout(() => {
          connectToPeer(targetParam);
        }, 500);
      }
    }
  }, [status, connectToPeer, addLog]);

  const sendMessage = (content: string, replyTo?: ReplyContext) => {
    if (!connRef.current || status !== ConnectionStatus.CONNECTED) {
      addLog('Cannot send: No active uplink.', 'error');
      return;
    }

    const msgData = { type: 'text', content, replyTo };
    connRef.current.send(msgData);

    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      sender: 'local',
      senderId: peerId,
      content,
      timestamp: Date.now(),
      type: 'text',
      status: 'sent',
      replyTo
    }]);
  };

  const handleEditMessage = (id: string, newContent: string) => {
    if (!connRef.current || status !== ConnectionStatus.CONNECTED) return;
    
    // Send edit signal
    connRef.current.send({
      type: 'edit',
      messageId: id,
      content: newContent
    });

    // Update local state
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, content: newContent, isEdited: true } : msg
    ));
  };

  const handleDeleteMessage = (id: string) => {
    if (!connRef.current || status !== ConnectionStatus.CONNECTED) return;

    // Send delete signal
    connRef.current.send({
      type: 'delete',
      messageId: id
    });

    // Update local state
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, isDeleted: true } : msg
    ));
  };

  const sendFile = (file: File) => {
    if (!connRef.current || status !== ConnectionStatus.CONNECTED) {
      addLog('Cannot send: No active uplink.', 'error');
      return;
    }
    addLog(`Initiating file transfer: ${file.name} (${(file.size / 1024).toFixed(1)}KB)...`, 'info');
    const msgId = Math.random().toString(36).substring(7);
    const fileData = {
      id: msgId,
      type: 'file',
      file: file,
      name: file.name,
      size: file.size,
      mimeType: file.type
    };
    connRef.current.send(fileData);
    const blobUrl = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      id: msgId,
      sender: 'local',
      senderId: peerId,
      content: `Sending file: ${file.name}`,
      timestamp: Date.now(),
      type: 'file',
      status: 'sending',
      file: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        blobUrl: blobUrl
      }
    }]);
  };

  const disconnect = () => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
      setStatus(ConnectionStatus.READY);
      setIsRemoteTyping(false);
      addLog('Manual disconnect initiated.', 'info');
    }
  };

  return (
    <TerminalLayout>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#33ff33]/50 pb-2 mb-2 lg:pb-4 lg:mb-4 select-none shrink-0 h-10 lg:h-16 relative z-30">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          {isSystemOn ? (
            <div className="w-2 h-2 lg:w-3 lg:h-3 bg-[#33ff33] shadow-[0_0_10px_#33ff33] animate-pulse shrink-0 rounded-full"></div>
          ) : (
             <div className="w-2 h-2 lg:w-3 lg:h-3 bg-red-500 shadow-[0_0_10px_red] shrink-0 rounded-full"></div>
          )}
          <h1 
            className="text-lg lg:text-3xl font-bold tracking-tighter font-['Share_Tech_Mono'] truncate glitch-text text-glow"
            data-text="#CHAT"
          >
            #CHAT
          </h1>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-4 text-[10px] md:text-xs lg:text-sm font-mono shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <ShieldCheck size={16} className={isSystemOn ? "text-[#33ff33] drop-shadow-[0_0_3px_#33ff33]" : "text-gray-600"} />
            <span className={isSystemOn ? "text-[#33ff33] text-glow" : "text-gray-600"}>AES-128</span>
          </div>
          
          <div className={`flex items-center gap-2 px-2 py-1 border transition-all duration-300 ${
             status === ConnectionStatus.CONNECTED ? 'border-[#33ff33] bg-[#33ff33]/10 shadow-[0_0_10px_rgba(51,255,51,0.2)]' : 
             status === ConnectionStatus.OFFLINE ? 'border-red-500 bg-red-900/10 text-red-500 shadow-[0_0_10px_rgba(255,0,0,0.2)]' :
             'border-[#1a801a]'
          }`}>
            {status === ConnectionStatus.CONNECTED ? <Wifi size={14} className="lg:w-4 lg:h-4" /> : <WifiOff size={14} className="lg:w-4 lg:h-4" />}
            <span className="hidden sm:inline font-bold tracking-wider">{status}</span>
          </div>

          <div className="flex gap-2">
             {/* Mobile Log Toggle (Hidden on Desktop) */}
            <button
              onClick={() => setShowMobileLogs(true)}
              className={`lg:hidden border p-1.5 transition-all active:scale-95 ${
                showMobileLogs
                  ? 'border-[#33ff33] text-[#33ff33] bg-[#33ff33]/20 shadow-[0_0_8px_#33ff33]'
                  : 'border-[#1a801a] text-[#1a801a]'
              }`}
              title="OPEN LOGS"
            >
              <ScrollText size={16} />
            </button>

            <button
              onClick={togglePower}
              className={`border p-1.5 lg:p-2 transition-all active:scale-95 ${
                isSystemOn 
                  ? 'border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33] hover:text-black shadow-[0_0_10px_rgba(51,255,51,0.3)]' 
                  : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]'
              }`}
              title={isSystemOn ? "SHUTDOWN SYSTEM" : "BOOT SYSTEM"}
            >
              <Power size={14} className="lg:w-[18px] lg:h-[18px]" />
            </button>
            
            <button
              onClick={toggleFullScreen}
              className="border border-[#33ff33] p-1.5 lg:p-2 text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-all active:scale-95 flex"
              title={isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
            >
              {isFullscreen ? <Minimize size={14} className="lg:w-[18px] lg:h-[18px]" /> : <Maximize size={14} className="lg:w-[18px] lg:h-[18px]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className={`flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-6 overflow-hidden transition-opacity duration-500 min-h-0 relative ${isSystemOn ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
        
        {/* Left Column (Desktop: 3 cols / 12) / Top Section (Mobile) */}
        <div className="lg:col-span-3 flex flex-col gap-3 lg:gap-6 shrink-0 lg:h-full lg:overflow-hidden z-10">
          <ConnectionManager 
            myPeerId={peerId} 
            connectToPeer={connectToPeer} 
            status={status}
            onDisconnect={disconnect}
            onIdentityChange={handleIdentityChange}
          />
          
          {/* Desktop Logs (Always Visible) */}
          <div className="hidden lg:flex flex-1 overflow-hidden border-glow">
             <LogPanel logs={logs} onClear={clearLogs} />
          </div>
        </div>

        {/* Mobile Logs Overlay (Full Screen Modal) */}
        {showMobileLogs && (
          <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col lg:hidden backdrop-blur-md animate-in slide-in-from-bottom-5 p-4 safe-area-inset-top">
             <div className="flex justify-between items-center mb-4 border-b border-[#33ff33] pb-3">
                <div className="flex items-center gap-2 text-[#33ff33]">
                   <ScrollText size={18} />
                   <span className="font-bold tracking-widest text-lg">SYSTEM LOGS</span>
                </div>
                <button 
                  onClick={() => setShowMobileLogs(false)} 
                  className="border border-red-500 text-red-500 p-2 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
             </div>
             <div className="flex-1 overflow-hidden border border-[#1a801a] relative">
                <LogPanel logs={logs} onClear={clearLogs} />
             </div>
          </div>
        )}

        {/* Right Column (Desktop: 9 cols / 12): Chat Interface */}
        <div className="flex-1 lg:col-span-9 flex flex-col min-h-0 border border-[#33ff33] bg-black/50 relative border-glow">
           {/* Decorative corner markers */}
           <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#33ff33]"></div>
           <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#33ff33]"></div>
           <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#33ff33]"></div>
           <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#33ff33]"></div>
           
           {!isSystemOn && (
             <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
                <div className="text-red-500 font-mono text-lg lg:text-xl animate-pulse border-2 border-red-500 p-6 bg-black shadow-[0_0_20px_rgba(255,0,0,0.4)] tracking-widest">
                   SYSTEM OFFLINE
                </div>
             </div>
           )}
           
           <ChatInterface 
             messages={messages} 
             onSendMessage={sendMessage}
             onEditMessage={handleEditMessage}
             onDeleteMessage={handleDeleteMessage}
             onSendFile={sendFile}
             onClearChat={clearChat}
             onTyping={handleTyping}
             isRemoteTyping={isRemoteTyping}
             disabled={status !== ConnectionStatus.CONNECTED}
           />
        </div>

      </div>
    </TerminalLayout>
  );
};

export default App;