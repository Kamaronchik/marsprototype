const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { WEEKDAYS, DAY_OPEN, DAY_CLOSE, toMinutes } = require('../utils/schedule');
const { loadSlots } = require('../utils/lessonDay');

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Checks the body of a schedule row. Returns a message, or null when everything is fine.
const validate = ({ groupId, weekday, startTime, endTime }, { partial }) => {
  if (!partial && !isUuid(groupId)) return 'Choose a group';
  if ((!partial || weekday !== undefined) && !WEEKDAYS.includes(weekday)) return 'Choose a weekday';
  if ((!partial || startTime !== undefined) && !TIME.test(startTime || '')) return 'Start time must look like 18:00';
  if ((!partial || endTime !== undefined) && !TIME.test(endTime || '')) return 'End time must look like 19:30';
  if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) return 'The lesson must end after it starts';
  if (startTime && (toMinutes(startTime) < DAY_OPEN || toMinutes(startTime) >= DAY_CLOSE)) return 'Lessons are from 09:00 to 22:00';
  return null;
};

const handleError = (error, res) => {
  if (error.code === '23505') return res.status(409).json({ message: 'This lesson time is already in the schedule' });
  return handleDbError(error, res);
};

// The schedule of every group (or of one: ?groupId).
const listSchedule = async (req, res) => {
  const { groupId } = req.query;
  if (groupId && !isUuid(groupId)) return res.status(400).json({ message: 'Invalid group id' });
  try {
    res.json({ slots: await loadSlots({ groupId }) });
  } catch (error) {
    handleDbError(error, res);
  }
};

const createSlot = async (req, res) => {
  const { groupId, weekday, startTime, endTime } = req.body;
  const problem = validate({ groupId, weekday, startTime, endTime }, { partial: false });
  if (problem) return res.status(400).json({ message: problem });

  const { data: group } = await supabase.from('groups').select('id').eq('id', groupId).eq('status', 'active').maybeSingle();
  if (!group) return res.status(404).json({ message: 'Group not found' });

  const { data, error } = await supabase
    .from('schedule').insert({ group_id: groupId, weekday, start_time: startTime, end_time: endTime }).select('id').single();
  if (error) return handleError(error, res);

  await logAction(req.user.id, 'schedule.create', 'schedule', data.id, { groupId, weekday, startTime });
  res.status(201).json({ id: data.id });
};

const updateSlot = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const { weekday, startTime, endTime } = req.body;
  const problem = validate({ weekday, startTime, endTime }, { partial: true });
  if (problem) return res.status(400).json({ message: problem });

  const updates = {};
  if (weekday !== undefined) updates.weekday = weekday;
  if (startTime !== undefined) updates.start_time = startTime;
  if (endTime !== undefined) updates.end_time = endTime;
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nothing to update' });

  const { data, error } = await supabase.from('schedule').update(updates).eq('id', id).select('id').maybeSingle();
  if (error) return handleError(error, res);
  if (!data) return res.status(404).json({ message: 'Lesson time not found' });

  await logAction(req.user.id, 'schedule.update', 'schedule', id, updates);
  res.json({ message: 'Saved' });
};

const deleteSlot = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

  const { data, error } = await supabase.from('schedule').delete().eq('id', id).select('id').maybeSingle();
  if (error) return handleError(error, res);
  if (!data) return res.status(404).json({ message: 'Lesson time not found' });

  await logAction(req.user.id, 'schedule.delete', 'schedule', id);
  res.json({ message: 'Deleted' });
};

module.exports = { listSchedule, createSlot, updateSlot, deleteSlot };
