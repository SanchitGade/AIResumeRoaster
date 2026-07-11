import { PDFParse } from "pdf-parse";
import ApiError from "../utils/ApiError.js";

async function extractText(buffer) {
  let parser;

  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const text = (result.text || "").trim();
    if (!text || text.length < 50) {
      throw ApiError.badRequest(
        "Could not extract readable text - is this a scanned/image-only pdf?",
      );
    }

    return {
      text,
      meta: { numPages: result.pages?.length ?? result.numPages ?? null },
    };
  } catch (error) {
    if (error.isOperational) throw error;
    throw ApiError.badRequest("Failed to parse PDF: " + error.message);
  } finally {
    try {
      await parser?.destroy?.();
    } catch (error) {}
  }
}
     
export default extractText;