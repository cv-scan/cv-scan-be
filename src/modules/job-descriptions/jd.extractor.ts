import type { EmploymentType, ExperienceLevel } from '@prisma/client';
import nlp from 'compromise';
import { TECH_KEYWORDS, normalizeSkill } from '../../services/scoring/synonym.map';

const PREFERRED_MARKERS =
  /(?:preferred|nice to have|bonus|plus|advantageous|optional|desired|ideally|would be great|is a plus|ưu tiên|là một lợi thế|là lợi thế|lợi thế)/i;
const REQUIRED_MARKERS =
  /(?:required|must have|essential|mandatory|minimum|necessary|you must|you will need|we require|yêu cầu|bắt buộc|cần có|phải có)/i;

function extractSkillsFromSection(text: string): string[] {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();

  for (const keyword of TECH_KEYWORDS) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,;(/'"])${escaped}(?=[\\s,;).!?/'"]|$)`, 'i');
    if (regex.test(lowerText)) {
      found.add(normalizeSkill(keyword));
    }
  }

  // NLP noun phrases
  const doc = nlp(text);
  const nouns = doc.nouns().out('array') as string[];
  for (const noun of nouns) {
    const normalized = normalizeSkill(noun);
    if (TECH_KEYWORDS.has(normalized)) {
      found.add(normalized);
    }
  }

  return Array.from(found);
}

export interface ExtractedJdSkills {
  requiredSkills: string[];
  preferredSkills: string[];
}

// ─── Metadata extraction ─────────────────────────────────────────────────────

export interface ExtractedJdMetadata extends ExtractedJdSkills {
  title: string;
  location?: string;
  employmentTypes: EmploymentType[];
  department?: string;
  experienceLevel?: ExperienceLevel;
  requiredExperienceYears?: number;
  requiredEducation?: string;
}

/** Insert newline before emoji so concatenated fields become separate lines */
function splitOnEmoji(text: string): string {
  return text.replace(/(\p{Extended_Pictographic})/gu, '\n$1');
}

function cleanValue(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '') // variation selector
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(text: string): string {
  const m = text.match(/(?:vị\s*trí|position)\s*:\s*(.+)/i);
  if (m) return cleanValue(m[1]);
  // Fallback: first short non-empty line
  for (const line of text.split('\n')) {
    const c = cleanValue(line);
    if (c.length >= 3 && c.length <= 200) return c;
  }
  return '';
}

function extractLocation(text: string): string | undefined {
  const m = text.match(/(?:địa\s*điểm[^:]*|location|nơi\s*làm\s*việc)\s*:\s*(.+)/i);
  return m ? cleanValue(m[1]) || undefined : undefined;
}

function extractEmploymentType(text: string): EmploymentType[] {
  const m = text.match(
    /(?:thời\s*gian|employment\s*type|hình\s*thức(?:\s*làm\s*việc)?)\s*:\s*(.+)/i,
  );
  if (!m) return [];
  const raw = cleanValue(m[1]);
  const types: EmploymentType[] = [];
  if (/full.?time|toàn\s*thời\s*gian/i.test(raw)) types.push('FULL_TIME');
  if (/part.?time|bán\s*thời\s*gian/i.test(raw)) types.push('PART_TIME');
  if (/contract|hợp\s*đồng/i.test(raw)) types.push('CONTRACT');
  if (/intern|thực\s*tập/i.test(raw)) types.push('INTERNSHIP');
  if (/freelance/i.test(raw)) types.push('FREELANCE');
  return types;
}

function extractDepartment(text: string): string | undefined {
  // "Báo cáo trực tiếp: Trưởng phòng Marketing/Truyền thông"
  const reportMatch = text.match(/báo\s*cáo\s*trực\s*tiếp\s*:\s*(?:trưởng\s*phòng\s*)?(.+)/i);
  if (reportMatch) return cleanValue(reportMatch[1]) || undefined;
  const deptMatch = text.match(/(?:department|phòng\s*ban)\s*:\s*(.+)/i);
  if (deptMatch) return cleanValue(deptMatch[1]) || undefined;
  return undefined;
}

function extractExperienceLevel(text: string): ExperienceLevel | undefined {
  if (/thực\s*tập\s*sinh|intern(?:ship)?/i.test(text)) return 'INTERN';
  if (/senior|cao\s*cấp|cấp\s*cao/i.test(text)) return 'SENIOR';
  if (/junior|fresher|mới\s*ra\s*trường/i.test(text)) return 'JUNIOR';
  if (/mid.?level|trung\s*cấp/i.test(text)) return 'MID_LEVEL';
  if (/trưởng\s*nhóm|team\s*lead/i.test(text)) return 'LEAD';
  if (/quản\s*lý|manager/i.test(text)) return 'MANAGER';
  return undefined;
}

