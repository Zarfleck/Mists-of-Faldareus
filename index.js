require('./utils');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 12;

const database = include('databaseConnection');
const db_utils = include('database/db_utils');
const db_users = include('database/users.js');
const db_notes = include('database/notes.js');
const { renderMarkdown, buildTitleMap } = include('noteRender');
db_utils.testConnection();

const port = process.env.PORT || 3000;

const expireTime = 60*60*1000; //expires after 1 hour (hours * minutes * seconds * millis)


/* secret information section */
const node_session_secret = process.env.NODE_SESSION_SECRET;


app.use(express.urlencoded({extended: false}));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public"));


app.use(session({ 
    secret: node_session_secret,
	store: new pgSession({ pool: database, createTableIfMissing: true }),
	saveUninitialized: false, 
	resave: false,
    cookie: {
        maxAge: expireTime
    }
}
));


// Expose session state to every view (powers the shared nav bar)
app.use((req, res, next) => {
    res.locals.authenticated = req.session.authenticated || false;
    res.locals.username = req.session.username || null;
    res.locals.user_type = req.session.user_type || null;
    next();
});


app.get('/', (req,res) => {
    console.log(req.session.username)
    res.render("index.ejs", {authenticated: req.session.authenticated, username: req.session.username});
});

app.post('/submitEmail', (req,res) => {
    var email = req.body.email;
    if (!email) {
        res.redirect('/contact?missing=1');
    }
    else {
        res.render("submitEmail", {email: email});
    }
});


app.get('/createUser', (req,res) => {
    res.render("createUser");
});


app.post('/submitUser', async (req,res) => {
    var username = req.body.username;
    var password = req.body.password;
    var hashedPassword = bcrypt.hashSync(password, saltRounds);
    var success = await db_users.createUser({ user: username, hashedPassword: hashedPassword });
    if (success) {
        var results = await db_users.getUsers();
        res.render("submitUser",{users:results});
    }
    else {
        res.render("errorMessage", {error: "Failed to create user."} );
    }
});

app.get('/login', (req,res) => {
    res.render("login");
});

app.post('/loggingin', async (req,res) => {
    var username = req.body.username;
    var password = req.body.password;


    var results = await db_users.getUser({ user: username, hashedPassword: password });
    if (results) {
        if (results.length == 1) { //there should only be 1 user in the db that matches
            if (bcrypt.compareSync(password, results[0].password)) {
                req.session.authenticated = true;
                console.log(req.session.authenticated)
                req.session.user_id = results[0].user_id;
                req.session.user_type = results[0].type;
                req.session.username = username;
                req.session.cookie.maxAge = expireTime;
                res.redirect('/');
                return;
            }
            else {
                console.log("invalid password");
            }
        }
        else {
            console.log('invalid number of users matched: '+results.length+" (expected 1).");
            res.redirect('/login');
            return;            
        }
    }

    console.log('user not found');
    //user and password combination not found
    res.redirect("/login");
});


function sessionValidation(req, res, next) {
    console.log(req.session.authenticated)
	if (!req.session.authenticated) {
		req.session.destroy();
		res.redirect('/login');
		return;
	}
	else {
		next();
        
	}
}


// function isAdmin(req) {
//     if (req.session.user_type == 'admin') {
//         return true;
//     }
//     return false;
// }

// function adminAuthorization(req, res, next) {
// 	if (!isAdmin(req)) {
//         res.status(403);
//         res.render("errorMessage", {error: "Not Authorized"});
//         return;
// 	}
// 	else {
// 		next();
// 	}
// }


// app.use('/members/admin', adminAuthorization);



/* ===== Notes (campaign vault) ===== */

async function getFolderList() {
    var notes = await db_notes.getAllNotes();
    if (!notes) return [];
    var set = {};
    for (var i = 0; i < notes.length; i++) {
        var f = (notes[i].folder || "").trim();
        if (f) set[f] = true;
    }
    return Object.keys(set).sort();
}

