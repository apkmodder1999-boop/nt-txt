import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  FolderTree,
  ListOrdered,
  Radio,
  FileCode,
  Search,
  BookOpen,
  Film,
  FileCheck2,
  Clock,
  Layers,
  Sparkles,
  Bot,
  SlidersHorizontal,
} from 'lucide-react';
import { ExtractionResult } from '../types';
import { ContentTreeViewer } from './ContentTreeViewer';

interface ResultViewerProps {
  result: ExtractionResult;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ result }) => {
  const [activeTab, setActiveTab] = useState<
    'bot-format' | 'direct-links' | 'full-report' | 'raw-urls' | 'tree' | 'm3u' | 'json'
  >('bot-format');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Bot Format customization state
  const [includeCategoryTag, setIncludeCategoryTag] = useState<boolean>(true);
  const [includeFolderInTitle, setIncludeFolderInTitle] = useState<boolean>(false);
  const [includeDuration, setIncludeDuration] = useState<boolean>(true);
  const [includeId, setIncludeId] = useState<boolean>(true);
  const [botFilterType, setBotFilterType] = useState<'all' | 'video' | 'notes' | 'dpp'>('all');

  const courseTitle = result.courseDetails?.title || `Course_${result.courseId}`;
  const safeCourseName = courseTitle
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();

  const handleDownload = (filename: string, content: string, mimeType = 'text/plain;charset=utf-8') => {
    // Prepending UTF-8 BOM (\uFEFF) ensures Windows Notepad & text editors properly render Hindi/Sanskrit Devanagari text and icons
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTab(tabName);
      setTimeout(() => setCopiedTab(null), 2000);
    });
  };

  // Dynamically generate the Bot-ready TXT matching [CATEGORY] Title: link
  const generateBotText = (): string => {
    let lines: string[] = [];
    const files = result.allFiles.filter((f) => {
      if (botFilterType === 'all') return true;
      if (botFilterType === 'video') return f.type === 'video';
      if (botFilterType === 'notes') return f.type === 'notes';
      if (botFilterType === 'dpp') return f.type === 'dpp';
      return true;
    });

    files.forEach((file) => {
      const isVideo = file.type === 'video';
      const targetUrl = isVideo ? file.streamUrl : (file.pdfUrl || file.streamUrl);
      if (!targetUrl) return;

      let cat = 'FILE';
      if (file.type === 'video') cat = 'VIDEO';
      else if (file.type === 'notes' || file.type === 'dpp') cat = 'PDF';
      else if (file.type === 'test') cat = 'TEST';

      let title = file.title;
      if (file.type === 'dpp' && !title.toLowerCase().startsWith('dpp')) {
        title = `DPP - ${title}`;
      }

      if (includeFolderInTitle && file.path) {
        title = `${file.path} - ${title}`;
      }

      const idStr = includeId && file.id ? ` (id: ${file.id})` : '';
      const durStr =
        includeDuration && file.duration && file.duration !== 'N/A'
          ? ` (${file.duration})`
          : '';

      const prefix = includeCategoryTag ? `[${cat}] ` : '';
      lines.push(`${prefix}${title}${idStr}${durStr}: ${targetUrl}`);
    });

    return lines.join('\n');
  };

  const botGeneratedText = generateBotText();

  const getCurrentText = (): string => {
    switch (activeTab) {
      case 'bot-format':
        return botGeneratedText;
      case 'direct-links':
        return result.directLinksTxt || '';
      case 'full-report':
        return result.txtReport || '';
      case 'raw-urls':
        return result.rawUrlsTxt || '';
      case 'm3u':
        return result.m3uPlaylist || '';
      case 'json':
        return JSON.stringify(result, null, 2);
      default:
        return '';
    }
  };

  const currentText = getCurrentText();
  const filteredLines = searchQuery
    ? currentText
        .split('\n')
        .filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
        .join('\n')
    : currentText;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs space-y-0 text-foreground">
      {/* Header Info Banner */}
      <div className="p-5 sm:p-6 border-b border-border bg-muted/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>EXTRACTION COMPLETED</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-mono">Course #{result.courseId}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {courseTitle}
            </h2>
            {result.courseDetails?.offer_price && (
              <p className="text-xs text-muted-foreground mt-1">
                Batch Price: ₹{result.courseDetails.offer_price}{' '}
                {result.courseDetails.mrp && (
                  <span className="line-through text-muted-foreground/60">₹{result.courseDetails.mrp}</span>
                )}
              </p>
            )}
          </div>

          {/* Quick Action Downloads */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                handleDownload(
                  `${safeCourseName}_bot_format.txt`,
                  botGeneratedText
                )
              }
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Bot className="w-4 h-4" />
              <span>Download Bot-Ready TXT</span>
            </button>

            <button
              onClick={() =>
                handleDownload(
                  `${safeCourseName}_stream_links.txt`,
                  result.directLinksTxt || ''
                )
              }
              className="px-3.5 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Stream Links TXT</span>
            </button>

            <button
              onClick={() =>
                handleDownload(
                  `${safeCourseName}_full_report.txt`,
                  result.txtReport || ''
                )
              }
              className="px-3.5 py-2 rounded-lg border border-input bg-background hover:bg-accent text-foreground text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Full Report</span>
            </button>
          </div>
        </div>

        {/* Highlight Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-5">
          <div className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-1">
              <Film className="w-3.5 h-3.5 text-blue-500" />
              <span>Classes / Videos</span>
            </div>
            <span className="text-xl font-bold text-foreground">{result.stats.totalVideos}</span>
          </div>

          <div className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-1">
              <BookOpen className="w-3.5 h-3.5 text-sky-500" />
              <span>Class Notes (PDF)</span>
            </div>
            <span className="text-xl font-bold text-foreground">{result.stats.totalNotes}</span>
          </div>

          <div className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-1">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>DPPs & Sheets</span>
            </div>
            <span className="text-xl font-bold text-foreground">{result.stats.totalDpps}</span>
          </div>

          <div className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-1">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>Folders</span>
            </div>
            <span className="text-xl font-bold text-foreground">{result.stats.totalFolders}</span>
          </div>

          <div className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Total Duration</span>
            </div>
            <span className="text-xs font-bold text-foreground truncate block">
              {result.stats.totalDurationFormatted}
            </span>
          </div>

          <div className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Total Files</span>
            </div>
            <span className="text-xl font-bold text-foreground">{result.stats.totalFiles}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border bg-muted/20 px-4 sm:px-6 flex items-center justify-between overflow-x-auto">
        <div className="flex space-x-1 py-2">
          <button
            onClick={() => setActiveTab('bot-format')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'bot-format'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Bot Format ([CATEGORY] Title: link)</span>
          </button>

          <button
            onClick={() => setActiveTab('direct-links')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'direct-links'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Stream Links (Classes, Notes & DPPs)</span>
          </button>

          <button
            onClick={() => setActiveTab('full-report')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'full-report'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Full TXT Report</span>
          </button>

          <button
            onClick={() => setActiveTab('raw-urls')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'raw-urls'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Raw Stream URLs</span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'tree'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Content Tree Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab('m3u')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'm3u'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>VLC Playlist (.m3u)</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'json'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Main Tab Panel Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Bot Format Customizer Banner */}
        {activeTab === 'bot-format' && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <Bot className="w-4 h-4" />
                <span>HTML Maker / Telegram Bot Format ([CATEGORY] Title: link)</span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] w-fit">
                Prevents "Link 1, Link 1" Fallback
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Bots parse each line in the format{' '}
              <code className="bg-background px-1.5 py-0.5 rounded border border-border text-emerald-600 dark:text-emerald-400 font-mono">
                [CATEGORY] Title: link
              </code>
              . This ensures every button generated displays the actual lecture / note title.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground border-t border-border">
              <span className="text-muted-foreground font-semibold flex items-center space-x-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Options:</span>
              </span>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCategoryTag}
                  onChange={(e) => setIncludeCategoryTag(e.target.checked)}
                  className="rounded border-input text-emerald-600 focus:ring-0"
                />
                <span>Include [CATEGORY] Tag</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeFolderInTitle}
                  onChange={(e) => setIncludeFolderInTitle(e.target.checked)}
                  className="rounded border-input text-emerald-600 focus:ring-0"
                />
                <span>Include Folder in Title</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeId}
                  onChange={(e) => setIncludeId(e.target.checked)}
                  className="rounded border-input text-emerald-600 focus:ring-0"
                />
                <span>Include ID</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDuration}
                  onChange={(e) => setIncludeDuration(e.target.checked)}
                  className="rounded border-input text-emerald-600 focus:ring-0"
                />
                <span>Include Duration</span>
              </label>

              <div className="flex items-center space-x-1 ml-auto">
                <span className="text-muted-foreground">Filter:</span>
                <select
                  value={botFilterType}
                  onChange={(e: any) => setBotFilterType(e.target.value)}
                  className="bg-background border border-input rounded px-2 py-0.5 text-xs text-foreground"
                >
                  <option value="all">All Content ({result.allFiles.length})</option>
                  <option value="video">Videos Only ({result.stats.totalVideos})</option>
                  <option value="notes">Notes Only ({result.stats.totalNotes})</option>
                  <option value="dpp">DPPs Only ({result.stats.totalDpps})</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tree' ? (
          <ContentTreeViewer rootFolders={result.rootFolders} />
        ) : (
          <div className="space-y-3">
            {/* Filter and Copy Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter lines (e.g. Class, Stream, DPP)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleCopy(currentText, activeTab)}
                  className="px-3 py-1.5 rounded-lg border border-input bg-background hover:bg-accent text-foreground text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  {copiedTab === activeTab ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    const ext = activeTab === 'm3u' ? 'm3u' : activeTab === 'json' ? 'json' : 'txt';
                    const name = `${safeCourseName}_${activeTab}.${ext}`;
                    handleDownload(name, currentText);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>

            {/* Formatted Code / TXT Display */}
            <div className="relative rounded-xl bg-background border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>
                  {filteredLines.split('\n').filter(Boolean).length} items • ~
                  {(new Blob([filteredLines]).size / 1024).toFixed(1)} KB
                </span>
                <span>UTF-8 Plain Text</span>
              </div>
              <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto max-h-[500px] leading-relaxed select-text whitespace-pre">
                {filteredLines}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
