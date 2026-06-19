import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import type { IAuditLog } from "../../application/interfaces/audit-log.interface";

export const auditLogAdapter: IAuditLog = auditLogService;
