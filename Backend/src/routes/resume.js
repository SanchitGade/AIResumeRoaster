import express, { application } from "express";
import mongoose, { version } from "mongoose";
import { z } from "zod";
import ApiError from "../utils/ApiError.js";
import requiredAuth from "../middleware/auth.js";
import uploadPdf from "../middleware/upload.js";
import validate from "../middleware/validate.js";
import Resume from "../models/Resume.js";
import extractText from "../services/pdfService.js";
import parseResume from "../services/structureParser.js";
import ResumeVersion from "../models/ResumeVersion.js";
import asyncHandler from "../utils/asyncHandler.js";
import { analyzeLimiter } from "../middleware/rateLimit.js";
import Analysis from "../models/Analysis.js";
import analyzeResume from "../services/geminiService.js";
import { diffText, summarize } from "../services/diffService.js";

const router = express.Router();
router.use(requiredAuth);

const objectIdSchema = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const idParam = z.object({ id: objectIdSchema });

async function loadOwnedResume(req) {
  const resume = await Resume.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!resume) throw ApiError.notFound("Resume Not Found");

  return resume;
}

async function loadVersion(resumeId, versionId) {
  const version = await ResumeVersion.findOne({ _id: versionId, resumeId });
  if (!version) throw ApiError.notFound("Version not found");
  return version;
}

router.post(
  "/",
  uploadPdf("file"),
  asyncHandler(async (req, res) => {
    const { text, meta } = await extractText(req.file.buffer);
    const parsedSections = await parseResume(text);

    const title =
      (req.body.title || "").trim() ||
      req.file.originalname.replace(/\.pdf$/i, "") ||
      "Untitled Resume";

    const resume = await Resume.create({
      userId: req.user._id,
      title,
      latestVersionNumber: 1,
    });

    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: 1,
      label: "V1",
      rawText: text,
      parsedSections,
      sourceType: "upload",
      parentVersionId: null,
    });

    resume.currentVersionId = version._id;
    await resume.save();

    res.status(201).json({ resume, version, meta });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ resumes });
  }),
);

router.get(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const versions = await ResumeVersion.find({ resumeId: resume._id })
      .sort({ versionNumber: 1 })
      .select("-rawText")
      .lean();
    res.json({ resume, versions });
  }),
);

router.get(
  "/:id/versions/:versionId",
  validate(
    z.object({ id: objectIdSchema, versionId: objectIdSchema }),
    "params",
  ),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    res.json({ version });
  }),
);

router.delete(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    await ResumeVersion.deleteMany({ resumeId: resume._id });
    await Analysis.deleteMany({ resumeId: resume._id });
    await resume.deleteOne();

    res.json({ ok: true });
  }),
);

const analyzeBody = z.object({
  versionId: objectIdSchema.optional(),
  targetRole: z.string().trim().max(120).optional(),
});

router.post(
  "/:id/analyze",
  analyzeLimiter,
  validate(idParam, "params"),
  validate(analyzeBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);

    const versionId = req.body.versionId || resume.currentVersionId;
    if (!versionId) throw ApiError.badRequest("No version to analyze");
    const version = await loadVersion(resume._id, versionId);

    const { analysis, model, promptTokens, responseTokens } =
      await analyzeResume({
        rawText: version.rawText,
        targetRole: req.body.targetRole,
      });

    const saved = await Analysis.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: version._id,
      atsScore: analysis.atsScore,
      scoredBreakdown: analysis.scoreBreakdown,
      issues: analysis.issues,
      strengths: analysis.strengths,
      bulletsRewrites: analysis.bulletsRewrites,
      keywordsPresent: analysis.keywordsPresent,
      keywordsMissing: analysis.keywordsMissing,
      summary: analysis.summary,
      model,
      promptTokens,
      responseTokens,
    });

    version.latestAnalysisId = saved._id;
    await version.save();

    res.status(201).json({ analysis: saved });
  }),
);

router.get(
  "/:id/analysis",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const analyses = await Analysis.find({ resumeId: resume._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ analyses });
  }),
);

