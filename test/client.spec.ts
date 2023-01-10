import { CbngDynamoDBClient } from "@/client";

describe("constructor", () => {
  it("クライアントが作成されること", () => {
    const client = new CbngDynamoDBClient("test", { region: "ap-northeast-1" });
    expect(client).not.toBeNull();
  });
});
