import { USE_MOCK_DATA } from "@/config";
import { chainReader } from "@/lib/sources/chain";
import { mockReader } from "@/lib/sources/mock";
import type { ChainReader } from "@/lib/sources/types";

export function getReader(): ChainReader {
  return USE_MOCK_DATA ? mockReader : chainReader;
}
