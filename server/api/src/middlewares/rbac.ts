export function requireRole(...roles: string[]) {
  return async function (request: any, reply: any) {
    const role = request.user?.role;
    if (!roles.includes(role)) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }
  };
}

export function requireSelfOrRole(...roles: string[]) {
  return async function (request: any, reply: any) {
    const user = request.user;
    const targetId = request.params?.id;
    if (user?.sub === targetId) return;
    if (!roles.includes(user?.role)) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }
  };
}
