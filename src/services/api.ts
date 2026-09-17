import {
  BatchSection,
  CourseDetails,
  ExtractedFileItem,
  ExtractedFolderNode,
  ExtractionStats,
} from '../types';

export async function fetchBatches(): Promise<BatchSection[]> {
  const res = await fetch('/api/batches');
  if (!res.ok) {
    throw new Error(`Failed to fetch batches catalog: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchCourseDetails(courseId: string): Promise<CourseDetails> {
  const res = await fetch('/api/course-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch course details: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchBatchContent(courseId: string): Promise<any[]> {
  const res = await fetch('/api/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch batch content: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchFolderContent(courseId: string, folderId: string | number): Promise<any[]> {
  const res = await fetch('/api/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, folderId: String(folderId) }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch folder content: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchVideoDetails(courseId: string, contentId: string | number): Promise<any> {
  const res = await fetch('/api/video-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, contentId: String(contentId) }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch video details: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || null;
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

  // 2. Raw URLs Only (for stream URLs and document links)
  let rawUrlsTxt = `# ==============================================================================
# Built by t.me/devnaitikanonymous
# Official Updates: t.me/learn_topper
# ==============================================================================
# Stream URLs & Content Links for Course: ${courseTitle} (ID: ${courseId})
# Generated on: ${dateNow}\n\n`;
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

  for (const node of rootFolders) {
    txt += renderHierarchicalDataTree(node, 0);
  }

  // 4. M3U Playlist
  let m3u = `#EXTM3U\n# Course: ${courseTitle} (ID: ${courseId})\n\n`;
  videoFiles
    .filter((f) => f.streamUrl)
    .forEach((v) => {
      m3u += `#EXTINF:-1 group-title="${v.path.replace(/"/g, '')}",Class: ${v.title.replace(/,/g, ' ')}\n${v.streamUrl}\n`;
    });

  // 5. Bot-Compatible Format ([CATEGORY] Title: link)
  let botFormatTxt = `// Built by t.me/devnaitikanonymous | Join: t.me/learn_topper\n`;
  allFiles.forEach((file) => {
    const isVideo = file.type === 'video';
    const targetUrl = isVideo ? file.streamUrl : (file.pdfUrl || file.streamUrl);
    if (!targetUrl) return;

    let cat = 'FILE';
    if (file.type === 'video') cat = 'VIDEO';
    else if (file.type === 'notes' || file.type === 'dpp') cat = 'PDF';
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

  return {
    txtReport: txt,
    directLinksTxt,
    botFormatTxt,
    rawUrlsTxt,
    m3uPlaylist: m3u,
  };
}
