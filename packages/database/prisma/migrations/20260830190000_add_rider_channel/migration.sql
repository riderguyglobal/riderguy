-- Distinguish independent/third-party riders from RiderGuy-trained in-house riders.
CREATE TYPE "RiderChannel" AS ENUM ('GUEST', 'IN_HOUSE');

ALTER TABLE "rider_profiles"
ADD COLUMN "riderChannel" "RiderChannel";
