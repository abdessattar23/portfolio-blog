export const AGENT_TOOLS_SCRIPT = `(() => {
  const root = typeof document === 'undefined' ? undefined : document;
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const modelContext = (root && root.modelContext) || (nav && nav.modelContext);
  if (!modelContext || typeof modelContext.registerTool !== 'function') return;
  const controller = new AbortController();
  const register = (tool) => modelContext.registerTool(tool, {signal: controller.signal});
  const text = async (url) => {
    const response = await fetch(url);
    const payload = await response.json();
    if (Array.isArray(payload.results)) {
      return payload.results.map((item) => item.title + ' - ' + item.url).join('\\n') || 'No matching pages.';
    }
    if (Array.isArray(payload.posts)) {
      return payload.posts.map((item) => item.title + ' - ' + item.url).join('\\n') || 'No published notes.';
    }
    if (Array.isArray(payload.work)) {
      return payload.work.map((item) => item.title + ' - ' + item.url).join('\\n') || 'No case studies.';
    }
    if (typeof payload.markdown === 'string') return payload.markdown;
    if (typeof payload.title === 'string' && typeof payload.url === 'string') return payload.title + ' - ' + payload.url;
    return 'No content returned.';
  };
  register({
    name: 'search_site',
    description: 'Search published notes, OpenTelemetry Java case studies, and talks on this site.',
    inputSchema: {
      type: 'object',
      properties: {query: {type: 'string', description: 'Words to match against titles and prose.'}},
      required: ['query']
    },
    async execute(input) {
      const query = input && typeof input.query === 'string' ? input.query : '';
      return text('/api/content/search?q=' + encodeURIComponent(query));
    }
  });
  register({
    name: 'read_post',
    description: 'Read one published technical note as markdown.',
    inputSchema: {
      type: 'object',
      properties: {slug: {type: 'string', description: 'Note slug, such as pooled-hashmap.'}},
      required: ['slug']
    },
    async execute(input) {
      const slug = input && typeof input.slug === 'string' ? input.slug : '';
      return text('/api/content/posts/' + encodeURIComponent(slug));
    }
  });
  register({
    name: 'list_work',
    description: 'List merged OpenTelemetry Java contributions documented on this site.',
    inputSchema: {type: 'object', properties: {}},
    async execute() {
      return text('/api/content/work');
    }
  });
})();`;
