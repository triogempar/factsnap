import { createExaPageReader, createExaSearcher } from "./exa-search";
import { createFireworksCompleter } from "./fireworks";
import type { PipelineDeps } from "./types";

export function createLiveDeps(): PipelineDeps {
  return {
    complete: createFireworksCompleter(),
    search: createExaSearcher(),
    readPage: createExaPageReader(),
  };
}
