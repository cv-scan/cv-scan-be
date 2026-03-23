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
  employmentType?: string;
  department?: string;
  experienceLevel?: string;
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

function extractEmploymentType(text: string): string | undefined {
  const m = text.match(
    /(?:thời\s*gian|employment\s*type|hình\s*thức(?:\s*làm\s*việc)?)\s*:\s*(.+)/i,
  );
  if (!m) return undefined;
  const raw = cleanValue(m[1]);
  const hasFullTime = /full.?time|toàn\s*thời\s*gian/i.test(raw);
  const hasPartTime = /part.?time|bán\s*thời\s*gian/i.test(raw);
  if (hasFullTime && hasPartTime) return 'Full-time / Part-time';
  if (hasFullTime) return 'Full-time';
  if (hasPartTime) return 'Part-time';
  if (/hybrid/i.test(raw)) return 'Hybrid';
  if (/remote|từ\s*xa/i.test(raw)) return 'Remote';
  return raw || undefined;
}

function extractDepartment(text: string): string | undefined {
  // "Báo cáo trực tiếp: Trưởng phòng Marketing/Truyền thông"
  const reportMatch = text.match(/báo\s*cáo\s*trực\s*tiếp\s*:\s*(?:trưởng\s*phòng\s*)?(.+)/i);
  if (reportMatch) return cleanValue(reportMatch[1]) || undefined;
  const deptMatch = text.match(/(?:department|phòng\s*ban)\s*:\s*(.+)/i);
  if (deptMatch) return cleanValue(deptMatch[1]) || undefined;
  return undefined;
}

function extractExperienceLevel(text: string): string | undefined {
  if (/thực\s*tập\s*sinh|intern(?:ship)?/i.test(text)) return 'Intern';
  if (/senior|cao\s*cấp|cấp\s*cao/i.test(text)) return 'Senior';
  if (/junior|fresher|mới\s*ra\s*trường/i.test(text)) return 'Junior';
  if (/mid.?level|trung\s*cấp/i.test(text)) return 'Mid-level';
  if (/trưởng\s*nhóm|team\s*lead/i.test(text)) return 'Lead';
  if (/quản\s*lý|manager/i.test(text)) return 'Manager';
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

export function extractJdMetadata(rawText: string): ExtractedJdMetadata {
  // Normalize: split concatenated emoji-separated fields onto separate lines
  const normalized = splitOnEmoji(rawText);

  const title = extractTitle(normalized);
  const location = extractLocation(normalized);
  const employmentType = extractEmploymentType(normalized);
  const department = extractDepartment(normalized);
  const experienceLevel = extractExperienceLevel(rawText);
  const requiredExperienceYears = extractExperienceYears(rawText);
  const requiredEducation = extractEducation(rawText);
  const { requiredSkills, preferredSkills } = extractSkillsFromJD(rawText);

  return {
    title,
    location,
    employmentType,
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
