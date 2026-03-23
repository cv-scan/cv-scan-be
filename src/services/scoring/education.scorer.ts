const EDUCATION_LEVELS: Record<string, number> = {
  'high school': 1,
  highschool: 1,
  diploma: 2,
  associate: 2,
  "associate's": 2,
  'associate degree': 2,
  bachelor: 3,
  "bachelor's": 3,
  bs: 3,
  ba: 3,
  bsc: 3,
  'b.s': 3,
  'b.a': 3,
  'b.eng': 3,
  undergraduate: 3,
  master: 4,
  "master's": 4,
  ms: 4,
  ma: 4,
  msc: 4,
  'm.s': 4,
  'm.a': 4,
  mba: 4,
  meng: 4,
  graduate: 4,
  phd: 5,
  'ph.d': 5,
  'ph.d.': 5,
  doctorate: 5,
  doctoral: 5,
  postdoctoral: 6,
  postdoc: 6,
};

const LEVEL_NAMES = [
  'None',
  'High School',
  "Associate's",
  "Bachelor's",
  "Master's",
  'PhD',
  'Postdoctoral',
];

function detectEducationLevel(text: string): number {
  const lower = text.toLowerCase();
  let maxLevel = 0;
  for (const [term, level] of Object.entries(EDUCATION_LEVELS)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      maxLevel = Math.max(maxLevel, level);
    }
  }
  return maxLevel;
}

function parseRequiredEducation(requiredEdu: string | null | undefined): number {
  if (!requiredEdu) return 0;
  const lower = requiredEdu.toLowerCase();
  for (const [term, level] of Object.entries(EDUCATION_LEVELS)) {
    if (lower.includes(term)) return level;
  }
  return 0;
}

export interface EducationScorerResult {
  rawScore: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
  detectedLevel: number;
}

export class EducationScorer {
  score(cvText: string, requiredEducation: string | null | undefined): EducationScorerResult {
    const detectedLevel = detectEducationLevel(cvText);
    const requiredLevel = parseRequiredEducation(requiredEducation);

    if (requiredLevel === 0) {
      const rawScore = detectedLevel > 0 ? Math.min(1, 0.6 + detectedLevel * 0.05) : 0.5;
      return {
        rawScore,
        rationale: 'No specific education requirement',
        evidence: detectedLevel > 0 ? [`${LEVEL_NAMES[detectedLevel]} detected`] : [],
        gaps: [],
        detectedLevel,
      };
    }

    let rawScore: number;
    if (detectedLevel === 0) {
      rawScore = 0.1;
    } else if (detectedLevel >= requiredLevel) {
      rawScore = Math.min(1, 0.9 + (detectedLevel - requiredLevel) * 0.05);
    } else {
      rawScore = (detectedLevel / requiredLevel) * 0.6;
    }

    const gaps =
      detectedLevel < requiredLevel
        ? [
            `Requires ${LEVEL_NAMES[requiredLevel]}, detected ${LEVEL_NAMES[detectedLevel] ?? 'None'}`,
          ]
        : [];

    return {
      rawScore,
      rationale: `Detected ${LEVEL_NAMES[detectedLevel] ?? 'no formal'} education, required ${LEVEL_NAMES[requiredLevel]}`,
      evidence: detectedLevel > 0 ? [`${LEVEL_NAMES[detectedLevel]} degree`] : [],
      gaps,
      detectedLevel,
    };
  }
}
