import jwt from 'jsonwebtoken';

/** Sets req.userId when a valid JWT cookie is present; otherwise req.userId is null. */
const optionalAuth = (req, res, next) => {
  let { token } = req.cookies;
  if (!token) {
    req.userId = null;
    return next();
  }
  if (token.startsWith('Bearer ')) {
    token = token.split(' ')[1];
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err && decoded?._id) {
      req.userId = decoded._id;
    } else {
      req.userId = null;
    }
    next();
  });
};

export default optionalAuth;
