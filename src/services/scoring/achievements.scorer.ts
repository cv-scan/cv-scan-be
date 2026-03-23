const ACHIEVEMENT_PATTERNS = [
  /(?:increased?|grew?|boosted?|improved?|enhanced?)\s+\w[\w\s]*\s+by\s+\d+\s*%/gi,
  /(?:reduced?|decreased?|cut|lowered?|minimized?)\s+\w[\w\s]*\s+by\s+\d+\s*%/gi,
  /\d+\s*%\s+(?:increase|decrease|improvement|reduction|growth|faster|better)/gi,
  /\d+x\s+(?:improvement|increase|faster|better|growth|performance|speedup)/gi,
  /(?:managed?|led?|oversaw?|supervised?)\s+(?:team of\s+)?\d+\s+(?:people|engineers?|developers?|employees?|members?)/gi,
  /(?:served?|handled?)\s+\d+[kmb]?\+?\s*(?:users?|customers?|clients?|requests?)/gi,
  /(?:processed?|handled?)\s+\d+[kmb]?\+?\s*(?:transactions?|requests?|records?|events?)/gi,
  /\$[\d,.]+[kmb]?\s*(?:in\s+)?(?:revenue|savings?|budget|funding|sales)/gi,
  /(?:saved?|generated?|earned?|raised?)\s+\$[\d,.]+[kmb]?/gi,
  /(?:received?|won|earned?)\s+(?:the\s+)?(?:\w+\s+)?(?:award|prize|recognition|certification)/gi,
  /(?:ranked?|rated?|voted?|selected?|chosen?)\s+(?:as\s+)?(?:top|best|#\d+|\d+st|\d+nd|\d+rd|\d+th)/gi,
  /(?:published?|authored?|co-authored?)\s+\d+\s+(?:papers?|articles?|books?)/gi,
  /(?:launched?|deployed?|shipped?|released?|delivered?)\s+\w+\s+(?:product|feature|service|platform|app)/gi,
  /zero\s+(?:downtime|incidents?|defects?)/gi,
  /\d+\s+(?:patents?|publications?|certifications?)/gi,
];

export interface AchievementsScorerResult {
  rawScore: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
  achievementCount: number;
}

export class AchievementsScorer {
  score(cvText: string): AchievementsScorerResult {
    const seen = new Set<string>();
    const achievements: string[] = [];

    for (const pattern of ACHIEVEMENT_PATTERNS) {
      const copy = new RegExp(pattern.source, pattern.flags);
      while (true) {
        const match = copy.exec(cvText);
        if (match === null) break;
        const key = match[0].toLowerCase().slice(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          achievements.push(match[0].slice(0, 120));
        }
      }
    }

    const count = achievements.length;

    let rawScore: number;
    if (count === 0) rawScore = 0.1;
    else if (count === 1) rawScore = 0.4;
    else if (count === 2) rawScore = 0.6;
    else if (count === 3) rawScore = 0.75;
    else if (count <= 5) rawScore = 0.88;
    else rawScore = 1.0;

    return {
      rawScore,
      rationale: `Found ${count} quantifiable achievement${count !== 1 ? "s" : ""}`,
      evidence: achievements.slice(0, 10),
      gaps: count === 0 ? ["No quantifiable achievements detected"] : [],
      achievementCount: count,
    };
  }
}
