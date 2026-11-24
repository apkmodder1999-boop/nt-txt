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
  process.env.REMOTE_SERVICE_URL || 'https://nt.learn-topper.workers.dev';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

// 1. All Batches / Courses
app.get('/api/batches', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${SERVICE_BASE_URL}/courses`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    const courseList = data.data?.find((l: any) => l.layout_type === 'course_list_layout')?.list || [];
    const formatted = [
      {
        section: 'Next Toppers Courses',
        batches: courseList.map((c: any) => ({
          id: c.id,
          name: c.title || c.name || `Course ${c.id}`,
          badge: c.is_trending || (c.is_new ? 'New' : (c.offer_price ? `₹${c.offer_price}` : null)),
          thumbnail: c.thumbnail,
          actions: ['Explore'],
        })),
      },
    ];
    res.json(formatted);
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
    const response = await fetch(`${SERVICE_BASE_URL}/course-details?courseId=${encodeURIComponent(String(courseId))}`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    const overview = data.data?.find((d: any) => d.type === 'overview' || d.title === 'Overview');
    const details = overview?.data?.find((d: any) => d.layout_type === 'details')?.layout_data?.[0] || {
      id: courseId,
      course_id: String(courseId),
      title: `Course #${courseId}`,
    };
    res.json({
      success: true,
      data: {
        ...details,
        course_id: String(details.id || courseId),
        title: details.title || `Course #${courseId}`,
      },
    });
  } catch (error: any) {
    console.error('Error fetching course-details:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch course details' });
  }
});

// 3. Batch Root Content
app.post('/api/content', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }
    const response = await fetch(`${SERVICE_BASE_URL}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=root`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json({ success: true, data: data.data || [] });
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
    const targetFolder = (!folderId || folderId === '0' || folderId === 0) ? 'root' : String(folderId);
    const response = await fetch(`${SERVICE_BASE_URL}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=${encodeURIComponent(targetFolder)}`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json({ success: true, data: data.data || [] });
  } catch (error: any) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch folder content' });
  }
});

// 5. Video Details / Direct Stream Resolver (/get-url)
app.post('/api/video-details', async (req: Request, res: Response) => {
  try {
    const { courseId, contentId, vdcId } = req.body;
    const targetVdc = vdcId || contentId;
    if (!targetVdc) {
      return res.status(400).json({ error: 'vdcId or contentId is required' });
    }
    const response = await fetch(`${SERVICE_BASE_URL}/get-url?vdcid=${encodeURIComponent(String(targetVdc))}`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.url) {
        return res.json({
          success: true,
          data: {
            file_url: data.url,
            stream_url: data.url,
            directUrl: data.directUrl,
            vdc_id: data.vdcId,
          },
        });
      }
    }
    res.json({ success: false, message: 'Stream not resolved' });
  } catch (error: any) {
    console.error('Error fetching video-details:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video details' });
  }
});

// 5.5. PDF URL Resolver
app.all(['/api/pdf-url', '/api/pdfurl'], async (req: Request, res: Response) => {
  try {
    const courseId = req.query.course_id || req.query.courseId || req.body?.course_id || req.body?.courseId;
    const contentId = req.query.content_id || req.query.contentId || req.body?.content_id || req.body?.contentId;
    if (!contentId || !courseId) {
      return res.status(400).json({ error: 'content_id and course_id are required' });
    }
    const response = await fetch(
      `https://nexttoppers.nextmate.site/api/course/pdfurl?content_id=${encodeURIComponent(String(contentId))}&course_id=${encodeURIComponent(String(courseId))}`,
      {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }
    const data = await response.json();
    res.json({
      success: true,
      data: {
        file_url: data.file_url || '',
        pdf_url: data.file_url || '',
        id: data.id,
        title: data.title,
      },
    });
  } catch (error: any) {
    console.error('Error fetching pdf-url:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pdf url' });
  }
});

const SW_LISTING_BASE = 'https://backend.opsolve.xyz/api/v1/live-course-lisitng';

function normalizeSWCourseItem(item: any) {
  return {
    ...item,
    id: String(item.id || item._id || ''),
    title: item.name || item.title || 'Untitled Course',
    banner: item.featured_image || item.banner || '',
    bannerSquare: item.featured_image || item.bannerSquare || item.banner || '',
    discountPrice: item.priceSelling ?? item.discountPrice,
    price: item.price,
    category: item.categoryName || item.category || '',
    validity: item.validityText || item.validity || '',
  };
}

