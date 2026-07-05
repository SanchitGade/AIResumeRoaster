import ApiError from "../utils/ApiError.js";

const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        ApiError.badRequest("Validation Failed", result.error.issues),
      );
    }

    req[source] = result.data;
    next();
  };

export default validate;
