import type { EventContext } from '@cloudflare/workers-types';
import {
  generateSWTxt,
  generateSWM3U,
  generateSWBash,
  generateSWPowerShell,
} from '../../src/services/swGenerators';

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

  // SW (Selection Way) Endpoints
  const SW_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: 'application/json',
  };

  if (pathname === '/api/sw/courses' && request.method === 'GET') {
    try {
      const res = await fetch('https://backend.multistreaming.site/api/courses', {
        headers: SW_HEADERS,
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch SW courses' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  if (pathname.startsWith('/api/sw/courses/') && pathname.endsWith('/classes') && request.method === 'GET') {
    try {
      const parts = pathname.split('/');
      const courseId = parts[parts.length - 2];
      const res = await fetch(
        `https://backend.multistreaming.site/api/courses/${encodeURIComponent(courseId)}/classes?populate=full`,
        {
          headers: SW_HEADERS,
        }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch SW course classes' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 6. GET /api/extract/stream (Edge Server-Sent Events via ReadableStream)
  if (pathname === '/api/extract/stream' && request.method === 'GET') {
    const courseId = url.searchParams.get('courseId')?.trim();
    const platform = (url.searchParams.get('platform') || 'NT').toUpperCase();
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
        if (platform === 'SW') {
          await sendEvent('status', {
            message: `Connecting to Selection Way API for Course ID #${courseId}...`,
          });

          const swApiUrl = `https://backend.multistreaming.site/api/courses/${encodeURIComponent(
            courseId
          )}/classes?populate=full`;
          const swRes = await fetch(swApiUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
          });

          if (!swRes.ok) {
            throw new Error(`Failed to fetch Selection Way course classes: HTTP ${swRes.status}`);
          }

          const swJson: any = await swRes.json();
          const swData = swJson.data || swJson;
          const courseInfo = swData.course || {};
          const topics = swData.classes || [];
          const courseTitle = courseInfo.title || `SW Course #${courseId}`;

          await sendEvent('status', {
            message: `Found: "${courseTitle}" with ${topics.length} topics. Parsing classes...`,
          });

          const courseDetails = {
            course_id: String(courseId),
            title: courseTitle,
            description: Array.isArray(courseInfo.description)
              ? courseInfo.description.join(' • ')
              : courseInfo.description || '',
            thumbnail: courseInfo.bannerSquare || courseInfo.banner || '',
            banner_image: courseInfo.banner || '',
            image: courseInfo.banner || '',
            price: courseInfo.price ? String(courseInfo.price) : undefined,
            offer_price: courseInfo.discountPrice ? String(courseInfo.discountPrice) : undefined,
          };

          let totalFoldersCount = topics.length;
          let totalFilesCount = 0;
          let totalVideosCount = 0;
          let totalNotesCount = 0;
          let totalDppsCount = 0;
          let totalTestsCount = 0;
          let totalLinksCount = 0;
          let totalDurationSeconds = 0;

          const allFilesList: any[] = [];
          const treeNodes: any[] = [];

          topics.forEach((topic: any, topicIndex: number) => {
            const topicName = (topic.topicName || `Topic ${topicIndex + 1}`).trim();
            const topicId = topic.topicId || `topic_${topicIndex + 1}`;
            const topicFiles: any[] = [];

            const classesList: any[] = topic.classes || [];
            classesList.forEach((cls: any, classIndex: number) => {
              const classId = cls._id || cls.classId || `cls_${topicIndex}_${classIndex}`;
              const classTitle = (cls.title || `Class ${classIndex + 1}`).trim();
              const teacher = cls.teacherName ? ` (${cls.teacherName})` : '';
              const fullVideoTitle = `${classTitle}${teacher}`;

              const rawDuration =
                typeof cls.duration === 'number' ? cls.duration : parseFloat(cls.duration || '0');
              const durationSeconds = !isNaN(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : 0;
              totalDurationSeconds += durationSeconds;

              const streamUrl = cls.class_link || '';
              const downloadUrls = Array.isArray(cls.mp4Recordings)
                ? cls.mp4Recordings
                    .filter((r: any) => r && r.url)
                    .map((r: any) => ({
                      quality: r.quality || r.title || 'Standard',
                      url: r.url,
                    }))
                : [];

              // 1. Video file item
              if (streamUrl || cls.isLive !== undefined || cls.isRecorded !== undefined) {
                totalFilesCount++;
                totalVideosCount++;
                const videoItem = {
                  id: String(classId),
                  title: fullVideoTitle,
                  className: classTitle,
                  type: 'video',
                  rawFileType: 2,
                  duration: formatDuration(durationSeconds),
                  durationSeconds,
                  streamUrl,
                  downloadUrls,
                  path: topicName,
                };
                topicFiles.push(videoItem);
                allFilesList.push(videoItem);
              }

              // 2. Class PDFs (Notes / DPPs)
              if (Array.isArray(cls.classPdf)) {
                cls.classPdf.forEach((pdf: any, pIdx: number) => {
                  if (!pdf || !pdf.url) return;
                  totalFilesCount++;
                  const pdfName = (pdf.name || `${classTitle} PDF ${pIdx + 1}`).trim();
                  const isDpp =
                    pdfName.toLowerCase().includes('dpp') ||
                    pdfName.toLowerCase().includes('sheet') ||
                    pdfName.toLowerCase().includes('worksheet') ||
                    pdfName.toLowerCase().includes('assignment');

                  if (isDpp) totalDppsCount++;
                  else totalNotesCount++;

                  const pdfItem = {
                    id: `${classId}_pdf_${pIdx}`,
                    title: pdfName,
                    className: classTitle,
                    type: isDpp ? 'dpp' : 'notes',
                    rawFileType: 1,
                    pdfUrl: pdf.url,
                    streamUrl: pdf.url,
                    path: topicName,
                  };
                  topicFiles.push(pdfItem);
                  allFilesList.push(pdfItem);
                });
              }

              // 3. Class Tests
              if (Array.isArray(cls.classTest)) {
                cls.classTest.forEach((test: any, tIdx: number) => {
                  if (!test) return;
                  const testUrl = test.url || test.link || '';
                  if (!testUrl && !test.name) return;
                  totalFilesCount++;
                  totalTestsCount++;
                  const testName = (test.name || `${classTitle} Test ${tIdx + 1}`).trim();

                  const testItem = {
                    id: `${classId}_test_${tIdx}`,
                    title: testName,
                    className: classTitle,
                    type: 'test',
                    pdfUrl: testUrl,
                    streamUrl: testUrl,
                    path: topicName,
                  };
                  topicFiles.push(testItem);
                  allFilesList.push(testItem);
                });
              }
            });

            treeNodes.push({
              id: String(topicId),
              title: topicName,
              path: [],
              folders: [],
              files: topicFiles,
            });
          });

          const stats = {
            totalFolders: totalFoldersCount,
            totalFiles: totalFilesCount,
            totalVideos: totalVideosCount,
            totalNotes: totalNotesCount,
            totalDpps: totalDppsCount,
            totalTests: totalTestsCount,
            totalLinks: totalLinksCount,
            totalDurationFormatted: formatDuration(totalDurationSeconds),
            totalDurationSeconds,
          };

          const courseDataForSW = {
            course: {
              id: courseId,
              title: courseTitle,
              isLive: courseInfo.isLive,
              ...courseInfo,
            },
            classes: topics,
          };

          const txtReport = generateSWTxt(courseDataForSW);
          const m3uPlaylist = generateSWM3U(courseDataForSW, { streamType: 'hls' });
          const bashScript = generateSWBash(courseDataForSW, { preferredQuality: '720p' });
          const powerShellScript = generateSWPowerShell(courseDataForSW, { preferredQuality: '720p' });

          // Bot Format TXT
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

          let directLinksTxt = `# BATCH CONTENT: ${courseTitle}\n# Course ID: ${courseId}\n\n`;
          allFilesList.forEach((file) => {
            const target = file.streamUrl || file.pdfUrl || '';
            if (target) {
              directLinksTxt += `[${file.type.toUpperCase()}] ${file.title}: ${target}\nFolder: ${file.path}\n\n`;
            }
          });

          const finalResult = {
            platform: 'SW',
            courseId,
            courseDetails,
            extractedAt: new Date().toISOString(),
            stats,
            rootFolders: treeNodes,
            allFiles: allFilesList,
            txtReport,
            botFormatTxt,
            directLinksTxt,
            rawUrlsTxt: allFilesList.map((f) => f.streamUrl || f.pdfUrl).filter(Boolean).join('\n'),
            m3uPlaylist,
            bashScript,
            powerShellScript,
            rawSWData: swData,
          };

          await sendEvent('complete', finalResult);
          return;
        }

        // Platform: NT (NextToppers)
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

        let remainingSubrequests = 45;

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
          if (remainingSubrequests > 2) {
            remainingSubrequests--;
            try {
              const folderRes = await fetch(`${remoteBase}/content/folder`, {
                method: 'POST',
                headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId, folderId: String(folderId) }),
                signal: AbortSignal.timeout(6000),
              });
              if (folderRes.ok) {
                const folderJson: any = await folderRes.json();
                items = folderJson.data || [];
              }
            } catch (err: any) {
              await sendEvent('log', { message: `Warning: Failed folder "${folderTitle}": ${err.message}` });
            }
          } else {
            await sendEvent('log', { message: `Subrequest budget reached for folder "${folderTitle}" on Edge Worker.` });
          }

          const folderItems: any[] = [];
          const files: any[] = [];

          for (const item of items) {
            const isFolder = item.type === 'folder' || item.is_folder || item.item_type === 'folder';
            const entityId = item.entity_id || item.data?.id || item.id;
            const itemTitle = item.title || item.data?.title || item.name || 'Untitled';

            if (isFolder) {
              folderItems.push(item);
            } else {
              totalFilesCount++;
              const fileData = item.data || item;
              const fid = item.entity_id || fileData.id || item.id || `file_${totalFilesCount}`;
              const fullPath = pathStr;
              const fileType = classifyFile(itemTitle, fullPath, fileData);

              if (fileType === 'video') totalVideosCount++;
              else if (fileType === 'notes') totalNotesCount++;
              else if (fileType === 'dpp') totalDppsCount++;
              else if (fileType === 'test') totalTestsCount++;
              else totalLinksCount++;

              let rawUrl = fileData.file_url || fileData.stream_url || item.stream_url || '';
              // For NT videos: strictly only .m3u8 direct stream URLs, never download links
              let streamUrl = (fileType === 'video')
                ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') ? rawUrl : '')
                : (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '');
              let pdfUrl = (fileType === 'notes' || fileType === 'dpp' || fileType === 'test')
                ? (fileData.file_url || fileData.pdf_url || '')
                : (fileData.pdf_url || item.pdf_url || item.document_url || '');

              const dynamicLink = fileData.dynamic_link || '';
              // If test, populate stream/pdf with dynamic test link if not already set
              if (fileType === 'test' && dynamicLink) {
                if (!streamUrl) streamUrl = dynamicLink;
                if (!pdfUrl) pdfUrl = dynamicLink;
              }

              const rawDuration = fileData.duration || item.duration;
              let durationSec = 0;
              if (rawDuration) {
                const s = typeof rawDuration === 'string' ? parseInt(rawDuration, 10) : rawDuration;
                if (!isNaN(s) && s > 0) {
                  durationSec = s;
                  totalDurationSeconds += s;
                }
              }

              const fileObj = {
                id: String(fid),
                title: itemTitle,
                className: itemTitle,
                type: fileType,
                rawFileType: fileData.file_type || item.file_type,
                streamUrl,
                pdfUrl,
                downloadUrls: [],
                duration: formatDuration(durationSec),
                durationSeconds: durationSec,
                shareUrl: dynamicLink,
                isLocked: Boolean(fileData.is_locked),
                isDrm: Boolean(fileData.is_drm),
                path: fullPath,
              };

              // Probe video-details for video direct .m3u8 stream URLs and document links
              if (deepFileDetails && (!streamUrl || fileType === 'video' || (fileType === 'notes' && !pdfUrl) || (fileType === 'dpp' && !pdfUrl))) {
                filesNeedingDetails.push({ fileObj, itemId: fid });
              }

              files.push(fileObj);
              allFilesList.push(fileObj);
            }
          }

          const subFolders = await Promise.all(
            folderItems.map((sub) =>
              crawlFolder(
                sub.entity_id || sub.data?.id || sub.id,
                sub.title || sub.data?.title || sub.name || 'Untitled Folder',
                currentPathArr
              )
            )
          );

          return {
            id: String(folderId),
            title: folderTitle,
            path: parentPath,
            folders: subFolders,
            files,
          };
        }

        const rootFolderItems = rootItems.filter((i: any) => i.type === 'folder' || i.is_folder || i.item_type === 'folder');
        const rootFileItems = rootItems.filter((i: any) => !(i.type === 'folder' || i.is_folder || i.item_type === 'folder'));

        for (const item of rootFileItems) {
          totalFilesCount++;
          const fileData = item.data || item;
          const fid = item.entity_id || fileData.id || item.id || `file_${totalFilesCount}`;
          const itemTitle = item.title || item.data?.title || item.name || 'Root File';
          const fileType = classifyFile(itemTitle, 'Root', fileData);

          if (fileType === 'video') totalVideosCount++;
          else if (fileType === 'notes') totalNotesCount++;
          else if (fileType === 'dpp') totalDppsCount++;
          else if (fileType === 'test') totalTestsCount++;
          else totalLinksCount++;

          let rawUrl = fileData.file_url || fileData.stream_url || item.stream_url || '';
          // For NT videos: strictly only .m3u8 direct stream URLs, never download links
          let streamUrl = (fileType === 'video')
            ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') ? rawUrl : '')
            : (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '');
          let pdfUrl = (fileType === 'notes' || fileType === 'dpp' || fileType === 'test')
            ? (fileData.file_url || fileData.pdf_url || '')
            : (fileData.pdf_url || item.pdf_url || item.document_url || '');

          const rawDuration = fileData.duration || item.duration;
          let durationSec = 0;
          if (rawDuration) {
            const s = typeof rawDuration === 'string' ? parseInt(rawDuration, 10) : rawDuration;
            if (!isNaN(s) && s > 0) {
              durationSec = s;
              totalDurationSeconds += s;
            }
          }

          const fileObj = {
            id: String(fid),
            title: itemTitle,
            className: itemTitle,
            type: fileType,
            rawFileType: fileData.file_type || item.file_type,
            streamUrl,
            pdfUrl,
            downloadUrls: [],
            duration: formatDuration(durationSec),
            durationSeconds: durationSec,
            shareUrl: fileData.dynamic_link || '',
            isLocked: Boolean(fileData.is_locked),
            isDrm: Boolean(fileData.is_drm),
            path: 'Root',
          };

          if (deepFileDetails) {
            if (fileType === 'video' && (!fileObj.streamUrl || !fileObj.streamUrl.includes('.m3u8'))) {
              filesNeedingDetails.push({ fileObj, itemId: fid });
            } else if ((fileType === 'notes' || fileType === 'dpp' || fileType === 'test') && !fileObj.pdfUrl) {
              filesNeedingDetails.push({ fileObj, itemId: fid });
            }
          }

          allFilesList.push(fileObj);
        }

        const treeNodes = await Promise.all(
          rootFolderItems.map((item: any) =>
            crawlFolder(
              item.entity_id || item.data?.id || item.id,
              item.title || item.data?.title || item.name || 'Root Folder',
              []
            )
          )
        );

        // Deep file details (strictly budgeted to prevent Cloudflare subrequest crashes)
        if (deepFileDetails && filesNeedingDetails.length > 0 && remainingSubrequests > 2) {
          const maxProbes = Math.min(filesNeedingDetails.length, remainingSubrequests - 2);
          const toProbe = filesNeedingDetails.slice(0, maxProbes);

          await sendEvent('status', {
            message: `Resolving direct .m3u8 stream URLs & links for ${toProbe.length} items...`,
          });

          const CONCURRENCY = 20;
          for (let i = 0; i < toProbe.length; i += CONCURRENCY) {
            const chunk = toProbe.slice(i, i + CONCURRENCY);
            await Promise.all(
              chunk.map(async ({ fileObj, itemId }) => {
                remainingSubrequests--;
                try {
                  const vdRes = await fetch(`${remoteBase}/video-details`, {
                    method: 'POST',
                    headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId, contentId: String(itemId) }),
                    signal: AbortSignal.timeout(6000),
                  });
                  if (vdRes.ok) {
                    const vdJson: any = await vdRes.json();
                    const vdData = vdJson.data || vdJson || {};
                    if (vdData.file_url) {
                      if (fileObj.type === 'video') {
                        // In NT, video links must strictly be direct .m3u8 stream URLs only! Never download links!
                        if (vdData.file_url.includes('.m3u8') && !vdData.file_url.includes('/download/')) {
                          fileObj.streamUrl = vdData.file_url;
                        }
                      } else {
                        fileObj.pdfUrl = vdData.file_url;
                        fileObj.streamUrl = vdData.file_url;
                      }
                    }
                    if (vdData.dynamic_link) {
                      fileObj.shareUrl = vdData.dynamic_link;
                    }
                    if (vdData.duration && (!fileObj.durationSeconds || fileObj.durationSeconds === 0)) {
                      const dNum = parseInt(String(vdData.duration), 10);
                      if (!isNaN(dNum) && dNum > 0) {
                        fileObj.durationSeconds = dNum;
                        fileObj.duration = formatDuration(dNum);
                        totalDurationSeconds += dNum;
                      }
                    }
                  }
                } catch {
                  // ignore single item failure
                }
              })
            );

            if (i % 12 === 0 || i + CONCURRENCY >= toProbe.length) {
              await sendEvent('progress', {
                folder: `Resolved details: ${Math.min(i + CONCURRENCY, toProbe.length)} / ${toProbe.length}`,
                totalFolders: totalFoldersCount,
                totalFiles: totalFilesCount,
              });
            }
          }
        }

        await sendEvent('status', { message: 'Compiling structured bot-format and direct links TXT reports...' });

        const dateNow = new Date().toISOString();
        const courseTitle = courseDetails?.title || `Course_${courseId}`;

        // Group files by type
        const videoFiles = allFilesList.filter((f) => f.type === 'video');
        const noteFiles = allFilesList.filter((f) => f.type === 'notes');
        const dppFiles = allFilesList.filter((f) => f.type === 'dpp');
        const testAndOtherFiles = allFilesList.filter((f) => f.type === 'test' || f.type === 'other');

        const watermarkHeader = `# ==============================================================================
# Built by t.me/devnaitikanonymous
# Official Updates: t.me/learn_topper
# ==============================================================================

`;

        // 1. Direct Links TXT formatted with Named Classes, Stream URL ONLY, Notes, DPPs
        let directLinksTxt = watermarkHeader;
        directLinksTxt += `# ==============================================================================\n`;
        directLinksTxt += `# BATCH CONTENT & STREAM LINKS: ${courseTitle}\n`;
        directLinksTxt += `# Course ID: ${courseId} | Generated on: ${dateNow}\n`;
        directLinksTxt += `# Summary: ${videoFiles.length} Classes/Videos | ${noteFiles.length} Class Notes | ${dppFiles.length} DPPs | ${testAndOtherFiles.length} Tests\n`;
        directLinksTxt += `# ==============================================================================\n\n`;

        // Section 1: Classes & Video Lectures (Stream Only)
        directLinksTxt += `# ==============================================================================\n`;
        directLinksTxt += `# 1. CLASSES & VIDEO LECTURES (STREAM ONLY)\n`;
        directLinksTxt += `# ==============================================================================\n\n`;

        if (videoFiles.length === 0) {
          directLinksTxt += `# No video lectures found in this batch.\n\n`;
        } else {
          videoFiles.forEach((file) => {
            const durationStr = file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';
            directLinksTxt += `[VIDEO] ${file.title}  (id: ${file.id})${durationStr}: ${file.streamUrl || 'N/A'}\n`;
            directLinksTxt += `Folder: ${file.path}\n\n`;
            directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
          });
        }

        // Section 2: Class Notes (PDFs)
        directLinksTxt += `\n# ==============================================================================\n`;
        directLinksTxt += `# 2. CLASS NOTES / LECTURE NOTES (PDF)\n`;
        directLinksTxt += `# ==============================================================================\n\n`;

        if (noteFiles.length === 0) {
          directLinksTxt += `# No class notes found in this batch.\n\n`;
        } else {
          noteFiles.forEach((file) => {
            const pdfLink = file.pdfUrl || file.streamUrl;
            directLinksTxt += `[PDF] ${file.title}  (id: ${file.id}): ${pdfLink || 'N/A'}\n`;
            directLinksTxt += `Folder: ${file.path}\n\n`;
            directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
          });
        }

        // Section 3: DPPs & Practice Sheets (PDFs)
        directLinksTxt += `\n# ==============================================================================\n`;
        directLinksTxt += `# 3. DPPS & PRACTICE SHEETS (PDF)\n`;
        directLinksTxt += `# ==============================================================================\n\n`;

        if (dppFiles.length === 0) {
          directLinksTxt += `# No DPPs or practice sheets found in this batch.\n\n`;
        } else {
          dppFiles.forEach((file) => {
            const pdfLink = file.pdfUrl || file.streamUrl;
            directLinksTxt += `[PDF] DPP - ${file.title}  (id: ${file.id}): ${pdfLink || 'N/A'}\n`;
            directLinksTxt += `Subject: ${file.path}\n\n`;
            directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
          });
        }

        // Section 4: Tests & Study Materials
        if (testAndOtherFiles.length > 0) {
          directLinksTxt += `\n# ==============================================================================\n`;
          directLinksTxt += `# 4. TESTS & STUDY MATERIALS\n`;
          directLinksTxt += `# ==============================================================================\n\n`;

          testAndOtherFiles.forEach((file) => {
            const link = file.pdfUrl || file.streamUrl;
            directLinksTxt += `[PDF] Test - ${file.title}  (id: ${file.id}): ${link || 'N/A'}\n`;
            directLinksTxt += `Folder: ${file.path}\n\n`;
            directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
          });
        }

        // 2. Generate Bot Format TXT
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

        // 3. Raw URLs
        let rawUrlsTxt = `# ==============================================================================\n# Built by t.me/devnaitikanonymous\n# Official Updates: t.me/learn_topper\n# ==============================================================================\n# Stream URLs & Content Links for Course: ${courseTitle} (ID: ${courseId})\n# Generated on: ${dateNow}\n\n`;
        rawUrlsTxt += `# --- STREAM VIDEOS (.M3U8) ---\n`;
        videoFiles.forEach((v) => {
          if (v.streamUrl) rawUrlsTxt += `${v.streamUrl}\n`;
        });
        rawUrlsTxt += `\n# --- CLASS NOTES ---\n`;
        noteFiles.forEach((p) => {
          const link = p.pdfUrl || p.streamUrl;
          if (link) rawUrlsTxt += `${link}\n`;
        });
        rawUrlsTxt += `\n# --- DPPS & PRACTICE SHEETS ---\n`;
        dppFiles.forEach((d) => {
          const link = d.pdfUrl || d.streamUrl;
          if (link) rawUrlsTxt += `${link}\n`;
        });

        // 4. M3U Playlist
        let m3u = `#EXTM3U\n# Course: ${courseTitle} (ID: ${courseId})\n\n`;
        videoFiles
          .filter((f) => f.streamUrl)
          .forEach((v) => {
            m3u += `#EXTINF:-1 group-title="${v.path.replace(/"/g, '')}",Class: ${v.title.replace(/,/g, ' ')}\n${v.streamUrl}\n`;
          });

        const finalResult = {
          platform: 'NT',
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
          txtReport: directLinksTxt,
          botFormatTxt,
          directLinksTxt,
          rawUrlsTxt,
          m3uPlaylist: m3u,
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
