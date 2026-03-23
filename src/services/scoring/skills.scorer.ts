import nlp from 'compromise';
import { TECH_KEYWORDS, normalizeSkill } from './synonym.map';

export function extractSkillsFromText(text: string): string[] {
  const lowerText = text.toLowerCase();
  const foundSkills = new Set<string>();

  // Direct keyword matching with word boundaries
  for (const keyword of TECH_KEYWORDS) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,;(])${escaped}(?=[\\s,;).!?]|$)`, 'i');
    if (regex.test(lowerText)) {
      foundSkills.add(keyword);
    }
  }

  // NLP noun extraction + filter
  const doc = nlp(text);
  const nouns = doc.nouns().out('array') as string[];
  for (const noun of nouns) {
    const normalized = normalizeSkill(noun);
    if (TECH_KEYWORDS.has(normalized)) {
      foundSkills.add(normalized);
    }
  }

  return Array.from(foundSkills);
}

export interface SkillsScorerResult {
  rawScore: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
  matchedRequired: string[];
  matchedPreferred: string[];
}

export class SkillsScorer {
  async score(
    cvText: string,
    requiredSkills: string[],
    preferredSkills: string[],
  ): Promise<SkillsScorerResult> {
    const { default: Fuse } = await import('fuse.js');

    const cvSkills = extractSkillsFromText(cvText);
    const normalizedCvSkills = cvSkills.map(normalizeSkill);

    if (requiredSkills.length === 0 && preferredSkills.length === 0) {
      return {
        rawScore: 0.5,
        rationale: 'No specific skills required',
        evidence: normalizedCvSkills.slice(0, 10),
        gaps: [],
        matchedRequired: [],
        matchedPreferred: [],
      };
    }

    const fuse = new Fuse(normalizedCvSkills, { threshold: 0.3, includeScore: true });

    const matchedRequired: string[] = [];
    const missedRequired: string[] = [];
    const matchedPreferred: string[] = [];

    for (const skill of requiredSkills.map(normalizeSkill)) {
      const results = fuse.search(skill);
      const isMatch =
        results.length > 0 && results[0].score !== undefined && results[0].score < 0.3;
      if (isMatch) {
        matchedRequired.push(skill);
      } else {
        missedRequired.push(skill);
      }
    }

    for (const skill of preferredSkills.map(normalizeSkill)) {
      const results = fuse.search(skill);
      const isMatch =
        results.length > 0 && results[0].score !== undefined && results[0].score < 0.3;
      if (isMatch) {
        matchedPreferred.push(skill);
      }
    }

    const requiredScore =
      requiredSkills.length > 0 ? matchedRequired.length / requiredSkills.length : 1;
    const preferredScore =
      preferredSkills.length > 0 ? matchedPreferred.length / preferredSkills.length : 0.5;

    const rawScore =
      requiredSkills.length > 0 ? requiredScore * 0.7 + preferredScore * 0.3 : preferredScore;

    return {
      rawScore: Math.min(1, rawScore),
      rationale: `Matched ${matchedRequired.length}/${requiredSkills.length} required skills, ${matchedPreferred.length}/${preferredSkills.length} preferred`,
      evidence: [...matchedRequired, ...matchedPreferred],
      gaps: missedRequired,
      matchedRequired,
      matchedPreferred,
    };
  }
}
