const { handleDbError } = require('../utils/apiErrors');
const { loadStudentOverview } = require('../utils/studentOverview');

// Everything the student's home screen shows, in one answer.
const getStudentHome = async (req, res) => {
  const { error, overview } = await loadStudentOverview(req.user.id);
  if (error) return handleDbError(error, res);
  res.json(overview);
};

module.exports = { getStudentHome };
