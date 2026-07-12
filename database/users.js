const supabase = include('supabaseConnection');

async function createUser(postData) {
	const { error } = await supabase
		.from('user')
		.insert({ username: postData.user, password: postData.hashedPassword });

	if (error) {
		console.log("Error inserting user");
		console.log(error);
		return false;
	}
	console.log("Successfully created user");
	return true;
}

async function getUsers() {
	const { data, error } = await supabase
		.from('user')
		.select('username');

	if (error) {
		console.log("Error getting users");
		console.log(error);
		return false;
	}
	console.log("Successfully retrieved users");
	return data;
}

async function getUser(postData) {
	const { data, error } = await supabase
		.from('user')
		.select('user_id, username, password, user_type ( type )')
		.eq('username', postData.user);

	if (error) {
		console.log("Error trying to find user");
		console.log(error);
		return false;
	}
	console.log("Successfully found user");
	return data.map(u => ({
		user_id: u.user_id,
		username: u.username,
		password: u.password,
		type: u.user_type ? u.user_type.type : null
	}));
}

module.exports = { createUser, getUsers, getUser };
