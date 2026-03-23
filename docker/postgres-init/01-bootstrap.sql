DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'identity_app') THEN
    CREATE ROLE identity_app LOGIN PASSWORD 'identity_password';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'survey_app') THEN
    CREATE ROLE survey_app LOGIN PASSWORD 'survey_password';
  END IF;
END
$$;

ALTER ROLE "user" CREATEDB;
CREATE DATABASE survey_db OWNER "user";

GRANT CONNECT ON DATABASE identity_db TO identity_app;
GRANT CONNECT ON DATABASE survey_db TO survey_app;
