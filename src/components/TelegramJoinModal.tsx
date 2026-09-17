import React, { useEffect, useState } from 'react';
import { Send, X, ExternalLink, Sparkles, Check } from 'lucide-react';

interface TelegramJoinModalProps {
  channelUrl?: string;
  channelName?: string;
  developerUrl?: string;
}

export const TelegramJoinModal: React.FC<TelegramJoinModalProps> = ({
  channelUrl = 'https://t.me/learn_topper',
  channelName = 't.me/learn_topper',
  developerUrl = 'https://t.me/devnaitikanonymous',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Check if user previously dismissed or joined
    const dismissedAt = localStorage.getItem('tg_join_modal_dismissed_at');
    if (!dismissedAt) {
      // Trigger modal automatically after a short friendly delay (1.2s)
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Remember dismissal for this session / 24 hours so it isn't obnoxious
    localStorage.setItem('tg_join_modal_dismissed_at', Date.now().toString());
  };

  const handleJoin = () => {
    window.open(channelUrl, '_blank', 'noopener,noreferrer');
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="telegram-join-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-modal-title"
    >
      <div className="relative w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          id="tg-modal-close-btn"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          aria-label="Close popup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Telegram badge & icon */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 border border-sky-500/20 shadow-xs">
            <Send className="w-6 h-6 -translate-y-0.5 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>OFFICIAL COMMUNITY</span>
            </div>
            <h3 id="tg-modal-title" className="text-lg sm:text-xl font-bold text-foreground">
              Join Our Telegram Channel
            </h3>
          </div>
        </div>

        {/* Body content */}
        <div className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
          <p>
            Stay updated with the latest batch links, direct TXT updates, extractor improvements, and fast bot tools at:
          </p>
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold text-sm hover:bg-sky-500/15 transition w-full justify-between"
          >
            <span className="flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span>{channelName}</span>
            </span>
            <ExternalLink className="w-4 h-4 opacity-70" />
          </a>

          <div className="pt-2 text-xs border-t border-border flex items-center justify-between text-muted-foreground/80">
            <span>
              Built by{' '}
              <a
                href={developerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline inline-flex items-center space-x-1"
              >
                <span>t.me/devnaitikanonymous</span>
              </a>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            id="tg-join-channel-btn"
            onClick={handleJoin}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-[0.99] text-white font-semibold text-sm transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>Join @learn_topper</span>
          </button>
          <button
            id="tg-dismiss-btn"
            onClick={handleClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-sm font-medium transition cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
