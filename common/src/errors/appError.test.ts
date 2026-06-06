import { describe, expect, it } from "vitest";

import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./appError.js";

describe("AppError", () => {
  it("statusCode と message を持つ", () => {
    const err = new AppError(418, "I'm a teapot");
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe("I'm a teapot");
  });

  it("Error のサブクラスである", () => {
    expect(new AppError(500, "fail")).toBeInstanceOf(Error);
  });

  it("name が AppError になる", () => {
    expect(new AppError(500, "fail").name).toBe("AppError");
  });
});

describe("NotFoundError", () => {
  it("statusCode が 404", () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it("デフォルトメッセージは Not Found", () => {
    expect(new NotFoundError().message).toBe("Not Found");
  });

  it("カスタムメッセージを設定できる", () => {
    expect(new NotFoundError("ChannelNotFound").message).toBe("ChannelNotFound");
  });

  it("AppError のインスタンスである", () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
  });

  it("name が NotFoundError になる", () => {
    expect(new NotFoundError().name).toBe("NotFoundError");
  });
});

describe("BadRequestError", () => {
  it("statusCode が 400", () => {
    expect(new BadRequestError().statusCode).toBe(400);
  });

  it("デフォルトメッセージは Bad Request", () => {
    expect(new BadRequestError().message).toBe("Bad Request");
  });

  it("カスタムメッセージを設定できる", () => {
    expect(new BadRequestError("EmployeeNotLinked").message).toBe("EmployeeNotLinked");
  });

  it("AppError のインスタンスである", () => {
    expect(new BadRequestError()).toBeInstanceOf(AppError);
  });
});

describe("UnauthorizedError", () => {
  it("statusCode が 401", () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it("デフォルトメッセージは Unauthorized", () => {
    expect(new UnauthorizedError().message).toBe("Unauthorized");
  });

  it("AppError のインスタンスである", () => {
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
  });
});

describe("ForbiddenError", () => {
  it("statusCode が 403", () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it("デフォルトメッセージは Forbidden", () => {
    expect(new ForbiddenError().message).toBe("Forbidden");
  });

  it("AppError のインスタンスである", () => {
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
  });
});

describe("ConflictError", () => {
  it("statusCode が 409", () => {
    expect(new ConflictError().statusCode).toBe(409);
  });

  it("デフォルトメッセージは Conflict", () => {
    expect(new ConflictError().message).toBe("Conflict");
  });

  it("AppError のインスタンスである", () => {
    expect(new ConflictError()).toBeInstanceOf(AppError);
  });
});

describe("instanceof チェック", () => {
  it("各サブクラスは AppError と Error でもある", () => {
    const errors = [
      new NotFoundError(),
      new BadRequestError(),
      new UnauthorizedError(),
      new ForbiddenError(),
      new ConflictError(),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
