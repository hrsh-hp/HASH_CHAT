import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Cpu, Paperclip, File as FileIcon, Download, Upload, Loader2, CheckCheck, Trash2, Zap, Reply, X, Files } from 'lucide-react';
import type { Message, ReplyContext } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (msg: string, replyTo?: ReplyContext) => void;
  onSendFile: (files: File[]) => void;
  onClearChat: () => void;
  onTyping: (isTyping: boolean) => void;
  isRemoteTyping: boolean;
  disabled: boolean;
}

const QUICK_MACROS = [
  '[ACKNOWLEDGED]',
  '[NEGATIVE]',
  '[STANDBY]',
  '>> INITIATING',
  '>> COMPLETED',
  '( ͡° ͜ʖ ͡°)',
  '¯\\_(ツ)_/¯',
  '(o_O)',
  'ʕ•ᴥ•ʔ',
  '[?] QUERY'
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onSendFile,
  onClearChat,
  onTyping,
  isRemoteTyping,
  disabled
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const macrosRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dragCounter = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isRemoteTyping, replyingTo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (macrosRef.current && !macrosRef.current.contains(event.target as Node)) {
        setShowMacros(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group messages by groupId for file groups
  const groupedMessages = useMemo(() => {
    const result: { messages: Message[]; isGroup: boolean; groupId?: string }[] = [];
    const processedGroupIds = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.groupId && !processedGroupIds.has(msg.groupId)) {
        processedGroupIds.add(msg.groupId);
        const groupMsgs = messages.filter(m => m.groupId === msg.groupId);
        result.push({ messages: groupMsgs, isGroup: true, groupId: msg.groupId });
      } else if (!msg.groupId) {
        result.push({ messages: [msg], isGroup: false });
      }
    }
    return result;
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!disabled) {
      onTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  const handleMacroSelect = (macro: string) => {
    submitMessage(macro);
    setShowMacros(false);
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    setInputValue('');
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setInputValue('');
  };

  const submitMessage = (content: string) => {
    if (content.trim() && !disabled) {
      let replyContext: ReplyContext | undefined;
      if (replyingTo) {
        replyContext = {
          id: replyingTo.id,
          sender: replyingTo.sender,
          content: replyingTo.type === 'file' ? `[FILE] ${replyingTo.file?.name}` : replyingTo.content.substring(0, 50) + (replyingTo.content.length > 50 ? '...' : '')
        };
      }
      onSendMessage(content, replyContext);
      setInputValue('');
      setReplyingTo(null);
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(inputValue);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSendFile(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onSendFile(Array.from(e.dataTransfer.files));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic opacity-90">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-[#888888]/30 px-1 rounded text-white">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderFileItem = (msg: Message, isMe: boolean, compact: boolean = false) => (
    <div key={msg.id} className={`flex items-center gap-2 lg:gap-3 ${compact ? 'py-1' : 'py-1 lg:py-2'}`}>
      <div className={`p-1.5 ${compact ? '' : 'lg:p-2'} border border-current border-opacity-30 shrink-0`}>
        <FileIcon size={compact ? 16 : 20} className={compact ? '' : 'lg:w-6 lg:h-6'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`${compact ? 'text-xs' : 'text-xs lg:text-sm'} font-bold truncate`}>{msg.file!.name}</div>
        <div className="text-[10px] lg:text-xs opacity-70">{formatSize(msg.file!.size)}</div>
        {isMe && (
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            {msg.status === 'sending' ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                <span className="animate-pulse">TRANSMITTING...</span>
              </>
            ) : msg.status === 'delivered' ? (
              <>
                <CheckCheck size={10} />
                <span>TRANSMISSION COMPLETE</span>
              </>
            ) : (
              <span>SENT</span>
            )}
          </div>
        )}
      </div>
      {msg.file!.blobUrl && (
        <a
          href={msg.file!.blobUrl}
          download={msg.file!.name}
          className={`p-1.5 lg:p-2 border shrink-0 ${isMe ? 'border-white hover:bg-white hover:text-black' : 'border-[#f0f0f0] hover:bg-[#f0f0f0] hover:text-black'} transition-colors`}
          title="Download File"
        >
          <Download size={16} />
        </a>
      )}
    </div>
  );

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Background Decor */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
        <Cpu size={200} className="lg:w-[300px] lg:h-[300px]" strokeWidth={0.5} />
      </div>

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center border-2 border-dashed border-white m-2 lg:m-4 animate-pulse pointer-events-none backdrop-blur-sm">
          <Upload size={48} className="text-white mb-4 lg:w-16 lg:h-16" />
          <h2 className="text-xl lg:text-2xl font-bold text-white tracking-widest text-center">INITIATE UPLOAD</h2>
          <p className="text-[#888888] mt-2 font-mono text-sm lg:text-base">RELEASE FILES TO TRANSMIT</p>
        </div>
      )}

      {/* Top Bar for Actions */}
      <div className="absolute top-2 right-2 z-10">
        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="p-1.5 bg-black/50 border border-[#888888] text-[#888888] hover:text-red-500 hover:border-red-500 transition-all rounded-sm backdrop-blur-md"
            title="Clear Chat History"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4 custom-scrollbar scroll-smooth">
        {messages.length === 0 && (
          <div className="text-[#888888] text-center mt-12 lg:mt-20 font-mono text-xs lg:text-sm animate-pulse px-4">
            AWAITING DATA PACKETS...
          </div>
        )}

        {groupedMessages.map((group) => {
          const firstMsg = group.messages[0];
          const isMe = firstMsg.sender === 'local';
          const isSystem = firstMsg.sender === 'system';

          if (isSystem) {
            return (
              <div key={firstMsg.id} className="flex justify-center my-2 opacity-80">
                <span className="text-[10px] lg:text-xs text-[#888888] border-y border-[#888888] px-2 py-1 bg-black/50 text-center font-bold tracking-wider">
                  SYSTEM // {firstMsg.content.toUpperCase()}
                </span>
              </div>
            );
          }

          // Grouped file messages
          if (group.isGroup && group.messages.length > 1) {
            const sourceLabel = isMe
              ? '>> LOCAL'
              : `<< ${firstMsg.senderId ? `REMOTE [${firstMsg.senderId}]` : 'REMOTE'}`;

            return (
              <div key={group.groupId} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`
                  max-w-[85%] lg:max-w-[70%] 
                  border p-2 lg:p-3 relative group
                  ${isMe
                    ? 'border-white bg-white/5 text-white'
                    : 'border-[#888888] bg-black text-[#f0f0f0]'
                  }
                `}>
                  {/* Group Header */}
                  <div className="flex justify-between items-center mb-2 gap-4 border-b border-dashed border-opacity-30 border-current pb-1 select-none">
                    <div className="flex items-center gap-1.5">
                      <Files size={12} />
                      <span className="text-[9px] lg:text-[10px] font-bold tracking-widest uppercase">
                        {sourceLabel} · {group.messages.length} FILES
                      </span>
                    </div>
                    <span className="text-[9px] lg:text-[10px] opacity-70 shrink-0">
                      {new Date(firstMsg.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* File Items */}
                  <div className="space-y-1">
                    {group.messages.map(msg => msg.file ? renderFileItem(msg, isMe, true) : null)}
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    <button
                      onClick={() => handleReply(firstMsg)}
                      className="p-1 text-white bg-black border border-[#888888] hover:bg-[#888888]/40 rounded shadow-md"
                      title="Reply"
                    >
                      <Reply size={12} />
                    </button>
                  </div>

                  {/* Corner Accent */}
                  <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-r border-b ${isMe ? 'border-white' : 'border-[#888888]'} bg-black`}></div>
                </div>
              </div>
            );
          }

          // Single message
          const msg = firstMsg;
          const sourceLabel = isMe
            ? '>> LOCAL'
            : `<< ${msg.senderId ? `REMOTE [${msg.senderId}]` : 'REMOTE'}`;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`
                max-w-[85%] lg:max-w-[70%] 
                border p-2 lg:p-3 relative group
                ${isMe
                  ? 'border-white bg-white/5 text-white'
                  : 'border-[#888888] bg-black text-[#f0f0f0]'
                }
              `}>
                {msg.isDeleted ? (
                  <div className="italic text-[#888888] text-xs">
                    [DATA PACKET PURGED]
                  </div>
                ) : (
                  <>
                    {msg.replyTo && (
                      <div className={`mb-2 p-1.5 text-xs border-l-2 ${isMe ? 'border-white/50 bg-white/10' : 'border-[#888888] bg-[#888888]/20'} font-mono opacity-80`}>
                        <div className="font-bold text-[10px] mb-0.5">
                          RE: {msg.replyTo.sender === 'local' ? 'LOCAL' : 'REMOTE'}
                        </div>
                        <div className="truncate italic opacity-70">
                          {msg.replyTo.content}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-1 gap-4 border-b border-dashed border-opacity-30 border-current pb-1 select-none">
                      <span className="text-[9px] lg:text-[10px] font-bold tracking-widest uppercase truncate max-w-[120px] lg:max-w-none">
                        {sourceLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        {msg.isEdited && <span className="text-[8px] opacity-60 italic">(edited)</span>}
                        <span className="text-[9px] lg:text-[10px] opacity-70 shrink-0">
                          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {msg.type === 'file' && msg.file ? (
                      renderFileItem(msg, isMe)
                    ) : (
                      <p className="font-mono text-xs lg:text-sm whitespace-pre-wrap leading-relaxed break-words">
                        {renderMarkdown(msg.content)}
                      </p>
                    )}

                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <button
                        onClick={() => handleReply(msg)}
                        className="p-1 text-white bg-black border border-[#888888] hover:bg-[#888888]/40 rounded shadow-md"
                        title="Reply"
                      >
                        <Reply size={12} />
                      </button>
                    </div>

                    <div className="lg:hidden absolute top-2 right-2 opacity-70 flex gap-2 z-10">
                      <button
                        onClick={() => handleReply(msg)}
                        className="p-1 bg-black/80 border border-[#888888] text-white rounded"
                      >
                        <Reply size={12} />
                      </button>
                    </div>
                  </>
                )}

                <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-r border-b ${isMe ? 'border-white' : 'border-[#888888]'} bg-black`}></div>
              </div>
            </div>
          );
        })}

        {isRemoteTyping && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="border border-[#888888] bg-black p-2 text-[#888888] text-xs font-mono flex items-center gap-2">
              <span className="animate-pulse">REMOTE IS TYPING</span>
              <div className="flex gap-0.5">
                <div className="w-1 h-1 bg-[#888888] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-[#888888] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-[#888888] animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="bg-[#888888]/20 border-t border-x border-white p-2 flex justify-between items-center animate-in slide-in-from-bottom-2 mx-2 -mb-px relative z-30 backdrop-blur-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Reply size={14} className="text-white shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-white font-bold">
                REPLYING TO {replyingTo.sender === 'local' ? 'LOCAL' : 'REMOTE'}
              </span>
              <span className="text-xs text-white/70 truncate font-mono">
                {replyingTo.type === 'file' ? `[FILE] ${replyingTo.file?.name}` : replyingTo.content}
              </span>
            </div>
          </div>
          <button onClick={cancelReply} className="text-white hover:text-red-400 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-2 lg:p-4 bg-black border-t border-white shrink-0 relative z-20">

        {showMacros && (
          <div ref={macrosRef} className="absolute bottom-full left-0 mb-2 ml-2 bg-black border border-white shadow-[0_0_20px_rgba(255,255,255,0.1)] p-2 grid grid-cols-2 gap-2 w-64 animate-in slide-in-from-bottom-5">
            <div className="col-span-2 text-xs text-[#888888] uppercase font-bold border-b border-[#888888] pb-1 mb-1">
              Quick Protocol
            </div>
            {QUICK_MACROS.map((macro, idx) => (
              <button
                key={idx}
                onClick={() => handleMacroSelect(macro)}
                className="text-xs text-white hover:bg-white hover:text-black p-1.5 text-left truncate font-mono border border-[#888888] hover:border-white transition-colors"
              >
                {macro}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-2 text-white hover:text-gray-300 disabled:opacity-30 transition-colors border border-transparent hover:border-white rounded-sm"
            title="Attach Files"
          >
            <Paperclip size={18} className="lg:w-5 lg:h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowMacros(!showMacros)}
            disabled={disabled}
            className={`p-2 text-white hover:text-gray-300 disabled:opacity-30 transition-colors border rounded-sm ${showMacros ? 'border-white bg-white/20' : 'border-transparent hover:border-white'}`}
            title="Quick Macros"
          >
            <Zap size={18} className="lg:w-5 lg:h-5" />
          </button>

          <span className="text-white font-bold animate-pulse hidden sm:inline">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder={disabled ? "CONNECTION REQUIRED" : "ENTER DATA... (*bold* _italic_)"}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder-[#888888] text-sm lg:text-base min-w-0"
            autoFocus
          />
          <button
            type="submit"
            disabled={disabled || !inputValue.trim()}
            className="p-2 text-white hover:text-gray-300 disabled:opacity-30 disabled:hover:text-white transition-colors border border-transparent hover:border-white rounded-sm"
          >
            <Send size={18} className="lg:w-5 lg:h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};