import { AchievementsScorer } from './achievements.scorer';
import { EducationScorer } from './education.scorer';
import { ExperienceScorer } from './experience.scorer';
import { RelevanceScorer } from './relevance.scorer';
import { SkillsScorer } from './skills.scorer';

export interface JdContext {
  content: string;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredExperienceYears: number | null;
  requiredEducation: string | null;
  weightSkills: number;
  weightExperience: number;
  weightEducation: number;
  weightAchievements: number;
  weightRelevance: number;
}

export interface CategoryScore {
  category: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
}

export interface ScoringResult {
  overallScore: number;
  recommendation: string;
  categories: CategoryScore[];
  processingTimeMs: number;
}

export class NlpScoringService {
  private skillsScorer = new SkillsScorer();
  private experienceScorer = new ExperienceScorer();
  private educationScorer = new EducationScorer();
  private achievementsScorer = new AchievementsScorer();
  private relevanceScorer = new RelevanceScorer();

  async score(cvText: string, jd: JdContext): Promise<ScoringResult> {
    const start = Date.now();

    const [skills, experience, education, achievements, relevance] = await Promise.all([
      this.skillsScorer.score(cvText, jd.requiredSkills, jd.preferredSkills),
      Promise.resolve(this.experienceScorer.score(cvText, jd.requiredExperienceYears)),
      Promise.resolve(this.educationScorer.score(cvText, jd.requiredEducation)),
      Promise.resolve(this.achievementsScorer.score(cvText)),
      Promise.resolve(this.relevanceScorer.score(cvText, jd.content)),
    ]);

    const categories: CategoryScore[] = [
      {
        category: 'SKILLS',
        rawScore: skills.rawScore,
        weight: jd.weightSkills,
        weightedScore: skills.rawScore * jd.weightSkills,
        rationale: skills.rationale,
        evidence: skills.evidence,
        gaps: skills.gaps,
      },
      {
        category: 'EXPERIENCE',
        rawScore: experience.rawScore,
        weight: jd.weightExperience,
        weightedScore: experience.rawScore * jd.weightExperience,
        rationale: experience.rationale,
        evidence: experience.evidence,
        gaps: experience.gaps,
      },
      {
        category: 'EDUCATION',
        rawScore: education.rawScore,
        weight: jd.weightEducation,
        weightedScore: education.rawScore * jd.weightEducation,
        rationale: education.rationale,
        evidence: education.evidence,
        gaps: education.gaps,
      },
      {
        category: 'ACHIEVEMENTS',
        rawScore: achievements.rawScore,
        weight: jd.weightAchievements,
        weightedScore: achievements.rawScore * jd.weightAchievements,
        rationale: achievements.rationale,
        evidence: achievements.evidence,
        gaps: achievements.gaps,
      },
      {
        category: 'RELEVANCE',
        rawScore: relevance.rawScore,
        weight: jd.weightRelevance,
        weightedScore: relevance.rawScore * jd.weightRelevance,
        rationale: relevance.rationale,
        evidence: relevance.evidence,
        gaps: relevance.gaps,
      },
    ];

    const overallScore = Math.min(
      1,
      categories.reduce((sum, cat) => sum + cat.weightedScore, 0),
    );

    return {
      overallScore,
      recommendation: this.getRecommendation(overallScore),
      categories,
      processingTimeMs: Date.now() - start,
    };
  }

  private getRecommendation(score: number): string {
    if (score >= 0.85) return 'STRONG_YES';
    if (score >= 0.7) return 'YES';
    if (score >= 0.55) return 'MAYBE';
    if (score >= 0.4) return 'NO';
    return 'STRONG_NO';
  }
}

export const nlpScoringService = new NlpScoringService();
