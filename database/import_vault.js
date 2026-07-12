require('dotenv').config();
require('../utils');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const supabase = include('supabaseConnection');

const VAULT_ROOT = path.join(__dirname, '..', 'Obsidian Vault', 'The Mists of Faldareus');

function walk(dir) {
	let files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files = files.concat(walk(full));
		}
		else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
			files.push(full);
		}
	}
	return files;
}

(async () => {
	if (!fs.existsSync(VAULT_ROOT)) {
		console.log("Vault folder not found: " + VAULT_ROOT);
		process.exitCode = 1;
		return;
	}

	const files = walk(VAULT_ROOT);
	console.log(`Found ${files.length} markdown files`);

	// Skip anything already imported (match on title + folder).
	const { data: existing, error: exErr } = await supabase.from('notes').select('title, folder');
	if (exErr) {
		console.log("Could not read existing notes (is the table created?)");
		console.log(exErr);
		process.exitCode = 1;
		return;
	}
	const seen = new Set((existing || []).map(n => `${n.folder}::${n.title}`));

	const rows = [];
	for (const file of files) {
		const rel = path.relative(VAULT_ROOT, file).split(path.sep);
		const filename = rel.pop();
		const title = filename.replace(/\.md$/i, '');
		const folder = rel.join('/');
		const key = `${folder}::${title}`;
		if (seen.has(key)) continue;

		const raw = fs.readFileSync(file, 'utf8');
		let body = raw;
		try { body = matter(raw).content; } catch (_) { body = raw; }

		rows.push({ title, folder, content: body.trim() });
	}

	if (rows.length === 0) {
		console.log("Nothing new to import.");
		return;
	}

	const { error } = await supabase.from('notes').insert(rows);
	if (error) {
		console.log("Error importing notes");
		console.log(error);
		process.exitCode = 1;
		return;
	}
	console.log(`Imported ${rows.length} notes.`);
})();
