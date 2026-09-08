import { describe, expect, test } from "bun:test";

import { decodeTransactionData } from "../../lib/decoder";

const EXTERNAL_CONTRACT = "0x2Ae938053c112Bd81042043945d142e208b50a66";

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";

describe("External Contract Decoder", () => {
  test("should decode function using external ABI", async () => {
    const data = "0x70a0823100000000000000000000000053e993819f2bc45a029615e8634bddeeab4f7817" as `0x${string}`;

    const result = await decodeTransactionData({
      chainId: 97,
      to: EXTERNAL_CONTRACT,
      data,
    });

    expect(result.decoded).toBe(true);
    expect(result.functionName).toBe("balanceOf");

    expect(result.abiSource).toBe("sourcify");

    expect(result.args?.[0]).toBe(USER);
  });
});

test("should decode external ERC20 approve", async () => {
  const data = "0x095ea7b3000000000000000000000000333333333333333333333333333333333333333300000000000000000000000000000b7abc627050305adf14a3d9e40000000000" as `0x${string}`;

  const result = await decodeTransactionData({
    chainId: 97,
    to: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
    data,
  });

  expect(result.decoded).toBe(true);
  expect(result.functionName).toBe("approve");
  expect(result.abiSource).toBe("local");

  expect(result.args?.[0]).toBe("0x3333333333333333333333333333333333333333");
});
