const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

// Convert Obsidian [[wikilinks]] into markdown links.
// [[Target]] or [[Target|Label]]. Resolves against a title -> note_id map;
// unknown targets link to the "create note" page prefilled with the title.
function convertWikilinks(content, titleMap) {
	return content.replace(/\[\[([^\]]+)\]\]/g, (match, inner) => {
		const parts = inner.split('|');
		const target = parts[0].trim();
		const label = (parts[1] || parts[0]).trim();
		const id = titleMap[target.toLowerCase()];
		if (id) {
			return `[${label}](/notes/view/${id})`;
		}
		return `[${label}](/notes/new?title=${encodeURIComponent(target)})`;
	});
}

function renderMarkdown(content, titleMap = {}) {
	const withLinks = convertWikilinks(content || '', titleMap);
	const rawHtml = marked.parse(withLinks);
	return sanitizeHtml(rawHtml, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ['src', 'alt', 'title'],
			a: ['href', 'name', 'target', 'rel']
		}
	});
}

function buildTitleMap(notes) {
	const map = {};
	for (const n of notes) {
		map[n.title.toLowerCase()] = n.note_id;
	}
	return map;
}

module.exports = { renderMarkdown, buildTitleMap };
