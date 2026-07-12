const supabase = include('supabaseConnection');

async function testConnection() {
	const { error } = await supabase.from('user').select('user_id').limit(1);

	if (error) {
		console.log("Error connecting to Supabase");
		console.log(error);
		return false;
	}
	console.log("Successfully connected to Supabase");
	return true;
}

module.exports = { testConnection };
