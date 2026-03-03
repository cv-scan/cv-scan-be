const EXPERIENCE_PATTERNS = [
  /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/gi,
  /(?:experience|exp)\s*(?:of\s+)?(\d+)\+?\s*(?:years?|yrs?)/gi,
  /over\s+(\d+)\s*(?:years?|yrs?)/gi,
  /(\d+)\s*[-–]\s*(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/gi,
];

export function extractExperienceYears(text: string): number {
  let maxYears = 0;

  for (const pattern of EXPERIENCE_PATTERNS) {
    const copy = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = copy.exec(text)) !== null) {
      const years = parseInt(match[1] ?? match[2] ?? '0', 10);
      if (!Number.isNaN(years) && years > 0 && years < 50) {
        maxYears = Math.max(maxYears, years);
      }
    }
  }

  // Infer from date spans if no direct mention
  if (maxYears === 0) {
    const yearMatches = text.match(/\b(19[89]\d|20[012]\d)\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const years = yearMatches.map(Number).sort((a, b) => a - b);
      const span = years[years.length - 1] - years[0];
      if (span > 0 && span < 50) {
        maxYears = Math.floor(span * 0.8);
      }
    }
  }

  return maxYears;
}

export interface ExperienceScorerResult {
  rawScore: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
  extractedYears: number;
}

export class ExperienceScorer {
  score(cvText: string, requiredYears: number | null | undefined): ExperienceScorerResult {
    const extractedYears = extractExperienceYears(cvText);

    if (!requiredYears || requiredYears === 0) {
      const rawScore = extractedYears > 0 ? Math.min(1, 0.5 + extractedYears * 0.04) : 0.3;
      return {
        rawScore,
        rationale: 'No specific experience requirement',
        evidence: extractedYears > 0 ? [`${extractedYears} years detected`] : [],
        gaps: [],
        extractedYears,
      };
    }

    let rawScore: number;
    if (extractedYears === 0) {
      rawScore = 0.1;
    } else if (extractedYears >= requiredYears) {
      const bonus = Math.min(0.1, (extractedYears - requiredYears) * 0.01);
      rawScore = Math.min(1, 0.9 + bonus);
    } else {
      rawScore = (extractedYears / requiredYears) * 0.8;
    }

    const gaps =
      extractedYears < requiredYears
        ? [`Requires ${requiredYears}y, detected ${extractedYears}y`]
        : [];

    return {
      rawScore,
      rationale: `Detected ${extractedYears}y experience, required ${requiredYears}y`,
      evidence: extractedYears > 0 ? [`${extractedYears} years of experience`] : [],
      gaps,
      extractedYears,
    };
  }
}
