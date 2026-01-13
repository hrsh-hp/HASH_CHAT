import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';
import { Trash2, Save, Terminal } from 'lucide-react';

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleDownload = () => {
    const text = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netrunner_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 border border-[#1a801a] bg-black flex flex-col relative overflow-hidden h-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
       {/* Header */}
       <div className="flex items-center justify-between bg-[#1a801a]/10 border-b border-[#1a801a] px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 text-[#1a801a]">
            <Terminal size={14} />
            <span className="text-xs font-bold uppercase tracking-widest">System Log</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownload}
              className="text-[#1a801a] hover:text-[#33ff33] transition-colors"
              title="Export Logs"
            >
              <Save size={14} />
            </button>
            <button 
              onClick={onClear}
              className="text-[#1a801a] hover:text-red-500 transition-colors"
              title="Clear Logs"
            >
              <Trash2 size={14} />
            </button>
          </div>
       </div>

      {/* Log Content - min-h-0 is crucial for flex child scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-xs space-y-1 custom-scrollbar">
        {logs.length === 0 && (
          <div className="text-[#1a801a]/50 italic text-center mt-10">
            -- NO SYSTEM EVENTS --
          </div>
        )}
        
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 group hover:bg-[#1a801a]/10 px-1 -mx-1 rounded">
            <span className="text-[#1a801a] whitespace-nowrap opacity-60 font-thin shrink-0 select-none">
              {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`
              break-words leading-relaxed
              ${log.type === 'error' ? 'text-red-500 text-glow' : ''}
              ${log.type === 'warning' ? 'text-yellow-500' : ''}
              ${log.type === 'success' ? 'text-[#33ff33]' : ''}
              ${log.type === 'info' ? 'text-[#33ff33]/80' : ''}
            `}>
              {log.type === 'info' && <span className="opacity-50 mr-1">{'>'}</span>}
              {log.type === 'error' && <span className="mr-1">!!</span>}
              {log.message}
            </span>
          </div>
        ))}
        {/* Blinking Cursor at the end of logs */}
        <div className="flex items-center text-[#33ff33] mt-2 opacity-80">
            <span className="mr-1">{'>'}</span>
            <span className="w-2 h-4 bg-[#33ff33] animate-pulse"></span>
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
};