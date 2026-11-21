const { AsyncLocalStorage } = require('async_hooks');

// Remembers the IP and the browser of the current request, so that logAction can write them
// without every controller passing them along.
const storage = new AsyncLocalStorage();

const requestContext = (req, res, next) => {
  storage.run({ ip: req.ip ?? null, userAgent: (req.get('user-agent') ?? '').slice(0, 300) || null }, next);
};

const currentContext = () => storage.getStore() ?? {};

module.exports = { requestContext, currentContext };
