import {AGENT_TOOLS_SCRIPT} from '../lib/agent/browser-tools';
import {SITE} from '../lib/site';

export function AgentAccess() {
  return (
    <>
      <p className="agent-note" aria-hidden="true">
        {`This HTML page has a markdown version. Request it with Accept: text/markdown, or open ${SITE.url}/index.md. Directory: ${SITE.url}/llms.txt. Full text: ${SITE.url}/llms-full.txt. Search and AI input are allowed. AI training is not.`}
      </p>
      <script dangerouslySetInnerHTML={{__html: AGENT_TOOLS_SCRIPT}} />
    </>
  );
}
