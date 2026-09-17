import type { EventContext } from '@cloudflare/workers-types';

interface Env {
  REMOTE_SERVICE_URL?: string;
  [key: string]: any;
}

const DEFAULT_REMOTE_URL = 'https://learnjh_api.learnjhapi.workers.dev/api/nexttoppers';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://learnjh.vercel.app/',
  Origin: 'https://learnjh.vercel.app',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function formatDuration(seconds: number | string | null | undefined): string {
  if (!seconds) return 'N/A';
  const num = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  if (isNaN(num) || num <= 0) return 'N/A';
  const h = Math.floor(num / 3600);
  const m = Math.floor((num % 3600) / 60);
  const s = num % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}m ${s}s`;
}

function parseDownloadUrls(raw: any): Array<{ quality: string; url: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => ({
        quality: item.title || item.quality || 'Standard',
        url: item.url || '',
      }))
      .filter((x) => x.url);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => ({
            quality: item.title || item.quality || 'Standard',
            url: item.url || '',
          }))
          .filter((x) => x.url);
      }
    } catch {
      // not JSON
    }
  }
  return [];
}

function classifyFile(
  itemTitle: string,
  folderPath: string,
  fileData: any
): 'video' | 'notes' | 'dpp' | 'test' | 'other' {
  const t = (itemTitle || '').toLowerCase();
  const pathStr = (folderPath || '').toLowerCase();
  const rawType = fileData?.file_type;
  const contentType = fileData?.content_type;

  if (rawType === 2 || contentType === 2 || (fileData?.video_type && fileData.video_type > 0)) {
    return 'video';
  }

  if (
    pathStr.includes('practice sheet') ||
    pathStr.includes('dpp') ||
    pathStr.includes('daily practice') ||
    pathStr.includes('assignment') ||
    t.includes('dpp') ||
    t.includes('practice sheet') ||
    t.includes('daily practice') ||
    t.includes('worksheet')
  ) {
    return 'dpp';
  }

  if (
    rawType === 1 ||
    contentType === 1 ||
    t.includes('.pdf') ||
    t.includes('note') ||
    fileData?.has_pdf === '1' ||
    pathStr.includes('note')
  ) {
    return 'notes';
  }

  if (t.includes('test') || pathStr.includes('test')) {
    return 'test';
  }

  return 'other';
}

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequest = async (context: EventContext<Env, any, any>): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, ''); // Remove trailing slash
  const remoteBase = env.REMOTE_SERVICE_URL || DEFAULT_REMOTE_URL;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1. GET /api/batches
  if (pathname === '/api/batches' && request.method === 'GET') {
    try {
      const res = await fetch(`${remoteBase}/batches`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch batches' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 2. POST /api/course-details
  if (pathname === '/api/course-details' && request.method === 'POST') {
    try {
      const body: any = await request.json();
      const { courseId } = body;
      if (!courseId) {
        return new Response(JSON.stringify({ error: 'courseId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const res = await fetch(`${remoteBase}/course-details`, {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: String(courseId) }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch course details' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 3. POST /api/content
  if (pathname === '/api/content' && request.method === 'POST') {
    try {
      const body: any = await request.json();
      const { courseId } = body;
      if (!courseId) {
        return new Response(JSON.stringify({ error: 'courseId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const res = await fetch(`${remoteBase}/content`, {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: String(courseId) }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch content' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 4. POST /api/folder
  if (pathname === '/api/folder' && request.method === 'POST') {
    try {
      const body: any = await request.json();
      const { courseId, folderId } = body;
      if (!courseId || folderId === undefined) {
        return new Response(JSON.stringify({ error: 'courseId and folderId are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const res = await fetch(`${remoteBase}/content/folder`, {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: String(courseId), folderId: String(folderId) }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch folder' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 5. POST /api/video-details
  if (pathname === '/api/video-details' && request.method === 'POST') {
    try {
      const body: any = await request.json();
      const { courseId, contentId } = body;
      if (!courseId || !contentId) {
        return new Response(JSON.stringify({ error: 'courseId and contentId are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const res = await fetch(`${remoteBase}/video-details`, {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: String(courseId), contentId: String(contentId) }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch video details' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 6. GET /api/extract/stream (Edge Server-Sent Events via ReadableStream)
  if (pathname === '/api/extract/stream' && request.method === 'GET') {
    const courseId = url.searchParams.get('courseId')?.trim();
    const deepFileDetails = url.searchParams.get('deepDetails') !== 'false';

    if (!courseId) {
      return new Response('courseId parameter is required', { status: 400, headers: CORS_HEADERS });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (type: string, payload: any) => {
      try {
        await writer.write(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`));
      } catch {
        // Stream may have closed
      }
    };

    const crawlTask = async () => {
      try {
        await sendEvent('status', { message: `Connecting to batch API for Course ID #${courseId}...` });

        // Step 1: Course Details
        let courseDetails: any = null;
        try {
          const cdRes = await fetch(`${remoteBase}/course-details`, {
            method: 'POST',
            headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId }),
          });
          if (cdRes.ok) {
            const cdJson: any = await cdRes.json();
            courseDetails = cdJson.data || cdJson;
          }
        } catch {
          // ignore
        }

        await sendEvent('status', {
          message: `Found course: ${courseDetails?.title || `ID ${courseId}`}. Fetching directory structure...`,
        });

        // Step 2: Content
        const contentRes = await fetch(`${remoteBase}/content`, {
          method: 'POST',
          headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });

        if (!contentRes.ok) {
          throw new Error(`Failed to load batch root: HTTP ${contentRes.status}`);
        }

        const contentJson: any = await contentRes.json();
        const rootItems: any[] = contentJson.data || [];

        let totalFoldersCount = 0;
        let totalFilesCount = 0;
        let totalVideosCount = 0;
        let totalNotesCount = 0;
        let totalDppsCount = 0;
        let totalTestsCount = 0;
        let totalLinksCount = 0;
        let totalDurationSeconds = 0;

        const allFilesList: any[] = [];
        const filesNeedingDetails: any[] = [];

        async function crawlFolder(
          folderId: string | number,
          folderTitle: string,
          parentPath: string[]
        ): Promise<any> {
          totalFoldersCount++;
          const currentPathArr = [...parentPath, folderTitle];
          const pathStr = currentPathArr.join(' / ');

          await sendEvent('progress', {
            folder: pathStr,
            totalFolders: totalFoldersCount,
            totalFiles: totalFilesCount,
          });

          let items: any[] = [];
          try {
            const folderRes = await fetch(`${remoteBase}/content/folder`, {
              method: 'POST',
              headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseId, folderId: String(folderId) }),
            });
            if (folderRes.ok) {
              const folderJson: any = await folderRes.json();
              items = folderJson.data || [];
            }
          } catch (err: any) {
            await sendEvent('log', { message: `Warning: Failed folder "${folderTitle}": ${err.message}` });
          }

          const subFolders: any[] = [];
          const files: any[] = [];

          for (const item of items) {
            if (item.type === 'folder' || item.is_folder || item.item_type === 'folder') {
              const sub = await crawlFolder(item.id, item.title || item.name || 'Folder', currentPathArr);
              subFolders.push(sub);
            } else {
              totalFilesCount++;
              const fileType = classifyFile(item.title || item.name || '', pathStr, item);

              if (fileType === 'video') totalVideosCount++;
              else if (fileType === 'notes') totalNotesCount++;
              else if (fileType === 'dpp') totalDppsCount++;
              else if (fileType === 'test') totalTestsCount++;
              else totalLinksCount++;

              let streamUrl = item.stream_url || item.url || item.link || '';
              let pdfUrl = item.pdf_url || item.document_url || '';
              let parsedDownloads = parseDownloadUrls(item.download_urls);
              let duration = item.duration ? formatDuration(item.duration) : 'N/A';

              if (item.duration) {
                const s = typeof item.duration === 'string' ? parseInt(item.duration, 10) : item.duration;
                if (!isNaN(s)) totalDurationSeconds += s;
              }

              const fileObj = {
                id: String(item.id),
                title: item.title || item.name || `File_${item.id}`,
                type: fileType,
                streamUrl,
                pdfUrl,
                downloadUrls: parsedDownloads,
                duration,
                path: pathStr,
              };

              if (fileType === 'video' && (!streamUrl || deepFileDetails)) {
                filesNeedingDetails.push({ fileObj, itemId: item.id });
              }

              files.push(fileObj);
              allFilesList.push(fileObj);

              if (totalFilesCount % 10 === 0) {
                await sendEvent('progress', {
                  folder: pathStr,
                  totalFolders: totalFoldersCount,
                  totalFiles: totalFilesCount,
                  lastFile: fileObj.title,
                });
              }
            }
          }

          return {
            id: String(folderId),
            title: folderTitle,
            path: parentPath,
            folders: subFolders,
            files,
          };
        }

        const treeNodes: any[] = [];
        for (const item of rootItems) {
          if (item.type === 'folder' || item.is_folder || item.item_type === 'folder') {
            const folderNode = await crawlFolder(item.id, item.title || item.name || 'Folder', []);
            treeNodes.push(folderNode);
          } else {
            totalFilesCount++;
            const fileType = classifyFile(item.title || item.name || '', 'Root', item);

            if (fileType === 'video') totalVideosCount++;
            else if (fileType === 'notes') totalNotesCount++;
            else if (fileType === 'dpp') totalDppsCount++;
            else if (fileType === 'test') totalTestsCount++;
            else totalLinksCount++;

            const fileObj = {
              id: String(item.id),
              title: item.title || item.name || `File_${item.id}`,
              type: fileType,
              streamUrl: item.stream_url || item.url || '',
              pdfUrl: item.pdf_url || '',
              downloadUrls: parseDownloadUrls(item.download_urls),
              duration: item.duration ? formatDuration(item.duration) : 'N/A',
              path: 'Root',
            };

            if (fileType === 'video' && (!fileObj.streamUrl || deepFileDetails)) {
              filesNeedingDetails.push({ fileObj, itemId: item.id });
            }

            allFilesList.push(fileObj);
          }
        }

        // Deep file details
        if (deepFileDetails && filesNeedingDetails.length > 0) {
          await sendEvent('status', {
            message: `Extracting direct stream URLs for ${filesNeedingDetails.length} videos...`,
          });

          const CONCURRENCY = 4;
          for (let i = 0; i < filesNeedingDetails.length; i += CONCURRENCY) {
            const chunk = filesNeedingDetails.slice(i, i + CONCURRENCY);
            await Promise.all(
              chunk.map(async ({ fileObj, itemId }) => {
                try {
                  const vdRes = await fetch(`${remoteBase}/video-details`, {
                    method: 'POST',
                    headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId, contentId: String(itemId) }),
                  });
                  if (vdRes.ok) {
                    const vdJson: any = await vdRes.json();
                    const vdata = vdJson.data || vdJson;
                    if (vdata) {
                      if (vdata.stream_url) fileObj.streamUrl = vdata.stream_url;
                      if (vdata.pdf_url && !fileObj.pdfUrl) fileObj.pdfUrl = vdata.pdf_url;
                      if (vdata.download_urls) {
                        fileObj.downloadUrls = parseDownloadUrls(vdata.download_urls);
                      }
                      if (vdata.duration) {
                        fileObj.duration = formatDuration(vdata.duration);
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              })
            );

            if (i % 8 === 0) {
              await sendEvent('progress', {
                folder: `Resolved video streams: ${Math.min(i + CONCURRENCY, filesNeedingDetails.length)} / ${filesNeedingDetails.length}`,
                totalFolders: totalFoldersCount,
                totalFiles: totalFilesCount,
              });
            }
          }
        }

        await sendEvent('status', { message: 'Compiling structured bot-format TXT report...' });

        // Generate Bot Format TXT
        let botFormatTxt = `// Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
        allFilesList.forEach((file) => {
          const isVideo = file.type === 'video';
          const targetUrl = isVideo ? file.streamUrl : file.pdfUrl || file.streamUrl;
          if (!targetUrl) return;

          let cat = 'FILE';
          if (file.type === 'video') cat = 'VIDEO';
          else if (file.type === 'notes' || file.type === 'dpp') cat = 'PDF';
          else if (file.type === 'test') cat = 'TEST';

          let titleDisplay = file.title;
          if (file.type === 'dpp' && !titleDisplay.toLowerCase().startsWith('dpp')) {
            titleDisplay = `DPP - ${titleDisplay}`;
          }

          let durationSuffix = file.duration && file.duration !== 'N/A' ? ` (${file.duration})` : '';
          let idSuffix = file.id ? ` (id: ${file.id})` : '';

          botFormatTxt += `[${cat}] ${titleDisplay}${idSuffix}${durationSuffix}: ${targetUrl}\n`;
        });

        // Direct links TXT
        const courseTitle = courseDetails?.title || `Course_${courseId}`;
        let directLinksTxt = `# ==============================================================================
# Built by t.me/devnaitikanonymous
# Official Updates: t.me/learn_topper
# ==============================================================================
# BATCH CONTENT: ${courseTitle}\n# Course ID: ${courseId}\n\n`;
        allFilesList.forEach((file) => {
          const target = file.streamUrl || file.pdfUrl || '';
          if (target) {
            directLinksTxt += `[${file.type.toUpperCase()}] ${file.title}: ${target}\nFolder: ${file.path}\n\n`;
          }
        });

        const finalResult = {
          courseId,
          courseDetails,
          extractedAt: new Date().toISOString(),
          stats: {
            totalFolders: totalFoldersCount,
            totalFiles: totalFilesCount,
            totalVideos: totalVideosCount,
            totalNotes: totalNotesCount,
            totalDpps: totalDppsCount,
            totalTests: totalTestsCount,
            totalLinks: totalLinksCount,
            totalDurationFormatted: formatDuration(totalDurationSeconds),
            totalDurationSeconds,
          },
          rootFolders: treeNodes,
          allFiles: allFilesList,
          txtReport: botFormatTxt,
          botFormatTxt,
          directLinksTxt,
          rawUrlsTxt: allFilesList.map((f) => f.streamUrl || f.pdfUrl).filter(Boolean).join('\n'),
          m3uPlaylist: `#EXTM3U\n# Course: ${courseTitle}\n`,
        };

        await sendEvent('complete', finalResult);
      } catch (err: any) {
        await sendEvent('error', { message: err.message || 'Unknown extraction error occurred' });
      } finally {
        await writer.close();
      }
    };

    // Keep Cloudflare worker alive while task completes
    context.waitUntil(crawlTask());

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
    });
  }

  // 404 for other API routes
  return new Response(JSON.stringify({ error: `Route not found: ${pathname}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
};
