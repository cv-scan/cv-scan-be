import natural from 'natural';

export interface RelevanceScorerResult {
  rawScore: number;
  rationale: string;
  evidence: string[];
  gaps: string[];
}

export class RelevanceScorer {
  score(cvText: string, jdText: string): RelevanceScorerResult {
    if (!cvText || !jdText) {
      return { rawScore: 0, rationale: 'Empty input', evidence: [], gaps: [] };
    }

    const tokenizer = new natural.WordTokenizer();
    const stemmer = natural.PorterStemmer;
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'can',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'must',
      'that',
      'this',
      'it',
      'its',
    ]);

    const tokenize = (text: string): string[] =>
      (tokenizer.tokenize(text.toLowerCase()) ?? [])
        .filter((t) => t.length > 2 && !stopWords.has(t))
        .map((t) => stemmer.stem(t));

    const cvStems = tokenize(cvText);
    const jdStems = tokenize(jdText);

    // Jaccard similarity
    const cvSet = new Set(cvStems);
    const jdSet = new Set(jdStems);
    const intersection = new Set([...cvSet].filter((t) => jdSet.has(t)));
    const union = new Set([...cvSet, ...jdSet]);
    const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;

    // TF-IDF keyword matching
    const tfidf = new natural.TfIdf();
    tfidf.addDocument(cvText);
    tfidf.addDocument(jdText);

    const jdTerms = tfidf.listTerms(1).slice(0, 20);
    const matchedTerms: string[] = [];

    for (const { term } of jdTerms) {
      if (cvText.toLowerCase().includes(term.toLowerCase())) {
        matchedTerms.push(term);
      }
    }

    const termScore = jdTerms.length > 0 ? matchedTerms.length / jdTerms.length : 0;

    // Combine: Jaccard (scaled) + term match
    const rawScore = Math.min(1, jaccardScore * 3 * 0.4 + termScore * 0.6);

    return {
      rawScore,
      rationale: `Jaccard: ${(jaccardScore * 100).toFixed(1)}%, key term match: ${(termScore * 100).toFixed(1)}%`,
      evidence: matchedTerms.slice(0, 8),
      gaps: [],
    };
  }
}
