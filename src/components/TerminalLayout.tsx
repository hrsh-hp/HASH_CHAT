import React from 'react';

interface TerminalLayoutProps {
  children: React.ReactNode;
}

export const TerminalLayout: React.FC<TerminalLayoutProps> = ({ children }) => {
  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen p-1 md:p-6 relative crt-flicker flex flex-col box-border overflow-hidden bg-[#050505]">
      <div className="max-w-[1800px] mx-auto w-full h-full flex-1 flex flex-col min-h-0">
        {children}
      </div>
      
      {/* Background Grid Pattern (Pure CSS) */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #33ff33 1px, transparent 1px),
            linear-gradient(to bottom, #33ff33 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
};