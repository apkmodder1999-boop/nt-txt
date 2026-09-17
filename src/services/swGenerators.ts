// Selection Way format generators for courses and batch schedules

import { formatDuration } from './api';

export interface SWExportOptions {
  includeDescription?: boolean;
  includeHls?: boolean;
  includeDirectMp4?: boolean;
  includePdfs?: boolean;
  preferredQuality?: string; // '720p' | '480p' | '360p' | '240p'
  streamType?: 'hls' | 'mp4';
}

function cleanUrl(url: string): string {
  if (!url) return '';
  return url.trim();
}

/**
 * Generates the Standard UTF-8 TXT Schedule for Selection Way / Selection Board
 */
export function generateSWTxt(
  courseData: { course: any; classes: any[] },
  options: SWExportOptions = {}
): string {
  const {
    includeDescription = true,
    includeHls = true,
    includeDirectMp4 = true,
    includePdfs = true,
    preferredQuality = '720p',
  } = options;

  const course = courseData.course || {};
  const topics = courseData.classes || [];

  let totalLectures = 0;
  let totalPdfs = 0;

  topics.forEach((t) => {
    if (Array.isArray(t.classes)) {
      totalLectures += t.classes.length;
      t.classes.forEach((c: any) => {
        if (Array.isArray(c.classPdf)) {
          totalPdfs += c.classPdf.length;
        }
      });
    }
  });

  const lines: string[] = [];

  lines.push('=========================================================================');
  lines.push(`               ✦ SELECTION BOARD BATCH REPORT: ${String(course.title || 'COURSE').toUpperCase()} ✦`);
  lines.push('=========================================================================');
  lines.push(`✦ Course Title: ${course.title || 'N/A'}`);
  lines.push(`✦ Course ID: ${course.id || course._id || 'N/A'}`);
  lines.push(`✦ Status: ${course.isLive ? '🔴 LIVE (+ Recorded)' : '📦 RECORDED'}`);
  lines.push(`✦ Total Topics: ${topics.length}`);
  lines.push(`✦ Total Lecture Classes: ${totalLectures}`);
  lines.push(`✦ Total PDFs/Notes: ${totalPdfs}`);
  lines.push(`✦ Powered By: NT • Selection Way Exporter (built by t.me/devnaitikanonymous)`);
  lines.push(`✦ Telegram Community: t.me/learn_topper`);
  lines.push(`✦ Generated On: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
  lines.push('-------------------------------------------------------------------------');
  lines.push('                           TABLE OF CONTENTS                             ');
  lines.push('-------------------------------------------------------------------------');

  topics.forEach((topic, idx) => {
    const topicClassesCount = Array.isArray(topic.classes) ? topic.classes.length : 0;
    const topicNum = String(idx + 1).padStart(2, '0');
    lines.push(`${topicNum}. [Topic] ${topic.topicName || 'Untitled Topic'} (${topicClassesCount} Lectures)`);
  });

  lines.push('');

  topics.forEach((topic, idx) => {
    const topicNum = String(idx + 1).padStart(2, '0');
    lines.push('=========================================================================');
    lines.push(`TOPIC ${topicNum}: ${String(topic.topicName || 'UNTITLED').toUpperCase()}`);
    lines.push('=========================================================================');

    const classes = topic.classes || [];
    if (classes.length === 0) {
      lines.push('  No lectures available in this topic yet.');
      lines.push('');
      return;
    }

    classes.forEach((cls: any, cIdx: number) => {
      const lecNum = String(cIdx + 1).padStart(2, '0');
      lines.push(`  ▶ LECTURE ${lecNum}: ${cls.title || 'Untitled Lecture'}`);
      lines.push('    -----------------------------------------------------------------');
      lines.push(`    • Faculty: ${cls.teacherName || 'Instructor'}`);
      lines.push(`    • Duration: ${formatDuration(cls.duration)}`);

      if (includeDescription && cls.description) {
        const cleanDesc = String(cls.description)
          .replace(/\r\n/g, ' ')
          .replace(/\n/g, '      ');
        lines.push(`    • Description: ${cleanDesc}`);
      }

      if (includeHls && cls.class_link) {
        lines.push(`    • HLS Stream link: ${cleanUrl(cls.class_link)}`);
      }

      if (cls.videoKey) {
        lines.push(`    • Video Auth Key: ${cls.videoKey}`);
      }

      if (includeDirectMp4 && Array.isArray(cls.mp4Recordings) && cls.mp4Recordings.length > 0) {
        lines.push('    • MP4 Videos (Direct links):');
        const preferred =
          cls.mp4Recordings.find((k: any) => k.quality === preferredQuality) ||
          cls.mp4Recordings[0];
        if (preferred) {
          const sizeStr = preferred.size ? ` (~${preferred.size}MB)` : '';
          lines.push(`      🟢 [Preferred] ${preferred.quality}: ${cleanUrl(preferred.url)}${sizeStr}`);
        }
        cls.mp4Recordings.forEach((k: any) => {
          if (k !== preferred) {
            const sizeStr = k.size ? ` (~${k.size}MB)` : '';
            lines.push(`         - ${k.quality}: ${cleanUrl(k.url)}${sizeStr}`);
          }
        });
      }

      if (includePdfs && Array.isArray(cls.classPdf) && cls.classPdf.length > 0) {
        lines.push('    • Class PDFs / Notes:');
        cls.classPdf.forEach((pdf: any, pIdx: number) => {
          lines.push(`      📄 [PDF ${pIdx + 1}] ${pdf.name || 'PDF Document'}: ${cleanUrl(pdf.url)}`);
        });
      }

      lines.push('');
    });
  });

  lines.push('=========================================================================');
  lines.push('                           DIRECT LINKS APPENDIX                         ');
  lines.push('=========================================================================');

  if (includeDirectMp4) {
    lines.push(`🌐 ALL MP4 DIRECT DIRECTORY (${preferredQuality} Priority):`);
    lines.push('-------------------------------------------------------------------------');
    let mp4Count = 0;
    topics.forEach((topic) => {
      (topic.classes || []).forEach((cls: any) => {
        if (Array.isArray(cls.mp4Recordings) && cls.mp4Recordings.length > 0) {
          const pref =
            cls.mp4Recordings.find((k: any) => k.quality === preferredQuality) ||
            cls.mp4Recordings[0];
          lines.push(`# Lecture: ${cls.title || 'Lecture'}`);
          lines.push(cleanUrl(pref.url));
          mp4Count++;
        }
      });
    });
    if (mp4Count === 0) {
      lines.push('No direct MP4 links found.');
    }
    lines.push('');
  }

  if (includePdfs) {
    lines.push('📄 ALL STUDY NOTES PDFs DIRECTORY:');
    lines.push('-------------------------------------------------------------------------');
    let pdfCount = 0;
    topics.forEach((topic) => {
      (topic.classes || []).forEach((cls: any) => {
        if (Array.isArray(cls.classPdf) && cls.classPdf.length > 0) {
          cls.classPdf.forEach((pdf: any) => {
            lines.push(`# Note: ${pdf.name || 'PDF'} (from: ${cls.title || 'Lecture'})`);
            lines.push(cleanUrl(pdf.url));
            pdfCount++;
          });
        }
      });
    });
    if (pdfCount === 0) {
      lines.push('No class PDFs found.');
    }
    lines.push('');
  }

  lines.push('=========================================================================');
  lines.push('✦ Built by: t.me/devnaitikanonymous | Join Telegram: t.me/learn_topper ✦');
  lines.push('=========================================================================');

  return lines.join('\n');
}

