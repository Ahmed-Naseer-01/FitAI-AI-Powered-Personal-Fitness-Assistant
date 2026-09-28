// Point every test at the throwaway database created by globalSetup.
process.env.DATABASE_URL = 'file:./test.db'
process.env.SESSION_SECRET = 'test-secret-long-enough-for-jose-hs256'
