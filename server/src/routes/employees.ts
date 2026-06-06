import { ForbiddenError, NotFoundError, UpdateEmployeeSchema, type UpdateEmployeeInput } from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { EmployeeRepository } from "../persistence/employeeRepository.js";

export function createEmployeesRouter(employeeRepository: EmployeeRepository): Router {
  const router = Router();

  router.patch(
    "/:id",
    requireAuth,
    validateBody(UpdateEmployeeSchema),
    (req, res, next) => {
      const { id } = req.params as { id: string };
      const user = req.user!;

      if (user.employeeId !== id) {
        next(new ForbiddenError("Forbidden"));
        return;
      }

      const input = req.body as UpdateEmployeeInput;
      employeeRepository
        .update(id, input)
        .then((employee) => {
          if (!employee) {
            throw new NotFoundError("EmployeeNotFound");
          }
          res.status(200).json(employee);
        })
        .catch(next);
    },
  );

  return router;
}