/**
 * Generates the Streaming Playlist (.m3u) for Selection Way
 */
export function generateSWM3U(
  courseData: { course: any; classes: any[] },
  options: { streamType?: 'hls' | 'mp4'; preferredQuality?: string } = {}
): string {
  const { streamType = 'hls', preferredQuality = '720p' } = options;
  const course = courseData.course || {};
  const topics = courseData.classes || [];

  const lines: string[] = [];
  lines.push('#EXTM3U');
  lines.push('#EXTENC:UTF-8');
  lines.push(`#PLAYLIST:${course.title || 'Selection Batch'}`);

  let lectureIndex = 1;
  topics.forEach((topic) => {
    const topicName = topic.topicName || 'Classes';
    (topic.classes || []).forEach((cls: any) => {
      let streamUrl = '';
      if (streamType === 'hls' && cls.class_link) {
        streamUrl = cleanUrl(cls.class_link);
      } else if (Array.isArray(cls.mp4Recordings) && cls.mp4Recordings.length > 0) {
        const pref =
          cls.mp4Recordings.find((k: any) => k.quality === preferredQuality) ||
          cls.mp4Recordings[0];
        streamUrl = cleanUrl(pref.url);
      } else if (cls.class_link) {
        streamUrl = cleanUrl(cls.class_link);
      }

      if (streamUrl) {
        const num = String(lectureIndex).padStart(2, '0');
        const durationSec = cls.duration ? Math.floor(Number(cls.duration)) : -1;
        const infoTitle = `L${num} | [${topicName}] ${cls.title || 'Lecture'}`;

        lines.push(`#EXTINF:${durationSec},${infoTitle}`);
        lines.push(`#EXTGRP:${topicName}`);
        lines.push(streamUrl);
        lectureIndex++;
      }
    });
  });

  return lines.join('\n');
}

