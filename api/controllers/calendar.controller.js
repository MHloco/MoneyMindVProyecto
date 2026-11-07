const calendarService = require('../services/calendar.services');

async function getEvents(req, res, next) {
  try {
    const userId = req.user.id;

    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || month < 1 || month > 12 || !year) {
      return res.status(400).json({
        message: 'Mes o año inválido.'
      });
    }

    const events = await calendarService.getEvents(
      userId,
      month,
      year,
      req.redis
    );

    res.json({ events });
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  try {
    const userId = req.user.id;

    const {
      title,
      description,
      event_date,
      color
    } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({
        message: 'El título y la fecha son obligatorios.'
      });
    }

    const event = await calendarService.createEvent(
      userId,
      {
        title,
        description,
        event_date,
        color
      },
      req.redis
    );

    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const event = await calendarService.deleteEvent(
      userId,
      id,
      req.redis
    );

    res.json({ event });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEvents,
  createEvent,
  deleteEvent
};