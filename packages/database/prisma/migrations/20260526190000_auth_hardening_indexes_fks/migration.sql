-- CreateIndex
CREATE INDEX "invitations_invitedByUserId_idx" ON "invitations"("invitedByUserId");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_type_verifiedAt_idx" ON "verification_tokens"("userId", "type", "verifiedAt");

-- CreateIndex
CREATE INDEX "audit_logs_severity_createdAt_idx" ON "audit_logs"("severity", "createdAt");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
