import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    explanation: String,
    fix: String,
  },
  { _id: false },
);

const StrengthSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    evidence: String,
  },
  { _id: false },
);

const bulletRewriteSchema = new mongoose.Schema(
  {
    section: String, //eg. "experincces"
    original: { type: String, required: true },
    rewritten: { type: String, required: true },
    rationale: String,
  },
  { _id: true },
);

const scoredBreakdownSchema = new mongoose.Schema(
  {
    keywords: { type: Number, min: 0, max: 25 },
    formatting: { type: Number, min: 0, max: 25 },
    impact: { type: Number, min: 0, max: 25 },
    clarity: { type: Number, min: 0, max: 25 },
  },
  { _id: false },
);

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true,
    },
    versionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeVersion",
      required: true,
      index: true,
    },

    atsScore: { type: Number, min: 0, max: 100, required: true },
    scoredBreakdown: scoredBreakdownSchema,
    issues: { type: [issueSchema], default: [] },
    strengths: { type: [StrengthSchema], default: [] },
    bulletsRewrites: { type: [bulletRewriteSchema], default: [] },
    keywordsPresent: { type: [String], default: [] },
    keywordsMissing: { type: [String], default: [] },
    summary: { type: String, default: "" },
    model: { type: String, default: "" },
    promptTokens: Number,
    responseTokens: Number,
  },
  { timestamps: true },
);

const Analysis = mongoose.model("Analysis", analysisSchema);

export default Analysis;
