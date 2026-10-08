const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('c:/Users/Dell/Downloads/Ecohub1R/Ecohub1R/server/ecohub.sqlite');
db.prepare("UPDATE collection_centres SET status = 'active' WHERE status = 'Active'").run();
console.log('Fixed statuses to lowercase active!');
