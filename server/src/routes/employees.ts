import { UpdateEmployeeSchema, err, isErr, notFound, ok, type UpdateEmployeeInput } from "@hatchery/common";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { EmployeeRepository } from "../persistence/employeeRepository.js";
import { resultToResponse } from "../utils/resultToResponse.js";

export function createEmployeesRouter(employeeRepository: EmployeeRepository): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    employeeRepository
      .listBotEmployees()
      .then((employees) => res.status(200).json(employees))
      .catch(next);
  });

  // #181: ADR-0018/0020 に従い admin ロールのみ更新可。旧来の本人チェックを廃止。
  router.patch(
    "/:id",
    requireAuth,
    requireAdmin,
    validateBody(UpdateEmployeeSchema),
    (req, res, next) => {
      const { id } = req.params as { id: string };
      const input = req.body as UpdateEmployeeInput;
      employeeRepository
        .update(id, input)
        .then((employee) => {
          const result = employee ? ok(employee) : err(notFound("EmployeeNotFound"));
          if (isErr(result)) { resultToResponse(res, result); return; }
          res.status(200).json(result.value);
        })
        .catch(next);
    },
  );

  return router;
}
