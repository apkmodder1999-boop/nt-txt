import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Video,
  FileText,
  Clock,
  Download,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { ExtractedFolderNode, ExtractedFileItem } from '../types';

interface ContentTreeViewerProps {
  rootFolders: ExtractedFolderNode[];
}

export const ContentTreeViewer: React.FC<ContentTreeViewerProps> = ({ rootFolders }) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Interactive Content Explorer</h3>
        <input
          type="text"
          placeholder="Filter tree items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-48"
        />
      </div>

      <div className="space-y-2">
        {rootFolders.map((node) => (
          <TreeNode key={node.id} node={node} search={searchTerm} defaultOpen={true} />
        ))}
      </div>
    </div>
  );
};

interface TreeNodeProps {
  node: ExtractedFolderNode;
  search: string;
  defaultOpen?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, search, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const hasMatchingFiles = search
    ? node.files.some((f) => f.title.toLowerCase().includes(search.toLowerCase()))
    : true;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-slate-900/60 hover:bg-slate-850 text-left transition"
      >
        <div className="flex items-center space-x-2 min-w-0">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span className="font-semibold text-slate-200 truncate">{node.title}</span>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            (id: {node.id}) • {node.files.length} files
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="p-2 space-y-2 pl-4 sm:pl-6 border-t border-slate-800/50">
          {/* Subfolders */}
          {node.folders.map((sub) => (
            <TreeNode key={sub.id} node={sub} search={search} />
          ))}

          {/* Files */}
          {node.files
            .filter((f) => !search || f.title.toLowerCase().includes(search.toLowerCase()))
            .map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
        </div>
      )}
    </div>
  );
};

const FileRow: React.FC<{ file: ExtractedFileItem }> = ({ file }) => {
  const [copied, setCopied] = useState(false);

  const isVideo = file.type === 'video';
  const targetLink = isVideo
    ? file.streamUrl
    : file.pdfUrl || file.streamUrl;

  const handleCopyLink = () => {
    if (targetLink) {
      navigator.clipboard.writeText(targetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg space-y-2 hover:border-slate-700 transition">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div className="flex items-center space-x-2 min-w-0">
          {file.type === 'video' ? (
            <div className="w-6 h-6 rounded bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
              <Video className="w-3.5 h-3.5" />
            </div>
          ) : file.type === 'notes' || file.type === 'dpp' || file.type === 'pdf' ? (
            <div className="w-6 h-6 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          )}

          <span className="font-medium text-slate-200 truncate">{file.title}</span>
          <span className="text-[10px] text-slate-500 font-mono shrink-0">
            (id: {file.id})
          </span>

          {file.duration && file.duration !== 'N/A' && (
            <span className="text-[10px] text-slate-400 flex items-center space-x-1 shrink-0 bg-slate-850 px-1.5 py-0.5 rounded font-mono">
              <Clock className="w-3 h-3" />
              <span>{file.duration}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          {isVideo && file.streamUrl && (
            <span className="px-2 py-0.5 text-[10px] rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
              m3u8 Stream
            </span>
          )}

          {targetLink && (
            <button
              onClick={handleCopyLink}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title={isVideo ? 'Copy Stream URL' : 'Copy Document Link'}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {targetLink && (
            <a
              href={targetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title={isVideo ? 'Open Stream URL' : 'Open Document Link'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
