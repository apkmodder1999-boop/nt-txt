import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  generateSWTxt,
  generateSWM3U,
  generateSWBash,
  generateSWPowerShell,
} from './src/services/swGenerators';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const SERVICE_BASE_URL =
  process.env.REMOTE_SERVICE_URL || 'https://learnjh_api.learnjhapi.workers.dev/api/nexttoppers';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://learnjh.vercel.app/',
  'Origin': 'https://learnjh.vercel.app',
};

// 1. All Batches
app.get('/api/batches', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${SERVICE_BASE_URL}/batches`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch batches' });
  }
});

// 2. Course Details
app.post('/api/course-details', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }
    const response = await fetch(`${SERVICE_BASE_URL}/course-details`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: String(courseId) }),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching course-details:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch course details' });
  }
});

// 3. Batch Content
app.post('/api/content', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }
    const response = await fetch(`${SERVICE_BASE_URL}/content`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: String(courseId) }),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch batch content' });
  }
});

// 4. Folder Content
app.post('/api/folder', async (req: Request, res: Response) => {
  try {
    const { courseId, folderId } = req.body;
    if (!courseId || folderId === undefined) {
      return res.status(400).json({ error: 'courseId and folderId are required' });
    }
    const response = await fetch(`${SERVICE_BASE_URL}/content/folder`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: String(courseId), folderId: String(folderId) }),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch folder content' });
  }
});

// 5. Video / PDF Details
app.post('/api/video-details', async (req: Request, res: Response) => {
  try {
    const { courseId, contentId } = req.body;
    if (!courseId || !contentId) {
      return res.status(400).json({ error: 'courseId and contentId are required' });
    }
    const response = await fetch(`${SERVICE_BASE_URL}/video-details`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: String(courseId), contentId: String(contentId) }),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching video-details:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video/content details' });
  }
});

// SW (Selection Way) API Endpoints
app.get('/api/sw/courses', async (req: Request, res: Response) => {
  try {
    const response = await fetch('https://backend.multistreaming.site/api/courses', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `SW API error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching SW courses:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch SW courses' });
  }
});

