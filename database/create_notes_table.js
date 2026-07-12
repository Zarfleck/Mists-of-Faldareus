require('dotenv').config();
require('../utils');
const pool = include('databaseConnection');

const sql = `
	CREATE TABLE IF NOT EXISTS notes (
		note_id     serial primary key,
		title       text not null,
		folder      text not null default '',
		content     text not null default '',
		created_by  int references "user"(user_id),
		updated_by  int references "user"(user_id),
		created_at  timestamptz not null default now(),
		updated_at  timestamptz not null default now()
	);
	CREATE INDEX IF NOT EXISTS notes_folder_idx ON notes (folder);
`;

(async () => {
	try {
		await pool.query(sql);
		console.log("notes table ready");
	}
	catch (err) {
		console.log("Error creating notes table");
		console.log(err);
		process.exitCode = 1;
	}
	finally {
		await pool.end();
	}
})();
