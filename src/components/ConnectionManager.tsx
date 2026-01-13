import React, { useState, useEffect } from 'react';
import { Share2, Edit2, Check, X, ChevronDown, ChevronUp, Network, Link, Unplug } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface ConnectionManagerProps {
  myPeerId: string;
  connectToPeer: (id: string) => void;
  status: ConnectionStatus;
  onDisconnect: () => void;
  onIdentityChange?: (newId: string) => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ 
  myPeerId, 
  connectToPeer, 
  status,
  onDisconnect,
  onIdentityChange
}) => {
  const [targetId, setTargetId] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Auto-collapse on connection
  useEffect(() => {
    if (status === ConnectionStatus.CONNECTED) {
      setIsExpanded(false);
    }
  }, [status]);

  // Sync edit value when myPeerId changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(myPeerId);
    }
  }, [myPeerId, isEditing]);

  const handleCopy = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('connect', myPeerId);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetId.trim()) {
      connectToPeer(targetId.trim());
    }
  };

  const saveIdentity = () => {
    if (editValue.trim() && editValue !== myPeerId && onIdentityChange) {
      onIdentityChange(editValue.trim());
      setIsEditing(false);
    } else {
      setIsEditing(false);
      setEditValue(myPeerId);
    }
  };

  // Compact Header View
  const Header = () => (
    <div 
      className="flex items-center justify-between cursor-pointer select-none"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2 text-[#33ff33]">
        <Network size={16} />
        <span className="text-xs md:text-sm font-bold tracking-widest uppercase">
          {status === ConnectionStatus.CONNECTED ? `LINKED: ${targetId || 'REMOTE'}` : 'CONNECTION MANAGER'}
        </span>
      </div>
      <button className="text-[#1a801a] hover:text-[#33ff33]">
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );

  return (
    <div className={`
      border border-[#33ff33] bg-black transition-all duration-300 relative shadow-[0_0_10px_rgba(51,255,51,0.1)]
      ${isExpanded ? 'p-2 md:p-3' : 'p-2'}
      flex flex-col gap-2
    `}>
      <Header />

      {/* Expandable Content - Side by Side Layout */}
      <div className={`
        overflow-hidden transition-all duration-300
        ${isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="grid grid-cols-2 gap-2">
          
          {/* Left: Local ID */}
          <div className="flex flex-col gap-1 min-w-0">
             <div className="flex justify-between items-center text-[9px] uppercase text-[#1a801a] font-bold">
               <span>MY ID</span>
               {copied && <span className="text-[#33ff33] animate-pulse">COPIED</span>}
             </div>
             
             {isEditing ? (
               <div className="flex items-center gap-1 h-8">
                  <input 
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 min-w-0 bg-[#0a0a0a] border border-[#33ff33] px-1 h-full font-mono text-sm text-[#33ff33] outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveIdentity()}
                  />
                  <button onClick={saveIdentity} className="h-full px-1 border border-[#33ff33] hover:bg-[#33ff33] hover:text-black">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setIsEditing(false)} className="h-full px-1 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black">
                    <X size={12} />
                  </button>
               </div>
             ) : (
               <div className="flex items-center gap-1 h-8">
                  <div 
                    className="flex-1 min-w-0 h-full bg-[#0a0a0a] border border-[#1a801a] px-2 flex items-center justify-between group cursor-pointer hover:border-[#33ff33]"
                    onClick={() => { if(status !== ConnectionStatus.CONNECTED && onIdentityChange) setIsEditing(true); }}
                  >
                    <span className="font-mono text-sm text-[#33ff33] truncate">{myPeerId}</span>
                    {status !== ConnectionStatus.CONNECTED && <Edit2 size={10} className="text-[#1a801a] group-hover:text-[#33ff33]" />}
                  </div>
                  <button onClick={handleCopy} className="h-full px-2 border border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33] hover:text-black" title="Share Link">
                    <Share2 size={14} />
                  </button>
               </div>
             )}
          </div>

          {/* Right: Remote ID */}
          <div className="flex flex-col gap-1 min-w-0">
             <span className="text-[9px] uppercase text-[#1a801a] font-bold truncate">REMOTE ID</span>
             <form onSubmit={handleConnect} className="flex items-center gap-1 h-8">
                <input
                  type="text"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="ID..."
                  className="flex-1 min-w-0 bg-[#0a0a0a] border border-[#1a801a] h-full px-2 font-mono text-sm text-[#33ff33] placeholder-[#1a801a] focus:border-[#33ff33] outline-none"
                  disabled={status === ConnectionStatus.CONNECTED}
                />
                {status === ConnectionStatus.CONNECTED ? (
                  <button 
                    type="button"
                    onClick={onDisconnect}
                    className="h-full px-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                    title="Disconnect"
                  >
                    <Unplug size={14} />
                  </button>
                ) : (
                  <button 
                    type="submit"
                    disabled={!targetId || status === ConnectionStatus.CONNECTING}
                    className="h-full px-2 border border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33] hover:text-black disabled:opacity-30"
                    title="Connect"
                  >
                    <Link size={14} />
                  </button>
                )}
             </form>
          </div>

        </div>
      </div>
    </div>
  );
};