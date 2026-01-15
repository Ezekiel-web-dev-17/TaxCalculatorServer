import { describe, it, expect } from "@jest/globals";

describe("Basic Tests", () => {
  it("should pass a simple test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle string operations", () => {
    const greeting = "Hello, TaxCalServer!";
    expect(greeting).toContain("TaxCalServer");
  });

  it("should handle arrays", () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });

  it("should handle objects", () => {
    const user = { name: "John", age: 30 };
    expect(user).toHaveProperty("name");
    expect(user.name).toBe("John");
  });

  it("should handle async operations", async () => {
    const asyncValue = await Promise.resolve("async result");
    expect(asyncValue).toBe("async result");
  });
});
