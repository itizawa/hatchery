-- #662: Claude API キー管理を環境変数（ANTHROPIC_API_KEY）に一本化し、DB 永続化を廃止。
DROP TABLE IF EXISTS "AppSetting";
