import { GoogleGenAI, Language, Type } from "@google/genai";
import env from "../config/env.js";
import { z } from "zod";

const ai = env.geminiApiKey
  ? new GoogleGenAI({ apiKey: env.geminiApiKey })
  : null;

const linkSchema = {
  type: Type.OBJECT,
  required: ["label", "url"],
  properties: {
    label: { type: Type.STRING },
    url: { type: Type.STRING },
  },
};

//responseSchema -> When gemini will give the output, it should be structured like this (JSON)
const responseSchema = {
  type: Type.OBJECT,
  required: [
    "basics",
    "summary",
    "experiences",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "interests",
  ],
  properties: {
    basics: {
      type: Type.OBJECT,
      required: ["name", "title", "location", "email", "phone", "links"],
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        location: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        links: { type: Type.ARRAY, items: linkSchema },
      },
    },

    summary: { type: Type.STRING },

    experiences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["company", "role", "period", "bullets"],
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          period: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },

    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["degree", "school", "period"],
        properties: {
          degree: { type: Type.STRING },
          school: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          details: { type: Type.STRING },
        },
      },
    },

    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },

    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name", "description"],
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          tech: { type: Type.ARRAY, items: { type: Type.STRING } },
          links: { type: Type.ARRAY, items: linkSchema },
        },
      },
    },

    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name"],
        properties: {
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          year: { type: Type.STRING },
        },
      },
    },

    languages: { type: Type.ARRAY, items: { type: Type.STRING } },

    interests: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
};

// ZOD schema for every values- it will make sure when gemini gives the responses, it will follow all this validation
const validator = z.object({
  basics: z.object({
    name: z.string().default(""),
    title: z.string().default(""),
    location: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    links: z
      .array(z.object({ label: z.string(), url: z.string() }))
      .default([]),
  }),

  summary: z.string().default(""),

  experiences: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        school: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        details: z.string().default(""),
      }),
    )
    .default([]),

  skills: z.array(z.string()).default([]),

  projects: z.array(
    z.object({
      name: z.string().default(""),
      description: z.string().default(""),
      tech: z.array(z.string()).default([]),
      links: z
        .array(z.object({ label: z.string(), url: z.string() }))
        .default([]),
    }),
  ),

  certifications: z
    .array(
      z.object({
        name: z.string().default(""),
        issuer: z.string().default(""),
        year: z.string().default(""),
      }),
    )
    .default([]),

  languages: z.array(z.string()).default([]),

  interests: z.array(z.string()).default([]),
});

function buildPrompt(rawText) {
  return [
    "You are a resume parser. The input is text extracter from a PDF - lines may be jumbled or out of natural reading order.",
    "",
    "Extract structured data: ",
    "-basic: name, professional title, location, email, phone, social, links(Linkedin/ Github/ portfolio etc.; label like 'Linkedin', full URL)",
    "-summary: the professional summary paragraph (rejoin if spilt across lines)",
    "-experiences: jobs most recent first, with company, role, period (preserve original data format), location if avaiable  and bullet points",
    "-skills: flat array of techincal skills",
    "-projects: name, one sentences description, optional tech tags, optional links",
    "-certification: name, issuer, year",
    "-languages: flat array",
    "-interests: flat array",
    "",
    "Rules:",
    "-Be conservative: omit fields that are not clearly present. Use empty strings/arrays where missings.",
    "-Do not invert  or paraphrase - extract verbatim where possible",
    "-Each experience bullet should read as a complete senetenes",
    "-Preserve original date format (e.g: 'Jan 2022 - Dec 2023')",
    "",
    "RESUME TEXT:",
    "------------",
    rawText,
    "------------",
  ].join("\n");
}

//IF API key is missing or not working, we are going to return this Empty arrays
const EMPTY = {
  basics: {
    name: "",
    title: "",
    location: "",
    email: "",
    phone: "",
    links: [],
  },
  summary: "",
  experiences: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
};

async function parseResume(rawText) {
  if (!ai || !rawText?.trim()) return EMPTY;

  const prompt = buildPrompt(rawText);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: env.geminiModel,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
        },
      });

      const text =
        typeof result.text === "function" ? result.text() : result.text;
      if (!text) throw new Error("Empty response");

      const parsed = JSON.parse(text);
      return validator.parse(parsed);
    } catch (error) {
      if (attempt === 2) {
        console.error("Structured parse failed: ", error.message);
        return EMPTY;
      }
    }
  }
  return EMPTY;
}

export default parseResume;
