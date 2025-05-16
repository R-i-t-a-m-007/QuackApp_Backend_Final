const Package = require('../models/Package');

exports.getPackages = async (req, res) => {
  const packages = await Package.find();
  res.json(packages);
};
