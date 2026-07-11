import multer from "multer";
import ApiError from "../utils/ApiError.js";
import { application } from "express";

const MAX_BYTES = 5 * 1024 * 1024; //5MB

const upload = multer({
  storage: multer.memoryStorage(), //Stores the file in RAM
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      //if uploaded file is not '.pdf', it will not accepted it and throw error
      return cb(ApiError.badRequest("Only PDF files are accepted"));
      //cb = callback
    }
    cb(null, file);
  },
});

const uploadPdf =
  (field = "file") =>
  (req, res, next) => {
    upload.single(field)(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(ApiError.badRequest("PDF exceeds 5MB limit"));
        }
        return next(ApiError.badRequest(error.message));
      }
      if (error) return next(error);
      if (!req.file) return next(ApiError.badRequest("No File Uploaded"));
      next();
    });
  };  

export default uploadPdf;
