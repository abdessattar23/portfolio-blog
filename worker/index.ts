import handler from "vinext/server/fetch-handler";

const worker: ExportedHandler<Record<string, never>> = {
  fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
