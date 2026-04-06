const Joi = require("joi");

exports.validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      status: "fail",
      errors: error.details.map((d) => d.message),
    });
  }

  req.body = value;
  next();
}; 