function resolveFolder(body) {
    var folder = (body.folder || "").trim();
    if (folder === "__other__") {
        return (body.folder_other || "").trim();
    }
    return folder;
}

// Browse notes by folder path (?path=NPCs/Strangers)
app.get('/notes', async (req, res) => {
    var notes = await db_notes.getAllNotes();
    if (!notes) {
        res.status(500).render("errorMessage", {error: "Could not load notes."});
        return;
    }

    var currentPath = (req.query.path || "").trim().replace(/^\/+|\/+$/g, "");
    var prefix = currentPath ? currentPath + "/" : "";
    var subfolders = {};
    var currentNotes = [];

    for (var i = 0; i < notes.length; i++) {
        var folder = (notes[i].folder || "").trim();
        if (!currentPath) {
            if (!folder) {
                currentNotes.push(notes[i]);
            } else {
                var top = folder.split("/")[0];
                subfolders[top] = true;
            }
        } else if (folder === currentPath) {
            currentNotes.push(notes[i]);
        } else if (folder.indexOf(prefix) === 0) {
            var rest = folder.slice(prefix.length);
            var next = rest.split("/")[0];
            if (next) subfolders[next] = true;
        }
    }

    var parentPath = "";
    if (currentPath) {
        var parts = currentPath.split("/");
        parts.pop();
        parentPath = parts.join("/");
    }

    res.render("notes-index", {
        currentPath: currentPath,
        parentPath: parentPath,
        subfolders: Object.keys(subfolders).sort(),
        notes: currentNotes,
        authenticated: req.session.authenticated,
        username: req.session.username
    });
});

// New-note form
app.get('/notes/new', sessionValidation, async (req, res) => {
    res.render("note-form", {
        note: { note_id: null, title: req.query.title || "", folder: req.query.folder || "", content: "" },
        folders: await getFolderList(),
        action: "/notes",
        heading: "New Note"
    });
});

// Create a note
app.post('/notes', sessionValidation, async (req, res) => {
    var title = (req.body.title || "").trim();
    if (!title) {
        res.status(400).render("errorMessage", {error: "Title is required."});
        return;
    }
    var id = await db_notes.createNote({
        title: title,
        folder: resolveFolder(req.body),
        content: req.body.content || "",
        userId: req.session.user_id
    });
    if (!id) {
        res.status(500).render("errorMessage", {error: "Failed to create note."});
        return;
    }
    res.redirect('/notes/view/' + id);
});

// View a single note (public)
app.get('/notes/view/:id', async (req, res) => {
    var note = await db_notes.getNote(req.params.id);
    if (!note) {
        res.status(404).render("404");
        return;
    }
    var allNotes = await db_notes.getAllNotes();
    var titleMap = buildTitleMap(allNotes || []);
    var html = renderMarkdown(note.content, titleMap);
    res.render("note-view", {
        note: note,
        html: html,
        authenticated: req.session.authenticated
    });
});

// Edit-note form
app.get('/notes/edit/:id', sessionValidation, async (req, res) => {
    var note = await db_notes.getNote(req.params.id);
    if (!note) {
        res.status(404).render("404");
        return;
    }
    res.render("note-form", {
        note: note,
        folders: await getFolderList(),
        action: "/notes/" + note.note_id,
        heading: "Edit Note"
    });
});

// Save edits
app.post('/notes/:id', sessionValidation, async (req, res) => {
    var title = (req.body.title || "").trim();
    if (!title) {
        res.status(400).render("errorMessage", {error: "Title is required."});
        return;
    }
    var ok = await db_notes.updateNote(req.params.id, {
        title: title,
        folder: resolveFolder(req.body),
        content: req.body.content || "",
        userId: req.session.user_id
    });
    if (!ok) {
        res.status(500).render("errorMessage", {error: "Failed to update note."});
        return;
    }
    res.redirect('/notes/view/' + req.params.id);
});


app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
})

// 404 catch route
app.use((req, res) => {
    res.status(404);
    res.render("404");
})

app.listen(port, () => {
	console.log("Node application listening on port "+port);
}); 




