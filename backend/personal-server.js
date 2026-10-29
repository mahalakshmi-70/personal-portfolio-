require('dotenv').config();

process.env.SITE = 'personal';
process.env.PORT = process.env.PERSONAL_PORT || process.env.PORT || '3001';

require('./server');