app.get('/api/sw/courses/:courseId/classes', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const response = await fetch(
      `https://backend.multistreaming.site/api/courses/${encodeURIComponent(courseId)}/classes?populate=full`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': DEFAULT_HEADERS['User-Agent'],
        },
      }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `SW API error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching SW classes:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch SW course classes' });
  }
});

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
      // not json
    }
  }
  return [];
}

function classifyFile(itemTitle: string, folderPath: string, fileData: any): 'video' | 'notes' | 'dpp' | 'test' | 'other' {
  const t = (itemTitle || '').toLowerCase();
  const pathStr = (folderPath || '').toLowerCase();
  const rawType = fileData?.file_type;
  const contentType = fileData?.content_type;

  if (rawType === 2 || contentType === 2 || (fileData?.video_type && fileData.video_type > 0)) {
    return 'video';
  }

  // Check if DPP or Practice Sheet
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

  // Check if Class Notes
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

// 6. Deep Batch Extraction with SSE Stream
app.get('/api/extract/stream', async (req: Request, res: Response) => {
  const courseId = String(req.query.courseId || '').trim();
  const platform = String(req.query.platform || 'NT').trim().toUpperCase();
  const deepFileDetails = req.query.deepDetails !== 'false';

  if (!courseId) {
    return res.status(400).send('courseId is required');
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (type: string, payload: any) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`, 'utf-8');
  };

  try {
    let courseDetails: any = null;
    let totalFoldersCount = 0;
    let totalFilesCount = 0;
    let totalVideosCount = 0;
    let totalNotesCount = 0;
    let totalDppsCount = 0;
    let totalTestsCount = 0;
    let totalLinksCount = 0;
    let totalDurationSeconds = 0;

    const allFilesList: any[] = [];
    const treeNodes: any[] = [];

    let rawSWData: any = null;

    if (platform === 'SW') {
      sendEvent('status', { message: `Connecting to SW API for Course ID #${courseId}...` });
      const swRes = await fetch(
        `https://backend.multistreaming.site/api/courses/${encodeURIComponent(courseId)}/classes?populate=full`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': DEFAULT_HEADERS['User-Agent'],
          },
        }
      );

      if (!swRes.ok) {
        throw new Error(`Failed to fetch SW course classes: HTTP ${swRes.status}`);
      }

      const swJson = await swRes.json();
      const swData = swJson.data || swJson;
      rawSWData = swData;
      const courseInfo = swData.course || {};
      const courseTitle = courseInfo.title || `SW Course #${courseId}`;
      const topics: any[] = swData.classes || [];

      courseDetails = {
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

      sendEvent('status', {
        message: `Course loaded: ${courseTitle}`,
        courseDetails,
      });

      topics.forEach((topic: any, topicIndex: number) => {
        totalFoldersCount++;
        const topicName = (topic.topicName || `Topic ${topicIndex + 1}`).trim();
        const topicId = topic.topicId || `topic_${topicIndex + 1}`;
        const topicFiles: any[] = [];

        sendEvent('progress', {
          folder: topicName,
          totalFolders: totalFoldersCount,
          totalFiles: totalFilesCount,
        });

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
    } else {
      sendEvent('status', { message: `Connecting to batch API for Course ID #${courseId}...` });

      // Step 1: Course Details
    try {
      const cdRes = await fetch(`${SERVICE_BASE_URL}/course-details`, {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      if (cdRes.ok) {
        const cdJson = await cdRes.json();
        courseDetails = cdJson.data || cdJson;
      }
    } catch (e: any) {
      sendEvent('log', { message: `Warning: Course details fetch failed: ${e.message}` });
    }

    sendEvent('status', {
      message: `Course loaded: ${courseDetails?.title || 'Course #' + courseId}`,
      courseDetails,
    });

    // Step 2: Fetch Root Content
    sendEvent('status', { message: 'Fetching root content categories...' });
    const contentRes = await fetch(`${SERVICE_BASE_URL}/content`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });

    if (!contentRes.ok) {
      throw new Error(`Failed to fetch course content: HTTP ${contentRes.status}`);
    }

    const contentJson = await contentRes.json();
    const rootItems = contentJson.data || [];

    sendEvent('log', { message: `Found ${rootItems.length} root section(s). Traversing folder tree...` });

    // Use outer scoped variables (do not redeclare!)
    const filesNeedingDetails: any[] = [];

    // Fast parallel recursive folder crawler
    async function crawlFolder(folderId: string | number, folderTitle: string, currentPath: string[]): Promise<any> {
      totalFoldersCount++;
      const folderPathStr = [...currentPath, folderTitle].join(' / ');
      sendEvent('progress', {
        folder: folderPathStr,
        totalFolders: totalFoldersCount,
        totalFiles: totalFilesCount,
      });

      let items: any[] = [];
      try {
        const folderRes = await fetch(`${SERVICE_BASE_URL}/content/folder`, {
          method: 'POST',
          headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, folderId: String(folderId) }),
        });

        if (folderRes.ok) {
          const folderJson = await folderRes.json();
          items = folderJson.data || [];
        }
      } catch (err: any) {
        sendEvent('log', { message: `Error fetching folder "${folderTitle}": ${err.message}` });
        return {
          id: String(folderId),
          title: folderTitle,
          path: currentPath,
          folders: [],
          files: [],
        };
      }

      const filesInFolder: any[] = [];
      const folderItems: any[] = [];

      for (const item of items) {
        if (item.type === 'folder') {
          folderItems.push(item);
        } else {
          totalFilesCount++;
          const fileData = item.data || {};
          const entityId = item.entity_id || fileData.id;
          const rawFileType = fileData.file_type;
          const fullPath = [...currentPath, folderTitle].join(' / ');
          const category = classifyFile(item.title || fileData.title, fullPath, fileData);

          if (category === 'video') totalVideosCount++;
          else if (category === 'notes') totalNotesCount++;
          else if (category === 'dpp') totalDppsCount++;
          else if (category === 'test') totalTestsCount++;
          else totalLinksCount++;

          const rawUrl = fileData.file_url || '';
          // For NT videos: strictly only .m3u8 direct stream URLs, never download links
          const streamUrl = (category === 'video')
            ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') ? rawUrl : '')
            : (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '');
          const pdfUrl = (category === 'notes' || category === 'dpp' || category === 'test')
            ? (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '')
            : '';
          const duration = fileData.duration || 0;
          if (typeof duration === 'number') {
            totalDurationSeconds += duration;
          }

          const fileEntry = {
            id: String(entityId),
            title: item.title || fileData.title || 'Untitled',
            className: item.title || fileData.title || 'Untitled',
            type: category,
            rawFileType,
            duration: formatDuration(duration),
            durationSeconds: duration,
            streamUrl,
            pdfUrl,
            downloadUrls: [],
            shareUrl: fileData.dynamic_link || '',
            isLocked: Boolean(fileData.is_locked),
            isDrm: Boolean(fileData.is_drm),
            path: fullPath,
          };

          filesInFolder.push(fileEntry);
          allFilesList.push(fileEntry);

          // Only queue items that actually lack direct .m3u8 stream URLs or PDF links
          if (deepFileDetails) {
            if (category === 'video' && (!fileEntry.streamUrl || !fileEntry.streamUrl.includes('.m3u8'))) {
              filesNeedingDetails.push(fileEntry);
            } else if ((category === 'notes' || category === 'dpp' || category === 'test') && !fileEntry.pdfUrl) {
              filesNeedingDetails.push(fileEntry);
            }
          }
        }
      }

      // Crawl child folders concurrently
      const subFolders = await Promise.all(
        folderItems.map((sub) =>
          crawlFolder(
            sub.entity_id || sub.data?.id,
            sub.title || sub.data?.title || 'Untitled Folder',
            [...currentPath, folderTitle]
          )
        )
      );

      return {
        id: String(folderId),
        title: folderTitle,
        path: currentPath,
        folders: subFolders,
        files: filesInFolder,
      };
    }

    const rootFolderItems = rootItems.filter((i: any) => i.type === 'folder');
    const rootFileItems = rootItems.filter((i: any) => i.type !== 'folder');

    for (const rootItem of rootFileItems) {
      totalFilesCount++;
      const fileData = rootItem.data || {};
      const entityId = rootItem.entity_id || fileData.id;
      const rawFileType = fileData.file_type;
      const category = classifyFile(rootItem.title || fileData.title, '/', fileData);

      if (category === 'video') totalVideosCount++;
      else if (category === 'notes') totalNotesCount++;
      else if (category === 'dpp') totalDppsCount++;
      else if (category === 'test') totalTestsCount++;
      else totalLinksCount++;

      const rawUrl = fileData.file_url || '';
      // For NT videos: strictly only .m3u8 direct stream URLs, never download links
      const streamUrl = (category === 'video')
        ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') ? rawUrl : '')
        : (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '');
      const pdfUrl = (category === 'notes' || category === 'dpp' || category === 'test')
        ? (rawUrl && !rawUrl.includes('/download/') ? rawUrl : '')
        : '';
      const duration = fileData.duration || 0;
      if (typeof duration === 'number') totalDurationSeconds += duration;

      const fileEntry = {
        id: String(entityId),
        title: rootItem.title || fileData.title || 'Untitled',
        className: rootItem.title || fileData.title || 'Untitled',
        type: category,
        rawFileType,
        duration: formatDuration(duration),
        durationSeconds: duration,
        streamUrl,
        pdfUrl,
        downloadUrls: [],
        shareUrl: fileData.dynamic_link || '',
        isLocked: Boolean(fileData.is_locked),
        isDrm: Boolean(fileData.is_drm),
        path: '/',
      };
      allFilesList.push(fileEntry);

      if (deepFileDetails) {
        if (category === 'video' && (!fileEntry.streamUrl || !fileEntry.streamUrl.includes('.m3u8'))) {
          filesNeedingDetails.push(fileEntry);
        } else if ((category === 'notes' || category === 'dpp' || category === 'test') && !fileEntry.pdfUrl) {
          filesNeedingDetails.push(fileEntry);
        }
      }
    }

    // Crawl all root folders in parallel
    const crawledRoots = await Promise.all(
      rootFolderItems.map((rootItem: any) =>
        crawlFolder(
          rootItem.entity_id || rootItem.data?.id,
          rootItem.title || rootItem.data?.title || 'Root Folder',
          []
        )
      )
    );
    treeNodes.push(...crawledRoots);

    // Step 3: Fast concurrent probe of video-details to resolve exact .m3u8 Stream URLs & PDF links
    if (deepFileDetails && filesNeedingDetails.length > 0) {
      sendEvent('status', {
        message: `Resolving direct .m3u8 stream URLs & document links for ${filesNeedingDetails.length} items...`,
      });

      const CONCURRENCY = 40;
      for (let i = 0; i < filesNeedingDetails.length; i += CONCURRENCY) {
        const chunk = filesNeedingDetails.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (fileItem) => {
            try {
              const vdRes = await fetch(`${SERVICE_BASE_URL}/video-details`, {
                method: 'POST',
                headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId, contentId: String(fileItem.id) }),
                signal: AbortSignal.timeout(4000),
              });
              if (vdRes.ok) {
                const vdJson = await vdRes.json();
                const vdData = vdJson.data || {};
                if (vdData.file_url) {
                  if (fileItem.type === 'video') {
                    // In NT, video URLs must strictly be direct .m3u8 stream URLs only!
                    if (vdData.file_url.includes('.m3u8') && !vdData.file_url.includes('/download/')) {
                      fileItem.streamUrl = vdData.file_url;
                    }
                  } else {
                    fileItem.pdfUrl = vdData.file_url;
                    fileItem.streamUrl = vdData.file_url;
                  }
                }
                if (vdData.dynamic_link) {
                  fileItem.shareUrl = vdData.dynamic_link;
                } else if (vdData.share_url && !fileItem.shareUrl) {
                  fileItem.shareUrl = vdData.share_url;
                } else if (vdData.link && !fileItem.shareUrl) {
                  fileItem.shareUrl = vdData.link;
                }
                if (vdData.duration && (!fileItem.durationSeconds || fileItem.durationSeconds === 0)) {
                  const dNum = parseInt(String(vdData.duration), 10);
                  if (!isNaN(dNum)) {
                    fileItem.durationSeconds = dNum;
                    fileItem.duration = formatDuration(dNum);
                    totalDurationSeconds += dNum;
                  }
                }
              }
            } catch {
              // ignore single item failure
            }
          })
        );

        sendEvent('progress', {
          folder: `Resolved stream links: ${Math.min(i + CONCURRENCY, filesNeedingDetails.length)} / ${filesNeedingDetails.length}`,
          totalFolders: totalFoldersCount,
          totalFiles: totalFilesCount,
        });
      }
    }
  }

    sendEvent('status', { message: 'Compiling structured TXT reports...' });

    // Step 4: Generate Formatted TXT content with Named Classes, IDs, Stream URLs ONLY, Notes, DPPs & Dynamic Links
    const dateNow = new Date().toISOString();
    const courseTitle = courseDetails?.title || `Batch Course #${courseId}`;
    const cleanDescription = (courseDetails?.description || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();

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

    // --------------------------------------------------------------------------
    // A) DIRECT STREAM & CONTENT LINKS TXT (Named Classes, Stream URL ONLY, Notes & DPPs)
    // --------------------------------------------------------------------------
    let directLinksTxt = watermarkHeader;
    directLinksTxt += `# ==============================================================================\n`;
    directLinksTxt += `# BATCH CONTENT & STREAM LINKS: ${courseTitle}\n`;
    directLinksTxt += `# Course ID: ${courseId} | Generated on: ${dateNow}\n`;
    directLinksTxt += `# Summary: ${videoFiles.length} Classes/Videos | ${noteFiles.length} Class Notes | ${dppFiles.length} DPPs | ${testAndOtherFiles.length} Tests\n`;
    directLinksTxt += `# ==============================================================================\n\n`;

    // 1. Classes & Video Lectures - STREAM URL ONLY
    directLinksTxt += `# ==============================================================================\n`;
    directLinksTxt += `# 1. CLASSES & VIDEO LECTURES (STREAM ONLY)\n`;
    directLinksTxt += `# ==============================================================================\n\n`;

    if (videoFiles.length === 0) {
      directLinksTxt += `# No video lectures found in this batch.\n\n`;
    } else {
      videoFiles.forEach((file) => {
        const durationStr =
          file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';
        directLinksTxt += `[VIDEO] ${file.title}  (id: ${file.id})${durationStr}: ${file.streamUrl || 'N/A'}\n`;
        directLinksTxt += `Folder: ${file.path}\n\n`;
        directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
      });
    }

    // 2. Class Notes (PDFs)
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

    // 3. DPPs & Practice Sheets (PDFs)
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

    // 4. Tests & Study Materials
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

    // --------------------------------------------------------------------------
    // B) RAW URLS ONLY (Stream URLs for Videos, Direct URLs for Notes/DPPs)
    // --------------------------------------------------------------------------
    let rawUrlsTxt = `# ==============================================================================\n# Built by t.me/devnaitikanonymous\n# Official Updates: t.me/learn_topper\n# ==============================================================================\n# Stream URLs & Content Links for Course: ${courseTitle} (ID: ${courseId})\n`;
    rawUrlsTxt += `# Generated on: ${dateNow}\n\n`;
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

    // --------------------------------------------------------------------------
    // C) HIERARCHICAL BATCH COURSE REPORT (Exact layout requested by user)
    // --------------------------------------------------------------------------
    let priceStr = 'Free';
    const offerPrice = courseDetails?.offer_price ?? courseDetails?.price;
    const mrpPrice = courseDetails?.mrp ?? courseDetails?.actual_price;
    if (offerPrice !== undefined && offerPrice !== null && offerPrice !== '') {
      const offerNum = parseFloat(String(offerPrice));
      const offerFormatted = isNaN(offerNum) ? String(offerPrice) : offerNum.toFixed(2);
      let mrpPart = '';
      if (mrpPrice !== undefined && mrpPrice !== null && mrpPrice !== '') {
        const mrpNum = parseFloat(String(mrpPrice));
        const mrpFormatted = isNaN(mrpNum) ? String(mrpPrice) : mrpNum.toFixed(2);
        mrpPart = ` (MRP ${mrpFormatted})`;
      }
      priceStr = `${offerFormatted}${mrpPart}`;
    }

    const thumbnailStr =
      courseDetails?.thumbnail ||
      courseDetails?.preview_image ||
      courseDetails?.image ||
      courseDetails?.banner_image ||
      'N/A';

    let txt = '';
    txt += `======================================================================\n`;
    txt += `Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
    txt += `======================================================================\n`;
    txt += `${courseTitle}\n`;
    txt += `======================================================================\n`;
    txt += `Course ID : ${courseId}\n`;
    txt += `Price     : ${priceStr}\n`;
    txt += `Thumbnail : ${thumbnailStr}\n\n`;
    txt += `Description:\n`;
    txt += `${cleanDescription || 'N/A'}\n\n`;
    txt += `Generated : ${dateNow}\n\n\n`;

    function renderHierarchicalDataTree(node: any, depth: number = 0): string {
      const indent = '  '.repeat(depth);
      let out = `${indent}[FOLDER] ${node.title}  (id: ${node.id})\n\n`;

      // 1. Recurse subfolders
      for (const sub of node.folders || []) {
        out += renderHierarchicalDataTree(sub, depth + 1);
      }

      // 2. Render files in this folder
      if (node.files && node.files.length > 0) {
        const fileIndent = indent + '  ';
        const detailIndent = fileIndent + '    ';

        for (const file of node.files) {
          let tag = '[FILE]';
          if (file.type === 'video') tag = '[LECTURE]';
          else if (file.type === 'notes') tag = '[NOTE]';
          else if (file.type === 'dpp') tag = '[DPP]';
          else if (file.type === 'test') tag = '[TEST]';

          const durationText =
            file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';

          out += `${fileIndent}${tag} ${file.title}  (id: ${file.id})${durationText}\n`;

          if (file.type === 'video') {
            if (file.streamUrl) {
              out += `${detailIndent}Stream: ${file.streamUrl}\n`;
            }
          } else if (file.type === 'notes' || file.type === 'dpp') {
            const docLink = file.pdfUrl || file.streamUrl;
            if (docLink) {
              out += `${detailIndent}Document: ${docLink}\n`;
            }
          } else {
            const link = file.pdfUrl || file.streamUrl;
            if (link) {
              out += `${detailIndent}Document: ${link}\n`;
            }
          }
        }
        out += '\n';
      }

      return out;
    }

    for (const node of treeNodes) {
      txt += renderHierarchicalDataTree(node, 0);
    }

    const rootFiles = allFilesList.filter((f) => f.path === '/' || f.path === '');
    if (rootFiles.length > 0) {
      for (const file of rootFiles) {
        let tag = '[FILE]';
        if (file.type === 'video') tag = '[LECTURE]';
        else if (file.type === 'notes') tag = '[NOTE]';
        else if (file.type === 'dpp') tag = '[DPP]';
        else if (file.type === 'test') tag = '[TEST]';

        const durationText =
          file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';

        txt += `${tag} ${file.title}  (id: ${file.id})${durationText}\n`;
        if (file.type === 'video') {
          if (file.streamUrl) txt += `    Stream: ${file.streamUrl}\n`;
        } else {
          const doc = file.pdfUrl || file.streamUrl;
          if (doc) txt += `    Document: ${doc}\n`;
        }
      }
      txt += '\n';
    }

    // M3U playlist format
    let m3u = `#EXTM3U\n# Course: ${courseTitle} (ID: ${courseId})\n\n`;
    videoFiles
      .filter((f) => f.streamUrl)
      .forEach((v) => {
        m3u += `#EXTINF:-1 group-title="${v.path.replace(/"/g, '')}",Class: ${v.title.replace(/,/g, ' ')}\n${v.streamUrl}\n`;
      });

    // --------------------------------------------------------------------------
    // D) BOT COMPATIBLE FORMAT ([CATEGORY] Title: link)
    // Specifically tailored for HTML Maker Bots (@AlsoRaOne / Hub bot)
    // Prevents bots from falling back to generic "Link 1" names
    // --------------------------------------------------------------------------
    let botFormatTxt = `// Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
    allFilesList.forEach((file) => {
      const isVideo = file.type === 'video';
      const targetUrl = isVideo ? file.streamUrl : (file.pdfUrl || file.streamUrl);
      if (!targetUrl) return;

      let cat = 'FILE';
      if (file.type === 'video') cat = 'VIDEO';
      else if (file.type === 'notes' || file.type === 'dpp' || file.type === 'pdf') cat = 'PDF';
      else if (file.type === 'test') cat = 'TEST';

      let titleDisplay = file.title;
      if (file.type === 'dpp' && !titleDisplay.toLowerCase().startsWith('dpp')) {
        titleDisplay = `DPP - ${titleDisplay}`;
      }

      let durationSuffix = '';
      if (file.duration && file.duration !== 'N/A') {
        durationSuffix = ` (${file.duration})`;
      }

      let idSuffix = file.id ? ` (id: ${file.id})` : '';

      botFormatTxt += `[${cat}] ${titleDisplay}${idSuffix}${durationSuffix}: ${targetUrl}\n`;
    });

    let bashScript = '';
    let powerShellScript = '';

    if (platform === 'SW' && rawSWData) {
      const courseDataForSW = {
        course: {
          id: courseId,
          title: courseTitle,
          isLive: courseDetails?.isLive,
          ...courseDetails,
        },
        classes: rawSWData.classes || [],
      };
      txt = generateSWTxt(courseDataForSW);
      m3u = generateSWM3U(courseDataForSW, { streamType: 'hls' });
      bashScript = generateSWBash(courseDataForSW, { preferredQuality: '720p' });
      powerShellScript = generateSWPowerShell(courseDataForSW, { preferredQuality: '720p' });
    }

    const finalResult = {
      platform,
      courseId,
      courseDetails,
      extractedAt: dateNow,
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
      txtReport: txt,
      directLinksTxt,
      botFormatTxt,
      rawUrlsTxt,
      m3uPlaylist: m3u,
      bashScript,
      powerShellScript,
      rawSWData,
    };

    sendEvent('complete', finalResult);
    res.end();
  } catch (error: any) {
    console.error('Extraction error:', error);
    sendEvent('error', { message: error.message || 'Unknown extraction error occurred' });
    res.end();
  }
});

// Production and Vite Dev middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://localhost:${PORT}`);
  });
}

startServer();

export { app };
export default app;
