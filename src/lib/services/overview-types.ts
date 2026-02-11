export type LookThroughMeta = {
  coveragePct: number;
  totalEtfValue: number;
  coveredEtfValue: number;
  uncoveredEtfValue: number;
  staleness: Array<{
    etfSymbol: string;
    asOfDate: string | null;
  }>;
};

export type ExposureBucket = {
  key: string;
  marketValue: number;
  portfolioWeightPct: number;
};

export type ClassificationSummary = {
  classifiedValue: number;
  unclassifiedValue: number;
  classifiedPct: number;
  unclassifiedPct: number;
};

export type ClassificationBreakdown = {
  byCountry: ExposureBucket[];
  bySector: ExposureBucket[];
  byIndustry: ExposureBucket[];
  byCurrency: ExposureBucket[];
  summaries: {
    country: ClassificationSummary;
    sector: ClassificationSummary;
    industry: ClassificationSummary;
    currency: ClassificationSummary;
  };
};
