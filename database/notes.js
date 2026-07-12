const supabase = include('supabaseConnection');

async function getAllNotes() {
	const { data, error } = await supabase
		.from('notes')
		.select('note_id, title, folder, updated_at')
		.order('folder', { ascending: true })
		.order('title', { ascending: true });

	if (error) {
		console.log("Error getting notes");
		console.log(error);
		return false;
	}
	return data;
}

async function getNote(id) {
	const { data, error } = await supabase
		.from('notes')
		.select('*')
		.eq('note_id', id)
		.maybeSingle();

	if (error) {
		console.log("Error getting note");
		console.log(error);
		return false;
	}
	return data;
}

async function createNote(postData) {
	const { data, error } = await supabase
		.from('notes')
		.insert({
			title: postData.title,
			folder: postData.folder || '',
			content: postData.content || '',
			created_by: postData.userId || null,
			updated_by: postData.userId || null
		})
		.select('note_id')
		.single();

	if (error) {
		console.log("Error creating note");
		console.log(error);
		return false;
	}
	return data.note_id;
}

async function updateNote(id, postData) {
	const { error } = await supabase
		.from('notes')
		.update({
			title: postData.title,
			folder: postData.folder || '',
			content: postData.content || '',
			updated_by: postData.userId || null,
			updated_at: new Date().toISOString()
		})
		.eq('note_id', id);

	if (error) {
		console.log("Error updating note");
		console.log(error);
		return false;
	}
	return true;
}

module.exports = { getAllNotes, getNote, createNote, updateNote };
