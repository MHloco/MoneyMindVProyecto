const service = require('../services/assistant.services');

// Do not forward raw SQL/provider errors or log conversation contents.
function endpoint(action) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      res.json(await action(req));
    } catch (error) {
      const expected = Number.isInteger(error.status) && error.status >= 400 && error.status < 600;
      res.status(expected ? error.status : 500).json({
        message: expected ? error.message : 'No se pudo procesar la conversación. Inténtalo de nuevo.',
      });
    }
  };
}

module.exports = {
  list: endpoint(req => service.list(req.user.id)),
  detail: endpoint(req => service.detail(req.user.id, req.params.id)),
  send: endpoint(req => service.send(req.user.id, req.body)),
  analyze: endpoint(req => service.analyze(req.user.id, req.body)),
};
