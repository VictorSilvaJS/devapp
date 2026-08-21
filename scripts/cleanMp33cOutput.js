const path = require('node:path');
const { removeTemporaryRoot } = require('./mp33cTemporarySafety');

const projectRoot = path.resolve(__dirname, '..');
removeTemporaryRoot(projectRoot);
