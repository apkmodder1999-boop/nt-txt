export interface BatchItem {
  id: number | string;
  name: string;
  badge?: string | null;
  validity_days?: number | null;
  thumbnail?: string | null;
  actions?: string[];
}

export interface BatchSection {
  section: string;
  batches: BatchItem[];
}

export interface CourseDetails {
  course_id: string;
  platform_id?: number;
  external_id?: string;
  title: string;
  description?: string;
  thumbnail?: string;
  preview_image?: string;
  image?: string;
  banner_image?: string;
  mrp?: string;
  actual_price?: string;
  offer_price?: string;
  price?: string;
  cat_type?: number;
  shipping_charge?: string;
  course_type?: number;
  tax_rate?: number;
  duration_type?: number;
  days?: number;
  start_date?: string;
  end_date?: string;
  is_featured?: string;
  is_new?: string;
  is_trending?: string;
  average_rating?: string;
  review_count?: number;
  discount_percentage?: number;
  syncedAt?: string;
}

export interface DownloadUrlItem {
  quality: string;
  url: string;
}

export interface ExtractedFileItem {
  id: string;
  title: string;
  className?: string;
  type: 'video' | 'notes' | 'dpp' | 'test' | 'link' | 'other';
  rawFileType?: number;
  duration?: string;
  durationSeconds?: number;
  streamUrl?: string;
  downloadUrls?: DownloadUrlItem[];
  pdfUrl?: string;
  shareUrl?: string;
  isLocked?: boolean;
  isDrm?: boolean;
  path: string;
}

export interface ExtractedFolderNode {
  id: string;
  title: string;
  path: string[];
  folders: ExtractedFolderNode[];
  files: ExtractedFileItem[];
}

export interface ExtractionStats {
  totalFolders: number;
  totalFiles: number;
  totalVideos: number;
  totalNotes: number;
  totalDpps: number;
  totalTests: number;
  totalLinks: number;
  totalDurationFormatted: string;
  totalDurationSeconds: number;
}

export interface ExtractionResult {
  courseId: string;
  courseDetails: CourseDetails | null;
  extractedAt: string;
  stats: ExtractionStats;
  rootFolders: ExtractedFolderNode[];
  allFiles: ExtractedFileItem[];
  txtReport: string;
  directLinksTxt: string;
  botFormatTxt?: string;
  rawUrlsTxt: string;
  m3uPlaylist: string;
}

export interface CrawlLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
