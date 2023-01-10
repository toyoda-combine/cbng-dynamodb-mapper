import { chunk } from "@/util";

describe("chunk", () => {
  it.each([
    {
      arr: [1, 2, 3, 4, 5, 6],
      size: 1,
      expected: [[1], [2], [3], [4], [5], [6]],
    },
    {
      arr: [1, 2, 3, 4, 5, 6],
      size: 2,
      expected: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    },
    {
      arr: [1, 2, 3, 4, 5, 6],
      size: 3,
      expected: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    },
    {
      arr: [1, 2, 3, 4, 5, 6],
      size: 4,
      expected: [
        [1, 2, 3, 4],
        [5, 6],
      ],
    },
    {
      arr: [1, 2, 3, 4, 5, 6],
      size: 5,
      expected: [[1, 2, 3, 4, 5], [6]],
    },
    {
      arr: [1, 2, 3, 4, 5, 6],
      size: 6,
      expected: [[1, 2, 3, 4, 5, 6]],
    },
    {
      arr: [],
      size: 6,
      expected: [],
    },
  ])("$arr / $size -> $expected", ({ arr, size, expected }) => {
    expect(chunk(arr, size)).toStrictEqual(expected);
  });
});
