import nlp from 'compromise';
import { TECH_KEYWORDS, normalizeSkill } from '../../services/scoring/synonym.map';

const PREFERRED_MARKERS =
  /(?:preferred|nice to have|bonus|plus|advantageous|optional|desired|ideally|would be great|is a plus)/i;
const REQUIRED_MARKERS =
  /(?:required|must have|essential|mandatory|minimum|necessary|you must|you will need|we require)/i;

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
