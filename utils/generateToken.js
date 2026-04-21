const jwt = require('jsonwebtoken');

const generateToken = (res, userId) => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: thirtyDaysInMs,
    });

    return token;
};

module.exports = generateToken;
