import React, { useState, useRef, useEffect } from 'react';
import { Send, Cpu, Paperclip, File as FileIcon, Download, Upload, Loader2, CheckCheck, Trash2, Zap, Reply, X } from 'lucide-react';
import type { Message, ReplyContext } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (msg: string, replyTo?: ReplyContext) => void;
  onSendFile: (file: File) => void;
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
  
  // Ref to track drag entry/exit depth
  const dragCounter = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isRemoteTyping, replyingTo]);

  // Click outside to close macro menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (macrosRef.current && !macrosRef.current.contains(event.target as Node)) {
        setShowMacros(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    // Handle typing indicator
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
    if (e.target.files && e.target.files[0]) {
      onSendFile(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Improved Drag and Drop Handlers
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
      const file = e.dataTransfer.files[0];
      onSendFile(file);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Basic Markdown Parser
  const renderMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-[#33ff33] font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic opacity-90">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-[#1a801a]/30 px-1 rounded text-[#33ff33]">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

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
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center border-2 border-dashed border-[#33ff33] m-2 lg:m-4 animate-pulse pointer-events-none backdrop-blur-sm">
          <Upload size={48} className="text-[#33ff33] mb-4 lg:w-16 lg:h-16" />
          <h2 className="text-xl lg:text-2xl font-bold text-[#33ff33] tracking-widest text-center">INITIATE UPLOAD</h2>
          <p className="text-[#1a801a] mt-2 font-mono text-sm lg:text-base">RELEASE FILE TO TRANSMIT</p>
        </div>
      )}

      {/* Top Bar for Actions */}
      <div className="absolute top-2 right-2 z-10">
         {messages.length > 0 && (
           <button 
             onClick={onClearChat}
             className="p-1.5 bg-black/50 border border-[#1a801a] text-[#1a801a] hover:text-red-500 hover:border-red-500 transition-all rounded-sm backdrop-blur-md"
             title="Clear Chat History"
           >
             <Trash2 size={14} />
           </button>
         )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4 custom-scrollbar scroll-smooth">
        {messages.length === 0 && (
          <div className="text-[#1a801a] text-center mt-12 lg:mt-20 font-mono text-xs lg:text-sm animate-pulse px-4">
            AWAITING DATA PACKETS...
          </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.sender === 'local';
          const isSystem = msg.sender === 'system';

          if (isSystem) {
             return (
                 <div key={msg.id} className="flex justify-center my-2 opacity-80">
                     <span className="text-[10px] lg:text-xs text-[#1a801a] border-y border-[#1a801a] px-2 py-1 bg-black/50 text-center font-bold tracking-wider">
                         SYSTEM // {msg.content.toUpperCase()}
                     </span>
                 </div>
             )
          }

          const sourceLabel = isMe 
            ? '>> LOCAL' 
            : `<< ${msg.senderId ? `REMOTE [${msg.senderId}]` : 'REMOTE'}`;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`
                max-w-[85%] lg:max-w-[70%] 
                border p-2 lg:p-3 relative group
                ${isMe 
                  ? 'border-[#33ff33] bg-[#33ff33]/5 text-[#33ff33]' 
                  : 'border-[#1a801a] bg-black text-[#f0f0f0]'
                }
              `}>
                {/* Deleted Overlay */}
                {msg.isDeleted ? (
                  <div className="italic text-[#1a801a] text-xs">
                    [DATA PACKET PURGED]
                  </div>
                ) : (
                  <>
                    {/* Reply Indicator in Message */}
                    {msg.replyTo && (
                      <div className={`mb-2 p-1.5 text-xs border-l-2 ${isMe ? 'border-[#33ff33]/50 bg-[#33ff33]/10' : 'border-[#1a801a] bg-[#1a801a]/20'} font-mono opacity-80`}>
                        <div className="font-bold text-[10px] mb-0.5">
                          RE: {msg.replyTo.sender === 'local' ? 'LOCAL' : 'REMOTE'}
                        </div>
                        <div className="truncate italic opacity-70">
                          {msg.replyTo.content}
                        </div>
                      </div>
                    )}

                    {/* Message Header */}
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
                    
                    {/* Content */}
                    {msg.type === 'file' && msg.file ? (
                      <div className="flex items-center gap-2 lg:gap-3 py-1 lg:py-2">
                        <div className="p-1.5 lg:p-2 border border-current border-opacity-30 shrink-0">
                          <FileIcon size={20} className="lg:w-6 lg:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs lg:text-sm font-bold truncate">{msg.file.name}</div>
                          <div className="text-[10px] lg:text-xs opacity-70">{formatSize(msg.file.size)}</div>
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
                        
                        {msg.file.blobUrl && (
                          <a 
                            href={msg.file.blobUrl} 
                            download={msg.file.name}
                            className={`p-1.5 lg:p-2 border shrink-0 ${isMe ? 'border-[#33ff33] hover:bg-[#33ff33] hover:text-black' : 'border-[#f0f0f0] hover:bg-[#f0f0f0] hover:text-black'} transition-colors`}
                            title="Download File"
                          >
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="font-mono text-xs lg:text-sm whitespace-pre-wrap leading-relaxed break-words">
                        {renderMarkdown(msg.content)}
                      </p>
                    )}

                    {/* Action Buttons (Desktop Hover) */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <button 
                        onClick={() => handleReply(msg)}
                        className="p-1 text-[#33ff33] bg-black border border-[#1a801a] hover:bg-[#1a801a]/40 rounded shadow-md"
                        title="Reply"
                      >
                        <Reply size={12} />
                      </button>
                    </div>

                    {/* Mobile Actions Overlay */}
                    <div className="lg:hidden absolute top-2 right-2 opacity-70 flex gap-2 z-10">
                       <button 
                         onClick={() => handleReply(msg)}
                         className="p-1 bg-black/80 border border-[#1a801a] text-[#33ff33] rounded"
                       >
                         <Reply size={12} />
                       </button>
                    </div>
                  </>
                )}

                {/* Corner Accents */}
                <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-r border-b ${isMe ? 'border-[#33ff33]' : 'border-[#1a801a]'} bg-black`}></div>
              </div>
            </div>
          );
        })}

        {/* Remote Typing Indicator */}
        {isRemoteTyping && (
          <div className="flex justify-start animate-in fade-in duration-300">
             <div className="border border-[#1a801a] bg-black p-2 text-[#1a801a] text-xs font-mono flex items-center gap-2">
                <span className="animate-pulse">REMOTE IS TYPING</span>
                <div className="flex gap-0.5">
                   <div className="w-1 h-1 bg-[#1a801a] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-1 h-1 bg-[#1a801a] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-1 h-1 bg-[#1a801a] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="bg-[#1a801a]/20 border-t border-x border-[#33ff33] p-2 flex justify-between items-center animate-in slide-in-from-bottom-2 mx-2 -mb-px relative z-30 backdrop-blur-sm">
           <div className="flex items-center gap-2 overflow-hidden">
              <Reply size={14} className="text-[#33ff33] shrink-0" />
              <div className="flex flex-col min-w-0">
                 <span className="text-[10px] text-[#33ff33] font-bold">
                    REPLYING TO {replyingTo.sender === 'local' ? 'LOCAL' : 'REMOTE'}
                 </span>
                 <span className="text-xs text-[#33ff33]/70 truncate font-mono">
                   {replyingTo.type === 'file' ? `[FILE] ${replyingTo.file?.name}` : replyingTo.content}
                 </span>
              </div>
           </div>
           <button onClick={cancelReply} className="text-[#33ff33] hover:text-white p-1">
             <X size={16} />
           </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-2 lg:p-4 bg-black border-t border-[#33ff33] shrink-0 relative z-20">
        
        {/* Macro Menu */}
        {showMacros && (
          <div ref={macrosRef} className="absolute bottom-full left-0 mb-2 ml-2 bg-black border border-[#33ff33] shadow-[0_0_20px_rgba(51,255,51,0.2)] p-2 grid grid-cols-2 gap-2 w-64 animate-in slide-in-from-bottom-5">
            <div className="col-span-2 text-xs text-[#1a801a] uppercase font-bold border-b border-[#1a801a] pb-1 mb-1">
              Quick Protocol
            </div>
            {QUICK_MACROS.map((macro, idx) => (
              <button
                key={idx}
                onClick={() => handleMacroSelect(macro)}
                className="text-xs text-[#33ff33] hover:bg-[#33ff33] hover:text-black p-1.5 text-left truncate font-mono border border-[#1a801a] hover:border-[#33ff33] transition-colors"
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
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-2 text-[#33ff33] hover:text-white disabled:opacity-30 transition-colors border border-transparent hover:border-[#33ff33] rounded-sm"
            title="Attach File"
          >
            <Paperclip size={18} className="lg:w-5 lg:h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowMacros(!showMacros)}
            disabled={disabled}
            className={`p-2 text-[#33ff33] hover:text-white disabled:opacity-30 transition-colors border rounded-sm ${showMacros ? 'border-[#33ff33] bg-[#33ff33]/20' : 'border-transparent hover:border-[#33ff33]'}`}
            title="Quick Macros"
          >
            <Zap size={18} className="lg:w-5 lg:h-5" />
          </button>

          <span className="text-[#33ff33] font-bold animate-pulse hidden sm:inline">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder={disabled ? "CONNECTION REQUIRED" : "ENTER DATA... (*bold* _italic_)"}
            className="flex-1 bg-transparent border-none outline-none text-[#33ff33] font-mono placeholder-[#1a801a] text-sm lg:text-base min-w-0"
            autoFocus
          />
          <button
            type="submit"
            disabled={disabled || !inputValue.trim()}
            className="p-2 text-[#33ff33] hover:text-white disabled:opacity-30 disabled:hover:text-[#33ff33] transition-colors border border-transparent hover:border-[#33ff33] rounded-sm"
          >
            <Send size={18} className="lg:w-5 lg:h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};