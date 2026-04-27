-- PAY-06: Enforce non-negative balance at the database level so any direct SQL
-- bypass of the optimistic `gte: amount` guard fails immediately.
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_nonneg" CHECK ("balance" >= 0);
