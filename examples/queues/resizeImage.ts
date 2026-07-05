import { defineQueue } from "../../src/queue";

// One queue per file. Producers: `import resize from "../queues/resizeImage";
// await resize.add({ url, width })`. serve() starts the worker if queues/ exists.
export default defineQueue<{ url: string; width: number }>({
  name: "resize-image",
  concurrency: 3,
  retries: 2,
  process: async ({ url, width }) => {
    // TODO: fetch `url`, resize to `width`, store it.
    void url;
    void width;
  },
});
