interface EventContext<Env = any, P = any, D = any> {
  request: Request;
  env: Env;
  params?: P;
  data?: D;
  waitUntil: (promise: Promise<any>) => void;
}
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

const DEFAULT_REMOTE_URL = 'https://nt.learn-topper.workers.dev';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
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
      const res = await fetch(`${remoteBase}/courses`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const data: any = await res.json();
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
      return new Response(JSON.stringify(formatted), {
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
      const res = await fetch(`${remoteBase}/course-details?courseId=${encodeURIComponent(String(courseId))}`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const data: any = await res.json();
      const overview = data.data?.find((d: any) => d.type === 'overview' || d.title === 'Overview');
      const details = overview?.data?.find((d: any) => d.layout_type === 'details')?.layout_data?.[0] || {
        id: courseId,
        course_id: String(courseId),
        title: `Course #${courseId}`,
      };
      return new Response(JSON.stringify({
        success: true,
        data: {
          ...details,
          course_id: String(details.id || courseId),
          title: details.title || `Course #${courseId}`,
        },
      }), {
        status: 200,
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
      const res = await fetch(`${remoteBase}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=root`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const data: any = await res.json();
      return new Response(JSON.stringify({ success: true, data: data.data || [] }), {
        status: 200,
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
      const targetFolder = (!folderId || folderId === '0' || folderId === 0) ? 'root' : String(folderId);
      const res = await fetch(`${remoteBase}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=${encodeURIComponent(targetFolder)}`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const data: any = await res.json();
      return new Response(JSON.stringify({ success: true, data: data.data || [] }), {
        status: 200,
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
      const { courseId, contentId, vdcId } = body;
      const targetVdc = vdcId || contentId;
      if (!targetVdc) {
        return new Response(JSON.stringify({ error: 'vdcId or contentId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const res = await fetch(`${remoteBase}/get-url?vdcid=${encodeURIComponent(String(targetVdc))}`, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.success && data.url) {
          return new Response(JSON.stringify({
            success: true,
            data: {
              file_url: data.url,
              stream_url: data.url,
              directUrl: data.directUrl,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }
      }
      return new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch video details' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  // 5.5. PDF URL Resolver
  if ((pathname === '/api/pdf-url' || pathname === '/api/pdfurl') && (request.method === 'GET' || request.method === 'POST')) {
    try {
      let contentId = url.searchParams.get('content_id') || url.searchParams.get('contentId');
      let courseId = url.searchParams.get('course_id') || url.searchParams.get('courseId');
      if (!contentId && request.method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        contentId = body.content_id || body.contentId;
        courseId = courseId || body.course_id || body.courseId;
      }
      if (!contentId || !courseId) {
        return new Response(JSON.stringify({ error: 'content_id and course_id are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const res = await fetch(
        `https://nexttoppers.nextmate.site/api/course/pdfurl?content_id=${encodeURIComponent(String(contentId))}&course_id=${encodeURIComponent(String(courseId))}`,
        {
          method: 'GET',
          headers: DEFAULT_HEADERS,
        }
      );
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `Upstream error: ${res.statusText}` }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      const data: any = await res.json();
      return new Response(JSON.stringify({
        success: true,
        data: {
          file_url: data.file_url || '',
          pdf_url: data.file_url || '',
          id: data.id,
          title: data.title,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch PDF URL' }), {
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

  const SW_LISTING_BASE = 'https://backend.opsolve.xyz/api/v1/live-course-lisitng';

  const normalizeSWCourseItem = (item: any) => ({
    ...item,
    id: String(item.id || item._id || ''),
    title: item.name || item.title || 'Untitled Course',
    banner: item.featured_image || item.banner || '',
    bannerSquare: item.featured_image || item.bannerSquare || item.banner || '',
    discountPrice: item.priceSelling ?? item.discountPrice,
    price: item.price,
    category: item.categoryName || item.category || '',
    validity: item.validityText || item.validity || '',
  });

  const fetchSWListingByType = async (type: 'All' | 'Live' | 'Recorded') => {
    const response = await fetch(`${SW_LISTING_BASE}?type=${encodeURIComponent(type)}`, {
      headers: SW_HEADERS,
    });
    if (!response.ok) {
      throw new Error(`SW API error (${type}): HTTP ${response.status}`);
    }
    const json: any = await response.json();
    const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    return list.map(normalizeSWCourseItem);
  };

  if (pathname === '/api/sw/courses' && request.method === 'GET') {
    try {
      const typeParam = (url.searchParams.get('type') || '').trim();
      if (typeParam === 'All' || typeParam === 'Live' || typeParam === 'Recorded') {
        const data = await fetchSWListingByType(typeParam);
        return new Response(JSON.stringify({ status: 'success', type: typeParam, data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const [allCourses, liveCourses, recordedCourses] = await Promise.all([
        fetchSWListingByType('All'),
        fetchSWListingByType('Live'),
        fetchSWListingByType('Recorded'),
      ]);

      return new Response(
        JSON.stringify({
          status: 'success',
          sections: {
            All: allCourses,
            Live: liveCourses,
            Recorded: recordedCourses,
          },
          data: allCourses,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      );
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
          const cdRes = await fetch(`${remoteBase}/course-details?courseId=${encodeURIComponent(String(courseId))}`, {
            method: 'GET',
            headers: DEFAULT_HEADERS,
          });
          if (cdRes.ok) {
            const cdJson: any = await cdRes.json();
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
        } catch {
          // ignore
        }

        await sendEvent('status', {
          message: `Found course: ${courseDetails?.title || `ID ${courseId}`}. Fetching directory structure...`,
        });

        // Step 2: Content
        const contentRes = await fetch(`${remoteBase}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=root`, {
          method: 'GET',
          headers: DEFAULT_HEADERS,
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

        const crawlFolder = async (
          folderId: string | number,
          folderTitle: string,
          parentPath: string[]
        ): Promise<any> => {
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
              const targetFolder = (!folderId || folderId === '0' || folderId === 0) ? 'root' : String(folderId);
              const folderRes = await fetch(`${remoteBase}/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=${encodeURIComponent(targetFolder)}`, {
                method: 'GET',
                headers: DEFAULT_HEADERS,
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
              // For NT videos: strictly only .m3u8 direct stream URLs, never download links or dynamic links
              let streamUrl = (fileType === 'video')
                ? (rawUrl && rawUrl.includes('.m3u8') && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '')
                : (rawUrl && isValidStreamOrDocUrl(rawUrl) ? rawUrl : '');
              let pdfUrl = (fileType === 'notes' || fileType === 'dpp' || fileType === 'test')
                ? (fileData.file_url || fileData.pdf_url || '')
                : (fileData.pdf_url || item.pdf_url || item.document_url || '');

              if (pdfUrl && !isValidStreamOrDocUrl(pdfUrl)) {
                pdfUrl = '';
              }

              const dynamicLink = fileData.dynamic_link || '';

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
                vdcId: fileData.vdc_id || item.vdc_id || '',
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
          // For NT videos: strictly only .m3u8 direct stream URLs, never download links or dynamic links
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
              totalDurationSeconds += s;
            }
          }

          const fileObj = {
            id: String(fid),
            vdcId: fileData.vdc_id || item.vdc_id || '',
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
                  if (fileObj.type === 'video') {
                    const targetVdc = fileObj.vdcId || itemId;
                    if (targetVdc) {
                      const vdRes = await fetch(`${remoteBase}/get-url?vdcid=${encodeURIComponent(String(targetVdc))}`, {
                        method: 'GET',
                        headers: DEFAULT_HEADERS,
                        signal: AbortSignal.timeout(6000),
                      });
                      if (vdRes.ok) {
                        const vdJson: any = await vdRes.json();
                        if (vdJson.success && vdJson.url && vdJson.url.includes('.m3u8')) {
                          fileObj.streamUrl = vdJson.url;
                        }
                      }
                    }
                  } else if ((fileObj.type === 'notes' || fileObj.type === 'dpp' || fileObj.type === 'test') && !fileObj.pdfUrl) {
                    const pRes = await fetch(
                      `https://nexttoppers.nextmate.site/api/course/pdfurl?content_id=${encodeURIComponent(String(itemId))}&course_id=${encodeURIComponent(String(courseId))}`,
                      {
                        method: 'GET',
                        headers: DEFAULT_HEADERS,
                        signal: AbortSignal.timeout(6000),
                      }
                    );
                    if (pRes.ok) {
                      const pJson: any = await pRes.json();
                      if (pJson && pJson.file_url && isValidStreamOrDocUrl(pJson.file_url)) {
                        fileObj.pdfUrl = pJson.file_url;
                        fileObj.streamUrl = pJson.file_url;
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
            const streamLink = (file.streamUrl && file.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(file.streamUrl)) ? file.streamUrl : 'N/A';
            const entryId = formatEntryId(file.id, courseId);
            directLinksTxt += `[VIDEO-LECTURE] ${file.title}  (id: ${entryId})${durationStr}: ${streamLink}\n`;
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
            const pdfLink = (file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : 'N/A');
            const entryId = formatEntryId(file.id, courseId);
            directLinksTxt += `[PDF-NOTES] ${file.title}  (id: ${entryId}): ${pdfLink}\n`;
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
            const pdfLink = (file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : 'N/A');
            const entryId = formatEntryId(file.id, courseId);
            directLinksTxt += `[PDF-DPP] ${file.title}  (id: ${entryId}): ${pdfLink}\n`;
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
            const link = (file.pdfUrl && isValidStreamOrDocUrl(file.pdfUrl)) ? file.pdfUrl : (isValidStreamOrDocUrl(file.streamUrl) ? file.streamUrl : 'N/A');
            const entryId = formatEntryId(file.id, courseId);
            directLinksTxt += `[PDF-TEST] ${file.title}  (id: ${entryId}): ${link}\n`;
            directLinksTxt += `Folder: ${file.path}\n\n`;
            directLinksTxt += `--------------------------------------------------------------------------------\n\n`;
          });
        }

        // 2. Generate Bot Format TXT
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

        // 3. Raw URLs
        let rawUrlsTxt = `# ==============================================================================\n# Built by t.me/devnaitikanonymous\n# Official Updates: t.me/learn_topper\n# ==============================================================================\n# Stream URLs & Content Links for Course: ${courseTitle} (ID: ${courseId})\n# Generated on: ${dateNow}\n\n`;
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

        // 4. M3U Playlist
        let m3u = `#EXTM3U\n# Course: ${courseTitle} (ID: ${courseId})\n\n`;
        videoFiles
          .filter((f) => f.streamUrl && f.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(f.streamUrl))
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