router.get(
  "/:id/versions/:versionId/analysis",
  validate(
    z.object({ id: objectIdSchema, versionId: objectIdSchema }),
    "params",
  ),

  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    const analysis = await Analysis.findOne({
      resumeId: resume._id,
      versionId: version._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ analysis: analysis || null });
  }),
);

const rewriteBody = z.object({
  analysisId: objectIdSchema,
  rewriteIds: z.array(objectIdSchema).optional(),
  label: z.string().trim().max(40).optional(),
});

function applyRewritesToText(rawText, rewrites) {
  let result = rawText;

  for (const r of rewrites) {
    if (!r.original || !r.rewritten) continue;

    const idx = result.indexOf(r.original);
    if (idx >= 0) {
      result =
        result.slice(0, idx) +
        r.rewritten +
        result.slice(idx + r.original.length);
    } else {
      result = result + `\n${r.rewritten}`;
    }
  }
  return result;
}

function patchBulletsInSections(sections, rewrites) {
  if (!sections) return null;

  const cloned = JSON.parse(JSON.stringify(sections));

  for (const r of rewrites) {
    if (!r?.original || !r?.rewritten) continue;

    for (const exp of cloned.experience || []) {
      if (!Array.isArray(exp.bullets)) continue;
      exp.bullets = exp.bullets.map((b) =>
        b === r.original ? r.rewritten : b,
      );
    }
  }
  return cloned;
}

function looksEmpty(sections) {
  if (!sections) return true;

  const b = sections.basics || {};
  const hasIdentity = b.name || b.email || b.title;

  const hasBody =
    sections.summary ||
    sections.experience?.length ||
    sections.education?.length ||
    sections.skills?.length;

  return !hasIdentity && !hasBody;
}

router.post(
  "/:id/rewrite",
  validate(idParam, "params"),
  validate(rewriteBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const analysis = await Analysis.findOne({
      _id: req.body.analysisId,
      resumeId: resume._id,
    });

    if (!analysis) throw ApiError.notFound("Analysis not found");

    const baseVersion = await loadVersion(resume._id, analysis.versionId);

    const selected = req.body.rewriteIds?.length
      ? analysis.bulletsRewrites.filter((r) =>
          req.body.rewriteIds.includes(r._id.toString()),
        )
      : analysis.bulletsRewrites;

    if (!selected.length) {
      throw ApiError.badRequest("No rewrites select to apply");
    }

    const newRaw = applyRewritesToText(baseVersion.rawText, selected);

    //Safety Net: pre build a structured copy from the base version with the chossen bullet swapped in
    //so V2 never lands with empty sections even if Gemini fails
    const patchedFromBase = patchBulletsInSections(
      baseVersion.parsedSections,
      selected,
    );
    const reparsed = await parseResume(newRaw);
    const finalParsed = looksEmpty(reparsed) ? patchedFromBase : reparsed;

    const nextNumber = resume.latestVersionNumber + 1;

    const newVersion = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: nextNumber,
      label: req.body.label?.trim() || `V${nextNumber}`,
      rawText: newRaw,
      parsedSections: finalParsed,
      sourceType: "rewrite",
      parentVersionId: baseVersion._id,
    });

    resume.latestVersionNumber = nextNumber;
    resume.currentVersionId = newVersion._id;
    await resume.save();

    res.status(201).json({
      version: newVersion,
      appliedCount: selected.length,
    });
  }),
);

const diffQuery = z.object({
  from: objectIdSchema,
  to: objectIdSchema,
  mode: z.enum(["words", "lines"]).optional(),
});

router.get(
  "/:id/diff",
  validate(idParam, "params"),
  validate(diffQuery, "query"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const [fromV, toV] = await Promise.all([
      loadVersion(resume._id, req.query.from),
      loadVersion(resume._id, req.query.to),
    ]);

    const parts = diffText(fromV.rawText, toV.rawText, req.query.mode);
    res.json({
      from: {
        id: fromV._id,
        label: fromV.label,
        versionNumber: fromV.versionNumber,
      },
      to: {
        id: toV._id,
        label: toV.label,
        versionNumber: toV.versionNumber,
      },
      parts,
      stats: summarize(parts),
    });
  }),
);

export default router;