function extractExperienceYears(text: string): number | undefined {
  const m = text.match(/(\d+)\+?\s*(?:năm|years?)\s*(?:kinh\s*nghiệm|experience)?/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isNaN(n) ? undefined : n;
}

function extractEducation(text: string): string | undefined {
  if (/tiến\s*sĩ|phd|doctorate/i.test(text)) return 'PhD';
  if (/thạc\s*sĩ|master'?s?/i.test(text)) return "Master's Degree";
  if (/cử\s*nhân|bachelor'?s?|đại\s*học/i.test(text)) return "Bachelor's Degree";
  if (/cao\s*đẳng|associate\s*degree/i.test(text)) return 'College Degree';
  if (/sinh\s*viên/i.test(text)) return 'Student';
  return undefined;
}

const ACHIEVEMENT_KEYWORDS =
  /portfolio|side\s*project|open\s*source|publication|award|dự\s*án\s*cá\s*nhân|giải\s*thưởng|đóng\s*góp/i;

/**
 * Infer scoring weights from JD content signals.
 * Returns weights that sum to exactly 1.0.
 */
export function inferScoringWeights(metadata: ExtractedJdMetadata): {
  skills: number;
  experience: number;
  education: number;
  achievements: number;
  relevance: number;
} {
  // Raw signal scores — higher = more important in this JD
  const skillCount = metadata.requiredSkills.length + metadata.preferredSkills.length * 0.5;
  const rawSkills = 3.5 + Math.min(skillCount, 12) * 0.1;           // 3.5–4.7
  const rawExperience = metadata.requiredExperienceYears !== undefined
    ? 2.5 + Math.min(metadata.requiredExperienceYears, 10) * 0.1    // 2.5–3.5
    : 2.0;
  const rawEducation = metadata.requiredEducation !== undefined ? 1.8 : 0.8;
  const rawAchievements = ACHIEVEMENT_KEYWORDS.test(
    metadata.requiredSkills.concat(metadata.preferredSkills).join(' '),
  ) ? 1.2 : 0.8;
  const rawRelevance = 0.9; // always baseline

  const total = rawSkills + rawExperience + rawEducation + rawAchievements + rawRelevance;

  const r = (n: number) => Math.round(n * 100) / 100;
  const skills = r(rawSkills / total);
  const experience = r(rawExperience / total);
  const education = r(rawEducation / total);
  const achievements = r(rawAchievements / total);
  // Compute remainder to guarantee exact sum = 1.0
  const relevance = r(1 - skills - experience - education - achievements);

  return { skills, experience, education, achievements, relevance };
}

export function extractJdMetadata(rawText: string): ExtractedJdMetadata {
  // Normalize: split concatenated emoji-separated fields onto separate lines
  const normalized = splitOnEmoji(rawText);

  const title = extractTitle(normalized);
  const location = extractLocation(normalized);
  const employmentTypes = extractEmploymentType(normalized);
  const department = extractDepartment(normalized);
  const experienceLevel = extractExperienceLevel(rawText);
  const requiredExperienceYears = extractExperienceYears(rawText);
  const requiredEducation = extractEducation(rawText);
  const { requiredSkills, preferredSkills } = extractSkillsFromJD(rawText);

  return {
    title,
    location,
    employmentTypes,
    department,
    experienceLevel,
    requiredExperienceYears,
    requiredEducation,
    requiredSkills,
    preferredSkills,
  };
}

export function extractSkillsFromJD(jdText: string): ExtractedJdSkills {
  // Split by double newlines into paragraphs/sections
  const sections = jdText.split(/\n{2,}/);

  const requiredSkills = new Set<string>();
  const preferredSkills = new Set<string>();

  let currentMode: 'required' | 'preferred' | 'auto' = 'auto';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Detect section heading
    if (REQUIRED_MARKERS.test(trimmed)) {
      currentMode = 'required';
    } else if (PREFERRED_MARKERS.test(trimmed)) {
      currentMode = 'preferred';
    }

    const skills = extractSkillsFromSection(trimmed);

    if (currentMode === 'preferred') {
      for (const s of skills) preferredSkills.add(s);
    } else {
      // 'required' or 'auto' — put in required
      for (const s of skills) requiredSkills.add(s);
    }
  }

  // Remove preferred skills that are also required (required takes precedence)
  for (const s of requiredSkills) {
    preferredSkills.delete(s);
  }

  return {
    requiredSkills: Array.from(requiredSkills),
    preferredSkills: Array.from(preferredSkills),
  };
}
