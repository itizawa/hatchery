import { useMediaQuery, useTheme } from "../components/uiParts/index.js";

export function useIsMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("md"));
}
