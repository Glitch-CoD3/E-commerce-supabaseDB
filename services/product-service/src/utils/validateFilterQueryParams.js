export const validateFilterQueryParams = (req, res, next) => {
  if (req.query.minPrice && isNaN(req.query.minPrice)) {
    return res.status(400).json({ success: false, message: 'minPrice must be a valid number' });
  }
  if (req.query.maxPrice && isNaN(req.query.maxPrice)) {
    return res.status(400).json({ success: false, message: 'maxPrice must be a valid number' });
  }
  next();
};