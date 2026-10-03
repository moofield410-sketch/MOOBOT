import { formatUnits } from "viem";
import { CONTRACTS, VOTING } from "@/config";
import { auraTier, getMooBot, type MooBotState } from "@/lib/moobot";
import { errorMessage, reportError } from "@/lib/monitoring";
import { getReader } from "@/lib/sources";
import type { ChainReader, TokenSymbol } from "@/lib/sources/types";
import type { Address, DataEnvelope, TokenBalance, WalletBalances } from "@/lib/types";

type Read = TokenBalance & { rawBig: bigint | null };

const empty = (symbol: TokenSymbol, status: TokenBalance["status"]): Read => ({
  symbol,
  status,
  raw: null,
  decimals: null,
  formatted: null,
  rawBig: null,
});

/**
 * Balance reader: $ORBIO and $MOOBOT at the latest block or a snapshot block. Always read fresh.
 * $MOOBOT is read only once its contract is verified on Orbio (see lib/moobot.ts); until then it is
 * "not-launched" and no number is shown.
 */
export async function readWalletBalances(
  address: Address,
  blockNumber?: bigint,
  deps: { reader?: ChainReader; moobot?: () => Promise<MooBotState> } = {},
): Promise<DataEnvelope<WalletBalances>> {
  const reader = deps.reader ?? getReader();
  const moobot = await (deps.moobot ?? (() => getMooBot()))();

  const read = async (symbol: TokenSymbol, token: Address | null): Promise<Read> => {
    try {
      const res = await reader.balanceOf({ symbol, address: token }, address, blockNumber);
      if (!res) return empty(symbol, "not-configured");
      return { symbol, status: "ok", raw: res.raw.toString(), decimals: res.decimals, formatted: formatUnits(res.raw, res.decimals), rawBig: res.raw };
    } catch (err) {
      reportError(err, { symbol, address });
      return { ...empty(symbol, "error"), error: errorMessage(err) };
    }
  };

  const readMooBot = (): Promise<Read> => {
    if (moobot.status === "verified") return read("MOOBOT", moobot.address);
    return Promise.resolve(empty("MOOBOT", moobot.status === "unverified" ? "unverified" : "not-launched"));
  };

  const [orbio, moobotBalance] = await Promise.all([read("ORBIO", CONTRACTS.orbioToken), readMooBot()]);

  const meetsVotingMinimum =
    orbio.rawBig !== null && orbio.decimals !== null ? orbio.rawBig >= BigInt(VOTING.minOrbio) * 10n ** BigInt(orbio.decimals) : null;
  const aura = moobotBalance.rawBig !== null && moobotBalance.decimals !== null ? (auraTier(moobotBalance.rawBig, moobotBalance.decimals)?.name ?? null) : null;

  const strip = ({ rawBig: _rawBig, ...b }: Read): TokenBalance => b;
  const anyError = orbio.status === "error" || moobotBalance.status === "error";

  return {
    data: {
      address,
      block: blockNumber?.toString() ?? "latest",
      orbio: strip(orbio),
      moobot: strip(moobotBalance),
      meetsVotingMinimum,
      aura,
    },
    source: reader.kind,
    updatedAt: new Date().toISOString(),
    stale: anyError,
    ...(anyError ? { error: "One or more balances could not be read" } : {}),
  };
}
