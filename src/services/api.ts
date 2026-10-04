import {
  BatchSection,
  CourseDetails,
  ExtractedFileItem,
  ExtractedFolderNode,
  ExtractionStats,
  ExtractionResult,
  SWCourseItem,
} from '../types';
import {
  generateSWTxt,
  generateSWM3U,
  generateSWBash,
  generateSWPowerShell,
} from './swGenerators';

export const SW_API_COURSES = 'https://backend.multistreaming.site/api/courses';
export const SW_API_COURSE_CLASSES = (courseId: string) =>
  `https://backend.multistreaming.site/api/courses/${encodeURIComponent(courseId)}/classes?populate=full`;

export async function fetchSWCourses(): Promise<SWCourseItem[]> {
  try {
    // Try backend proxy first
    const proxyRes = await fetch('/api/sw/courses');
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (Array.isArray(json.data)) return json.data;
      if (Array.isArray(json)) return json;
    }
  } catch {
    // Fall back to direct request
  }

  const res = await fetch(SW_API_COURSES);
  if (!res.ok) {
    throw new Error(`Failed to fetch SW courses: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchSWCourseClasses(courseId: string): Promise<any> {
  try {
    // Try backend proxy first
    const proxyRes = await fetch(`/api/sw/courses/${encodeURIComponent(courseId)}/classes`);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      return json.data || json;
    }
  } catch {
    // Fall back to direct request
  }

  const res = await fetch(SW_API_COURSE_CLASSES(courseId));
  if (!res.ok) {
    throw new Error(`Failed to fetch SW classes: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function fetchBatches(): Promise<BatchSection[]> {
  try {
    const res = await fetch('/api/batches');
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json) && json.length > 0) return json;
      } catch {}
    }
  } catch {
    // Fall back to direct upstream
  }

  const direct = await fetch('https://nt.learn-topper.workers.dev/courses', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
    },
  });
  if (!direct.ok) {
    throw new Error(`Failed to fetch batches: HTTP ${direct.status}`);
  }
  const dJson = await direct.json();
  const courseList = dJson.data?.find((l: any) => l.layout_type === 'course_list_layout')?.list || [];
  return [
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
}

export async function fetchCourseDetails(courseId: string): Promise<CourseDetails> {
  try {
    const res = await fetch('/api/course-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.data || json.title) return json.data || json;
      } catch {}
    }
  } catch {
    // Fall back to direct upstream
  }

  const direct = await fetch(
    `https://nt.learn-topper.workers.dev/course-details?courseId=${encodeURIComponent(String(courseId))}`
  );
  if (!direct.ok) {
    throw new Error(`Failed to fetch course details: HTTP ${direct.status}`);
  }
  const dJson = await direct.json();
  const overview = dJson.data?.find((d: any) => d.type === 'overview' || d.title === 'Overview');
  const details = overview?.data?.find((d: any) => d.layout_type === 'details')?.layout_data?.[0];
  return {
    course_id: String(courseId),
    title: details?.title || `Course #${courseId}`,
    description: details?.description || '',
    thumbnail: details?.thumbnail || '',
    image: details?.thumbnail || '',
  };
}

export async function fetchBatchContent(courseId: string): Promise<any[]> {
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.data)) return json.data;
      } catch {}
    }
  } catch {
    // Fall back to direct upstream
  }

  const direct = await fetch(
    `https://nt.learn-topper.workers.dev/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=root`
  );
  if (!direct.ok) {
    throw new Error(`Failed to fetch batch content: HTTP ${direct.status}`);
  }
  const dJson = await direct.json();
  return dJson.data || [];
}

export async function fetchFolderContent(courseId: string, folderId: string | number): Promise<any[]> {
  try {
    const res = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, folderId: String(folderId) }),
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.data)) return json.data;
      } catch {}
    }
  } catch {
    // Fall back to direct upstream
  }

  const target = (!folderId || folderId === '0' || folderId === 0) ? 'root' : String(folderId);
  const direct = await fetch(
    `https://nt.learn-topper.workers.dev/all-content?courseId=${encodeURIComponent(String(courseId))}&folderId=${encodeURIComponent(target)}`
  );
  if (!direct.ok) {
    throw new Error(`Failed to fetch folder content: HTTP ${direct.status}`);
  }
  const dJson = await direct.json();
  return dJson.data || [];
}

