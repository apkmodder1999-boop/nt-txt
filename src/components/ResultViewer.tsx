import React, { useState } from 'react';
import { ExtractionResult } from '../types';
import { ContentTreeViewer } from './ContentTreeViewer';
import {
  generateSWTxt,
  generateSWM3U,
  generateSWBash,
  generateSWPowerShell,
} from '../services/swGenerators';
import {
  Download,
  Copy,
  Check,
  FileText,
  Search,
  Radio,
  FolderTree,
  FileCode,
  Layers,
  BookOpen,
  Film,
  FileCheck2,
  Clock,
  Send,
  Bot,
  SlidersHorizontal,
  Terminal,
  Code2,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface ResultViewerProps {
  result: ExtractionResult;
  onReset: () => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ result, onReset }) => {
  const isSW = result.platform === 'SW';

  // Tabs for SW or NT default
  const [activeTab, setActiveTab] = useState<string>(
    isSW ? 'sw-txt' : 'bot-format'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // SW-specific customization options
  const [swIncludeDesc, setSwIncludeDesc] = useState<boolean>(true);
  const [swIncludeHls, setSwIncludeHls] = useState<boolean>(true);
  const [swIncludeDirectMp4, setSwIncludeDirectMp4] = useState<boolean>(true);
  const [swIncludePdfs, setSwIncludePdfs] = useState<boolean>(true);
  const [swPreferredQuality, setSwPreferredQuality] = useState<'720p' | '480p' | '360p' | '240p'>('720p');
  const [swM3uStreamType, setSwM3uStreamType] = useState<'hls' | 'mp4'>('hls');

  // NT Bot Format customization state
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

  // Dynamically compute SW formats based on active options
  const computeSWData = () => {
    if (!result.rawSWData) {
      return {
        course: {
          id: result.courseId,
          title: result.courseDetails?.title || `Course ${result.courseId}`,
          isLive: false,
        },
        classes: result.rootFolders.map((f) => ({
          topicName: f.title,
          classes: f.files.map((fl) => ({
            title: fl.title,
            duration: fl.durationSeconds,
            teacherName: fl.className,
            class_link: fl.streamUrl,
            mp4Recordings: fl.downloadUrls?.map((d) => ({
              quality: d.quality,
              url: d.url,
            })),
            classPdf: fl.pdfUrl ? [{ name: fl.title, url: fl.pdfUrl }] : [],
          })),
        })),
      };
    }
    return {
      course: result.rawSWData.course || {
        id: result.courseId,
        title: result.courseDetails?.title,
      },
      classes: result.rawSWData.classes || [],
    };
  };

  const currentSWCourseData = isSW ? computeSWData() : null;

  // Selection Way format outputs
  const swTxtContent = isSW && currentSWCourseData
    ? generateSWTxt(currentSWCourseData, {
        includeDescription: swIncludeDesc,
        includeHls: swIncludeHls,
        includeDirectMp4: swIncludeDirectMp4,
        includePdfs: swIncludePdfs,
        preferredQuality: swPreferredQuality,
      })
    : result.txtReport || '';

  const swM3uContent = isSW && currentSWCourseData
    ? generateSWM3U(currentSWCourseData, {
        streamType: swM3uStreamType,
        preferredQuality: swPreferredQuality,
      })
    : result.m3uPlaylist || '';

  const swBashContent = isSW && currentSWCourseData
    ? generateSWBash(currentSWCourseData, { preferredQuality: swPreferredQuality })
    : result.bashScript || '';

  const swPowerShellContent = isSW && currentSWCourseData
    ? generateSWPowerShell(currentSWCourseData, { preferredQuality: swPreferredQuality })
    : result.powerShellScript || '';

  // NT Bot format generator
  const generateBotText = (): string => {
    let lines: string[] = [
      '// Built by t.me/devnaitikanonymous | Join: t.me/learn_topper',
    ];
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

      let durationSuffix = '';
      if (includeDuration && file.duration && file.duration !== 'N/A') {
        durationSuffix = ` (${file.duration})`;
      }

      let idSuffix = '';
      if (includeId && file.id) {
        idSuffix = ` (id: ${file.id})`;
      }

      const prefix = includeCategoryTag ? `[${cat}] ` : '';
      lines.push(`${prefix}${title}${idSuffix}${durationSuffix}: ${targetUrl}`);
    });

    return lines.join('\n');
  };

  const botContent = generateBotText();

  // Active text content resolver
  let currentText = '';
  if (activeTab === 'sw-txt') currentText = swTxtContent;
  else if (activeTab === 'sw-m3u') currentText = swM3uContent;
  else if (activeTab === 'sw-bash') currentText = swBashContent;
  else if (activeTab === 'sw-powershell') currentText = swPowerShellContent;
  else if (activeTab === 'bot-format') currentText = botContent;
  else if (activeTab === 'direct-links') currentText = result.directLinksTxt || '';
  else if (activeTab === 'full-report') currentText = result.txtReport || '';
  else if (activeTab === 'raw-urls') currentText = result.rawUrlsTxt || '';
  else if (activeTab === 'm3u') currentText = result.m3uPlaylist || '';
  else if (activeTab === 'json') currentText = JSON.stringify(result, null, 2);

  const filteredLines = currentText
    .split('\n')
    .filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
    .join('\n');

  return (
    <div id="result-viewer" className="w-full bg-card rounded-2xl border border-border shadow-md overflow-hidden">
      {/* Header with Course Info & Quick Actions */}
      <div className="p-4 sm:p-6 border-b border-border bg-muted/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            {result.courseDetails?.thumbnail && (
              <img
                src={result.courseDetails.thumbnail}
                alt={courseTitle}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-border shrink-0 shadow-xs"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {isSW ? 'Selection Way (SW)' : 'NT Platform'}
                </span>
                {isSW && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Selection Way Active
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  ID: #{result.courseId}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-foreground truncate mt-1">
                {courseTitle}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Extracted on {new Date(result.extractedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onReset}
              className="px-3.5 py-2 rounded-lg border border-input bg-background hover:bg-accent text-foreground text-xs font-semibold transition cursor-pointer"
            >
              Extract Another
            </button>

            {isSW ? (
              <>
                <button
                  onClick={() =>
                    handleDownload(
                      `${safeCourseName}_selection_way.txt`,
                      swTxtContent
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download SW TXT</span>
                </button>
                <button
                  onClick={() =>
                    handleDownload(
                      `${safeCourseName}_playlist.m3u`,
                      swM3uContent
                    )
                  }
                  className="px-3.5 py-2 rounded-lg border border-input bg-background hover:bg-accent text-foreground text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-emerald-500" />
                  <span>M3U</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() =>
                    handleDownload(
                      `${safeCourseName}_bot_format.txt`,
                      botContent
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Bot TXT</span>
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
              </>
            )}

            <a
              href="https://t.me/learn_topper"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Join Channel</span>
            </a>
          </div>
        </div>

        {/* Stats Badges */}
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
              <span>{isSW ? 'Topics' : 'Folders'}</span>
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
              <span>Total Items</span>
            </div>
            <span className="text-xl font-bold text-foreground">{result.stats.totalFiles}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Selection Way format tabs when SW) */}
      <div className="border-b border-border bg-muted/20 px-4 sm:px-6 flex items-center justify-between overflow-x-auto">
        <div className="flex space-x-1 py-2">
          {isSW ? (
            <>
              <button
                onClick={() => setActiveTab('sw-txt')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sw-txt'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Text Document (.txt)</span>
              </button>

              <button
                onClick={() => setActiveTab('sw-m3u')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sw-m3u'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Streaming Playlist (.m3u)</span>
              </button>

              <button
                onClick={() => setActiveTab('sw-bash')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sw-bash'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Bash Script (Linux/sh)</span>
              </button>

              <button
                onClick={() => setActiveTab('sw-powershell')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sw-powershell'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>PowerShell (Windows)</span>
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
                <span>Topic Explorer</span>
              </button>

              <button
                onClick={() => setActiveTab('bot-format')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'bot-format'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Bot Format</span>
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
            </>
          ) : (
            <>
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
                <FileText className="w-3.5 h-3.5" />
                <span>Stream Links</span>
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
                <span>Raw URLs</span>
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
                <span>Folder Explorer</span>
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
            </>
          )}
        </div>
      </div>

      {/* Main Tab Panel Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Selection Way Customizer Controls */}
        {isSW && (activeTab === 'sw-txt' || activeTab === 'sw-m3u' || activeTab === 'sw-bash' || activeTab === 'sw-powershell') && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-bold">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Selection Way Export Customizer</span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono text-[11px] w-fit">
                Batch Course ID: #{result.courseId}
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs text-foreground border-t border-border">
              {activeTab === 'sw-txt' && (
                <>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={swIncludeDesc}
                      onChange={(e) => setSwIncludeDesc(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    <span>Class Descriptions</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={swIncludeHls}
                      onChange={(e) => setSwIncludeHls(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    <span>HLS Stream Links</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={swIncludeDirectMp4}
                      onChange={(e) => setSwIncludeDirectMp4(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    <span>MP4 Direct Links</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={swIncludePdfs}
                      onChange={(e) => setSwIncludePdfs(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    <span>PDFs & Notes</span>
                  </label>
                </>
              )}

              {activeTab === 'sw-m3u' && (
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground font-semibold">Stream Source:</span>
                  <select
                    value={swM3uStreamType}
                    onChange={(e) => setSwM3uStreamType(e.target.value as any)}
                    className="bg-background border border-input rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                  >
                    <option value="hls">HLS Master Link (.m3u8)</option>
                    <option value="mp4">Direct MP4 Video (.mp4)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground font-semibold">Quality Priority:</span>
                <select
                  value={swPreferredQuality}
                  onChange={(e) => setSwPreferredQuality(e.target.value as any)}
                  className="bg-background border border-input rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value="720p">720p (High)</option>
                  <option value="480p">480p (Medium)</option>
                  <option value="360p">360p (Low)</option>
                  <option value="240p">240p (Data Saver)</option>
                </select>
              </div>
            </div>
          </div>
        )}

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

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCategoryTag}
                  onChange={(e) => setIncludeCategoryTag(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-ring"
                />
                <span>[CATEGORY] Tag</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFolderInTitle}
                  onChange={(e) => setIncludeFolderInTitle(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-ring"
                />
                <span>Include Folder Path</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDuration}
                  onChange={(e) => setIncludeDuration(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-ring"
                />
                <span>Video Duration</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeId}
                  onChange={(e) => setIncludeId(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-ring"
                />
                <span>Content ID</span>
              </label>

              <div className="flex items-center space-x-1.5 ml-auto">
                <span className="text-muted-foreground font-medium">Filter:</span>
                <select
                  value={botFilterType}
                  onChange={(e) => setBotFilterType(e.target.value as any)}
                  className="bg-background border border-input rounded px-2 py-0.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">All Items ({result.stats.totalFiles})</option>
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
                  placeholder="Filter lines (e.g. Lecture, MP4, PDF, wget)..."
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
                    let ext = 'txt';
                    if (activeTab === 'sw-m3u' || activeTab === 'm3u') ext = 'm3u';
                    else if (activeTab === 'sw-bash') ext = 'sh';
                    else if (activeTab === 'sw-powershell') ext = 'ps1';
                    else if (activeTab === 'json') ext = 'json';

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
                <span>
                  {activeTab === 'sw-bash'
                    ? 'Bash Shell Script (.sh)'
                    : activeTab === 'sw-powershell'
                    ? 'PowerShell Script (.ps1)'
                    : activeTab === 'sw-m3u' || activeTab === 'm3u'
                    ? 'Extended M3U Playlist (.m3u)'
                    : 'UTF-8 Plain Text'}
                </span>
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
