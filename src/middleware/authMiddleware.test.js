const { optionalAuth0, protectAuth0 } = require('./authMiddleware');

const invoke = (middleware, authorization) =>
  new Promise((resolve) => {
    const req = { headers: authorization ? { authorization } : {} };
    middleware(req, {}, (error) => resolve({ req, error }));
  });

describe('Auth0 middleware', () => {
  test('optional auth allows a guest request with a stale or malformed token', async () => {
    const { req, error } = await invoke(optionalAuth0, 'Bearer stale-token');

    expect(error).toBeUndefined();
    expect(req.auth).toBeUndefined();
  });

  test('required auth still rejects the same token', async () => {
    const { error } = await invoke(protectAuth0, 'Bearer stale-token');

    expect(error).toMatchObject({ statusCode: 401 });
  });
});