async function fetchSWListingByType(type: 'All' | 'Live' | 'Recorded') {
  const response = await fetch(`${SW_LISTING_BASE}?type=${encodeURIComponent(type)}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
    },
  });
  if (!response.ok) {
    throw new Error(`SW API error (${type}): HTTP ${response.status}`);
  }
  const json: any = await response.json();
  const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  return list.map(normalizeSWCourseItem);
}

// SW (Selection Way) API Endpoints
app.get('/api/sw/courses', async (req: Request, res: Response) => {
  try {
    const typeParam = String(req.query.type || '').trim();
    if (typeParam === 'All' || typeParam === 'Live' || typeParam === 'Recorded') {
      const data = await fetchSWListingByType(typeParam);
      return res.json({ status: 'success', type: typeParam, data });
    }

    const [allCourses, liveCourses, recordedCourses] = await Promise.all([
      fetchSWListingByType('All'),
      fetchSWListingByType('Live'),
      fetchSWListingByType('Recorded'),
    ]);

    res.json({
      status: 'success',
      sections: {
        All: allCourses,
        Live: liveCourses,
        Recorded: recordedCourses,
      },
      data: allCourses,
    });
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

function isValidStreamOrDocUrl(url?: string | null): boolean {
  if (!url) return false;
  const u = String(url).trim();
  if (!u || u === 'N/A' || u === '""' || u === "''") return false;
  if (u.includes('/dl/r/') || u.includes('course.nexttoppers.com') || u.includes('/dynamic_link')) return false;
  if (u.includes('/download/')) return false;
  return u.startsWith('http://') || u.startsWith('https://');
}

function formatEntryId(rawId: any, currentCourseId: any): string {
  const idStr = String(rawId || '').trim();
  const cId = String(currentCourseId || '').trim();
  if (!idStr || idStr === '0') return cId ? `${cId}-0` : '';
  if (cId) {
    if (idStr.startsWith(`${cId}-`)) return idStr;
    if (idStr.startsWith(`${cId}_`)) return `${cId}-${idStr.slice(cId.length + 1)}`;
    const dashIdx = idStr.indexOf('-');
    if (dashIdx > 0 && idStr.slice(0, dashIdx) === cId) {
      return idStr;
    }
    return `${cId}-${idStr}`;
  }
  return idStr;
}

function getMediaTag(file: { type?: string; title?: string; path?: string }): string {
  const isVideo = file.type === 'video';
  const t = (file.title || '').toLowerCase();
  const p = (file.path || '').toLowerCase();

  const isDpp = file.type === 'dpp' || t.includes('dpp') || t.includes('practice sheet') || p.includes('dpp') || t.includes('worksheet') || t.includes('assignment');
  const isNotes = file.type === 'notes' || t.includes('note') || p.includes('note') || t.includes('handwritten') || t.includes('study material');
  const isTest = file.type === 'test' || t.includes('test') || p.includes('test');
  const isLecture = file.type === 'lecture' || t.includes('lecture') || t.includes('class') || /\bl-?\s*\d+/i.test(t) || /\bch-?\s*\d+/i.test(t);

  if (isVideo) {
    if (isDpp) return 'VIDEO-DPP';
    if (isTest) return 'VIDEO-TEST';
    if (isNotes && !isLecture) return 'VIDEO-NOTES';
    return 'VIDEO-LECTURE';
  } else {
    if (isDpp) return 'PDF-DPP';
    if (isNotes) return 'PDF-NOTES';
    if (isTest) return 'PDF-TEST';
    if (isLecture) return 'PDF-LECTURE';
    return 'PDF-NOTES';
  }
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
        const cdRes = await fetch(`${SERVICE_BASE_URL}/course-details?courseId=${encodeURIComponent(String(courseId))}`, {
          method: 'GET',
          headers: DEFAULT_HEADERS,
        });
        if (cdRes.ok) {
          const cdJson = await cdRes.json();
          const overview = cdJson.data?.find((d: any) => d.type === 'overview' || d.title === 'Overview');
          const details = overview?.data?.find((d: any) => d.layout_type === 'details')?.layout_data?.[0];
          if (details) {
            courseDetails = {
              ...details,
              course_id: String(details.id || courseId),
              title: details.title || `Course #${courseId}`,
            };
          }
        }
      } catch (e: any) {
        sendEvent('log', { message: `Warning: Course details fetch failed: ${e.message}` });
      }

      sendEvent('status', {
        message: `Course loaded: ${courseDetails?.title || 'Course #' + courseId}`,
        courseDetails,
      });

      // Step 2: Fetch Root Content
      sendEvent('status', { message: 'Fetching root content categories from NT API...' });
      const contentRes = await fetch(`${SERVICE_BASE_URL}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=root`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
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
          const targetFolder = (!folderId || folderId === '0' || folderId === 0) ? 'root' : String(folderId);
          const folderRes = await fetch(`${SERVICE_BASE_URL}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=${encodeURIComponent(targetFolder)}`, {
            method: 'GET',
            headers: DEFAULT_HEADERS,
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
              ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '')
              : (rawUrl && !rawUrl.includes('/download/') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '');
            const pdfUrl = (category === 'notes' || category === 'dpp' || category === 'test')
              ? (rawUrl && !rawUrl.includes('/download/') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '')
              : '';
            const duration = fileData.duration || 0;
            if (typeof duration === 'number') {
              totalDurationSeconds += duration;
            }

            const fileEntry = {
              id: String(entityId),
              vdcId: fileData.vdc_id || '',
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

            // Queue video items lacking direct .m3u8 stream URLs and documents lacking PDF links
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
          ? (rawUrl && rawUrl.includes('.m3u8') && !rawUrl.includes('/download/') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '')
          : (rawUrl && !rawUrl.includes('/download/') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '');
        const pdfUrl = (category === 'notes' || category === 'dpp' || category === 'test')
          ? (rawUrl && !rawUrl.includes('/download/') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '')
          : '';
        const duration = fileData.duration || 0;
        if (typeof duration === 'number') totalDurationSeconds += duration;

        const fileEntry = {
          id: String(entityId),
          vdcId: fileData.vdc_id || '',
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

      // Step 3: Fast concurrent probe of direct stream URLs and document links
      if (deepFileDetails && filesNeedingDetails.length > 0) {
        sendEvent('status', {
          message: `Resolving stream URLs & document links for ${filesNeedingDetails.length} items...`,
        });

        const CONCURRENCY = 40;
        for (let i = 0; i < filesNeedingDetails.length; i += CONCURRENCY) {
          const chunk = filesNeedingDetails.slice(i, i + CONCURRENCY);
          await Promise.all(
            chunk.map(async (fileItem) => {
              try {
                if (fileItem.type === 'video' && fileItem.vdcId) {
                  const uRes = await fetch(`${SERVICE_BASE_URL}/get-url?vdcid=${encodeURIComponent(fileItem.vdcId)}`, {
                    method: 'GET',
                    headers: DEFAULT_HEADERS,
                    signal: AbortSignal.timeout(4000),
                  });
                  if (uRes.ok) {
                    const uJson = await uRes.json();
                    if (uJson.success && uJson.url && uJson.url.includes('.m3u8')) {
                      fileItem.streamUrl = uJson.url;
                    }
                  }
                } else if ((fileItem.type === 'notes' || fileItem.type === 'dpp' || fileItem.type === 'test') && !fileItem.pdfUrl) {
                  const pRes = await fetch(
                    `https://nexttoppers.nextmate.site/api/course/pdfurl?content_id=${encodeURIComponent(fileItem.id)}&course_id=${encodeURIComponent(String(courseId))}`,
                    {
                      method: 'GET',
                      headers: DEFAULT_HEADERS,
                      signal: AbortSignal.timeout(4000),
                    }
                  );
                  if (pRes.ok) {
                    const pJson = await pRes.json();
                    if (pJson && pJson.file_url && isValidStreamOrDocUrl(pJson.file_url)) {
                      fileItem.pdfUrl = pJson.file_url;
                      fileItem.streamUrl = pJson.file_url;
                    }
                  }
                }
              } catch {
                // ignore single item failure
              }
            })
          );

          sendEvent('progress', {
            folder: `Resolved links & documents: ${Math.min(i + CONCURRENCY, filesNeedingDetails.length)} / ${filesNeedingDetails.length}`,
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
        const streamLink = (file.streamUrl && file.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(file.streamUrl)) ? file.streamUrl : 'N/A';
        const entryId = formatEntryId(file.id, courseId);
        directLinksTxt += `[VIDEO-LECTURE] ${file.title}  (id: ${entryId})${durationStr}: ${streamLink}\n`;
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
        const pdfLink = (file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : 'N/A');
        const entryId = formatEntryId(file.id, courseId);
        directLinksTxt += `[PDF-NOTES] ${file.title}  (id: ${entryId}): ${pdfLink}\n`;
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
        const pdfLink = (file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : 'N/A');
        const entryId = formatEntryId(file.id, courseId);
        directLinksTxt += `[PDF-DPP] ${file.title}  (id: ${entryId}): ${pdfLink}\n`;
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
        const link = (file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : 'N/A');
        const entryId = formatEntryId(file.id, courseId);
        directLinksTxt += `[PDF-TEST] ${file.title}  (id: ${entryId}): ${link}\n`;
        directLinksTxt += `Folder: ${file.path}\n\n`;
        directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
      });
    }

    // --------------------------------------------------------------------------
    // B) RAW URLS ONLY (Stream URLs for Videos, Direct URLs for Notes/DPPs - never dynamic links)
    // --------------------------------------------------------------------------
    let rawUrlsTxt = `# ==============================================================================\n# Built by t.me/devnaitikanonymous\n# Official Updates: t.me/learn_topper\n# ==============================================================================\n# Stream URLs & Content Links for Course: ${courseTitle} (ID: ${courseId})\n`;
    rawUrlsTxt += `# Generated on: ${dateNow}\n\n`;
    rawUrlsTxt += `# --- STREAM VIDEOS (.M3U8) ---\n`;
    videoFiles.forEach((v) => {
      if (v.streamUrl && v.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(v.streamUrl)) rawUrlsTxt += `${v.streamUrl}\n`;
    });
    rawUrlsTxt += `\n# --- CLASS NOTES ---\n`;
    noteFiles.forEach((p) => {
      const link = p.pdfUrl || p.streamUrl;
      if (isValidStreamOrDocUrl(link)) rawUrlsTxt += `${link}\n`;
    });
    rawUrlsTxt += `\n# --- DPPS & PRACTICE SHEETS ---\n`;
    dppFiles.forEach((d) => {
      const link = d.pdfUrl || d.streamUrl;
      if (isValidStreamOrDocUrl(link)) rawUrlsTxt += `${link}\n`;
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
          const tag = getMediaTag(file);
          const entryId = formatEntryId(file.id, courseId);
          const durationText =
            file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';

          out += `${fileIndent}[${tag}] ${file.title}  (id: ${entryId})${durationText}\n`;

          if (file.type === 'video') {
            if (file.streamUrl && file.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(file.streamUrl)) {
              out += `${detailIndent}Stream: ${file.streamUrl}\n`;
            }
          } else {
            const docLink = file.pdfUrl || file.streamUrl;
            if (docLink && isValidStreamOrDocUrl(docLink)) {
              out += `${detailIndent}Document: ${docLink}\n`;
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
        const tag = getMediaTag(file);
        const entryId = formatEntryId(file.id, courseId);
        const durationText =
          file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';

        txt += `[${tag}] ${file.title}  (id: ${entryId})${durationText}\n`;
        if (file.type === 'video') {
          if (file.streamUrl && file.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(file.streamUrl)) {
            txt += `    Stream: ${file.streamUrl}\n`;
          }
        } else {
          const doc = file.pdfUrl || file.streamUrl;
          if (doc && isValidStreamOrDocUrl(doc)) {
            txt += `    Document: ${doc}\n`;
          }
        }
      }
      txt += '\n';
    }

    // M3U playlist format
    let m3u = `#EXTM3U\n# Course: ${courseTitle} (ID: ${courseId})\n\n`;
    videoFiles
      .filter((f) => f.streamUrl && f.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(f.streamUrl))
      .forEach((v) => {
        m3u += `#EXTINF:-1 group-title="${v.path.replace(/"/g, '')}",Class: ${v.title.replace(/,/g, ' ')}\n${v.streamUrl}\n`;
      });

    // --------------------------------------------------------------------------
    // D) BOT COMPATIBLE FORMAT ([VIDEO/PDF-LECTURE/DPP/NOTES] Title (id: courseid-contentid): link)
    // --------------------------------------------------------------------------
    let botFormatTxt = `// Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
    allFilesList.forEach((file) => {
      const isVideo = file.type === 'video';
      const targetUrl = isVideo
        ? (file.streamUrl && file.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : '')
        : ((file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (file.streamUrl && isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : ''));
      if (!isValidStreamOrDocUrl(targetUrl)) return;

      const cat = getMediaTag(file);
      const titleDisplay = (file.title || 'Untitled').trim();
      const durationSuffix = file.duration && file.duration !== 'N/A' ? ` (${file.duration})` : '';
      const combinedId = formatEntryId(file.id, courseId);
      const idSuffix = combinedId ? ` (id: ${combinedId})` : '';

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