export async function fetchVideoDetails(courseId: string, contentId: string | number, vdcId?: string): Promise<any> {
  const targetVdc = vdcId || contentId;

  // 1. Try proxy route first
  try {
    const res = await fetch('/api/video-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        contentId: String(contentId),
        ...(vdcId ? { vdcId: String(vdcId) } : {}),
      }),
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.success && json.data && (json.data.file_url || json.data.stream_url)) {
          return json.data;
        }
      } catch {}
    }
  } catch {
    // Fallback to direct request
  }

  // 2. Direct fallback to Cloudflare Worker media stream resolver (CORS open)
  if (targetVdc) {
    try {
      const directRes = await fetch(
        `https://nt.learn-topper.workers.dev/get-url?vdcid=${encodeURIComponent(String(targetVdc))}`
      );
      if (directRes.ok) {
        const directJson = await directRes.json();
        if (directJson.success && directJson.url) {
          return {
            file_url: directJson.url,
            stream_url: directJson.url,
            directUrl: directJson.directUrl || directJson.url,
            vdc_id: directJson.vdcId || targetVdc,
          };
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  return null;
}

export async function fetchPdfUrl(courseId: string, contentId: string | number): Promise<string | null> {
  // 1. Try backend proxy first
  try {
    const res = await fetch(`/api/pdf-url?content_id=${encodeURIComponent(String(contentId))}&course_id=${encodeURIComponent(String(courseId))}`);
    if (res.ok) {
      const json = await res.json();
      const resolved = json.data?.file_url || json.data?.pdf_url;
      if (resolved && isValidStreamOrDocUrl(resolved)) {
        return resolved;
      }
    }
  } catch {
    // Fallback to direct request
  }

  // 2. Direct fallback (CORS is *)
  try {
    const directRes = await fetch(
      `https://nexttoppers.nextmate.site/api/course/pdfurl?content_id=${encodeURIComponent(String(contentId))}&course_id=${encodeURIComponent(String(courseId))}`
    );
    if (directRes.ok) {
      const data = await directRes.json();
      if (data && data.file_url && isValidStreamOrDocUrl(data.file_url)) {
        return data.file_url;
      }
    }
  } catch {
    // Ignore fallback error
  }

  return null;
}

export function formatDuration(seconds: number | string | null | undefined): string {
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

export function parseDownloadUrls(raw: any): Array<{ quality: string; url: string }> {
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

export function classifyFile(
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

export function isValidStreamOrDocUrl(url?: string | null): boolean {
  if (!url) return false;
  const u = String(url).trim();
  if (!u || u === 'N/A' || u === '""' || u === "''") return false;
  if (u.includes('/dl/r/') || u.includes('course.nexttoppers.com') || u.includes('/dynamic_link')) return false;
  if (u.includes('/download/')) return false;
  return u.startsWith('http://') || u.startsWith('https://');
}

export function formatEntryId(rawId: any, currentCourseId: any): string {
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

export function getMediaTag(file: { type?: string; title?: string; path?: string }): string {
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

export function generateTxtFiles(
  courseId: string,
  courseDetails: CourseDetails | null,
  rootFolders: ExtractedFolderNode[],
  allFiles: ExtractedFileItem[],
  stats: ExtractionStats
): {
  txtReport: string;
  directLinksTxt: string;
  botFormatTxt: string;
  rawUrlsTxt: string;
  m3uPlaylist: string;
} {
  const dateNow = new Date().toISOString();
  const courseTitle = courseDetails?.title || `Batch Course #${courseId}`;
  const cleanDescription = (courseDetails?.description || '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const videoFiles = allFiles.filter((f) => f.type === 'video');
  const noteFiles = allFiles.filter((f) => f.type === 'notes');
  const dppFiles = allFiles.filter((f) => f.type === 'dpp');
  const testAndOtherFiles = allFiles.filter((f) => f.type === 'test' || f.type === 'other');

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
      const durationStr =
        file.duration && file.duration !== 'N/A' ? `  (Duration: ${file.duration})` : '';
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

  // 2. Raw URLs Only (for stream URLs and document links - never dynamic links)
  let rawUrlsTxt = `# ==============================================================================
# Built by t.me/devnaitikanonymous
# Official Updates: t.me/learn_topper
# ==============================================================================
# Stream URLs & Content Links for Course: ${courseTitle} (ID: ${courseId})
# Generated on: ${dateNow}\n\n`;
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

  // 3. Hierarchical Batch Report (Exact format requested by user)
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

  const cleanDescriptionFormatted = (courseDetails?.description || '')
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

  let txt = `======================================================================\n`;
  txt += `Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
  txt += `======================================================================\n`;
  txt += `${courseTitle}\n`;
  txt += `======================================================================\n`;
  txt += `Course ID : ${courseId}\n`;
  txt += `Price     : ${priceStr}\n`;
  txt += `Thumbnail : ${thumbnailStr}\n\n`;
  txt += `Description:\n`;
  txt += `${cleanDescriptionFormatted || 'N/A'}\n\n`;
  txt += `Generated : ${dateNow}\n\n\n`;

  function renderHierarchicalDataTree(node: ExtractedFolderNode, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    let out = `${indent}[FOLDER] ${node.title}  (id: ${node.id})\n\n`;

    // 1. Subfolders
    for (const sub of node.folders || []) {
      out += renderHierarchicalDataTree(sub, depth + 1);
    }

    // 2. Files in folder
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

  for (const node of rootFolders) {
    txt += renderHierarchicalDataTree(node, 0);
  }

  // 4. M3U Playlist (Strictly .m3u8 stream URLs only)
  let m3u = `#EXTM3U\n# Course: ${courseTitle} (ID: ${courseId})\n\n`;
  videoFiles
    .filter((f) => f.streamUrl && f.streamUrl.includes('.m3u8') && isValidStreamOrDocUrl(f.streamUrl))
    .forEach((v) => {
      m3u += `#EXTINF:-1 group-title="${v.path.replace(/"/g, '')}",Class: ${v.title.replace(/,/g, ' ')}\n${v.streamUrl}\n`;
    });

  // 5. Bot-Compatible Format ([VIDEO/PDF-LECTURE/DPP/NOTES] Title (id: courseid-contentid): link)
  let botFormatTxt = `// Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
  allFiles.forEach((file) => {
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

  return {
    txtReport: txt,
    directLinksTxt,
    botFormatTxt,
    rawUrlsTxt,
    m3uPlaylist: m3u,
  };
}

export function convertSWClassesToExtractionResult(
  courseId: string,
  swData: any
): ExtractionResult {
  const courseInfo = swData.course || {};
  const courseTitle = courseInfo.title || `SW Course #${courseId}`;
  const topics: any[] = swData.classes || [];

  const courseDetails: CourseDetails = {
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

  let totalFilesCount = 0;
  let totalVideosCount = 0;
  let totalNotesCount = 0;
  let totalDppsCount = 0;
  let totalTestsCount = 0;
  let totalLinksCount = 0;
  let totalDurationSeconds = 0;

  const allFiles: ExtractedFileItem[] = [];
  const rootFolders: ExtractedFolderNode[] = [];

  topics.forEach((topic: any, topicIndex: number) => {
    const topicName = (topic.topicName || `Topic ${topicIndex + 1}`).trim();
    const topicId = topic.topicId || `topic_${topicIndex + 1}`;
    const topicFiles: ExtractedFileItem[] = [];

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
      const downloadUrls: any[] = Array.isArray(cls.mp4Recordings)
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
        const videoItem: ExtractedFileItem = {
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
        allFiles.push(videoItem);
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

          const pdfItem: ExtractedFileItem = {
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
          allFiles.push(pdfItem);
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

          const testItem: ExtractedFileItem = {
            id: `${classId}_test_${tIdx}`,
            title: testName,
            className: classTitle,
            type: 'test',
            pdfUrl: testUrl,
            streamUrl: testUrl,
            path: topicName,
          };
          topicFiles.push(testItem);
          allFiles.push(testItem);
        });
      }
    });

    rootFolders.push({
      id: String(topicId),
      title: topicName,
      path: [],
      folders: [],
      files: topicFiles,
    });
  });

  const stats: ExtractionStats = {
    totalFolders: rootFolders.length,
    totalFiles: totalFilesCount,
    totalVideos: totalVideosCount,
    totalNotes: totalNotesCount,
    totalDpps: totalDppsCount,
    totalTests: totalTestsCount,
    totalLinks: totalLinksCount,
    totalDurationFormatted: formatDuration(totalDurationSeconds),
    totalDurationSeconds,
  };

  const { directLinksTxt, botFormatTxt, rawUrlsTxt } = generateTxtFiles(
    courseId,
    courseDetails,
    rootFolders,
    allFiles,
    stats
  );

  // Generate Selection Way export formats
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

  return {
    platform: 'SW',
    courseId,
    courseDetails,
    extractedAt: new Date().toISOString(),
    stats,
    rootFolders,
    allFiles,
    txtReport,
    directLinksTxt,
    botFormatTxt,
    rawUrlsTxt,
    m3uPlaylist,
    bashScript,
    powerShellScript,
    rawSWData: swData,
  };
}

export async function extractSWBatch(
  courseId: string,
  onProgress?: (msg: string, percent: number) => void
): Promise<ExtractionResult> {
  onProgress?.(`Connecting to SW API for Course #${courseId}...`, 15);
  const data = await fetchSWCourseClasses(courseId);
  onProgress?.('Processing topics, classes, stream links & PDFs...', 65);
  const result = convertSWClassesToExtractionResult(courseId, data);
  onProgress?.('Extraction completed successfully!', 100);
  return result;
}

