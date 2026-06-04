import { Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

export const AuthLayout = (): ReactElement => {
  return <Outlet />;
};
