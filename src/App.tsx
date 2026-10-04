import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ResultViewer } from './components/ResultViewer';
import { TelegramJoinModal } from './components/TelegramJoinModal';
import {
  fetchBatches,
  fetchCourseDetails,
  fetchBatchContent,
  fetchFolderContent,
  fetchVideoDetails,
  fetchPdfUrl,
  formatDuration,
  parseDownloadUrls,
  classifyFile,
  generateTxtFiles,
  isValidStreamOrDocUrl,
  fetchSWCourses,
  extractSWBatch,
} from './services/api';
import {
  BatchSection,
  BatchItem,
  CrawlLog,
  ExtractionResult,
  ExtractedFolderNode,
  ExtractedFileItem,
  PlatformType,
  SWCourseItem,
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
  Sparkles,
  ExternalLink,
  Layers,
} from 'lucide-react';

export default function App() {
  const [platform, setPlatform] = useState<PlatformType>('NT');
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

  // NT Batches list & filtering
  const [batchSections, setBatchSections] = useState<BatchSection[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  // SW Courses list & filtering
  const [swCourses, setSwCourses] = useState<SWCourseItem[]>([]);
  const [isLoadingSWCourses, setIsLoadingSWCourses] = useState<boolean>(false);
  const [swCoursesError, setSwCoursesError] = useState<string | null>(null);

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

  // Load SW courses catalog on mount
  useEffect(() => {
    async function loadSW() {
      setIsLoadingSWCourses(true);
      setSwCoursesError(null);
      try {
        const data = await fetchSWCourses();
        if (Array.isArray(data)) {
          setSwCourses(data);
        }
      } catch (err: any) {
        console.error('Failed to load SW courses:', err);
        setSwCoursesError('Could not load SW courses catalog.');
      } finally {
        setIsLoadingSWCourses(false);
      }
    }
    loadSW();
  }, []);

  // Switch Platform handler
  const handleSwitchPlatform = (newPlatform: PlatformType) => {
    if (newPlatform === platform) return;
    setPlatform(newPlatform);
    setSelectedSection('all');
    setBatchSearchTerm('');
    setError(null);
    setResult(null);
    if (newPlatform === 'NT') {
      if (!courseId || courseId.length > 8) {
        setCourseId('192');
      }
    } else {
      if (!courseId || /^\d{1,4}$/.test(courseId)) {
        if (swCourses.length > 0) {
          setCourseId(swCourses[0].id);
        } else {
          setCourseId('');
        }
      }
    }
  };

  // Flattened batches list for NT
  const allBatches = useMemo(() => {
    const list: Array<BatchItem & { sectionName: string }> = [];
    batchSections.forEach((sec) => {
      sec.batches.forEach((b) => {
        list.push({ ...b, sectionName: sec.section });
      });
    });
    return list;
  }, [batchSections]);

  // Section names for category tabs (NT)
  const sectionNames = useMemo(() => {
    return Array.from(new Set(batchSections.map((s) => s.section).filter(Boolean)));
  }, [batchSections]);

  // Filtered batches for NT
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

  // Filtered courses for SW
  const filteredSWCourses = useMemo(() => {
    return swCourses.filter((c) => {
      const q = batchSearchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q)
      );
    });
  }, [swCourses, batchSearchTerm]);

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
      setError(`Please enter a valid ${platform} Course ID.`);
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

    addLog('info', `Starting extraction on ${platform} for Course ID #${targetCourseId}...`);

    // Clean up any ongoing SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `/api/extract/stream?platform=${platform}&courseId=${encodeURIComponent(
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

    es.addEventListener('complete', async (e: MessageEvent) => {
      try {
        hasCompleted = true;
        const finalData: ExtractionResult = JSON.parse(e.data);
        finalData.platform = platform;

        // For NT: strictly sanitize to ensure ONLY & ONLY stream URLs (.m3u8), and zero download or dynamic links
        if (platform === 'NT' && finalData.allFiles) {
          finalData.allFiles.forEach((f) => {
            if (f.type === 'video') {
              if (!f.streamUrl || !f.streamUrl.includes('.m3u8') || f.streamUrl.includes('/download/') || f.streamUrl.includes('/dl/r/') || f.streamUrl.includes('course.nexttoppers.com')) {
                f.streamUrl = '';
              }
            }
            if (f.pdfUrl && (f.pdfUrl.includes('/download/') || f.pdfUrl.includes('/dl/r/') || f.pdfUrl.includes('course.nexttoppers.com'))) {
              f.pdfUrl = '';
            }
            f.downloadUrls = [];
          });

          // Check if any videos are missing .m3u8 stream URLs or documents missing PDF links
          const missingItems = finalData.allFiles.filter(
            (f) => (f.type === 'video' && (!f.streamUrl || !f.streamUrl.includes('.m3u8'))) || ((f.type === 'notes' || f.type === 'dpp' || f.type === 'test') && !f.pdfUrl)
          );

          if (deep && missingItems.length > 0) {
            addLog('info', `Resolving ${missingItems.length} direct stream URLs (.m3u8) & links in browser...`);
            const BATCH = 25;
            for (let i = 0; i < missingItems.length; i += BATCH) {
              const chunk = missingItems.slice(i, i + BATCH);
              await Promise.all(
                chunk.map(async (fileItem) => {
                  try {
                    if (fileItem.type === 'video') {
                      // Crucial fix: pass fileItem.vdcId so get-url resolves with VideoCrypt ID
                      const vd = await fetchVideoDetails(targetCourseId, fileItem.id, fileItem.vdcId);
                      if (vd) {
                        const resUrl = vd.file_url || vd.stream_url || '';
                        // Strictly only .m3u8 direct stream URLs, never download links or dynamic links
                        if (resUrl && resUrl.includes('.m3u8') && isValidStreamOrDocUrl(resUrl)) {
                          fileItem.streamUrl = resUrl;
                        }
                        if (vd.duration && (!fileItem.durationSeconds || fileItem.durationSeconds === 0)) {
                          const d = typeof vd.duration === 'string' ? parseInt(vd.duration, 10) : vd.duration;
                          if (!isNaN(d) && d > 0) {
                            fileItem.durationSeconds = d;
                            fileItem.duration = formatDuration(d);
                          }
                        }
                      }
                    } else if (fileItem.type === 'notes' || fileItem.type === 'dpp' || fileItem.type === 'test') {
                      const pdfLink = await fetchPdfUrl(targetCourseId, fileItem.id);
                      if (pdfLink && isValidStreamOrDocUrl(pdfLink)) {
                        fileItem.pdfUrl = pdfLink;
                        fileItem.streamUrl = pdfLink;
                      }
                    }
                  } catch {
                    // Ignore single resolution failure
                  }
                })
              );
              addLog('info', `Resolved ${Math.min(i + BATCH, missingItems.length)} / ${missingItems.length} streams in browser...`);
            }

            // Sync updated stream URLs into rootFolders tree
            const fileMap = new Map<string, ExtractedFileItem>();
            finalData.allFiles.forEach((f) => fileMap.set(f.id, f));

            const syncFolderFiles = (node: ExtractedFolderNode) => {
              if (node.files && Array.isArray(node.files)) {
                node.files.forEach((nf) => {
                  const match = fileMap.get(nf.id);
                  if (match) {
                    nf.streamUrl = match.streamUrl;
                    nf.pdfUrl = match.pdfUrl;
                    nf.duration = match.duration;
                    nf.durationSeconds = match.durationSeconds;
                  }
                });
              }
              if (node.folders && Array.isArray(node.folders)) {
                node.folders.forEach(syncFolderFiles);
              }
            };
            finalData.rootFolders.forEach(syncFolderFiles);

            const regenerated = generateTxtFiles(
              targetCourseId,
              finalData.courseDetails,
              finalData.rootFolders,
              finalData.allFiles,
              finalData.stats
            );
            finalData.txtReport = regenerated.txtReport;
            finalData.botFormatTxt = regenerated.botFormatTxt;
            finalData.directLinksTxt = regenerated.directLinksTxt;
            finalData.rawUrlsTxt = regenerated.rawUrlsTxt;
            finalData.m3uPlaylist = regenerated.m3uPlaylist;
          }
        }

        setResult(finalData);
        setProgressPercent(100);
        setIsExtracting(false);
        setTotalFolders(finalData.stats?.totalFolders || 0);
        setTotalFiles(finalData.stats?.totalFiles || 0);
        setTotalVideos(finalData.stats?.totalVideos || 0);
        setTotalNotes(finalData.stats?.totalNotes || 0);
        setTotalDpps(finalData.stats?.totalDpps || 0);

        // If server returned 0 files, or returned video items but 0 valid stream URLs (e.g. edge worker subrequest limit),
        // trigger full client-side extraction fallback immediately
        const videoCountInBatch = finalData.allFiles?.filter((f) => f.type === 'video').length || 0;
        const validStreamsCountInBatch = finalData.allFiles?.filter(
          (f) => f.type === 'video' && f.streamUrl && f.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(f.streamUrl)
        ).length || 0;

        if ((finalData.stats?.totalFiles || 0) === 0 || (videoCountInBatch > 0 && validStreamsCountInBatch === 0)) {
          addLog('warning', `Server stream returned ${validStreamsCountInBatch}/${videoCountInBatch} stream links. Running full browser crawler fallback...`);
          es.close();
          eventSourceRef.current = null;
          if (platform === 'SW') {
            runClientSideSWExtraction(targetCourseId);
            return;
          } else {
            runClientSideFallback(targetCourseId, deep);
            return;
          }
        }

        const courseTitle = finalData.courseDetails?.title || `${platform}_Course_${targetCourseId}`;
        const filename = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;

        setSuccessMessage(
          `Done [${platform}] — ${courseTitle}: ${finalData.stats?.totalFolders} folders, ${finalData.stats?.totalFiles} items extracted.`
        );

        // Auto-download TXT (Selection Way TXT format for SW, Bot format for NT) only when items exist
        const contentToSave =
          platform === 'SW'
            ? finalData.txtReport || finalData.botFormatTxt || ''
            : finalData.botFormatTxt || finalData.txtReport || '';

        if ((finalData.stats?.totalFiles || 0) > 0 && contentToSave) {
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
        } else if ((finalData.stats?.totalFiles || 0) === 0) {
          setError('No downloadable content found for this course. Please verify the Course ID.');
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
      console.warn('SSE stream interrupted, switching to fallback crawler...', e);
      es.close();
      eventSourceRef.current = null;

      if (platform === 'SW') {
        addLog('warning', 'Direct stream closed. Executing client-side SW extraction...');
        runClientSideSWExtraction(targetCourseId);
      } else {
        addLog('warning', 'Direct stream closed. Executing client-side NT crawler...');
        runClientSideFallback(targetCourseId, deep);
      }
    });
  };

  // Client-side SW extraction pipeline
  const runClientSideSWExtraction = async (targetCourseId: string) => {
    try {
      addLog('info', `Connecting directly to SW classes API for Course #${targetCourseId}...`);
      const finalResult = await extractSWBatch(targetCourseId, (msg, pct) => {
        addLog('info', msg);
        setProgressPercent(pct);
      });

      setResult(finalResult);
      setProgressPercent(100);
      setIsExtracting(false);
      setTotalFolders(finalResult.stats?.totalFolders || 0);
      setTotalFiles(finalResult.stats?.totalFiles || 0);
      setTotalVideos(finalResult.stats?.totalVideos || 0);
      setTotalNotes(finalResult.stats?.totalNotes || 0);
      setTotalDpps(finalResult.stats?.totalDpps || 0);

      const courseTitle = finalResult.courseDetails?.title || `SW_Course_${targetCourseId}`;
      const filename = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;

      setSuccessMessage(
        `Done [SW] — ${courseTitle}: ${finalResult.stats?.totalFolders} folders, ${finalResult.stats?.totalFiles} items extracted.`
      );

      if ((finalResult.stats?.totalFiles || 0) > 0 && (finalResult.txtReport || finalResult.botFormatTxt)) {
        const contentToSave = finalResult.txtReport || finalResult.botFormatTxt || '';
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
      } else if ((finalResult.stats?.totalFiles || 0) === 0) {
        setError('No items found in this course. Please verify the Course ID and ensure classes are published.');
      }
    } catch (err: any) {
      console.error('Client SW extract error:', err);
      setError(`Extraction failed: ${err.message || 'Unknown error'}`);
      setIsExtracting(false);
    }
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
      const filesNeedingDetails: ExtractedFileItem[] = [];

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

        const folderItems: any[] = [];
        const files: ExtractedFileItem[] = [];

        for (const item of items) {
          const isFolder = item.type === 'folder' || item.is_folder || item.item_type === 'folder';
          const entityId = item.entity_id || item.data?.id || item.id;
          const itemTitle = item.title || item.data?.title || item.name || 'Untitled';

          if (isFolder) {
            folderItems.push({ entityId, itemTitle });
          } else {
            filesCount++;
            setTotalFiles(filesCount);

            const fileData = item.data || item;
            const fid = item.entity_id || fileData.id || item.id || `file_${filesCount}`;
            const fileType = classifyFile(itemTitle, folderPath, fileData);

            // In NT, video links must strictly be direct .m3u8 stream URLs only, never download links
            const rawUrl = fileData.file_url || fileData.stream_url || item.stream_url || '';
            let streamUrl = (fileType === 'video')
              ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') ? rawUrl : '')
              : (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '');
            let pdfUrl = (fileType === 'notes' || fileType === 'dpp' || fileType === 'test')
              ? (fileData.file_url || fileData.pdf_url || '')
              : (fileData.pdf_url || item.pdf_url || item.document_url || '');

            if (pdfUrl && (pdfUrl.includes('/dl/r/') || pdfUrl.includes('course.nexttoppers.com') || pdfUrl.includes('/download/'))) {
              pdfUrl = '';
            }

            const dynamicLink = fileData.dynamic_link || item.dynamic_link || '';

            const rawDuration = fileData.duration || item.duration;
            let durationSec = 0;
            if (rawDuration) {
              const s = typeof rawDuration === 'string' ? parseInt(rawDuration, 10) : rawDuration;
              if (!isNaN(s) && s > 0) {
                durationSec = s;
                durationSum += s;
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
              id: String(fid),
              vdcId: fileData.vdc_id || item.vdc_id || undefined,
              title: itemTitle,
              type: fileType,
              streamUrl,
              pdfUrl,
              downloadUrls: [],
              duration: formatDuration(durationSec),
              durationSeconds: durationSec,
              path: folderPath,
            };

            files.push(fileObj);
            allFilesList.push(fileObj);

            // Collect items that need video-details for .m3u8 stream URLs or document links
            if (deep) {
              if (fileType === 'video' && (!fileObj.streamUrl || !fileObj.streamUrl.includes('.m3u8'))) {
                filesNeedingDetails.push(fileObj);
              } else if ((fileType === 'notes' || fileType === 'dpp' || fileType === 'test') && !fileObj.pdfUrl) {
                filesNeedingDetails.push(fileObj);
              }
            }
          }
        }

        // Parallelize subfolder crawling for speed
        const subFolders = await Promise.all(
          folderItems.map((f) =>
            crawlSubFolder(f.entityId, f.itemTitle, [...path, title])
          )
        );

        return { id: String(folderId), title, path, folders: subFolders, files };
      }

      const rootFolderItems = rootItems.filter((i: any) => i.type === 'folder' || i.is_folder || i.item_type === 'folder');
      const rootFileItems = rootItems.filter((i: any) => !(i.type === 'folder' || i.is_folder || i.item_type === 'folder'));

      for (const item of rootFileItems) {
        filesCount++;
        setTotalFiles(filesCount);
        const fileData = item.data || item;
        const fid = item.entity_id || fileData.id || item.id || `file_${filesCount}`;
        const itemTitle = item.title || item.data?.title || item.name || 'Root File';
        const fileType = classifyFile(itemTitle, 'Root', fileData);

        if (fileType === 'video') videosCount++;
        else if (fileType === 'notes') notesCount++;
        else if (fileType === 'dpp') dppsCount++;
        else if (fileType === 'test') testsCount++;
        else linksCount++;

        const rawUrl = fileData.file_url || fileData.stream_url || item.stream_url || '';
        let streamUrl = (fileType === 'video')
          ? (rawUrl && rawUrl.includes('.m3u8') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '')
          : (rawUrl && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '');
        let pdfUrl = (fileType === 'notes' || fileType === 'dpp' || fileType === 'test')
          ? (fileData.file_url || fileData.pdf_url || '')
          : (fileData.pdf_url || item.pdf_url || item.document_url || '');

        if (pdfUrl && !isValidStreamOrDocUrl(pdfUrl)) {
          pdfUrl = '';
        }

        const rawDuration = fileData.duration || item.duration;
        let durationSec = 0;
        if (rawDuration) {
          const s = typeof rawDuration === 'string' ? parseInt(rawDuration, 10) : rawDuration;
          if (!isNaN(s) && s > 0) {
            durationSec = s;
            durationSum += s;
          }
        }

        const fileObj: ExtractedFileItem = {
          id: String(fid),
          vdcId: fileData.vdc_id || item.vdc_id || undefined,
          title: itemTitle,
          type: fileType,
          streamUrl,
          pdfUrl,
          downloadUrls: [],
          duration: formatDuration(durationSec),
          durationSeconds: durationSec,
          path: 'Root',
        };
        allFilesList.push(fileObj);

        if (deep) {
          if (fileType === 'video' && (!fileObj.streamUrl || !fileObj.streamUrl.includes('.m3u8'))) {
            filesNeedingDetails.push(fileObj);
          } else if ((fileType === 'notes' || fileType === 'dpp' || fileType === 'test') && !fileObj.pdfUrl) {
            filesNeedingDetails.push(fileObj);
          }
        }
      }

      // Parallelize root folders crawling
      const rootFolders = await Promise.all(
        rootFolderItems.map((rf: any) => {
          const entityId = rf.entity_id || rf.data?.id || rf.id;
          const itemTitle = rf.title || rf.data?.title || rf.name || 'Root Folder';
          return crawlSubFolder(entityId, itemTitle, []);
        })
      );

      // Fast concurrent resolution of stream URLs & document links
      if (deep && filesNeedingDetails.length > 0) {
        addLog('info', `Resolving stream URLs (.m3u8) & links for ${filesNeedingDetails.length} items in browser...`);
        const BATCH = 35;
        for (let i = 0; i < filesNeedingDetails.length; i += BATCH) {
          const chunk = filesNeedingDetails.slice(i, i + BATCH);
          await Promise.all(
            chunk.map(async (fileItem) => {
              try {
                if (fileItem.type === 'video') {
                  const vidDetails = await fetchVideoDetails(targetCourseId, fileItem.id, fileItem.vdcId);
                  if (vidDetails) {
                    const resUrl = vidDetails.file_url || vidDetails.stream_url || '';
                    // Strictly only .m3u8 direct stream URLs, never download links or dynamic links
                    if (resUrl && resUrl.includes('.m3u8') && isValidStreamOrDocUrl(resUrl)) {
                      fileItem.streamUrl = resUrl;
                    }

                    if (vidDetails.duration && (!fileItem.durationSeconds || fileItem.durationSeconds === 0)) {
                      const d = typeof vidDetails.duration === 'string' ? parseInt(vidDetails.duration, 10) : vidDetails.duration;
                      if (!isNaN(d) && d > 0) {
                        fileItem.durationSeconds = d;
                        fileItem.duration = formatDuration(d);
                        durationSum += d;
                      }
                    }
                  }
                } else if (fileItem.type === 'notes' || fileItem.type === 'dpp' || fileItem.type === 'test') {
                  const pdfLink = await fetchPdfUrl(targetCourseId, fileItem.id);
                  if (pdfLink && isValidStreamOrDocUrl(pdfLink)) {
                    fileItem.pdfUrl = pdfLink;
                    fileItem.streamUrl = pdfLink;
                  }
                }
              } catch {
                // Ignore individual lookup errors
              }
            })
          );
          const resolvedCount = Math.min(i + BATCH, filesNeedingDetails.length);
          setProgressPercent(Math.min(96, 50 + Math.round((resolvedCount / filesNeedingDetails.length) * 45)));
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
        platform: 'NT',
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

      // Auto download only when files were extracted
      if (filesCount > 0 && (generated.botFormatTxt || generated.txtReport)) {
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
      } else if (filesCount === 0) {
        setError('No files or videos found for this Course ID. Please verify the Course ID.');
      }
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
    <main className="min-h-screen bg-background px-4 sm:px-6 py-8 sm:py-12 text-foreground selection:bg-primary/20 transition-colors">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header with NT Platform Branding and Dark Mode Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl tracking-wider shadow-sm shrink-0">
              NT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">NT Extractor</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  NT & SW
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Export complete course folders, video streams, notes & DPPs as clean TXT files.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              id="header-tg-btn"
              href="https://t.me/learn_topper"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Join</span> Channel
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

        {/* Platform Selection Segmented Control */}
        <div className="mt-6 p-1 bg-muted/70 dark:bg-muted/40 border border-border rounded-xl flex gap-1">
          <button
            type="button"
            onClick={() => handleSwitchPlatform('NT')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
              platform === 'NT'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>NT Platform</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
              NextToppers
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchPlatform('SW')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
              platform === 'SW'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>SW Platform</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
              Selection Way
            </span>
          </button>
        </div>

        {/* Input Card */}
        <form
          onSubmit={handleFormSubmit}
          className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row shadow-xs"
        >
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              inputMode={platform === 'NT' ? 'numeric' : 'text'}
              placeholder={
                platform === 'NT'
                  ? 'Enter NT Course ID (e.g. 192)'
                  : 'Enter SW Course ID (e.g. 6a9c1a854d63c7a67104bba6)'
              }
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={isExtracting}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isExtracting || !courseId.trim()}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isExtracting ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Extracting…
              </span>
            ) : (
              `Extract ${platform} TXT`
            )}
          </button>
        </form>

        {/* Optional stream crawl toggle */}
        <div className="mt-2.5 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deepDetails}
              onChange={(e) => setDeepDetails(e.target.checked)}
              className="rounded border-input text-primary focus:ring-0"
            />
            <span>Resolve video stream URLs (.m3u8) & PDF document links</span>
          </label>
          <span className="font-mono text-[11px]">
            Target: <strong className="text-foreground">{platform}</strong>
          </span>
        </div>

        {/* NT API status line */}
        {platform === 'NT' && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 text-xs rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-muted-foreground">
            <div className="flex items-center gap-2 truncate">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] truncate">
                NT API:{' '}
                <a
                  href="https://nt.learn-topper.workers.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  https://nt.learn-topper.workers.dev/
                </a>{' '}
                <span className="text-muted-foreground/75">(HLS stream resolver active)</span>
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium shrink-0">
              Note: PDF links pending upstream API update
            </span>
          </div>
        )}

        {/* Progress Card when extracting */}
        {isExtracting && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground truncate">
                {currentFolder
                  ? `Scanning: ${currentFolder}`
                  : `Connecting to ${platform} API… (${totalFolders} folders, ${totalFiles} items)`}
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

        {/* Available Batches / Courses Catalog */}
        <div className="mt-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {platform === 'NT' ? 'Available NT Batches' : 'Available SW Courses'}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-mono font-medium">
                {platform === 'NT' ? filteredBatches.length : filteredSWCourses.length} available
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Click &quot;Extract&quot; on any course to download its TXT
            </span>
          </div>

          {/* Search Catalog Bar */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={batchSearchTerm}
              onChange={(e) => setBatchSearchTerm(e.target.value)}
              placeholder={
                platform === 'NT'
                  ? 'Search NT batches by name or ID…'
                  : 'Search SW courses by title or ID…'
              }
              className="w-full rounded-lg border border-input bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* NT Category Tabs */}
          {platform === 'NT' && sectionNames.length > 1 && (
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

          {/* NT Platform Catalog List */}
          {platform === 'NT' && (
            <>
              {isLoadingBatches && (
                <div className="mt-4 flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading NT batches…</span>
                </div>
              )}

              {batchesError && !isLoadingBatches && (
                <p className="mt-3 text-sm text-destructive">{batchesError}</p>
              )}

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
                  No NT batches found matching your search.
                </div>
              )}
            </>
          )}

          {/* SW Platform Catalog List */}
          {platform === 'SW' && (
            <>
              {isLoadingSWCourses && (
                <div className="mt-4 flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading SW courses catalog…</span>
                </div>
              )}

              {swCoursesError && !isLoadingSWCourses && (
                <p className="mt-3 text-sm text-destructive">{swCoursesError}</p>
              )}

              {!isLoadingSWCourses && filteredSWCourses.length > 0 && (
                <ul className="mt-3 grid gap-2">
                  {filteredSWCourses.map((c) => {
                    const thumb = c.bannerSquare || c.banner;
                    return (
                      <li
                        key={c.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border bg-card p-3 sm:flex transition hover:border-border/80"
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={c.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-12 w-20 shrink-0 rounded-md object-cover bg-muted"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-12 w-20 shrink-0 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold font-mono">
                            SW
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium text-foreground">{c.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.2 rounded">
                              ID: {c.id.substring(0, 12)}…
                            </span>
                            {c.validity && <span>• {c.validity}</span>}
                            {(c.discountPrice || c.price) && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                • ₹{c.discountPrice || c.price}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCourseId(c.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            handleStartExtraction(c.id, deepDetails);
                          }}
                          disabled={isExtracting}
                          className="col-span-2 w-full shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 sm:col-span-1 sm:w-auto cursor-pointer"
                        >
                          Extract SW
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isLoadingSWCourses && filteredSWCourses.length === 0 && !swCoursesError && (
                <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No SW courses found matching your search.
                </div>
              )}
            </>
          )}
        </div>

        {/* Watermark & Community Footer */}
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
          <p className="text-muted-foreground/70">
            NT Platform — Multi-Platform Course Extractor (NT &amp; SW)
          </p>
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