/**
 * Generates the Bash Script (Linux/sh) with wget loop integration
 */
export function generateSWBash(
  courseData: { course: any; classes: any[] },
  options: { preferredQuality?: string } = {}
): string {
  const { preferredQuality = '720p' } = options;
  const course = courseData.course || {};
  const topics = courseData.classes || [];

  const courseFolder = (course.title || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  const lines: string[] = [];

  lines.push('#!/bin/bash');
  lines.push(`# Script to batch download MP4 course lectures for: ${course.title || 'Course'}`);
  lines.push('# Generated by NT Batch Extractor (Selection Board)');
  lines.push('# Create an output folder and download');
  lines.push(`mkdir -p "${courseFolder}"`);
  lines.push(`cd "${courseFolder}"`);
  lines.push('');

  let lectureIndex = 1;
  topics.forEach((topic) => {
    const topicFolder = (topic.topicName || 'Topic').replace(/[^a-zA-Z0-9_-]/g, '_');
    lines.push(`mkdir -p "${topicFolder}"`);

    (topic.classes || []).forEach((cls: any) => {
      if (Array.isArray(cls.mp4Recordings) && cls.mp4Recordings.length > 0) {
        const pref =
          cls.mp4Recordings.find((k: any) => k.quality === preferredQuality) ||
          cls.mp4Recordings[0];
        const cleanTitle = (cls.title || 'Lecture').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const num = String(lectureIndex).padStart(2, '0');
        const filename = `L${num}_${cleanTitle}_${pref.quality || 'mp4'}.mp4`;

        lines.push(`wget -O "${topicFolder}/${filename}" "${cleanUrl(pref.url)}"`);
      }
      lectureIndex++;
    });
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Generates the PowerShell (Windows) Invoke-WebRequest loop
 */
export function generateSWPowerShell(
  courseData: { course: any; classes: any[] },
  options: { preferredQuality?: string } = {}
): string {
  const { preferredQuality = '720p' } = options;
  const course = courseData.course || {};
  const topics = courseData.classes || [];

  const courseFolder = (course.title || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  const lines: string[] = [];

  lines.push(`# PowerShell Script to batch download MP4 course lectures for: ${course.title || 'Course'}`);
  lines.push('# Generated by NT Batch Extractor (Selection Board)');
  lines.push(`New-Item -ItemType Directory -Force -Path "${courseFolder}"`);
  lines.push(`Set-Location "${courseFolder}"`);
  lines.push('');

  let lectureIndex = 1;
  topics.forEach((topic) => {
    const topicFolder = (topic.topicName || 'Topic').replace(/[^a-zA-Z0-9_-]/g, '_');
    lines.push(`New-Item -ItemType Directory -Force -Path "${topicFolder}"`);

    (topic.classes || []).forEach((cls: any) => {
      if (Array.isArray(cls.mp4Recordings) && cls.mp4Recordings.length > 0) {
        const pref =
          cls.mp4Recordings.find((k: any) => k.quality === preferredQuality) ||
          cls.mp4Recordings[0];
        const cleanTitle = (cls.title || 'Lecture').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const num = String(lectureIndex).padStart(2, '0');
        const filename = `L${num}_${cleanTitle}_${pref.quality || 'mp4'}.mp4`;

        lines.push(
          `Invoke-WebRequest -Uri "${cleanUrl(pref.url)}" -OutFile "${topicFolder}/${filename}"`
        );
      }
      lectureIndex++;
    });
    lines.push('');
  });

  return lines.join('\n');
}
