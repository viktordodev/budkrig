-- Local dev: create the least-privilege app role and the migration role
-- (ADR-0003). Coolify/production provisions these out of band.
-- The container's POSTGRES_USER (budkrig_app) is created by the image; here we
-- give it the right privileges and add the migrator.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'budkrig_migrator') THEN
    CREATE ROLE budkrig_migrator LOGIN PASSWORD 'migrate';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE budkrig TO budkrig_migrator;

-- app role: DML only, no DDL. Applied to future tables via default privileges
-- owned by the migrator.
ALTER DEFAULT PRIVILEGES FOR ROLE budkrig_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO budkrig_app;
ALTER DEFAULT PRIVILEGES FOR ROLE budkrig_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO budkrig_app;

GRANT USAGE ON SCHEMA public TO budkrig_app;
