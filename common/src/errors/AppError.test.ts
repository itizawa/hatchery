import { describe, expect, it } from "vitest";

import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./AppError.js";

describe("AppError", () => {
  it("statusCode と message が正しく設定される", () => {
    const err = new AppError(418, "I'm a teapot");
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe("I'm a teapot");
  });

  it("Error を継承している", () => {
    const err = new AppError(500, "oops");
    expect(err).toBeInstanceOf(Error);
  });

  it("name がクラス名になる", () => {
    const err = new AppError(500, "oops");
    expect(err.name).toBe("AppError");
  });
});

describe("NotFoundError", () => {
  it("statusCode が 404", () => {
    expect(new NotFoundError("ChannelNotFound").statusCode).toBe(404);
  });

  it("message が設定される", () => {
    expect(new NotFoundError("ChannelNotFound").message).toBe("ChannelNotFound");
  });

  it("AppError のインスタンスである", () => {
    expect(new NotFoundError("x")).toBeInstanceOf(AppError);
  });
});

describe("BadRequestError", () => {
  it("statusCode が 400", () => {
    expect(new BadRequestError("EmployeeNotLinked").statusCode).toBe(400);
  });

  it("AppError のインスタンスである", () => {
    expect(new BadRequestError("x")).toBeInstanceOf(AppError);
  });
});

describe("UnauthorizedError", () => {
  it("statusCode が 401", () => {
    expect(new UnauthorizedError("Unauthorized").statusCode).toBe(401);
  });

  it("AppError のインスタンスである", () => {
    expect(new UnauthorizedError("x")).toBeInstanceOf(AppError);
  });
});

describe("ForbiddenError", () => {
  it("statusCode が 403", () => {
    expect(new ForbiddenError("Forbidden").statusCode).toBe(403);
  });

  it("AppError のインスタンスである", () => {
    expect(new ForbiddenError("x")).toBeInstanceOf(AppError);
  });
});

describe("ConflictError", () => {
  it("statusCode が 409", () => {
    expect(new ConflictError("Conflict").statusCode).toBe(409);
  });

  it("AppError のインスタンスである", () => {
    expect(new ConflictError("x")).toBeInstanceOf(AppError);
  });
});

describe("instanceof チェーン", () => {
  it("各具象クラスは AppError かつ Error のインスタンスである", () => {
    const errors = [
      new NotFoundError("a"),
      new BadRequestError("b"),
      new UnauthorizedError("c"),
      new ForbiddenError("d"),
      new ConflictError("e"),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
