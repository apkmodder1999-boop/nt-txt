import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ResultViewer } from './components/ResultViewer';
import { TelegramJoinModal } from './components/TelegramJoinModal';
import {
  fetchBatches,
  fetchCourseDetails,
  fetchBatchContent,
  fetchFolderContent,
  fetchVideoDetails,
  formatDuration,
  parseDownloadUrls,
  classifyFile,
  generateTxtFiles,
} from './services/api';
import {
  BatchSection,
  BatchItem,
  CrawlLog,
  ExtractionResult,
  ExtractedFolderNode,
  ExtractedFileItem,
} from './types';
import {
  Search,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  X,
  Send,
} from 'lucide-react';

export default function App() {
  const [courseId, setCourseId] = useState<string>('192');
  const [deepDetails, setDeepDetails] = useState<boolean>(true);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [totalFolders, setTotalFolders] = useState<number>(0);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [totalVideos, setTotalVideos] = useState<number>(0);
  const [totalNotes, setTotalNotes] = useState<number>(0);
  const [totalDpps, setTotalDpps] = useState<number>(0);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available batches list & filtering
  const [batchSections, setBatchSections] = useState<BatchSection[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Theme Management (Light / Dark)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load available batches catalog on mount
  useEffect(() => {
    async function loadBatches() {
      setIsLoadingBatches(true);
      setBatchesError(null);
      try {
        const data = await fetchBatches();
        if (Array.isArray(data)) {
          setBatchSections(data);
        }
      } catch (err: any) {
        console.error('Failed to load batches:', err);
        setBatchesError('Could not load available batches.');
      } finally {
        setIsLoadingBatches(false);
      }
    }
    loadBatches();
  }, []);

  // Flattened batches list
  const allBatches = useMemo(() => {
    const list: Array<BatchItem & { sectionName: string }> = [];
    batchSections.forEach((sec) => {
      sec.batches.forEach((b) => {
        list.push({ ...b, sectionName: sec.section });
      });
    });
    return list;
  }, [batchSections]);

  // Section names for category tabs
  const sectionNames = useMemo(() => {
    return Array.from(new Set(batchSections.map((s) => s.section).filter(Boolean)));
  }, [batchSections]);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return allBatches.filter((b) => {
      const matchesSearch =
        batchSearchTerm.trim() === '' ||
        b.name.toLowerCase().includes(batchSearchTerm.toLowerCase()) ||
        String(b.id).includes(batchSearchTerm.trim());

      const matchesSection =
        selectedSection === 'all' || b.sectionName === selectedSection;

      return matchesSearch && matchesSection;
    });
  }, [allBatches, batchSearchTerm, selectedSection]);

  const addLog = (type: CrawlLog['type'], message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        time,
        type,
        message,
      },
    ]);
  };

  const handleCancelExtraction = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExtracting(false);
    addLog('warning', 'Extraction cancelled by user.');
  };

  // Main extraction trigger
  const handleStartExtraction = (idToExtract: string, deep: boolean) => {
    const targetCourseId = idToExtract.trim();
    if (!targetCourseId) {
      setError('Please enter a valid numeric Course ID.');
      return;
    }

    // Reset previous extraction state
    setError(null);
    setSuccessMessage(null);
    setResult(null);
    setProgressPercent(5);
    setCurrentFolder('');
    setTotalFolders(0);
    setTotalFiles(0);
    setTotalVideos(0);
    setTotalNotes(0);
    setTotalDpps(0);
    setLogs([]);
    setIsExtracting(true);

    addLog('info', `Starting extraction for Course ID #${targetCourseId}...`);

    // Clean up any ongoing SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `/api/extract/stream?courseId=${encodeURIComponent(
      targetCourseId
    )}&deepDetails=${deep}`;

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    let hasCompleted = false;

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.message) {
          addLog('info', payload.message);
        }
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('log', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.message) {
          addLog('info', payload.message);
        }
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.folder) setCurrentFolder(payload.folder);
        if (payload.totalFolders !== undefined) setTotalFolders(payload.totalFolders);
        if (payload.totalFiles !== undefined) setTotalFiles(payload.totalFiles);
        if (payload.lastFile) {
          addLog('info', `Found: ${payload.lastFile}`);
        }
        setProgressPercent((prev) => Math.min(94, prev + 2));
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('complete', (e: MessageEvent) => {
      try {
        hasCompleted = true;
        const finalData: ExtractionResult = JSON.parse(e.data);
        setResult(finalData);
        setProgressPercent(100);
        setIsExtracting(false);
        setTotalFolders(finalData.stats?.totalFolders || 0);
        setTotalFiles(finalData.stats?.totalFiles || 0);
        setTotalVideos(finalData.stats?.totalVideos || 0);
        setTotalNotes(finalData.stats?.totalNotes || 0);
        setTotalDpps(finalData.stats?.totalDpps || 0);

        const courseTitle = finalData.courseDetails?.title || `Course_${targetCourseId}`;
        const filename = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;

        setSuccessMessage(
          `Done — ${courseTitle}: ${finalData.stats?.totalFolders} folders, ${finalData.stats?.totalFiles} items extracted.`
        );

        // Auto-download TXT (Bot format)
        if (finalData.botFormatTxt || finalData.txtReport) {
          const contentToSave = finalData.botFormatTxt || finalData.txtReport || '';
          const blob = new Blob(['\uFEFF' + contentToSave], {
            type: 'text/plain;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        es.close();
        eventSourceRef.current = null;
      } catch (err: any) {
        console.error('Error handling complete event:', err);
        setError('Failed to parse extraction report.');
        setIsExtracting(false);
        es.close();
      }
    });

    es.addEventListener('error', (e: any) => {
      if (hasCompleted) return;
      console.warn('SSE stream interrupted, switching to client fallback crawler...', e);
      es.close();
      eventSourceRef.current = null;

      addLog('warning', 'Direct stream closed. Executing client-side crawler...');
      runClientSideFallback(targetCourseId, deep);
    });
  };

  // Client-side fallback if server streaming encounters network interruption
  const runClientSideFallback = async (targetCourseId: string, deep: boolean) => {
    try {
      addLog('info', `Fetching details for Course #${targetCourseId}...`);
      const courseDetails = await fetchCourseDetails(targetCourseId).catch(() => null);

      addLog('info', `Scanning directory tree for Course #${targetCourseId}...`);
      const rootItems = await fetchBatchContent(targetCourseId);

      let foldersCount = 0;
      let filesCount = 0;
      let videosCount = 0;
      let notesCount = 0;
      let dppsCount = 0;
      let testsCount = 0;
      let linksCount = 0;
      let durationSum = 0;
      const allFilesList: ExtractedFileItem[] = [];

      async function crawlSubFolder(
        folderId: string | number,
        title: string,
        path: string[]
      ): Promise<ExtractedFolderNode> {
        foldersCount++;
        setTotalFolders(foldersCount);
        const folderPath = [...path, title].join(' / ');
        setCurrentFolder(folderPath);

        let items: any[] = [];
        try {
          items = await fetchFolderContent(targetCourseId, folderId);
        } catch (e: any) {
          addLog('warning', `Could not load folder "${title}": ${e.message}`);
          return { id: String(folderId), title, path, folders: [], files: [] };
        }

        const subFolders: ExtractedFolderNode[] = [];
        const files: ExtractedFileItem[] = [];

        for (const item of items) {
          if (item.type === 'folder' || item.is_folder || item.item_type === 'folder') {
            const sub = await crawlSubFolder(item.id, item.title || item.name || 'Folder', [
              ...path,
              title,
            ]);
            subFolders.push(sub);
          } else {
            filesCount++;
            setTotalFiles(filesCount);

            const fileType = classifyFile(
              item.title || item.name || '',
              folderPath,
              item
            );
            let streamUrl = item.stream_url || item.url || item.link || '';
            let pdfUrl = item.pdf_url || item.document_url || '';
            let parsedDownloads: any[] = [];
            let duration = item.duration ? formatDuration(item.duration) : 'N/A';

            if (item.download_urls) {
              parsedDownloads = parseDownloadUrls(item.download_urls);
            }

            if (fileType === 'video' && (!streamUrl || deep)) {
              try {
                const vidDetails = await fetchVideoDetails(targetCourseId, item.id);
                if (vidDetails) {
                  if (vidDetails.stream_url) streamUrl = vidDetails.stream_url;
                  if (vidDetails.duration) duration = formatDuration(vidDetails.duration);
                  if (vidDetails.download_urls) {
                    parsedDownloads = parseDownloadUrls(vidDetails.download_urls);
                  }
                }
              } catch (e) {
                // Keep existing values
              }
            }

            if (fileType === 'video') videosCount++;
            else if (fileType === 'notes') notesCount++;
            else if (fileType === 'dpp') dppsCount++;
            else if (fileType === 'test') testsCount++;
            else linksCount++;

            setTotalVideos(videosCount);
            setTotalNotes(notesCount);
            setTotalDpps(dppsCount);

            const fileObj: ExtractedFileItem = {
              id: String(item.id),
              title: item.title || item.name || `Item_${item.id}`,
              type: fileType,
              streamUrl,
              pdfUrl,
              downloadUrls: parsedDownloads,
              duration,
              path: folderPath,
            };

            files.push(fileObj);
            allFilesList.push(fileObj);
          }
        }

        return { id: String(folderId), title, path, folders: subFolders, files };
      }

      const rootFolders: ExtractedFolderNode[] = [];

      for (const item of rootItems) {
        if (item.type === 'folder' || item.is_folder || item.item_type === 'folder') {
          const folderNode = await crawlSubFolder(
            item.id,
            item.title || item.name || 'Folder',
            []
          );
          rootFolders.push(folderNode);
        } else {
          filesCount++;
          setTotalFiles(filesCount);
          const fileType = classifyFile(item.title || item.name || '', 'Root', item);
          if (fileType === 'video') videosCount++;
          else if (fileType === 'notes') notesCount++;
          else if (fileType === 'dpp') dppsCount++;
          else if (fileType === 'test') testsCount++;
          else linksCount++;

          const fileObj: ExtractedFileItem = {
            id: String(item.id),
            title: item.title || item.name || `Item_${item.id}`,
            type: fileType,
            streamUrl: item.stream_url || item.url || '',
            pdfUrl: item.pdf_url || '',
            downloadUrls: parseDownloadUrls(item.download_urls),
            duration: item.duration ? formatDuration(item.duration) : 'N/A',
            path: 'Root',
          };
          allFilesList.push(fileObj);
        }
      }

      const statsObj = {
        totalFolders: foldersCount,
        totalFiles: filesCount,
        totalVideos: videosCount,
        totalNotes: notesCount,
        totalDpps: dppsCount,
        totalTests: testsCount,
        totalLinks: linksCount,
        totalDurationSeconds: durationSum,
        totalDurationFormatted: formatDuration(durationSum),
      };

      const generated = generateTxtFiles(
        targetCourseId,
        courseDetails,
        rootFolders,
        allFilesList,
        statsObj
      );

      const finalResult: ExtractionResult = {
        courseId: targetCourseId,
        courseDetails,
        extractedAt: new Date().toISOString(),
        stats: statsObj,
        rootFolders,
        allFiles: allFilesList,
        txtReport: generated.txtReport,
        botFormatTxt: generated.botFormatTxt,
        directLinksTxt: generated.directLinksTxt,
        rawUrlsTxt: generated.rawUrlsTxt,
        m3uPlaylist: generated.m3uPlaylist,
      };

      setResult(finalResult);
      setProgressPercent(100);
      setIsExtracting(false);

      const courseTitle = courseDetails?.title || `Course_${targetCourseId}`;
      const filename = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
      setSuccessMessage(
        `Done — ${courseTitle}: ${foldersCount} folders, ${filesCount} items saved.`
      );

      // Auto download
      const blob = new Blob(['\uFEFF' + (generated.botFormatTxt || generated.txtReport)], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Client crawl error:', err);
      setError(`Extraction failed: ${err.message || 'Unknown error'}`);
      setIsExtracting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (courseId.trim() && !isExtracting) {
      handleStartExtraction(courseId.trim(), deepDetails);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground selection:bg-primary/20 transition-colors">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header with Title and Dark Mode Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Batch Extractor</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Give a course ID and get one text file with every folder, lecture, PDF and video link.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              id="header-tg-btn"
              href="https://t.me/learn_topper"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Join Channel</span>
            </a>

            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="Toggle theme"
              className="rounded-lg border border-input bg-card p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Input Card matching nt-extractor.lovable.app */}
        <form
          onSubmit={handleFormSubmit}
          className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row shadow-xs"
        >
          <input
            ref={inputRef}
            inputMode="numeric"
            placeholder="e.g. 192"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={isExtracting}
            className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isExtracting || !courseId.trim()}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {isExtracting ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Extracting…
              </span>
            ) : (
              'Extract TXT'
            )}
          </button>
        </form>

        {/* Optional stream crawl toggle */}
        <div className="mt-2.5 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deepDetails}
              onChange={(e) => setDeepDetails(e.target.checked)}
              className="rounded border-input text-primary focus:ring-0"
            />
            <span>Include direct video stream URLs & PDF download links</span>
          </label>
        </div>

        {/* Progress Card when extracting */}
        {isExtracting && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground truncate">
                {currentFolder
                  ? `Scanning: ${currentFolder}`
                  : `Scanning folders… (${totalFolders} found, ${totalFiles} items)`}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground font-mono">
                {progressPercent}%
              </p>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {totalFolders} folders • {totalVideos} videos • {totalNotes} notes • {totalDpps} DPPs
              </span>
              <button
                type="button"
                onClick={handleCancelExtraction}
                className="text-xs text-destructive hover:underline font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:opacity-75 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Success message */}
        {successMessage && !isExtracting && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Extraction Result & TXT Download View */}
        {result && !isExtracting && (
          <div className="mt-6">
            <ResultViewer result={result} />
          </div>
        )}

        {/* Available batches section */}
        <div className="mt-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Available batches</h2>
            {allBatches.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredBatches.length} courses listed
              </span>
            )}
          </div>

          {/* Search Batches Bar */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={batchSearchTerm}
              onChange={(e) => setBatchSearchTerm(e.target.value)}
              placeholder="Search batches by name or ID…"
              className="w-full rounded-lg border border-input bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Section Category Tabs */}
          {sectionNames.length > 1 && (
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedSection('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
                  selectedSection === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({allBatches.length})
              </button>
              {sectionNames.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
                    selectedSection === sec
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}

          {/* Batches Loading / Error State */}
          {isLoadingBatches && (
            <p className="mt-3 text-sm text-muted-foreground">Loading batches…</p>
          )}

          {batchesError && !isLoadingBatches && (
            <p className="mt-3 text-sm text-destructive">{batchesError}</p>
          )}

          {/* Batches List matching nt-extractor.lovable.app */}
          {!isLoadingBatches && filteredBatches.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {filteredBatches.map((b) => (
                <li
                  key={`${b.id}-${b.sectionName}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border bg-card p-3 sm:flex transition hover:border-border/80"
                >
                  {b.thumbnail ? (
                    <img
                      src={b.thumbnail}
                      alt={b.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-12 w-20 shrink-0 rounded-md object-cover bg-muted"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-12 w-20 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold">
                      ID {b.id}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID {b.id} {b.sectionName && `• ${b.sectionName}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCourseId(String(b.id));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      handleStartExtraction(String(b.id), deepDetails);
                    }}
                    disabled={isExtracting}
                    className="col-span-2 w-full shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50 sm:col-span-1 sm:w-auto cursor-pointer"
                  >
                    Extract
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isLoadingBatches && filteredBatches.length === 0 && !batchesError && (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No batches found matching your search.
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-muted-foreground pb-8 space-y-2">
          <p>
            Built by{' '}
            <a
              href="https://t.me/devnaitikanonymous"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              t.me/devnaitikanonymous
            </a>{' '}
            • Join community at{' '}
            <a
              href="https://t.me/learn_topper"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              t.me/learn_topper
            </a>
          </p>
          <p className="text-muted-foreground/70">Batch Extractor — Export any course as a TXT file</p>
        </footer>
      </div>

      {/* Telegram Join Channel Popup */}
      <TelegramJoinModal
        channelUrl="https://t.me/learn_topper"
        channelName="t.me/learn_topper"
        developerUrl="https://t.me/devnaitikanonymous"
      />
    </main>
  );
}
